""" Upload routes for SPARCd server """

from flask import Blueprint, jsonify, request
from flask_cors import cross_origin

import handlers.upload as hupload
from sparcd_config import WORKING_PASSCODE, \
                          authenticated_route, temp_species_filename
from sparcd_env import ALLOWED_ORIGINS
from s3.s3_access_helpers import SPARCD_PREFIX

upload_bp = Blueprint('upload', __name__)


@upload_bp.route('/uploadImages', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def upload_images(*, db, user_info, s3_info, **_):
    """ Returns the list of images from a collection's upload
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON list of images for the specified upload
        401: if the session token is invalid or expired
        404: if the request is malformed or the user cannot be found
        406: if the collection ID or upload ID parameters are missing, or no images are found
    """
    print(f'UPLOAD IMAGES user={user_info.name}', flush=True)

    params = hupload.UploadImagesParams(passcode=WORKING_PASSCODE,
                                        temp_species_filename=temp_species_filename(s3_info.id))
    all_images = hupload.handle_upload_images(db, user_info, s3_info, params)

    if not all_images:
        return 'Not Found', 406

    return jsonify(all_images)


@upload_bp.route('/uploadLocation', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def image_location(*, db, user_info, s3_info, **_):
    """ Handles updating the location information for images in an upload
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Form parameters:
        timestamp - the timestamp of the location change
        collection - the collection ID
        upload - the upload ID
        locId - the new location ID
        locName - the new location name
        locElevation - the new location elevation
        locLat - the new location latitude
        locLon - the new location longitude
    Returns:
        200: JSON object indicating success
        401: if the session token is invalid or expired
        404: if the request is malformed or the user cannot be found
        406: if any required parameters are missing or the update fails
    """
    print(f'UPLOAD LOCATION user={user_info.name}', flush=True)

    if not hupload.handle_upload_location(db, user_info, s3_info,
                                          temp_species_filename(s3_info.id)):
        return 'Not Found', 406

    return jsonify({'success': True})

@upload_bp.route('/checkChanges', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def check_changes(*, db, user_info, s3_info, **_):
    """ Checks if changes have been made to an upload and are stored in the database
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Form parameters:
        id - the collection ID to check
        up - the upload ID to check
    Returns:
        200: JSON object containing whether changes have been made
        401: if the session token is invalid or expired
        404: if the request is malformed or the user cannot be found
        406: if the collection ID or upload ID parameters are missing
    """
    print(f'CHECK CHANGES user={user_info.name}', flush=True)

    collection_id = request.form.get('id')
    collection_upload = request.form.get('up')

    if not collection_id or not collection_upload:
        return 'Not Found', 406

    have_changes = db.have_upload_changes(s3_info.id,
                                          SPARCD_PREFIX + collection_id,
                                          collection_upload)
    return jsonify({'changesMade': have_changes})


@upload_bp.route('/uploadUpdateDetails', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def upload_update_details(*, db, user_info, s3_info, **_):
    """ Checks if changes have been made to an upload and are stored in the database
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Form parameters:
        id - the collection ID of the upload
        up - the upload ID of the new description
        description - the new description
    Returns:
        200: JSON object containing whether changes have been made
        401: if the session token is invalid or expired
        404: if the request is malformed or the user cannot be found
        406: if any of collection ID, upload ID, or description parameters are missing
    """
    print(f'CHECK CHANGES user={user_info.name}', flush=True)

    collection_id = request.form.get('id')
    collection_upload = request.form.get('up')
    description = request.form.get('description')

    if not all(val for val in [collection_id, collection_upload, description]):
        return 'Not Found', 406

    updated_coll = hupload.handle_update_upload_details(db, s3_info, collection_id,
                                                                    collection_upload, description)
    return {'success': updated_coll is not None, 'coll': updated_coll}
