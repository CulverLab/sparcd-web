""" Core utility functions for SPARCd server """

import hashlib
import json
import math
import os
from typing import Optional

from flask import request

from sparcd_db import SPARCdDatabase


def make_boolean(value) -> bool:
    """ Converts the parameter to a boolean value
    Arguments:
        value: The value to convert
    Return:
        Returns the boolean equivalent of the value
    Notes:
        Boolean values are returned as is. Strings that are "true" or "false" are converted
        to their boolean equivalent and returned, regardless of case.  Otherwise, the
        truthy-ness of the value is returned as defined by Python
    """
    if isinstance(value, bool):
        return value

    if isinstance(value, str):
        if value.lower() == 'true':
            return True
        if value.lower() == 'false':
            return False

    if value:
        return True

    return False


def secure_email(email: str) -> Optional[str]:
    """ Secures the email address by replacing characters with asterisks while
        retaining legibility
    Arguments:
        email: the email to secure
    Return:
        Returns the secured email. None is returned if the email parameter is None
    """
    if email is None:
        return None

    if '@' in email:
        first_part = email[:email.index('@')]
        second_part = email[email.index('@'):]
    else:
        first_part = email[:max(1, math.floor(len(email) / 2))]
        second_part = email[max(1, math.ceil(len(email) / 2)):]

    match len(first_part):
        case 1:
            pass
        case 2:
            first_part = first_part[:1] + '*'
        case 3:
            first_part = first_part[:2] + '*'
        case 4:
            first_part = first_part[:3] + '*'
        case _:
            first_part = first_part[:3] + '*' * (min(7, len(first_part) - 3))

    return first_part + second_part


def secure_user_settings(settings: dict) -> dict:
    """ Secures the user settings information
    Arguments:
        settings: the user settings
    Return:
        The secured user settings
    """
    if isinstance(settings, str):
        cur_settings = json.loads(settings)
    else:
        cur_settings = settings

    if 'email' in cur_settings and cur_settings['email'] and len(cur_settings['email']) > 2:
        cur_settings['email'] = secure_email(cur_settings['email'])

    return cur_settings


def cleanup_old_queries(db: SPARCdDatabase, token: str) -> None:
    """ Cleans up old queries off the file system
    Arguments:
        db: connections to the current database
        token: the session token used to identify queries to clean up
    """
    expired_queries = db.get_clear_queries(token)
    if expired_queries:
        for one_query_path in expired_queries:
            if os.path.exists(one_query_path):
                try:
                    os.unlink(one_query_path)
                # pylint: disable=broad-exception-caught
                except Exception as ex:
                    print(f'Unable to remove old query file: {one_query_path}')
                    print(ex)


def token_is_valid(token: str, client_ip: str, user_agent: str, db: SPARCdDatabase,
                   expire_seconds: int) -> tuple:
    """Checks the database for a token and then checks the validity
    Arguments:
        token: the token to check
        client_ip: the client IP to check (use '*' to skip IP check)
        user_agent: the user agent value to check
        db: the database storing the token
        expire_seconds: the session expiration timeout
    Returns:
        Returns True if the token is valid and False if not
    """
    login_info, elapsed_sec = db.get_token_user_info(token)
    if login_info is not None and elapsed_sec is not None:
        if login_info.settings:
            login_info.settings = json.loads(login_info.settings)
        if login_info.species:
            login_info.species = json.loads(login_info.species)

        if abs(int(elapsed_sec)) < expire_seconds and \
           client_ip.rstrip('/') in (login_info.client_ip.rstrip('/'), '*') and \
           login_info.user_agent == user_agent:
            db.update_token_timestamp(token)
            return True, login_info

    return False, None


def token_user_valid(db: SPARCdDatabase, req, token: str, session_expire_sec: int) -> tuple:
    """ Checks that the token and user are valid
    Arguments:
        db: the database to access
        req: the incoming request environment
        token: the user request token
        session_expire_sec: the number of seconds before the session is considered expired
    Return:
        Returns a tuple with the first boolean value indicating if the token is valid, and the
        second value containing the loaded user information. None is returned for each of these
        values if there is an issue
    """
    if not db or not req or not token or not session_expire_sec:
        return None, None

    client_ip = req.environ.get('HTTP_X_FORWARDED_FOR', req.environ.get('HTTP_ORIGIN',
                                req.environ.get('HTTP_REFERER', req.remote_addr)))
    client_user_agent = req.environ.get('HTTP_USER_AGENT', None)
    if not client_ip or not client_user_agent:
        return None, None

    user_agent_hash = hashlib.sha256(client_user_agent.encode('utf-8')).hexdigest()
    return token_is_valid(token, client_ip, user_agent_hash, db, session_expire_sec)


def get_request_files() -> Optional[list]:
    """ Gets all the request file json for a request
    Return:
        The JSON object as described in the request (all file parameters are combined), or None if
        there's a problem - such as files not being found, or not being JSON strings, or multiple
        file parameters not being able to be combined
    """
    all_files = request.form.get('files')
    if not all_files:
        return None

    all_files = all_files.splitlines()

    req_index = 1
    while True:
        more_files = request.form.get(f'files{req_index}')
        if not more_files:
            break

        all_files.extend(more_files.splitlines())
        req_index += 1

    return all_files
