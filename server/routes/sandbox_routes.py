""" Sandbox upload routes for SPARCd server """

from flask import Blueprint, jsonify, request
from flask_cors import cross_origin

import handlers.sandbox as hsand
import sparcd_utils as sdu
from sparcd_config import TEMP_UPLOAD_STATS_FILE_NAME_POSTFIX, \
                          TEMP_UPLOAD_STATS_FILE_TIMEOUT_SEC, authenticated_route
from sparcd_env import ALLOWED_ORIGINS

sandbox_bp = Blueprint('sandbox', __name__)


@sandbox_bp.route('/sandbox', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def sandbox(*, db, user_info, s3_info, **_):
    """ Returns the list of sandbox uploads accessible to the user
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON list of sandbox upload collections accessible to the user.
             Non-admin users only see their own uploads.
        401: if the session token is invalid or expired
        404: if the request is malformed or the user cannot be found
    """
    print(f'SANDBOX user={user_info.name} admin={bool(user_info.admin)}', flush=True)
    return jsonify(hsand.handle_sandbox(db, user_info, s3_info))


@sandbox_bp.route('/sandboxStats', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def sandbox_stats(*, db, user_info, s3_info, **_):
    """ Returns upload statistics for display
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON list of sandbox statistics
        401: if the session token is invalid or expired
        404: if the request is malformed or the user cannot be found
    """
    print('SANDBOX STATS', request, flush=True)
    return jsonify(hsand.handle_sandbox_stats(db,
                                              user_info,
                                              s3_info,
                                              s3_info.id + TEMP_UPLOAD_STATS_FILE_NAME_POSTFIX,
                                              TEMP_UPLOAD_STATS_FILE_TIMEOUT_SEC))


@sandbox_bp.route('/sandboxPrev', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def sandbox_prev(*, db, user_info, s3_info, **_):
    """ Checks if a sandbox item has been previously uploaded
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Form parameters:
        path - the relative path of the upload to check
    Returns:
        200: JSON object with the following fields:
                 exists (bool): whether a previous upload exists for the given path
                 path (str): the relative path of the upload
                 uploadedFiles: the list of previously uploaded files, or None if none exist
                 elapsed_sec: the number of seconds since the upload was started, or None
                 id: the upload ID, or None if no previous upload exists
        401: if the session token is invalid or expired
        404: if the request is malformed or the user cannot be found
        406: if the path parameter is missing
    """
    print(f'SANDBOX PREV user={user_info.name}', flush=True)

    rel_path = request.form.get('path')
    if not rel_path:
        return 'Not Found', 406

    elapsed_sec, uploaded_files, upload_id, _ = db.sandbox_get_upload(s3_info.id,
                                                                       user_info.name,
                                                                       rel_path,
                                                                       True)
    return jsonify({'exists': uploaded_files is not None,
                    'path': rel_path,
                    'uploadedFiles': uploaded_files,
                    'elapsed_sec': elapsed_sec,
                    'id': upload_id})


@sandbox_bp.route('/sandboxRecoveryUpdate', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def sandbox_recovery_update(*, db, user_info, s3_info, **_):
    """ Updates the sandbox information in the database upon upload recovery
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Form parameters:
        id - the collection ID
        key - the upload key
        loc - the location ID
        path - the source path of the upload
    Returns:
        200: JSON object indicating success or failure with upload ID and file list
        401: if the session token is invalid or expired
        404: if the result is False or the request is malformed
        406: if any required parameters are missing
    """
    print(f'SANDBOX RECOVERY UPDATE user={user_info.name}', flush=True)

    coll_id = request.form.get('id')
    upload_key = request.form.get('key')
    loc_id = request.form.get('loc')
    source_path = request.form.get('path')

    if not all(item for item in [source_path, upload_key, coll_id]):
        return 'Not Found', 406

    result = hsand.handle_sandbox_recovery_update(db, user_info, s3_info,
                                                  hsand.SandboxRecoveryParams(
                                                      coll_id=coll_id,
                                                      upload_key=upload_key,
                                                      loc_id=loc_id,
                                                      source_path=source_path))
    if result is False:
        return 'Not Found', 404

    if result is None:
        return jsonify({'success': False,
                        'message': 'Unable to update the upload to receive the files'})

    return jsonify({'success': True, 'id': result[0], 'files': result[1],
                    'message': 'Successfully updated for the file upload'})


@sandbox_bp.route('/sandboxCheckContinueUpload', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def sandbox_check_continue_upload(*, db, user_info, s3_info, **_):
    """ Checks if sandbox files already uploaded match what has just been received
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Form parameters:
        id - the upload ID to check
    Returns:
        200: JSON object containing:
                 success (bool): True if all files match
                 missing (bool): True if a file is missing on the server
                 message (str): description of the result
        401: if the session token is invalid or expired
        404: if the request is malformed or the user cannot be found
        406: if the upload ID parameter is missing
    """
    print('SANDBOX CHECK CONTINUE UPLOAD', flush=True)

    upload_id = request.form.get('id')
    if not upload_id:
        return 'Not Found', 406

    all_match, message = hsand.handle_sandbox_check_continue_upload(db,
                                                                    user_info,
                                                                    s3_info,
                                                                    upload_id,
                                                                    request.files)
    return jsonify({'success': all_match is True,
                    'missing': all_match == 'missing',
                    'message': message})


@sandbox_bp.route('/sandboxNew', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def sandbox_new(*, db, user_info, s3_info, **_):
    """ Adds a new sandbox upload to the database
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Form parameters:
        location - the location ID for the upload
        collection - the collection ID for the upload
        comment - the upload comment
        path - the relative path of the upload
        ts - the upload timestamp in ISO format
        tz - the timezone for the upload
        files - the json encoded list of files
        files* - optional additional json encoded list of files with keys starting at "files1",
                    "files2", and so on
    Returns:
        200: JSON object containing the new upload ID
        401: if the session token is invalid or expired
        404: if the request is malformed or the user cannot be found
        406: if any required parameters are missing or the upload cannot be created
    """
    print(f'SANDBOX NEW user={user_info.name}', flush=True)

    location_id = request.form.get('location')
    collection_id = request.form.get('collection')
    comment = request.form.get('comment')
    rel_path = request.form.get('path')
    timestamp = request.form.get('ts')
    timezone = request.form.get('tz')

    if not all(item for item in [location_id, collection_id, comment, rel_path,
                                 timestamp, timezone]):
        return 'Not Found', 406

    all_files = sdu.get_request_files()
    if all_files is None:
        return 'Not Found', 406

    upload_id = hsand.handle_sandbox_new(db, user_info, s3_info,
                                         hsand.SandboxNewParams(location_id=location_id,
                                                                collection_id=collection_id,
                                                                comment=comment,
                                                                rel_path=rel_path,
                                                                all_files=all_files,
                                                                timestamp=timestamp,
                                                                timezone=timezone))
    if upload_id is None:
        return 'Not Found', 406

    return jsonify({'id': upload_id})


@sandbox_bp.route('/sandboxFile', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route(eager_password=True)
def sandbox_file(*, db, user_info, s3_info, **_):
    """ Handles the upload of a new sandbox image file
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Form parameters:
        id - the upload ID to add the file to
        tz_off - the timezone offset in hours for timestamp adjustment
    Returns:
        200: JSON object indicating success
        401: if the session token is invalid or expired
        404: if the request is malformed or the user cannot be found
        406: if the upload ID is missing or no files were included in the request
    """
    print(f'SANDBOX FILE user={user_info.name}', flush=True)

    upload_id = request.form.get('id')
    tz_offset = request.form.get('tz_off')

    if not upload_id or len(request.files) <= 0:
        return 'Not Found', 406

    hsand.handle_sandbox_file(db,
                              user_info,
                              s3_info,
                              hsand.SandboxFileParams(upload_id=upload_id,
                                                      tz_offset=tz_offset,
                                                      files=request.files))
    return jsonify({'success': True})


@sandbox_bp.route('/sandboxCounts', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def sandbox_counts(*, db, user_info, **_):
    """ Returns the total and uploaded file counts for a sandbox upload
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
    Query parameters:
        i - the upload ID to get counts for
    Returns:
        200: JSON object containing total and uploaded file counts
        401: if the session token is invalid or expired
        404: if the request is malformed or the user cannot be found
        406: if the upload ID parameter is missing
    """
    print('SANDBOX COUNTS', flush=True)

    upload_id = request.args.get('i')
    if not upload_id:
        return 'Not Found', 406

    counts = db.sandbox_upload_counts(user_info.name, upload_id)
    return jsonify({'total': counts[0], 'uploaded': counts[1]})


@sandbox_bp.route('/sandboxUnloadedFiles', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def sandbox_unloaded_files(*, db, user_info, **_):
    """ Returns the list of files that have not yet been uploaded
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
    Query parameters:
        i - the upload ID to check for unloaded files
    Returns:
        200: JSON list of files not yet uploaded
        401: if the session token is invalid or expired
        404: if the request is malformed or the user cannot be found
        406: if the upload ID parameter is missing
    """
    print(f'SANDBOX UNLOADED FILES user={user_info.name}', flush=True)

    upload_id = request.args.get('i')
    if not upload_id:
        return 'Not Found', 406

    return jsonify(db.sandbox_files_not_uploaded(user_info.name, upload_id))


@sandbox_bp.route('/sandboxReset', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def sandbox_reset(*, db, user_info, **_):
    """ Resets a sandbox upload to start from the beginning
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
    Form parameters:
        id - the upload ID to reset
        files - JSON encoded list of files for the upload
    Returns:
        200: JSON object containing the reset upload ID
        401: if the session token is invalid or expired
        404: if the request is malformed or the user cannot be found
        406: if the upload ID or files parameter is missing or the files JSON is invalid
    """
    print(f'SANDBOX RESET user={user_info.name}', flush=True)

    upload_id = request.form.get('id')
    if not upload_id:
        return 'Not Found', 406

    all_files = sdu.get_request_files()
    if all_files is None:
        return 'Not Found', 406

    upload_id = db.sandbox_reset_upload(user_info.name, upload_id, all_files)
    return jsonify({'id': upload_id})


@sandbox_bp.route('/sandboxAbandon', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def sandbox_abandon(*, db, user_info, **_):
    """ Removes a sandbox upload record from the database
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
    Form parameters:
        id - the upload ID to abandon
    Returns:
        200: JSON object containing the upload ID and completed file count
        401: if the session token is invalid or expired
        404: if the request is malformed or the user cannot be found
        406: if the upload ID parameter is missing
    Notes:
        The uploaded files are not removed from S3 storage as they may be
        needed for recovery. Removal from S3 is handled separately if required.
    """
    print(f'SANDBOX ABANDON user={user_info.name}', flush=True)

    upload_id = request.form.get('id')
    if not upload_id:
        return 'Not Found', 406

    completed_count = db.sandbox_upload_counts(user_info.name, upload_id)
    db.sandbox_upload_complete(user_info.name, upload_id)

    # We don't remove the actual data because it's not recoverable
    # Remove the files from S3
    #if upload_info:
    #    S3Connection.remove_upload(s3_info, s3_bucket, s3_path)

    return jsonify({'id': upload_id, 'completed': completed_count})


@sandbox_bp.route('/sandboxCompleted', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def sandbox_completed(*, db, user_info, s3_info, **_):
    """ Marks a sandbox upload as completely uploaded and finalizes it
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Form parameters:
        id - the upload ID to mark as completed
    Returns:
        200: JSON object indicating success
        401: if the session token is invalid or expired
        404: if the upload cannot be finalized or the request is malformed
        406: if the upload ID parameter is missing
    """
    print(f'SANDBOX COMPLETED user={user_info.name}', flush=True)

    upload_id = request.form.get('id')
    if not upload_id:
        return 'Not Found', 406

    if not hsand.handle_sandbox_completed(db, user_info, s3_info, upload_id):
        return 'Not Found', 404

    return jsonify({'success': True})
