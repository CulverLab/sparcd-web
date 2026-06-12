""" Admin and collection owner routes for SPARCd server """

import json
from typing import Optional

from flask import Blueprint, jsonify, request
from flask_cors import cross_origin

import handlers.admin as hadmin
from spd_types.userinfo import UserInfo
from sparcd_config import authenticated_route, make_handler_response, \
                          temp_species_filename
from sparcd_env import ALLOWED_ORIGINS
import sparcd_utils as sdu

admin_bp = Blueprint('admin', __name__)


def __check_incomplete_param(colls: str) -> Optional[str]:
    """ Returns the verified parameter for checking incomplete uploads
    Arguments:
        colls_json: the json parameter
    Return:
        Returns the collections list upon success, None if there is a problem
        with the parameter
    """
    # Get the list of collections
    try:
        cur_colls = json.loads(colls)
    except json.JSONDecodeError as ex:
        print('ERROR: Received invalid collections list to check for incomplete uploads',flush=True)
        print(ex, flush=True)
        return None

    return cur_colls


def __collection_update_request_params() -> Optional[hadmin.CollectionEditParams]:
    """ Gets and validates the collection update parameters for editing
    Return:
        Returns the parameters in CollectionEditParams when successful and None if validation
        fails
    """
    # Get the rest of the request parameters
    params = hadmin.CollectionEditParams(
                        col_id = request.form.get('id'),
                        col_name = request.form.get('name'),
                        col_desc = request.form.get('description', ''),
                        col_email = request.form.get('email', ''),
                        col_org = request.form.get('organization', ''),
                        col_all_perms = request.form.get('allPermissions')
                    )

    # Check what we have from the requestor
    if not all(item for item in [params.col_id, params.col_name, params.col_all_perms]):
        return None

    return params


def __validate_collection_update_params(user_info: UserInfo,
                                    must_be_admin: bool) -> Optional[hadmin.CollectionEditParams]:
    """ Validates and returns the collection update request parameters
    Arguments:
        user_info: the user information
        must_be_admin: set to False if the user shouldn't be an admin
    Return:
        Returns the validated parameters, or None if validation fails
    """
    if bool(user_info.admin) != must_be_admin:
        return None

    params = __collection_update_request_params()
    if params is None:
        return None

    try:
        params.col_all_perms = json.loads(params.col_all_perms)
    except json.JSONDecodeError as ex:
        print(f'Unable to convert permissions for collection update: '
              f'{params.col_id} {user_info.name}', flush=True)
        print(ex)
        return None

    if not params.col_all_perms:
        return None

    return params


