""" Static and next.js file serving routes for SPARCd server """

import os

from flask import Blueprint, make_response, render_template, request, send_file, \
                  send_from_directory
from flask_cors import cross_origin

import handlers.next as hnext
from sparcd_config import IMAGE_BROWSER_CACHE_TIMEOUT_SEC, \
                          LOGIN_PAGE_BROWSER_CACHE_TIMEOUT_SEC, REQEST_ALLOWED_FILE_EXTENSIONS, \
                          DEFAULT_TEMPLATE_PAGE, RESOURCE_START_PATH
from sparcd_env import ALLOWED_ORIGINS

static_bp = Blueprint('static', __name__)


@static_bp.route('/', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
def index():
    """ Default page """
    print('RENDERING TEMPLATE', DEFAULT_TEMPLATE_PAGE, os.getcwd(), flush=True)
    client_ip = request.environ.get('HTTP_X_FORWARDED_FOR',
                    request.environ.get('HTTP_ORIGIN',
                    request.environ.get('HTTP_REFERER', request.remote_addr)))
    client_user_agent = request.environ.get('HTTP_USER_AGENT', None)
    if not client_ip or not client_user_agent or client_user_agent == '-':
        return 'Resource not found', 404

    response = make_response(render_template(DEFAULT_TEMPLATE_PAGE))
    response.headers.set('Cache-Control',
                         f'public, max-age={LOGIN_PAGE_BROWSER_CACHE_TIMEOUT_SEC}')
    return response


@static_bp.route('/favicon.ico', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
def favicon():
    """ Return the favicon """
    return send_from_directory(RESOURCE_START_PATH, 'favicon.ico',
                               mimetype='image/vnd.microsoft.icon',
                               max_age=IMAGE_BROWSER_CACHE_TIMEOUT_SEC)


@static_bp.route('/mapImage.png', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
def mapimage():
    """ Return the map image """
    return send_from_directory(RESOURCE_START_PATH, 'mapImage.png',
                               mimetype='image/png',
                               max_age=IMAGE_BROWSER_CACHE_TIMEOUT_SEC)


@static_bp.route('/badimage.png', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
def badimage():
    """ Return the bad image placeholder """
    return send_from_directory(RESOURCE_START_PATH, 'badimage.png',
                               mimetype='image/png',
                               max_age=IMAGE_BROWSER_CACHE_TIMEOUT_SEC)


@static_bp.route('/sparcd.png', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
def sparcdpng():
    """ Return the SPARCd logo """
    return send_from_directory(RESOURCE_START_PATH, 'sparcd.png',
                               mimetype='image/png',
                               max_age=IMAGE_BROWSER_CACHE_TIMEOUT_SEC)


@static_bp.route('/wildcatResearch.png', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
def wildcatresearch():
    """ Return the wildcat research image """
    return send_from_directory(RESOURCE_START_PATH, 'wildcatResearch.png',
                               mimetype='image/png',
                               max_age=IMAGE_BROWSER_CACHE_TIMEOUT_SEC)


@static_bp.route('/loading.gif', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
def loading():
    """ Return the loading animation """
    return send_from_directory(RESOURCE_START_PATH, 'loading.gif',
                               mimetype='image/gif',
                               max_age=IMAGE_BROWSER_CACHE_TIMEOUT_SEC)


@static_bp.route('/sanimalBackground.JPG', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
def sanimalbackground():
    """ Return the background image """
    return send_from_directory(RESOURCE_START_PATH, 'sanimalBackground.JPG',
                               mimetype='image/jpeg',
                               max_age=IMAGE_BROWSER_CACHE_TIMEOUT_SEC)


@static_bp.route('/_next/static/<path:path_fragment>', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
def sendnextfile(path_fragment: str):
    """ Return next.js static files """
    print('RETURN _next FILENAME:', path_fragment, flush=True)
    return_path = hnext.handle_next_static(path_fragment, REQEST_ALLOWED_FILE_EXTENSIONS)
    if not return_path:
        return 'Resource not found', 404

    return send_file(return_path)


@static_bp.route('/_next/image', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
def sendnextimage():
    """ Return next.js image files """
    print('RETURN _next IMAGE:', flush=True)
    file_path, img_byte_array, image_type = hnext.handle_next_image(
        request.args.get('url'),
        request.args.get('w'),
        request.args.get('q'),
        REQEST_ALLOWED_FILE_EXTENSIONS
    )
    if not all(val for val in [file_path, img_byte_array, image_type]):
        return 'Resource not found', 404
    if file_path and not img_byte_array:
        return send_file(file_path)

    return send_file(img_byte_array, mimetype='image/' + image_type.lower())
