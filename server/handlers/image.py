""" Functions to handle requests starting with /image for SPARCd server """

from dataclasses import dataclass
import datetime
import json
import os
import tempfile
from typing import Optional, Union
from dateutil.relativedelta import relativedelta

from camtrap.v016 import camtrap
import camtrap_utils as ctu
import image_utils
from sparcd_db import SPARCdDatabase
import sparcd_collections as sdc
import spd_crypt as crypt
from spd_types.userinfo import UserInfo
from spd_types.s3info import S3Info
import sparcd_timestamp_utils as sdtsu
import sparcd_upload_utils as sdupu
from s3.s3_access_helpers import make_s3_path, download_s3_file, COLLECTIONS_FOLDER, \
                                MEDIA_CSV_FILE_NAME, OBSERVATIONS_CSV_FILE_NAME, \
                                SPECIES_JSON_FILE_NAME, SPARCD_PREFIX, S3_UPLOADS_PATH_PART
from s3.s3_collections import S3CollectionConnection
from s3.s3_connect import s3_connect
from s3.s3_uploads import S3UploadConnection
import s3_utils as s3u


@dataclass
class ImageEditParams:
    """ Contains the parameters for an image edit complete request """
    coll_id: str
    upload_id: str
    path_encrypted: str
    path: str
    last_reqid: str


@dataclass
class ImageAllEditedParams:
    """ Contains the parameters for when the user has finished editing images """
    user_name: str
    coll_id: str
    upload_id: str
    last_request_id: str
    timestamp: str
    force_all_changes: bool

@dataclass
class SpeciesParams:
    """ Contains the species related parameters for an image """
    common_name: str
    scientific_name: str
    count: str

@dataclass
class ImageSpeciesParams:
    """ The parameters for adding/adjusting an iamge's species """
    timestamp: str
    coll_id: str
    upload_id: str
    path: str
    reqid: str
    species: SpeciesParams

@dataclass
class SpeciesKeybindParams:
    """ The parameters for setting a species' keybind """
    common: str
    scientific: str
    new_key: str

@dataclass
class AdjustTimestamp:
    """ Contains the timestamp parameters """
    year: int
    month: int
    day: int
    hour: int
    minute: int
    second: int


@dataclass
class AdjustTimestampParams:
    """ Contains the parameters for adjusting timestamps """
    collection_id: str
    upload_id: str
    files: list
    timestamp: AdjustTimestamp


def __has_last_edit(edit_files_info: list, last_reqid: str) -> bool:
    """ Checks if the last edit request has been received
    Arguments:
        edit_files_info: the list of edit file information
        last_reqid: the last request ID to check for
    Return:
        Returns True if the last edit request has been received, False otherwise
    """
    return any('request_id' in one_edit and
               one_edit['request_id'] and
               one_edit['request_id'] == last_reqid
               for one_edit in edit_files_info)


def __has_last_edit_or_forced(edited_files_info: list,
                               last_request_id: Optional[str],
                               force_all_changes: bool) -> bool:
    """ Checks if the last edit request has been received or changes are forced
    Arguments:
        edited_files_info: the list of edited file information
        last_request_id: the last request ID to check for, or None to force save
        force_all_changes: whether to force all changes regardless of last edit
    Return:
        Returns True if we should proceed with saving changes, False otherwise
    """
    if last_request_id is None or force_all_changes:
        return True
    return any(one_edit['request_id'] == last_request_id
               for one_edit in edited_files_info)


def __make_edit_response(params: ImageEditParams, success: bool,
                         message: str, retry: bool, error: bool) -> dict:
    """ Builds a standard image edit response dict
    Arguments:
        params: the image edit parameters
        success: whether the edit was successful
        message: the message to return
        retry: whether the client should retry
        error: whether there was an error
    Return:
        Returns a dict containing the response information
    """
    return {'success': success,
            'retry': retry,
            'message': message,
            'error': error,
            'collection': params.coll_id,
            'upload_id': params.upload_id,
            'path': params.path_encrypted,
            'filename': os.path.basename(params.path)}


