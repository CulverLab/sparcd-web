""" Native API routes for SPARCd server """

from flask import Blueprint, jsonify, make_response, request, Response
from flask_cors import cross_origin
import requests

import handlers.base as hbase
from sparcd_db import SPARCdDatabase
from sparcd_config import (WORKING_PASSCODE, TEMP_SPECIES_FILE_NAME)
from sparcd_env import ALLOWED_ORIGINS, DEFAULT_DB_PATH, DEFAULT_DB_SANDBOX_PATH, \
                       SESSION_EXPIRE_SECONDS
import spd_crypt as crypt

api_bp = Blueprint('api', __name__)

@admin_bp.route('/api/login', methods=['POST'])
@cross_origin(origins="*", supports_credentials=True)
def api_login():
    """ Returns a token representing the login
    Arguments: (POST)
        url - the S3 database URL
        user - the user name
        password - the user credentials
    Returns:
        200: JSON object containing the session token and user information
        404: if the login credentials are invalid or the user cannot be found
	"""
    db = SPARCdDatabase(DEFAULT_DB_PATH, DEFAULT_DB_SANDBOX_PATH)
    print('API LOGIN', flush=True)

    result = hbase.handle_login(db,
                                WORKING_PASSCODE,
                                SESSION_EXPIRE_SECONDS,
                                TEMP_SPECIES_FILE_NAME,
                                crypt.hash2str)
    if not result:
        return 'Not Found', 404

    return jsonify(result)
