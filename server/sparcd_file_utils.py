""" Functions for handling common files """

import datetime
import hashlib
import json
import os
import time
from typing import Optional


# Maximum number of times to try updating a temporary file
TEMP_FILE_MAX_WRITE_TRIES = 7
# Number of seconds to keep the temporary file around before it's invalid
TEMP_FILE_EXPIRE_SEC = 1 * 60 * 60


def save_timed_info(save_path: str, data, num_retries: int=TEMP_FILE_MAX_WRITE_TRIES) -> None:
    """ Attempts to save information to a file with a timestamp
    Arguments:
        save_path: the path to the save file
        data: the data to save with a timestamp
        num_retries: optional parameter for the number of times to retry writing the data out
    Note:
        If the file is locked, this function sleeps for a second until
        the max retries is reached
    """
    # pylint: disable=broad-exception-caught
    if os.path.exists(save_path):
        try:
            os.unlink(save_path)
        except Exception as ex:
            print(f'Unable to remove old temporaryfile: {save_path}')
            print(ex)
            print('Continuing to try updating the file')

    attempts = 0
    informed_exception = False
    save_info = {'timestamp':datetime.datetime.now(datetime.UTC).isoformat(),
                 'data':data
                }
    while attempts < num_retries:
        try:
            with open(save_path, 'w', encoding='utf-8') as outfile:
                outfile.write(json.dumps(save_info))
            attempts = num_retries
        except Exception as ex:
            if not informed_exception:
                print(f'Unable to open temporary file for writing: {save_path}')
                print(ex)
                print(f'Will keep trying for up to {TEMP_FILE_MAX_WRITE_TRIES} times')
                informed_exception = True
                time.sleep(1)
            attempts = attempts + 1


def load_timed_info(load_path: str, timeout_sec: int=TEMP_FILE_EXPIRE_SEC):
    """ Loads the timed data from the specified file
    Arguments:
        load_path: the path to load data from
        timeout_sec: the timeout length of the file contents
    Return:
        The loaded data or None if a problem occurs
    """
    # pylint: disable=broad-exception-caught
    loaded_data = None

    if not os.path.exists(load_path):
        return None

    with open(load_path, 'r', encoding='utf-8') as infile:
        try:
            loaded_data = json.loads(infile.read())
        except json.JSONDecodeError as ex:
            infile.close()
            print(f'WARN: Timed file has invalid contents: {load_path}')
            print(ex)
            print('      Removing invalid file')
            try:
                os.unlink(load_path)
            except Exception as ex_2:
                print(f'Unable to remove bad timed file: {load_path}')
                print(ex_2)

            return None

    # Check if the contents are too old
    if not isinstance(loaded_data, dict) or 'timestamp' not in loaded_data or \
                                                    not loaded_data['timestamp']:
        print(f'WARN: Timed file has missing contents: {load_path}')
        print('      Removing invalid file')
        try:
            os.unlink(load_path)
        except Exception as ex:
            print(f'Unable to remove invalid timed file: {load_path}')
            print(ex)
        return None

    old_ts = datetime.datetime.fromisoformat(loaded_data['timestamp'])
    ts_diff = datetime.datetime.now(datetime.UTC) - old_ts

    if ts_diff.total_seconds() > timeout_sec:
        print(f'INFO: Expired timed file {load_path}')
        try:
            os.unlink(load_path)
        except Exception as ex:
            print(f'Unable to remove expired timed file: {load_path}')
            print(ex)
        return None

    return loaded_data['data']


def file_checksum(file_path: str) -> Optional[str]:
    """ Calculates the checksum for the file
    Arguments:
        file_path: the path to the file to calculate the checksum for
    Return:
        The checksum is returned if the file exists and can be read. None is returned otherwise
    """
    if os.path.exists(file_path):
        try:
            hash_md5 = hashlib.md5()
            with open(file_path, "rb") as ifile:
                for chunk in iter(lambda: ifile.read(4096), b""):
                    hash_md5.update(chunk)
            return hash_md5.hexdigest()
        except PermissionError:
            print(f'Unable to read file for checksum: {file_path}', flush=True)
        finally:
            pass

    return None