def __update_metadata_and_collection(db: SPARCdDatabase,
                                     s3_info: S3Info,
                                     s3_bucket: str,
                                     s3_path: str,
                                     params: ImageAllEditedParams) -> tuple:
    """ Updates upload metadata and collection after image edits
    Arguments:
        db: the database instance
        s3_info: the S3 endpoint information
        s3_bucket: the S3 bucket
        s3_path: the S3 path
        params: the images all edited parameters
    Return:
        Returns a tuple of (updated, kept_urls) booleans
    """
    all_images, kept_urls = sdc.get_upload_images(db, s3_bucket, params.coll_id,
                                                  params.upload_id, s3_info,
                                                  force_refresh=True, keep_image_url=True)

    image_with_species = sum(1 for one_image in all_images
                             if 'species' in one_image and len(one_image['species']) > 0)

    edit_comment = f'Edited by {params.user_name} on ' + \
                   datetime.datetime.fromisoformat(params.timestamp).strftime("%Y.%m.%d.%H.%M.%S")

    updated, _ = S3UploadConnection.update_upload_metadata(s3_info, s3_bucket, s3_path,
                                                     edit_comment, image_with_species)
    if updated:
        updated_collection = S3CollectionConnection.get_collection_info(s3_info, s3_bucket)
        if updated_collection:
            sdc.collection_update(db, s3_info.id, sdupu.normalize_collection(updated_collection))

    return updated, kept_urls


def __update_observations(s3_info: S3Info,
                          s3_bucket: str,
                          s3_path: str,
                          edited_files_info: list,
                          timestamp: str) -> None:
    """ Updates the observations CSV file with edited image information
    Arguments:
        s3_info: the S3 endpoint information
        s3_bucket: the S3 bucket
        s3_path: the S3 path
        edited_files_info: the list of edited file information
        timestamp: the timestamp of the edit
    """
    deployment_info = ctu.load_camtrap_deployments(s3_info, s3_bucket, s3_path, True)
    obs_info = ctu.load_camtrap_observations(s3_info, s3_bucket, s3_path, True)

    for one_file in edited_files_info:
        obs_info = ctu.update_observations(s3_path, obs_info,
                        [one_species | {'filename': one_file['filename'],
                                        'timestamp': timestamp}
                         for one_species in one_file['species']],
                        deployment_info[0][camtrap.CAMTRAP_DEPLOYMENT_ID_IDX])

    row_groups = (obs_info[one_key] for one_key in obs_info)
    S3UploadConnection.upload_camtrap_data(s3_info, s3_bucket,
                                     make_s3_path((s3_path, OBSERVATIONS_CSV_FILE_NAME)),
                                     [one_row for one_set in row_groups for one_row in one_set])


def handle_image_species(db: SPARCdDatabase, user_info: UserInfo, s3_info: S3Info,
                                                params: ImageSpeciesParams) -> Union[bool, None]:
    """ Implementation for adding an species entry for a file into the database
    Arguments:
        db: the database instance
        user_info: the user information
        s3_info: the S3 endpoint information
        params: the parameters for adding/adjusting image species
    Return:
        Returns True if the database could be successfully updated, and False otherwise. If the
        image path is invalid, None is returned
    """
    bucket = SPARCD_PREFIX + params.coll_id

    db.add_image_species_edit(s3_info.id, bucket, params.path, user_info.name, params.timestamp,
                                    params.species.common_name, params.species.scientific_name,
                                    params.species.count, str(params.reqid))

    return True


