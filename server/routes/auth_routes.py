""" Authentication and session routes for SPARCd server """

import hashlib

from flask import Blueprint, jsonify, make_response, request, Response
from flask_cors import cross_origin
import requests

import handlers.base as hbase
from sparcd_db import SPARCdDatabase
from sparcd_config import WORKING_PASSCODE, TEMP_SPECIES_FILE_NAME, \
                          IMAGE_BROWSER_CACHE_TIMEOUT_SEC, DEFAULT_IMAGE_FETCH_TIMEOUT_SEC, \
                          authenticated_route, get_s3_info, make_handler_response
from sparcd_env import ALLOWED_ORIGINS, DEFAULT_DB_PATH, DEFAULT_DB_SANDBOX_PATH, \
                       SESSION_EXPIRE_SECONDS
import sparcd_utils as sdu
import s3_utils as s3u
import spd_crypt as crypt

auth_bp = Blueprint('auth', __name__)


IS_ADMIN_BROWSER_CACHE_TIMEOUT_SEC = 10 * 60 # How long to cache whether user is admin or not

def __parse_range(range_header: str, object_size: int) -> tuple:
    """ Parses an HTTP Range header and returns (start, end) byte positions
    Arguments:
        range_header: the Range header value e.g. 'bytes=0-1023'
        object_size: the total size of the object in bytes
    Return:
        Returns a tuple of (start, end) where end is exclusive
    """
    ranges = range_header.strip().replace('bytes=', '')
    start_str, end_str = ranges.split('-')
    start = int(start_str) if start_str else 0
    end = (int(end_str) + 1) if end_str else object_size
    return start, min(end, object_size)


def __serve_image_stream(res: requests.Response) -> Response:
    """ Streams an image response progressively
    Arguments:
        res: the requests response object containing the image content
    """
    def generate():
        yield from res.iter_content(32 * 1024)

    response = Response(generate(), content_type=res.headers.get('Content-Type', 'image/jpeg'))
    response.headers.set('Cache-Control', f'private, max-age={IMAGE_BROWSER_CACHE_TIMEOUT_SEC}')
    return response


def __serve_video(res: requests.Response) -> Response:
    """ Serves a video response with range request support
    Arguments:
        res: the requests response object containing the video content
    """
    object_size = int(res.headers.get('Content-Length', 0))
    mimetype = res.headers.get('Content-Type', 'video/mp4')

    range_header = request.headers.get('Range')
    if range_header:
        start, end = __parse_range(range_header, object_size)
        content = res.content[start:end]
        response = Response(content, 206, content_type=mimetype)
        response.headers['Content-Range'] = f'bytes {start}-{end - 1}/{object_size}'
    else:
        response = Response(res.content, 200, content_type=mimetype)

    response.headers['Accept-Ranges'] = 'bytes'
    response.headers['Content-Length'] = object_size
    response.headers.set('Cache-Control', f'private, max-age={IMAGE_BROWSER_CACHE_TIMEOUT_SEC}')
    return response


