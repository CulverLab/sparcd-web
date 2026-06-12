""" Route decorators for SPARCd server """
import functools
from typing import Callable
from flask import request
from sparcd_db import SPARCdDatabase
from spd_types.userinfo import UserInfo
from spd_types.s3info import S3Info
import sparcd_utils as sdu


def make_authenticated_route(db_path: str, db_sandbox_path: str, session_expire_seconds: int,
                             get_s3_info: Callable[[str, SPARCdDatabase, UserInfo], S3Info]):
    """ Factory function that returns a route authentication decorator.
    Args:
        db_path: path to the SPARCd database
        db_sandbox_path: path to the SPARCD Sandbox database
        session_expire_seconds: number of seconds before a session expires
        get_s3_info: callable that returns S3Info for the current user
    Returns:
        A decorator that handles auth boilerplate for route handlers,
        injecting `db`, `token`, `user_info`, and `s3_info` as keyword arguments.
        Route handlers may declare only the parameters they need and use **_
        to absorb the rest.
    """
    def authenticated_route(admin_only: bool = False, non_admin_only: bool = False,
                            eager_password: bool = False):
        """ Route handling function
        Arguments:
            admin_only: set to True if the user needs to be an admin
            non_admin_only: set to True if the user should not be an admin
            eager_password: set to True to have the password generated ahead of time instead of
                        just-in-time
        Return:
            Returns the route decorator function
        """
        def decorator(func):
            """ The decorator function
            Arguments:
                func: The function to call with the added parameters
            Return:
                Returns the results of the function
            """
            @functools.wraps(func)
            def wrapper(*args, **kwargs):
                """ Handles the authentication and calls the handling function
                Return:
                    Returns the result of calling the function, or error codes
                    upon failure
                """
                db = SPARCdDatabase(db_path, db_sandbox_path)
                token = request.args.get('t')
                token_valid, user_info = sdu.token_user_valid(db, request, token,
                                                              session_expire_seconds)
                if token_valid is None or user_info is None:
                    return 'Not Found', 404
                if not token_valid or not user_info:
                    return 'Unauthorized', 401
                if admin_only and not bool(user_info.admin):
                    return 'Not Found', 404
                if non_admin_only and bool(user_info.admin):
                    return 'Not Found', 404
                s3_info = get_s3_info(token, db, user_info, eager_password)
                injected = {'db': db, 'token': token, 'user_info': user_info,
                            's3_info': s3_info}
                return func(*args, **{**injected, **kwargs})
            return wrapper
        return decorator
    return authenticated_route