def handle_image_edit_complete(db: SPARCdDatabase, user_info: UserInfo, s3_info: S3Info, \
                                temp_species_filename: str,
                                params: ImageEditParams) -> Optional[dict]:
    """ Implementation for updating one image with the changes made
    Arguments:
        db: the database instance
        user_info: the user information
        s3_info: the S3 endpoint information
        temp_species_filename: the filename of the temporary species storeage
        params: the parameters for completing image edits
    Return:
        Returns the dict of information to return to the server, or None if there's a problen
    """
    edit_files_info = db.get_next_files_info(s3_info.id, user_info.name, params.path)
    if not edit_files_info:
        return __make_edit_response(params, success=True, retry=True, error=False,
                                    message='No changes found for file')

    if not __has_last_edit(edit_files_info, params.last_reqid):
        return __make_edit_response(params, success=True, retry=True, error=False,
                                    message=f'All edits have not been received yet '
                                            f'({params.last_reqid})')

    edit_files_info = [one_file | {'name': one_file['s3_path']
                       [one_file['s3_path'].index(params.upload_id) + len(params.upload_id) + 1:]}
                       for one_file in edit_files_info]

    success_files, errored_files = sdupu.process_upload_changes(s3_info,
                                                sdupu.UploadChangeParams(
                                                        collection_id=params.coll_id,
                                                        upload_name=params.upload_id,
                                                        species_timed_file=temp_species_filename,
                                                        files_info=edit_files_info
                                                )
                                            )
    if success_files:
        db.complete_image_edits(user_info.name, success_files)

    if errored_files:
        return __make_edit_response(params, success=False, retry=True, error=True,
                                    message='Not all the edits could be completed')

    return {'success': True, 'message': 'The images have been successfully updated', 'error': False}


def handle_images_all_edited(db: SPARCdDatabase, user_info: UserInfo, s3_info: S3Info,
                                            params: ImageAllEditedParams) -> Union[tuple|dict]:
    """ Implementation for completing changes after all images have been edited
    Arguments:
        db: the database instance
        user_info: the user information
        s3_info: the S3 endpoint information
        params: the parameters for handling when all images are edited
    Return:
        Returns a tuple containing a boolean indicating whether (True) or not (False) information
        was updated with None being returned if there's a problem, and another bool indication
        indicating if the image URLs were updated (True) or kept the same (False) or None if there
        was a problem
    """
    # Get any and all changes
    edited_files_info = db.get_edited_files_info(s3_info.id, user_info.name, params.upload_id, True)

    if not edited_files_info:
        return {'success': True, 'retry': True, 'foundEdits': 0,  \
                'message': "No changes found for to the upload", \
                'collection': params.coll_id, 'upload_id': params.upload_id
               }

    if not __has_last_edit_or_forced(edited_files_info, params.last_request_id,
                                                                        params.force_all_changes):
        return {'success': True, 'retry': True, 'foundEdits': len(edited_files_info),  \
                'message': "Last change not found for to the upload", \
                'collection': params.coll_id, 'upload_id': params.upload_id}

    # Update the image and the observations information
    edited_files_info = [one_file|{'filename': one_file['s3_path']\
                            [one_file['s3_path'].index(params.upload_id)+len(params.upload_id)+1:]}\
                                for one_file in edited_files_info]

    s3_bucket = SPARCD_PREFIX + params.coll_id
    s3_path = make_s3_path((COLLECTIONS_FOLDER, params.coll_id, S3_UPLOADS_PATH_PART,
                                                                                params.upload_id))

    # Start updating the CAMTRAP information starting with observations
    __update_observations(s3_info, s3_bucket, s3_path, edited_files_info, params.timestamp)

    db.finish_image_edits(user_info.name, edited_files_info)

    # Update the upload metadata and and save the collection information
    updated, kept_urls = __update_metadata_and_collection(db, s3_info, s3_bucket,
                                                          s3_path, params)

    return bool(updated), kept_urls


def handle_species_keybind(db: SPARCdDatabase, user_info: UserInfo, s3_info: S3Info,
                                temp_species_filename: str, params: SpeciesKeybindParams) -> bool:
    """ Implementation for updating a user's species keybind
    Arguments:
        db: the database instance
        user_info: the user information
        s3_info: the S3 endpoint information
        temp_species_filename: the name of the temporary species file
        params: the parameters for the species' keybind
    Return:
        Returns True if updating the keybinding worked out, and False if not
    """
    # Get the species
    if user_info.species:
        cur_species = user_info.species
    else:
        cur_species = s3u.load_sparcd_config(SPECIES_JSON_FILE_NAME,
                                            temp_species_filename,
                                            s3_info)

    # Update the species
    found = False
    for one_species in cur_species:
        if one_species['scientificName'] == params.scientific:
            one_species['keyBinding'] = params.new_key[0]
            found = True
            break

    # Add entry if it's not in the species
    if not found:
        cur_species.append({'name':params.common,
                            'scientificName':params.scientific,
                            'keyBinding':params.new_key[0],
                            'speciesIconURL': 'https://i.imgur.com/4qz5mI0.png'})

    db.save_user_species(s3_info.id, user_info.name, json.dumps(cur_species))

    return True