@auth_bp.route('/login', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
def login_token():
    """ Returns a token representing the login
    Arguments: (POST)
        url - the S3 database URL
        user - the user name
        password - the user credentials
        token - the token to check for validity
    Returns:
        200: JSON object containing the session token and user information
        404: if the login credentials are invalid or the user cannot be found
    Notes:
        If a token is provided it is checked for expiration first. If the token
        is invalid, missing, or expired and valid credentials are provided, a new
        token is issued. The S3 ID is not yet known at login time so only the
        species file name without ID prefix is passed to the handler.
    """
    db = SPARCdDatabase(DEFAULT_DB_PATH, DEFAULT_DB_SANDBOX_PATH)
    print('LOGIN', flush=True)

    result = hbase.handle_login(db,
                                WORKING_PASSCODE,
                                SESSION_EXPIRE_SECONDS,
                                TEMP_SPECIES_FILE_NAME,
                                crypt.hash2str)
    if not result:
        return 'Not Found', 404

    return jsonify(result)


@auth_bp.route('/image', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
def image():
    """ Returns an image from S3 storage
    Arguments: (GET)
        t - the session token
        i - the encrypted key identifying the image
    Returns:
        200: the image content with browser cache headers set
        401: if the session token is invalid or expired
        404: if the user agent header is missing or the image cannot be found
    Notes:
        This route does not use authenticated_route because image requests may
        originate from any IP address (e.g. via browser image tags), so origin
        IP checking is deliberately skipped. The user agent is still validated
        as a basic sanity check on the request.
    """
    db = SPARCdDatabase(DEFAULT_DB_PATH, DEFAULT_DB_SANDBOX_PATH)
    token = request.args.get('t')
    print('IMAGE', request, flush=True)

    client_user_agent = request.environ.get('HTTP_USER_AGENT', None)
    if not client_user_agent:
        return 'Not Found', 404

    user_agent_hash = hashlib.sha256(client_user_agent.encode('utf-8')).hexdigest()

    # Wildcard IP allows requests from any origin since images are loaded via browser tags
    token_valid, user_info = sdu.token_is_valid(token, '*', user_agent_hash, db,
                                                SESSION_EXPIRE_SECONDS)
    if not token_valid or not user_info:
        return 'Unauthorized', 401

    s3_info = get_s3_info(token, db, user_info)
    res, ext = hbase.handle_image(db,
                             s3_info,
                             request.args.get('i'),
                             DEFAULT_IMAGE_FETCH_TIMEOUT_SEC,
                             WORKING_PASSCODE)

    if not res:
        return 'Not Found', 404

    if ext in ('.mp4', '.mov', '.avi'):
        return __serve_video(res)

    return __serve_image_stream(res)


@auth_bp.route('/settings', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def set_settings(*, db, user_info, s3_info, **_):
    """ Updates the authenticated user's application settings
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Form parameters:
        autonext - whether to automatically advance to the next image
        dateFormat - the preferred date display format
        measurementFormat - the preferred measurement unit format
        sandersonDirectory - the Sanderson output directory
        sandersonOutput - the Sanderson output format
        timeFormat - the preferred time display format
        coordinatesDisplay - the preferred coordinate display format
        email - the user's email address
    Returns:
        200: JSON object containing the updated user settings
        401: if the session token is invalid or expired
        404: if the request is malformed or the user cannot be found
    """
    print(f'SET SETTINGS user={user_info.name}', flush=True)

    new_settings = {
        'autonext': request.form.get('autonext'),
        'dateFormat': request.form.get('dateFormat'),
        'measurementFormat': request.form.get('measurementFormat'),
        'sandersonDirectory': request.form.get('sandersonDirectory'),
        'sandersonOutput': request.form.get('sandersonOutput'),
        'timeFormat': request.form.get('timeFormat'),
        'coordinatesDisplay': request.form.get('coordinatesDisplay')
    }
    new_email = request.form.get('email')

    user_info = hbase.handle_settings(db, user_info, s3_info, new_settings, new_email)
    return jsonify(user_info.settings)


@auth_bp.route('/adminCheck', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def admin_check(*, user_info, **_):
    """ Returns whether the authenticated user has administrator privileges
    Arguments:
        user_info: the authenticated user's information (injected by authenticated_route)
    Returns:
        200: JSON object with 'value' set to True if admin, False otherwise
        401: if the session token is invalid or expired
        404: if the request is malformed or the user cannot be found
    """
    print('ADMIN CHECK', flush=True)
    return {'value': bool(user_info.admin)}


@auth_bp.route('/settingsAdmin', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route(admin_only=True)
def settings_admin(*, user_info, **_):
    """ Verifies an administrator's S3 password before allowing admin-level edits
    Arguments:
        user_info: the authenticated user's information (injected by authenticated_route)
    Form parameters:
        value - the S3 password to verify
    Returns:
        200: JSON object with 'success' True if the password is correct
        401: if the session token is invalid, expired, or password verification fails
        404: if the request is malformed or the user cannot be found
        406: if the password parameter is missing
    Notes:
        Constructs a fresh S3 connection using the submitted password rather than
        the session-derived credentials in order to verify the password is correct
    """
    print(f'ADMIN SETTINGS user={user_info.name}', flush=True)

    pw = request.form.get('value')
    if not pw:
        return 'Not Found', 406

    pw_s3_info = s3u.get_s3_info(user_info.url,
                                  user_info.name,
                                  pw,
                                  lambda x: crypt.do_decrypt(WORKING_PASSCODE, x))

    pw_ok = hbase.handle_settings_admin(user_info, pw_s3_info)
    if pw_ok is False:
        return 'Not Found', 406
    if pw_ok is None:
        return 'Not Found', 401

    return jsonify({'success': pw_ok})


@auth_bp.route('/settingsOwner', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route(non_admin_only=True)
def settings_owner(*, user_info, **_):
    """ Verifies a collection owner's S3 password before allowing owner-level edits
    Arguments:
        user_info: the authenticated user's information (injected by authenticated_route)
    Form parameters:
        value - the S3 password to verify
    Returns:
        200: JSON object with 'success' True if the password is correct
        401: if the session token is invalid, expired, or password verification fails
        404: if the request is malformed or the user cannot be found
        406: if the password parameter is missing
    Notes:
        Constructs a fresh S3 connection using the submitted password rather than
        the session-derived credentials in order to verify the password is correct.
        This route is restricted to non-admin users only.
    """
    print(f'OWNER CHECK user={user_info.name}', flush=True)

    pw = request.form.get('value')
    if not pw:
        return 'Not Found', 406

    pw_s3_info = s3u.get_s3_info(user_info.url,
                                  user_info.name,
                                  pw,
                                  lambda x: crypt.do_decrypt(WORKING_PASSCODE, x))

    pw_ok = hbase.handle_settings_owner(user_info, pw_s3_info)
    if pw_ok is False:
        return 'Not Found', 404
    if pw_ok is None:
        return 'Not Found', 401

    return jsonify({'success': pw_ok})


@auth_bp.route('/locationInfo', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def location_info(*, s3_info, **_):
    """ Returns details on a location from the S3 endpoint
    Arguments:
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON object containing location details
        401: if the session token is invalid or expired
        404: if the request is malformed or the user cannot be found
        406: if the location information cannot be retrieved
    """
    print('LOCATION INFO', flush=True)

    loc_info = hbase.handle_location_info(s3_info)
    if not loc_info:
        return 'Not Found', 406

    return jsonify(loc_info)


@auth_bp.route('/setUploadComplete', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def set_upload_complete(*, db, user_info, s3_info, **_):
    """ Marks an incomplete upload as completed
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON object indicating success
        401: if the session token is invalid or expired
        404: if the request is malformed or the user cannot be found
        406: if the upload cannot be marked complete
    """
    print(f'SET UPLOAD COMPLETE user={user_info.name}', flush=True)
    return make_handler_response(hbase.handle_upload_complete(db, user_info, s3_info))


@auth_bp.route('/userIsAdmin', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def user_is_admin(*, user_info, **_):
    """ Marks an incomplete upload as completed
    Arguments:
        user_info: the authenticated user's information (injected by authenticated_route)
    Returns:
        200: JSON object indicating success
        401: if the session token is invalid or expired
        404: if the request is malformed or the user cannot be found
        406: if the upload cannot be marked complete
    """
    print(f'USER IS ADMIN user={user_info.name}', flush=True)
    response = make_response({'success': True, 'isAdmin': user_info.admin})
    response.headers.set('Cache-Control',
                         f'private, max-age={IS_ADMIN_BROWSER_CACHE_TIMEOUT_SEC}')
    return response
