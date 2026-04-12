""" Zip utilities """

from multiprocessing import Lock, synchronize
import os
import shutil
import tempfile
import threading
import time
import zipfile

from spd_types.s3info import S3Info
from s3_access import S3Connection, SPARCD_PREFIX, S3_UPLOADS_PATH_PART


def zip_downloaded_files(write_fd: int, file_list: list, \
                            files_lock: synchronize.Lock, done_sem: threading.Semaphore, \
                            save_folder: str) -> None:
    """ Compresses the downloaded files and streams the data into the data pipe
    Arguments:
        write_pipe: the pipe to use for the zipping output
        file_list: the list of files to compress
        files_lock: the lock access to the list of files
        done_sem: the lock indicating the downloads have completed
        save_folder: the base folder where the downloads are being saved. Use for relative
                    path names
    """
    if not save_folder.endswith(os.path.sep):
        save_folder += os.path.sep

    with os.fdopen(write_fd, 'wb') as zip_out:
        with zipfile.ZipFile(zip_out, mode='w', compression=zipfile.ZIP_BZIP2, \
                                                                    compresslevel=2) as compressed:
            lock_acquired = False
            while True:
                next_file = None

                # Only get the lock one time
                if not lock_acquired:
                    files_lock.acquire()
                    lock_acquired = True

                # Get the next file to work on and relase the lock if we don't have too
                # many files queued up already
                try:
                    # Check if all the files have been downloaded
                    if len(file_list) == 0:
                        # Release the lock on file list
                        if lock_acquired:
                            files_lock.release()
                            lock_acquired = False

                        # Check if we hit a download lull or we're done
                        if done_sem.acquire(blocking=False, timeout=None):
                            done_sem.release()
                            break

                        # Not done yet, wait for a little
                        time.sleep(0.5)
                        continue

                    # Grab the next file
                    next_file, _, _ = file_list.pop(0) # unused next_bucket, next_s3_path
                finally:
                    # We hold onto the list lock if there's a bunch of files downloaded already.
                    # This will allow us to catch up
                    if len(file_list) < 200 and lock_acquired:
                        files_lock.release()
                        lock_acquired = False

                if not next_file:
                    continue

                compressed.write(next_file, next_file[len(save_folder):])

                os.unlink(next_file)

    # Remove the downloading folder
    shutil.rmtree(save_folder)


def gzip_cb(info: tuple, bucket: str, s3_path: str, local_path: str):
    """ Handles the downloaded file as part of the GZIP creation
    Arguments:
        info: additional information from the calling function
        bucket: the bucket downloaded from
        s3_path: the S3 path of the downloaded file
        local_path: where the data is locally
    """
    # Check for being done and indicate that we're done
    if bucket is None:
        finish_lock = info[2]
        finish_lock.release()

    # Add our file information to the list
    file_list = info[0]
    list_lock = info[1]

    # Add our file to the list
    list_lock.acquire()
    try:
        file_list.append((local_path, bucket, s3_path))
    finally:
        list_lock.release()


def get_zip_dl_info(file_str: str) -> tuple:
    """ Returns the file information for downloading purposes
    Arguments:
        file_str: the file path information to split apart
    Return:
        A tuple containing the bucket, S3 path, and target file
    """
    bucket, s3_path = file_str.split(':')
    upload_search_str = f'/{S3_UPLOADS_PATH_PART}'
    if upload_search_str in s3_path:
        target_path = s3_path[s3_path.index(upload_search_str)+len(upload_search_str):]
    else:
        target_path = s3_path

    return bucket, s3_path, target_path


def generate_zip(s3_info: S3Info, s3_files: tuple, \
                 							write_fd: int, done_sem: threading.Semaphore) -> None:
    """ Creates a gz file containing the images
    Arguments:
        s3_info: the information on the S3 endpoint
        s3_files: the list of files to compress in the format of bucket:path
        write_pipe: the pipe to write the ZIP data to
        done_sem: the lock indicating the last file has been downloaded
    Returns:
        The contents of the compressed files
    """
    # This folder is removed in zip_downloaded_files
    save_folder = tempfile.mkdtemp(prefix=SPARCD_PREFIX + 'gz_')
    downloaded_files = []
    download_files_lock = Lock()

    zip_thread = threading.Thread(target=zip_downloaded_files,
                          args=(write_fd, downloaded_files, download_files_lock, done_sem, \
                                                                                        save_folder)
                         )
    zip_thread.start()

    S3Connection.download_images_cb(s3_info,
                                        [get_zip_dl_info(one_file) for one_file in s3_files],
                                        save_folder, gzip_cb,
                                        (downloaded_files, download_files_lock, done_sem))

def zip_iterator(read_fd: int):
    """ Reads the data in the pipe and yields it
    Arguments:
        read_conn: the reading pipe to read from
    """
    with os.fdopen(read_fd, 'rb') as zip_in:
        while True:
            data = zip_in.read(1024)
            if not data:
                break
            yield data
