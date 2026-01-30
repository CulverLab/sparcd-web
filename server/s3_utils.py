""" Utilities to help with S3 access """

import json
import os
import tempfile
from typing import Callable
from urllib.parse import urlparse

from cryptography.fernet import InvalidToken

from minio import Minio

from sparcd_file_utils import load_timed_info, save_timed_info
from s3_access import S3Connection, find_settings_bucket



def web_to_s3_url(url: str, decrypt: Callable) -> str:
    """ Takes a web URL and converts it to something Minio can handle: converts
        http and https to port numbers
    Arguments:
        url: the URL to convert
        decrypt: function to call if needing to decrypt the url
    Return:
        Returns a URL that can be used to access minio
    Notes:
        If http or https is specified, any existing port number will be replaced.
        Any params, queries, and fragments are not kept
        The return url may be the same one passed in if it doesn't need changing.
    """
    # Check for encrypted URLs
    if not url.lower().startswith('http'):
        try:
            cur_url = decrypt(url)
            url = cur_url
        except InvalidToken:
            # Don't know what we have, just return it
            return url

    # It's encrypted but not an http(s) url
    if not url.lower().startswith('http'):
        return url

    parsed = urlparse(url)
    port = '80'
    if parsed.scheme.lower() == 'https':
        port = '443'

    return parsed.hostname + ':' + port


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


def load_sparcd_config(sparcd_file: str, timed_file: str, url: str, user: str, \
                                                            fetch_password: Callable):
    """ Attempts to load the configuration information from either the timed_file or download it
        from S3. If downloaded from S3, it's saved as a timed file
    Arguments:
        sparcd_file: the name of the sparcd configuration file
        timed_file: the name of the timed file to attempt loading from
        url: the URL to the S3 store
        user: the S3 username
        fetch_password: returns the S3 password
    Return:
        Returns the loaded configuration information or None if there's a
        problem
    """
    config_file_path = os.path.join(tempfile.gettempdir(), timed_file)
    loaded_config = load_timed_info(config_file_path)
    if loaded_config:
        return loaded_config

    # Try to get the configuration information from S3
    loaded_config = S3Connection.get_configuration(sparcd_file, url, user, fetch_password())
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


# pylint: disable=too-many-arguments,too-many-positional-arguments
def save_sparcd_config(config_data, sparcd_file: str, timed_file: str, url: str, user: str, \
                                                            fetch_password: Callable) -> None:
    """ Saves the species on S3 and locally
    Arguments:
        config_data: the data to save
        sparcd_file: the name of the sparcd configuration file
        timed_file: the name of the timed file to save to
        url: the URL to the S3 store
        user: the S3 username
        fetch_password: returns the S3 password
    """
    # Save to S3 and the local file system
    S3Connection.put_configuration(sparcd_file, json.dumps(config_data, indent=4), url, user,
                                                                                fetch_password())

    config_file_path = os.path.join(tempfile.gettempdir(), timed_file)
    save_timed_info(config_file_path, config_data)
