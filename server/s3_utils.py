""" Utilities to help with S3 access """

import json
import os
import tempfile
from typing import Callable, Union
from urllib.parse import urlparse

from cryptography.fernet import InvalidToken

from minio import Minio

from sparcd_file_utils import load_timed_info, save_timed_info
from spd_types.s3info import S3Info
from s3_access import S3Connection, find_settings_bucket



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
    loaded_config = S3Connection.get_configuration(s3_info, sparcd_file)
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
def save_sparcd_config(config_data, sparcd_file: str, timed_file: str, s3_info: S3Info) -> None:
    """ Saves the species on S3 and locally
    Arguments:
        config_data: the data to save
        sparcd_file: the name of the sparcd configuration file
        timed_file: the name of the timed file to save to
        s3_info: the information for connecting to the S3 endpoint
    """
    # Save to S3 and the local file system
    S3Connection.put_configuration(s3_info, sparcd_file, json.dumps(config_data, indent=4))

    config_file_path = os.path.join(tempfile.gettempdir(), timed_file)
    save_timed_info(config_file_path, config_data)