@admin_bp.route('/adminCheckChanges', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route(admin_only=True)
def admin_check_changes(*, db, user_info, s3_info, **_):
    """ Checks if there are pending admin changes to locations or species
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON object indicating whether location or species changes are pending
        401: if the session token is invalid or expired
        404: if the request is malformed or the user cannot be found
    """
    print(f'ADMIN CHECK CHANGES user={user_info.name}', flush=True)

    changed = db.have_admin_changes(s3_info.id, user_info.name)
    return jsonify({'success': True,
                    'locationsChanged': changed['locationsCount'] > 0,
                    'speciesChanged': changed['speciesCount'] > 0})


@admin_bp.route('/adminCollectionDetails', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route(admin_only=True)
def admin_collection_details(*, db, user_info, s3_info, **_):
    """ Returns detailed collection information for admin editing
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON object containing detailed collection information
        401: if the session token is invalid or expired
        404: if the collection cannot be found or the request is malformed
    """
    print(f'ADMIN COLLECTION DETAILS user={user_info.name}', flush=True)

    must_be_admin = True

    bucket = request.form.get('bucket', None)
    is_admin = bool(user_info.admin)
    if bucket is None or is_admin != must_be_admin:
        return make_handler_response(False)

    # Collection can be None so we handle that differently than most of the code
    collection = hadmin.handle_admin_collection_details(db, user_info, s3_info, bucket,
                                                                                    is_admin)
    if collection is False:
        return make_handler_response(None)

    return jsonify(collection)


@admin_bp.route('/ownerCollectionDetails', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route(non_admin_only=True)
def owner_collection_details(*, db, user_info, s3_info, **_):
    """ Returns detailed collection information for collection owner editing
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON object containing detailed collection information
        401: if the session token is invalid or expired
        404: if the collection cannot be found or the request is malformed
    Notes:
        Performs additional permission checks since must_be_admin is False.
        Unlike the admin version, None is not returned on permission failure.
    """
    print(f'OWNER COLLECTION DETAILS user={user_info.name}', flush=True)

    must_be_admin = False

    bucket = request.form.get('bucket', None)
    is_admin = bool(user_info.admin)
    if bucket is None or is_admin != must_be_admin:
        return make_handler_response(False)


    # Collection can be None so we handle that differently than most of the code
    collection = hadmin.handle_admin_collection_details(db, user_info, s3_info, bucket, is_admin)
    if collection is False:
        return make_handler_response(None)

    return jsonify(collection)


@admin_bp.route('/adminLocationDetails', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route(admin_only=True)
def admin_location_details(*, user_info, s3_info, **_):
    """ Returns detailed location information for admin editing
    Arguments:
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON object containing detailed location information
        401: if the session token is invalid or expired
        404: if the location cannot be found
        406: if the request is malformed
    """
    print(f'ADMIN LOCATION DETAILS user={user_info.name}', flush=True)

    # Make sure this user is an admin
    if not bool(user_info.admin):
        return make_handler_response(None)

    loc_id = request.form.get('id', None)
    if loc_id is None:
        return make_handler_response(False)

    location = hadmin.handle_admin_location_details(s3_info, loc_id)

    return make_handler_response(location)


@admin_bp.route('/adminUsers', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route(admin_only=True)
def admin_users(*, db, user_info, s3_info, **_):
    """ Returns user information for admin editing
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON object containing user information
        401: if the session token is invalid or expired
        404: if the users cannot be found or the request is malformed
    """
    print(f'ADMIN USERS user={user_info.name}', flush=True)

    users = hadmin.handle_admin_users(db, user_info, s3_info)
    if users is False or users is None:
        return 'Not Found', 404

    return jsonify(users)


@admin_bp.route('/adminSpecies', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route(admin_only=True)
def admin_species(*, user_info, s3_info, **_):
    """ Returns the official species list for admin editing
    Arguments:
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON object containing the official species list
        401: if the session token is invalid or expired
        404: if the species list cannot be found
        406: if the request is malformed
    Notes:
        Returns the official species list, not user-specific species
    """
    print(f'ADMIN SPECIES user={user_info.name}', flush=True)

    cur_species = hadmin.handle_admin_species(user_info, s3_info,
                                              temp_species_filename(s3_info.id))

    return make_handler_response(cur_species)


@admin_bp.route('/adminUserUpdate', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route(admin_only=True)
def admin_user_update(*, db, user_info, s3_info, **_):
    """ Updates a user with the specified information
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON object containing the updated user information
        401: if the session token is invalid or expired
        404: if the user cannot be found
        406: if the request is malformed or the update parameters are invalid
    """
    print(f'ADMIN USER UPDATE user={user_info.name}', flush=True)

    # Make sure the user requesting the change is an admin
    if not bool(user_info.admin):
        return make_handler_response(None)

    # Get the rest of the request parameters
    old_name = request.form.get('oldName')
    new_email = request.form.get('newEmail')
    admin = request.form.get('admin')

    # Check what we have from the requestor
    if not old_name or new_email is None:
        return make_handler_response(False)

    if admin is not None:
        admin = sdu.make_boolean(admin)


    return make_handler_response(hadmin.handle_user_update(db, s3_info,
                                            hadmin.UserUpdateParams(
                                                        old_name=old_name,
                                                        new_email=new_email,
                                                        admin=admin
                                            )
                                ))


@admin_bp.route('/adminSpeciesUpdate', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route(admin_only=True)
def admin_species_update(*, db, user_info, s3_info, **_):
    """ Adds or updates a species entry in the official species list
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON object containing the updated species information
        401: if the session token is invalid or expired
        404: if the species cannot be found
        406: if the request is malformed or the update parameters are invalid
    """
    print(f'ADMIN SPECIES UPDATE user={user_info.name}', flush=True)

    # Make sure this user is an admin
    if not bool(user_info.admin):
        return make_handler_response(None)

    # Get the rest of the request parameters
    new_name = request.form.get('newName')
    old_scientific = request.form.get('oldScientific')
    new_scientific = request.form.get('newScientific')
    key_binding = request.form.get('keyBinding', '')
    icon_url = request.form.get('iconURL')

    # Check what we have from the requestor
    if not all(item for item in [new_name, new_scientific, icon_url]):
        return make_handler_response(False)

    return make_handler_response(hadmin.handle_species_update(db, user_info, s3_info,
                                                              temp_species_filename(s3_info.id),
                                                              hadmin.SpeciesUpdateParams(
                                                                new_name=new_name,
                                                                old_scientific=old_scientific,
                                                                new_scientific=new_scientific,
                                                                key_binding=key_binding,
                                                                icon_url=icon_url
                                                            )
                                ))


@admin_bp.route('/adminLocationUpdate', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route(admin_only=True)
def admin_location_update(*, db, user_info, s3_info, **_):
    """ Adds or updates location information
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON object containing the updated location information
        401: if the session token is invalid or expired
        404: if the location cannot be found
        406: if the request is malformed or the update parameters are invalid
    """
    print(f'ADMIN LOCATION UPDATE user={user_info.name}', flush=True)

    # Make sure this user is an admin
    if not bool(user_info.admin):
        return make_handler_response(None)

    utm = hadmin.LocationUtmInfo(
        utm_zone=request.form.get('utm_zone'),
        utm_letter=request.form.get('utm_letter'),
        utm_x=request.form.get('utm_x'),
        utm_y=request.form.get('utm_y')
    )
    coords = hadmin.LocationCoordInfo(
        coordinate=request.form.get('coordinate'),
        new_lat=request.form.get('new_lat'),
        new_lng=request.form.get('new_lon'),
        old_lat=request.form.get('old_lat'),
        old_lng=request.form.get('old_lon'),
        utm=utm
    )
    params = hadmin.LocationEditParams(
        loc_id=request.form.get('id'),
        loc_name=request.form.get('name'),
        loc_active=request.form.get('active'),
        measure=request.form.get('measure'),
        loc_ele=request.form.get('elevation'),
        description=request.form.get('description'),
        coords=coords
    )

    params = hadmin.location_update_params_check(params)
    if not params:
        return make_handler_response(False)

    return make_handler_response(hadmin.handle_location_update(db, user_info, s3_info, params))


@admin_bp.route('/adminCollectionUpdate', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route(admin_only=True)
def admin_collection_update(*, db, user_info, s3_info, **_):
    """ Updates collection information
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON object containing the updated collection information
        401: if the session token is invalid or expired
        404: if the collection cannot be found
        406: if the request is malformed or the update parameters are invalid
    """
    print(f'ADMIN COLLECTION UPDATE user={user_info.name}', flush=True)

    must_be_admin = True

    params = __validate_collection_update_params(user_info, must_be_admin)
    if params is None:
        return make_handler_response(False)

    return make_handler_response(hadmin.handle_collection_update(db, user_info, s3_info, params,
                                                                    must_be_admin=must_be_admin))


@admin_bp.route('/adminCollectionAdd', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route(admin_only=True)
def admin_collection_add(*, db, user_info, s3_info, **_):
    """ Adds a new collection
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON object containing the new collection information
        401: if the session token is invalid or expired
        404: if the collection cannot be created
        406: if the request is malformed or the collection parameters are invalid
    """
    print(f'ADMIN COLLECTION ADD user={user_info.name}', flush=True)

    # Check if the user has the correct admin permissions level
    is_admin = bool(user_info.admin)
    if is_admin is not True:
        return make_handler_response(False)

    # Get the rest of the request parameters
    col_name = request.form.get('name')
    col_desc = request.form.get('description', '')
    col_email = request.form.get('email', '')
    col_org = request.form.get('organization', '')
    col_all_perms = request.form.get('allPermissions')

    # Check what we have from the requestor
    if not all(item for item in [col_name, col_all_perms]):
        return make_handler_response(None)

    return make_handler_response(hadmin.handle_collection_add(db, user_info, s3_info,
                                                    hadmin.CollectionAddParams(
                                                        col_name=col_name,
                                                        col_desc=col_desc,
                                                        col_email=col_email,
                                                        col_org=col_org,
                                                        col_all_perms=col_all_perms
                                                    )
                                            ))


@admin_bp.route('/ownerCollectionUpdate', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route(non_admin_only=True)
def owner_collection_update(*, db, user_info, s3_info, **_):
    """ Adds or updates collection information for a collection owner
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON object containing the updated collection information
        401: if the session token is invalid or expired
        404: if the collection cannot be found
        406: if the request is malformed or the update parameters are invalid
    Notes:
        Restricted to non-admin users only. Performs additional ownership
        permission checks inside the handler.
    """
    print(f'OWNER COLLECTION UPDATE user={user_info.name}', flush=True)

    must_be_admin = False

    params = __validate_collection_update_params(user_info, must_be_admin)
    if params is None:
        return make_handler_response(False)

    return make_handler_response(hadmin.handle_collection_update(db, user_info, s3_info, params,
                                                                 must_be_admin=must_be_admin))


@admin_bp.route('/adminCheckIncomplete', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route(admin_only=True)
def admin_check_incomplete(*, db, user_info, s3_info, **_):
    """ Looks for incomplete uploads in collections
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON object containing incomplete upload information
        401: if the session token is invalid or expired
        404: if the incomplete upload information cannot be found
        406: if the request is malformed
    """
    print(f'ADMIN CHECK INCOMPLETE UPLOADS user={user_info.name}', flush=True)

    cur_colls = request.form.get('collections')
    if cur_colls:
        cur_colls = __check_incomplete_param(cur_colls)

    # Check the parameters we've received
    if not cur_colls:
        return make_handler_response(None)

    return make_handler_response(hadmin.handle_check_incomplete(db, user_info, s3_info, cur_colls))


@admin_bp.route('/adminCompleteChanges', methods=['PUT'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route(admin_only=True)
def admin_complete_changes(*, db, user_info, s3_info, **_):
    """ Applies all pending location and species changes to the S3 data
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON object indicating success
        401: if the session token is invalid or expired
        404: if the changes cannot be found
        406: if the request is malformed or the changes cannot be applied
    """
    print(f'ADMIN COMPLETE THE CHANGES user={user_info.name}', flush=True)

    return make_handler_response(hadmin.handle_complete_changes(db, user_info, s3_info,
                                                                temp_species_filename(s3_info.id)))


@admin_bp.route('/adminAbandonChanges', methods=['PUT'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route(admin_only=True)
def admin_abandon_changes(*, db, user_info, s3_info, **_):
    """ Discards all pending location and species changes
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON object indicating success
        401: if the session token is invalid or expired
        404: if the changes cannot be found
        406: if the request is malformed
    """
    print(f'ADMIN ABANDON THE CHANGES user={user_info.name}', flush=True)

    return make_handler_response(hadmin.handle_abandon_changes(db, user_info, s3_info))


@admin_bp.route('/moveUpload', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route(admin_only=True)
def move_upload(*, db, user_info, s3_info, **_):
    """ Discards all pending location and species changes
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON object indicating success
        401: if the session token is invalid or expired
        404: if the changes cannot be found
        406: if the request is malformed
    """
    print(f'MOVE UPLOAD user={user_info.name}', flush=True)

    src_coll_id = request.form.get('s')
    upload_key = request.form.get('u')
    dst_coll_id = request.form.get('d')

    if not all(val for val in [src_coll_id, upload_key, dst_coll_id]):
        return "Not found", 406

    return make_handler_response(hadmin.handle_move_upload(db, user_info, s3_info,
                                        hadmin.UploadMoveParams(src_coll_id=src_coll_id,
                                                                upload_key=upload_key,
                                                                dst_coll_id=dst_coll_id
                                        )
                                ))


@admin_bp.route('/deleteLocation', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route(admin_only=True)
def delete_location(*, db, user_info, s3_info, **_):
    """ Discards all pending location and species changes
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON object indicating success
        401: if the session token is invalid or expired
        404: if the changes cannot be found
        406: if the request is malformed
    """
    print(f'DELETE LOCATION user={user_info.name}', flush=True)

    location_id = request.form.get('id')

    if not location_id:
        return "Not found", 406

    return make_handler_response(hadmin.handle_delete_location(db, user_info, s3_info, location_id))
