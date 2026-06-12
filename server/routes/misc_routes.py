""" Miscellaneous routes for SPARCd server that don't fit elsewhere """

from flask import Blueprint, jsonify
from flask_cors import cross_origin

import sparcd_collections as sdc
import sparcd_location_utils as sdlu
from sparcd_config import authenticated_route
from sparcd_env import ALLOWED_ORIGINS
from s3.s3_collections import S3CollectionConnection

misc_bp = Blueprint('misc', __name__)


@misc_bp.route('/collections', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def collections(*, db, user_info, s3_info, **_):
    """ Returns the list of collections and their uploads
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON list of collections accessible to the user. Non-admin users
             only see collections they have permissions for
        401: if the session token is invalid or expired
        404: if the request is malformed or the user cannot be found
        423: if the collections cannot be loaded
    """
    print('COLLECTIONS', flush=True)

    return_colls = sdc.load_collections(db, bool(user_info.admin), s3_info)
    if return_colls is None:
        return 'Unable to load collections', 423

    if not bool(user_info.admin):
        return_colls = [one_coll for one_coll in return_colls
                        if 'permissions' in one_coll and one_coll['permissions']]

    return jsonify([one_coll | {'allPermissions': None} for one_coll in return_colls])


@misc_bp.route('/locations', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def locations(*, s3_info, **_):
    """ Returns the list of locations from the S3 endpoint
    Arguments:
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON list of locations
        401: if the session token is invalid or expired
        404: if the request is malformed or the user cannot be found
    """
    print('LOCATIONS', flush=True)

    return jsonify(sdlu.load_locations(s3_info))


@misc_bp.route('/additionalBuckets', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def additional_buckets(*, s3_info, **_):
    """ Returns the list of buckets that are not collections
    Arguments:
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON list of additional buckets
        401: if the session token is invalid or expired
        404: if the request is malformed or the user cannot be found
    """
    print('ADDITIONAL BUCKETS', flush=True)

    return jsonify({'success': True, 
                    'buckets': S3CollectionConnection.list_not_collection_buckets(s3_info)})
