""" Image editing and species routes for SPARCd server """

import datetime
from typing import Optional

from flask import Blueprint, jsonify, request
from flask_cors import cross_origin

import handlers.image as himage
from sparcd_config import WORKING_PASSCODE, authenticated_route, \
                          make_handler_response, temp_species_filename
from sparcd_env import ALLOWED_ORIGINS
import sparcd_utils as sdu
import spd_crypt as crypt

image_bp = Blueprint('image', __name__)


def __adjust_timestamp_params() -> Optional[himage.AdjustTimestampParams]:
    """ Gets and validates the adjust timestamp parameters
    Returns:
        The parameters in AdjustTimestampParams when successful, and None when not
    """
    # Get the rest of the request parameters
    try:
        collection_id = request.form.get('collection')
        upload_id = request.form.get('upload')
        year = int(request.form.get('year', 0))
        month = int(request.form.get('month', 0))
        day = int(request.form.get('day', 0))
        hour = int(request.form.get('hour', 0))
        minute = int(request.form.get('minute', 0))
        second = int(request.form.get('second', 0))
        all_files = request.form.get('files')
    except ValueError:
        return None

    # Check for mandatory parameters
    if not all([collection_id, upload_id]):
        return None

    # Get all the file names
    if all_files is not None:
        all_files = sdu.get_request_files()
        if all_files is None:
            return None

    if not all_files:
        all_files = []

    return himage.AdjustTimestampParams(
        collection_id=collection_id,
        upload_id=upload_id,
        files=all_files,
        timestamp=himage.AdjustTimestamp(year=year,
                                  month=month,
                                  day=day,
                                  hour=hour,
                                  minute=minute,
                                  second=second
                                )
        )


def __images_all_edited_params(user_name: str) -> Optional[himage.ImageAllEditedParams]:
    """ Gets and validates the request parameters for an images all edited request
    Arguments:
        user_name: the user's name
    Return:
        Returns the request parameters in ImageAllEditedParams when successful, and None if not
    """
    coll_id = request.form.get('collection', None)
    upload_id = request.form.get('upload', None)
    last_request_id = request.form.get('requestId', None)
    timestamp = request.form.get('timestamp', datetime.datetime.now().isoformat())
    force_all_changes = request.form.get('force', None)

    # Check what we have from the requestor
    if not all(item for item in [coll_id, upload_id]):
        return "Not Found", 406

    if force_all_changes is not None and not isinstance(force_all_changes, bool):
        force_all_changes = sdu.make_boolean(force_all_changes)
    elif force_all_changes is None:
        force_all_changes = False

    return himage.ImageAllEditedParams(coll_id=coll_id, upload_id=upload_id,
                                last_request_id=last_request_id, timestamp=timestamp,
                                force_all_changes=force_all_changes,
                                user_name=user_name)


def __image_edit_request_params(passcode: str) -> Optional[himage.ImageEditParams]:
    """ Gets and validates the request parameters for an image edit complete request
    Arguments:
        passcode: the working passcode
    Return:
        Returns the request parameters in ImageEditParams when successful, or None if not
    """
    coll_id = request.form.get('collection')
    upload_id = request.form.get('upload')
    path_encrypted = request.form.get('path')
    last_reqid = request.form.get('lastReqid')

    if not all(item for item in [coll_id, upload_id, path_encrypted]):
        return None

    path = crypt.do_decrypt(passcode, path_encrypted)
    if upload_id not in path or coll_id not in path:
        return None

    return himage.ImageEditParams(coll_id=coll_id, upload_id=upload_id,
                           path_encrypted=path_encrypted, path=path,
                           last_reqid=last_reqid)


def __image_species_request_params(passcode: str) -> Optional[himage.ImageSpeciesParams]:
    """ Gets and validates the request parameters for an image edit complete request
    Arguments:
        passcode: the working passcode
    Return:
        Returns the request parameters in ImageSpeciesParams when successful, or None if not
    """
    # Get the rest of the request parameters
    timestamp = request.form.get('timestamp')
    coll_id = request.form.get('collection')
    upload_id = request.form.get('upload')
    path = request.form.get('path') # Image path on S3 under bucket
    common_name = request.form.get('common')
    scientific_name = request.form.get('species') # Scientific name
    count = request.form.get('count')
    reqid = request.form.get('reqid', 0)  # Unique request identifier keeps track of requests

    # Check what we have from the requestor
    if not all(item for item in [timestamp, coll_id, upload_id, path, common_name, \
                                                                        scientific_name, count]):
        return False

    path = crypt.do_decrypt(passcode, path)
    if upload_id not in path or coll_id not in path:
        return None

    return himage.ImageSpeciesParams(
                timestamp=timestamp,
                coll_id=coll_id,
                upload_id=upload_id,
                path=path,
                reqid=reqid,
                species=himage.SpeciesParams(
                            common_name=common_name,
                            scientific_name=scientific_name,
                            count=count
                        )
            )


