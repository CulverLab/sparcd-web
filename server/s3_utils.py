""" Utilities to help with S3 access """

import json
import os
import tempfile
from typing import Callable, Union
from urllib.parse import urlparse

from cryptography.fernet import InvalidToken

from minio import Minio, S3Error
from minio.commonconfig import CopySource
from minio.deleteobjects import DeleteObject
from minio.error import MinioException

from sparcd_file_utils import load_timed_info, save_timed_info
from spd_types.s3info import S3Info
from s3.s3_admin import S3AdminConnection
from s3.s3_access_helpers import (find_settings_bucket, make_s3_path, COLLECTIONS_FOLDER,
                                    SPARCD_PREFIX, S3_UPLOADS_PATH_PART)
from s3.s3_connect import s3_connect


def __check_bucket_read(minio: Minio, bucket: str) -> Union[bool, None]:
    """ Checks if the user has read bucket permissions
    Arguments:
        minio: the s3 client to access
        bucket: the name of the bucket to check
    Return:
        Returns True if the user can read the bucket, False if they cannot,
        and None if a problem occurred
    """
    try:
        objects = minio.list_objects(bucket, recursive=True)
        for obj in objects:
            if obj.is_dir:
                continue

            minio.stat_object(bucket, obj.object_name)
            break
    except StopIteration:
        # Bucket is empty but listing succeeded
        pass
    except S3Error as ex:
        if ex.code in ('AccessDenied', 'NoSuchBucket'):
            return False

        raise ex

    return True


def __files_copy(minio: Minio, source_bucket: str, source_path: str, dest_bucket: str,
                                                                get_dest_path: Callable) -> None:
    """ Copies the files recursively from the source to the destination
    Arguments:
        minio: the s3 client to access
        source_bucket: the bucket to get the objects from
        source_path: the top-level starting path in the source_bucket
        dest_bucket: the bucket to put the objects to
        get_dest_path: the top-level path in which to move the objects to
    Return:
        Returns True if successful and False if not
    """
    for cur_obj in minio.list_objects(source_bucket, source_path, recursive=True):
        if cur_obj.is_dir:
            continue

        minio.copy_object(dest_bucket, get_dest_path(cur_obj.object_name),
                            CopySource(source_bucket, cur_obj.object_name)
                            )


def __files_remove(minio: Minio, bucket: str, path: str) -> bool:
    """ Deletes the files recursively from the source to the destination
    Arguments:
        minio: the s3 client to access
        bucket: the bucket to remove objects from
        path: the top-level starting path in the bucket
    Return:
        Returns True if successful and False if not
    """
    # Make sure we have a path that looks like it could be correct
    if not COLLECTIONS_FOLDER in path or not S3_UPLOADS_PATH_PART in path:
        return False
    if path.endswith(S3_UPLOADS_PATH_PART) or path.endswith(S3_UPLOADS_PATH_PART[:-1]):
        return False

    # Remove objects
    remove_dirs = []
    for cur_obj in minio.list_objects(bucket, path, recursive=True):
        if cur_obj.is_dir:
            remove_dirs.append(DeleteObject(cur_obj.object_name))
            continue

        minio.remove_object(bucket, cur_obj.object_name)

    # Remove folders
    minio.remove_objects(bucket, remove_dirs)

    return True


def __test_copy_access(minio: Minio, source_bucket: str, source_path: str,
                                                dest_bucket: str, get_dest_path: Callable) -> bool:
    """ Tests whether or not a copy can succeed
    Arguments:
        minio: the s3 client to access
        source_bucket: the bucket to get the objects from
        source_path: the top-level starting path in the source_bucket
        dest_bucket: the bucket to put the objects to
        get_dest_path: called to return the destination path
    Return:
        Return True if the tests succeed and False if not
    Notes:
        Attempts to read from the source path. Also creates a small temporary file on the
        destination which is immediately deleted. Failure to read from the source, or write
        and delete on the destination results in a False return.

        Exceptions are reported here
    """
    try:
        bucket_res = __check_bucket_read(minio, source_bucket)
        if bucket_res is False:
            return 'Unable to read source bucket'
    except MinioException as ex:
        print('ERROR: __test_copy_access: READ: Caught S3 exception: src: ' \
                    f'{source_bucket}:{source_path} dst: {dest_bucket}', flush=True)
        print(ex, flush=True)
        return False

    # Try moving the first object to make sure we have destination write
    cur_obj = None
    for obj in minio.list_objects(source_bucket, source_path):
        if obj.is_dir:
            continue

        cur_obj = obj
        break

    # If there are no object to test the move on
    if not cur_obj:
        return True

    test_path = make_s3_path((get_dest_path(cur_obj.object_name) ))

    try:
        minio.copy_object(dest_bucket, test_path,
                            CopySource(source_bucket, cur_obj.object_name)
                        )
        minio.remove_object(dest_bucket, test_path)
    except S3Error as ex:
        if ex.code in ('AccessDenied', 'NoSuchBucket'):
            return "Write permission to the destination is missing"

        print('ERROR: __test_copy_access: COPY: Caught S3 exception: src: ' \
                    f'{source_bucket}:{source_path} dst: {dest_bucket}', flush=True)
        print(ex, flush=True)
        return False

    return True


def collection_id_exists(s3_info: S3Info, coll_id: str) -> bool:
    """ Checks if the collection ID is an actual collection ID and if it exists
    Arguments:
        s3_info: connection information for the S3 instance
        coll_id: the collection ID (also handles SPARCD buckets)
    Return:
        Returns True if the ID is a collection ID and it exists
    """
    working_bucket = coll_id if coll_id.startswith(SPARCD_PREFIX) else f'{SPARCD_PREFIX}{coll_id}'

    minio = s3_connect(s3_info)

    return minio.bucket_exists(working_bucket)


