"""This script contains the definition of connection information for S3
"""

from collections.abc import Callable
import hashlib
from typing import Union

class S3Info:
    """ Class containing S3 connection information
    """

    # pylint: disable=too-many-arguments, too-many-positional-arguments
    def __init__(self, uri: str, access_key: str, secret_key: Union[str, Callable], \
                      secure: bool=True, s3_id: str=None):
        """ Initialize an instance
        Arguments:
            uri: the endpoint URL/URI for access
            access_key: the login name to use
            secret_key: the secret associated with the login name, or a parameter-less function
                        that returns the secret. If a function and it is expensive to run, consider
                        setting a plain text secret key since the function will be run each time
                        the password is requested
            secure: set to False if running over http, and set to True (default) otherwise
            s3_id: unique ID for the S3 URI. If None, the ID is derived from the URI. The same ID
                   is derived for every same URI. e.g.: '123456' is the ID for every URI that's
                   'ABCDEF'
        """
        self.__uri = uri
        self.__access_key = access_key
        self.__secret_key = secret_key
        self.__secure = secure
        self.__id = s3_id

    def __str__(self):
        """ Return a string represenation
        """
        return f'URI: {self.__uri}, access key: {self.__access_key}, secret: ***, ' \
                                                                            'secure: {self.secure}'

    @property
    def uri(self):
        """ Returns the instance's uri """
        return self.__uri

    @property
    def access_key(self):
        """ Returns the instance's access key """
        return self.__access_key

    @property
    def secret_key(self):
        """ Returns the instance's secret key """
        if callable(self.__secret_key):
            try:
                cur_pw = self.__secret_key()
                self.__secret_key = cur_pw
                return cur_pw
            except TypeError:
                pass

        return self.__secret_key

    @property
    def secure(self):
        """ Returns the instance's secure """
        return self.__secure

    @property
    def id(self):
        """ Returns the unique identifier derived from the S3 URI (has the same ID for same URI) """
        if self.__id is None:
            self.__id = hashlib.md5(self.__uri.encode('utf-8')).hexdigest()
        return self.__id