@image_bp.route('/imageSpecies', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def image_species(*, db, user_info, s3_info, **_):
    """ Handles updating the species and counts for an image
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON object indicating success
        401: if the session token is invalid or expired
        404: if the request is malformed or the user cannot be found
        406: if the species update parameters are invalid
    """
    print(f'IMAGE SPECIES user={user_info.name}', flush=True)

    params = __image_species_request_params(WORKING_PASSCODE)
    if not params:
        return 'Not Found', 406

    resp = himage.handle_image_species(db, user_info, s3_info, params)

    return make_handler_response({'success': True} if resp else resp)


@image_bp.route('/imageEditComplete', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def image_edit_complete(*, db, user_info, s3_info, **_):
    """ Handles updating one image with the changes made
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON object containing the edit result
        401: if the session token is invalid or expired
        404: if the request is malformed or the user cannot be found
        406: if the edit parameters are invalid or the edit cannot be completed
    """
    print(f'IMAGE EDIT COMPLETE user={user_info.name}', flush=True)
    params = __image_edit_request_params(WORKING_PASSCODE)
    if not params:
        return 'Not Found', 406

    resp = himage.handle_image_edit_complete(db,
                                             user_info,
                                             s3_info,
                                             temp_species_filename(s3_info.id),
                                             params)
    if not resp:
        return 'Not Found', 406

    return resp


@image_bp.route('/imagesAllEdited', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def images_all_edited(*, db, user_info, s3_info, **_):
    """ Handles completing changes after all images in an upload have been edited
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON object indicating whether the upload metadata and image URLs were updated
        401: if the session token is invalid or expired
        404: if the request is malformed or the user cannot be found
        406: if the edit completion parameters are invalid or the operation cannot be completed
    """
    print(f'IMAGES ALL FINISHED user={user_info.name}', flush=True)
    # Get the request parameters
    params = __images_all_edited_params(user_info.name)
    if not params:
        return 'Not Found', 406

    res = himage.handle_images_all_edited(db, user_info, s3_info, params)
    if isinstance(res, tuple):
        updated, kept_urls = res
    else:
        # Return formatted return value
        return jsonify(res)

    if updated is None or kept_urls is None:
        return 'Not Found', 406

    return jsonify({'success': True,
                    'message': 'The images have been successfully updated',
                    'updatedUpload': bool(updated),
                    'imagesReloaded': not kept_urls})


@image_bp.route('/speciesKeybind', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def species_keybind(*, db, user_info, s3_info, **_):
    """ Handles adding or changing a species keybind for an image
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON object indicating success
        401: if the session token is invalid or expired
        404: if the request is malformed or the user cannot be found
        406: if the keybind parameters are invalid or the update cannot be completed
    """
    print(f'SPECIES KEYBIND user={user_info.name}', flush=True)

    # Get the request parameters
    common = request.form.get('common') # Species name
    scientific = request.form.get('scientific') # Species scientific name
    new_key = request.form.get('key')

    # Check what we have from the requestor
    if not common or not scientific or not new_key:
        return 'Not Found', 406

    if not himage.handle_species_keybind(db, user_info, s3_info,
                                         temp_species_filename(s3_info.id),
                                         himage.SpeciesKeybindParams(
                                                    common=common,
                                                    scientific=scientific,
                                                    new_key=new_key
                                         )):
        return 'Not Found', 406

    return jsonify({'success': True})


@image_bp.route('/imageTimestamp', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def image_timestamps(*, s3_info, **_):
    """ Fetches the first timestamp found in the list of uploaded files
    Arguments:
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON object containing success status and the timestamp in ISO format if found
        401: if the session token is invalid or expired
        404: if the request is malformed or no timestamp can be found
        406: if the timestamp parameters are invalid
    """
    print('IMAGE TIMESTAMP', flush=True)
    # Get the request parameters
    collection_id = request.form.get('collection')
    upload_id = request.form.get('upload')

    # Check for mandatory parameters
    if not all([collection_id, upload_id]):
        return make_handler_response(False)

    all_files = sdu.get_request_files()
    if all_files is None:
        return make_handler_response(False)

    file_ts = himage.handle_image_timestamp(s3_info,
                                            collection_id,
                                            all_files,
                                            WORKING_PASSCODE)

    return make_handler_response(
        {'success': True, 'timestamp': file_ts.isoformat()}
            if file_ts
                else file_ts
    )


@image_bp.route('/adjustTimestamps', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def adjust_timestamps(*, s3_info, **_):
    """ Adjusts the timestamps for image files in an upload
    Arguments:
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON object indicating success or failure with a message
        401: if the session token is invalid or expired
        404: if the request is malformed or the user cannot be found
        406: if the timestamp adjustment parameters are invalid
    """
    print('ADJUST TIMESTAMPS', flush=True)
    params = __adjust_timestamp_params()
    if params is None:
        return 'Not Found', 406

    res = himage.handle_adjust_timestamp(s3_info, params)
    if res is False:
        return 'Not Found', 406
    if res is None:
        return jsonify({'success': False,
                        'message': 'Unable to get media information from server'})

    return jsonify({'success': True})