def web_to_s3_url(url: str, decrypt: Callable) -> tuple:
    """ Takes a web URL and converts it to something Minio can handle: converts
        http and https to port numbers
    Arguments:
        url: the URL to convert
        decrypt: function to call if needing to decrypt the url
    Return:
        Returns a tuple containing the URL that can be used to access minio, and a boolean
        value where True indicates a secure connection should be used, and False if an insecure
        connection should be used
    Notes:
        If http or https is specified, any existing port number will be replaced.
        Any params, queries, and fragments are not kept
        The return url may be the same one passed in if it doesn't need changing.
    """
    use_secure = True

    # Check for encrypted URLs
    if not url.lower().startswith('http'):
        try:
            cur_url = decrypt(url)
            url = cur_url
        except InvalidToken:
            # Don't know what we have, just return it
            return url, True

    # It's encrypted but not an http(s) url
    if not url.lower().startswith('http'):
        use_secure = not url.endswith(':80')
        return url, use_secure

    parsed = urlparse(url)
    if not parsed.port:
        port = '80'
        if parsed.scheme.lower() == 'https':
            port = '443'
    else:
        port = str(parsed.port)

    if parsed.scheme.lower() == 'http':
        use_secure = False

    return parsed.hostname + ':' + port, use_secure


def get_s3_info(url: str, access_key: str, secret_key: Union[str, Callable], \
                                                                    decrypt: Callable) -> S3Info:
    """ Returns an instance of S3 connection information
    Arguments:
        url: the URL to convert
        access_key: the key used to access the S3 instance (e.g. username)
        secret_key: the secret associated with the login name, or a parameter-less function
                    that returns the secret
        decrypt: function to call if needing to decrypt the url
    Return:
        An instance fo the S3 connection info
    """
    s3_uri, s3_secure = web_to_s3_url(url, decrypt)

    return S3Info(s3_uri, access_key, secret_key, s3_secure)

def sparcd_config_exists(minio: Minio) -> bool:
    """ Checks that SPARCd is setup at the endpoint
    Arguments:
        url: the URL to the S3 store
        user: the S3 username
        fetch_password: returns the S3 password
    Return:
        Returns True if there is a configuration on the S3 endpoint and False if not
    """
    settings_bucket = find_settings_bucket(minio)

    return settings_bucket is not None


def load_sparcd_config(sparcd_file: str, timed_file: str, s3_info: S3Info):
    """ Attempts to load the configuration information from either the timed_file or download it
        from S3. If downloaded from S3, it's saved as a timed file
    Arguments:
        sparcd_file: the name of the sparcd configuration file
        timed_file: the name of the timed file to attempt loading from
        s3_info: the information for connecting to the S3 endpoint
    Return:
        Returns the loaded configuration information or None if there's a
        problem
    """
    config_file_path = os.path.join(tempfile.gettempdir(), timed_file)
    loaded_config = load_timed_info(config_file_path)
    if loaded_config:
        return loaded_config

    # Try to get the configuration information from S3
    loaded_config = S3AdminConnection.get_configuration(s3_info, sparcd_file)
    if loaded_config is None:
        return None

    try:
        loaded_config = json.loads(loaded_config)
        save_timed_info(config_file_path, loaded_config)
    except ValueError as ex:
        print(f'Invalid JSON from configuration file {sparcd_file}')
        print(ex)
        loaded_config = None

    return loaded_config


def save_sparcd_config(config_data, sparcd_file: str, timed_file: str, s3_info: S3Info) -> None:
    """ Saves the species on S3 and locally
    Arguments:
        config_data: the data to save
        sparcd_file: the name of the sparcd configuration file
        timed_file: the name of the timed file to save to
        s3_info: the information for connecting to the S3 endpoint
    """
    # Save to S3 and the local file system
    S3AdminConnection.put_configuration(s3_info, sparcd_file, json.dumps(config_data, indent=4))

    config_file_path = os.path.join(tempfile.gettempdir(), timed_file)
    save_timed_info(config_file_path, config_data)


def move_upload(s3_info: S3Info, source_bucket: str, dest_bucket: str, source_path: str,
                                                    get_dest_path: Callable) -> Union[bool, str]:
    """ Moves the objects starting at the specified path from the source bucket to the
        destination bucket preserving their paths
    Arguments:
        s3_info: the S3 connection information
        source_bucket: the bucket to get the objects from
        dest_bucket: the bucket to put the objects to
        source_path: the top-level starting path in the source_bucket
        get_dest_path: formats the destination path from the source path
    Return:
        Returns True if the data was moved and False if it wasn't. Returns None if there was no
        data to move
    Notes:
        All the data is copied, and then the data is removed from the source if the copy was
        completely successful
    """
    minio = s3_connect(s3_info)

    # Perform checks
    if not minio.bucket_exists(source_bucket) or not minio.bucket_exists(dest_bucket):
        return False

    # Make sure we can access the buckets for reading at least
    if not __test_copy_access(minio, source_bucket, source_path, dest_bucket, get_dest_path):
        return False

    # Perform the complete copy
    try:
        __files_copy(minio, source_bucket, source_path, dest_bucket, get_dest_path)
    except S3Error as ex:
        print(f'ERROR: move_upload: Caught S3 exception while copying: ' \
                f'src: {source_bucket}:{source_path} dst: {dest_bucket}', flush=True)
        print(ex, flush=True)
        return False

    # Remove the source files
    #try:
    #    __files_remove(minio, source_bucket, source_path)
    #except S3Error as ex:
    #    print('ERROR: move_upload: Caught S3 exception while deleteing: ' \
    #                                                f'{source_bucket}:{source_path}', flush=True)
    #    print(ex, flush=True)
    #    return False

    return True