def handle_image_timestamp(s3_info: S3Info, collection_id: str, files: tuple,
                                            passcode: str) -> Union[datetime.datetime, bool, None]:
    """ Implementation of fetching the first found timestamp in a file on S3
    Arguments:
        s3_info: the S3 endpoint information
        collection_id: the ID of the collection
        files: the list of affected files
        passcode: the working passcode
    Return:
        Returns the first found timestamp when successful, False is returned if there's a problem
        with the request, and None if unable to get a timestamp
    """
    # Setup for getting timestamps
    s3_bucket = SPARCD_PREFIX + collection_id

    minio = s3_connect(s3_info)
    if not minio:
        return None

    # Keep trying to get a file timestamp
    file_ts = None
    for one_file in files:
        s3_file = crypt.do_decrypt(passcode, one_file)

        # Get the image from the server
        temp_file = tempfile.mkstemp(suffix=os.path.splitext(s3_file)[1],
                                        prefix=SPARCD_PREFIX)
        os.close(temp_file[0])

        if not download_s3_file(minio, s3_bucket, s3_file, temp_file[1]):
            print('Warning: Unable to find file to change timestamp', flush=True)
            # Clean up the temp file
            if os.path.exists(temp_file[1]):
                os.unlink(temp_file[1])
            continue

        # Try to change the timestamp in the image
        new_ts = image_utils.get_image_timestamp(temp_file[1])

        # Clean up the temp file
        if os.path.exists(temp_file[1]):
            os.unlink(temp_file[1])

        if new_ts is not None:
            file_ts = new_ts
            break

    return file_ts


def handle_adjust_timestamp(s3_info: S3Info, params: AdjustTimestampParams) -> Union[bool, None]:
    """ Handles the adjust timestamps for the images files request
    Arguments:
        s3_info: the S3 endpoint information
        params: the parameters for adjusting the image timestamps
    Return:
        Returns True if everything has worked out, False if there's a problem with
        the parameters, and None if there was a problem
    """
    # If the time adjustments are all zero, we're done
    if all(val == 0 for val in [params.timestamp.year,
                                params.timestamp.month,
                                params.timestamp.day,
                                params.timestamp.hour,
                                params.timestamp.minute,
                                params.timestamp.second]):
        return True

    # If we don't have any files, we're done
    if len(params.files) <= 0:
        return True

    s3_bucket = SPARCD_PREFIX + params.collection_id
    s3_path = make_s3_path((COLLECTIONS_FOLDER, params.collection_id, S3_UPLOADS_PATH_PART,
                                                                                params.upload_id))

    # Get the media file so we can update - use the file name as the index
    media_info = ctu.load_camtrap_media(s3_info, s3_bucket, s3_path,
                                                    key_field=camtrap.CAMTRAP_MEDIA_FILE_NAME_IDX)
    if not media_info:
        return None

    # Loop through the file names and update the timestamp both in the file (if possible)
    # and in the media
    time_adjust = relativedelta(year=params.timestamp.year,
                                month=params.timestamp.month,
                                day=params.timestamp.day,
                                hour=params.timestamp.hour,
                                minute=params.timestamp.minute,
                                second=params.timestamp.second)

    new_media_info = sdtsu.adjust_timestamps(params.files,
                                            sdtsu.TimestampAdjustContext(time_adjust=time_adjust,
                                                                        bucket=s3_bucket,
                                                                        s3_info=s3_info,
                                                                        media_info=media_info
                                                                     )

                                            )

    # Upload the MEDIA csv file to the server
    S3UploadConnection.upload_camtrap_data(s3_info,
                                     s3_bucket,
                                     make_s3_path((s3_path, MEDIA_CSV_FILE_NAME)),
                                     new_media_info.values())

    return True
