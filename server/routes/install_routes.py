""" Installation and repair routes for SPARCd server """

from flask import Blueprint
from flask_cors import cross_origin

import handlers.install as hinstall
from sparcd_config import authenticated_route, make_handler_response
from sparcd_env import ALLOWED_ORIGINS, DEFAULT_SETTINGS_PATH

install_bp = Blueprint('install', __name__)


@install_bp.route('/installCheck', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def new_install_check(*, db, user_info, s3_info, **_):
    """ Checks if the S3 endpoint can support a new SPARCd installation
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON object containing the results of the installation check
        401: if the session token is invalid or expired
        404: if the check cannot be completed
        406: if the request is malformed
    """
    print(f'NEW INSTALL CHECK user={user_info.name}', flush=True)

    return make_handler_response(hinstall.handle_new_install_check(db, user_info, s3_info))


@install_bp.route('/installNew', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def install_new(*, db, user_info, s3_info, **_):
    """ Attempts to create a new SPARCd installation on the S3 endpoint
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON object indicating success
        401: if the session token is invalid or expired
        404: if the installation cannot be completed
        406: if the request is malformed or the S3 endpoint cannot support a new installation
    Notes:
        Uses the default settings path to populate the new installation with
        template configuration files
    """
    print(f'NEW INSTALL user={user_info.name}', flush=True)

    return make_handler_response(hinstall.handle_new_install(db, user_info, s3_info,
                                                             DEFAULT_SETTINGS_PATH))


@install_bp.route('/installRepair', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def install_repair(*, user_info, s3_info, **_):
    """ Attempts to repair an existing SPARCd installation on the S3 endpoint
    Arguments:
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON object indicating success
        401: if the session token is invalid or expired
        404: if the repair cannot be completed
        406: if the request is malformed or the S3 endpoint cannot be repaired
    Notes:
        Uses the default settings path to restore any missing template
        configuration files
    """
    print(f'REPAIR INSTALL user={user_info.name}', flush=True)

    return make_handler_response(hinstall.handle_repair_install(user_info, s3_info,
                                                                DEFAULT_SETTINGS_PATH))
