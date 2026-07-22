""" Functions to handle requests starting with /sandbox for SPARCd server """

import concurrent.futures
from dataclasses import dataclass
import datetime
import os
import subprocess
import tempfile
from typing import Optional, Union
from dateutil.relativedelta import relativedelta
import dateutil.tz

from minio import S3Error
from moviepy import VideoFileClip
from werkzeug.datastructures import FileStorage, ImmutableMultiDict

from camtrap.v016 import camtrap
import camtrap_utils as ctu
import image_utils
import sparcd_collections as sdc
from sparcd_db import SPARCdDatabase
import sparcd_file_utils as sdfu
from spd_types.dataclasses import UploadResult
from spd_types.userinfo import UserInfo
from spd_types.s3info import S3Info
import sparcd_location_utils as sdlu
import sparcd_sandbox_utils as sdsu
import sparcd_timestamp_utils as sdtsu
import sparcd_upload_utils as sdupu
from s3.s3_access_helpers import make_s3_path, CAMTRAP_FILE_NAMES, DEPLOYMENT_CSV_FILE_NAME, \
                                MEDIA_CSV_FILE_NAME, OBSERVATIONS_CSV_FILE_NAME, SPARCD_PREFIX
from s3.s3_collections import S3CollectionConnection
from s3.s3_images import S3ImageConnection
from s3.s3_uploads import S3UploadConnection

@dataclass
class FileCompareResult:
    """ Internal use class for the return from comparing file checksum results """
    matched: bool | str | None  # True, False, 'Missing', or None
    message: str

@dataclass
class FileInfo:
    """ Internal use class which contains the extracted information from an uploaded file """
    species: Optional[str]
    location: Optional[dict]
    timestamp: Optional[datetime.datetime]

@dataclass
class FileUploadContext:
    """ Internal use class which contains the context for a single file being prepared 
        for upload
    """
    file_obj: FileStorage
    temp_path: str
    file_ext: str
    upload_id: str
    sb_location: Optional[dict]

@dataclass
class PreparedFile:
    """ Internal use class which contains the prepared file information ready for upload """
    upload_path: str
    working_name: str
    working_mimetype: str

@dataclass
class SandboxNewParams:
    """ Contains the parameters for new sandbox calls """
    location_id: str
    collection_id: str
    comment: str
    rel_path: str
    all_files: str
    timestamp: str
    timezone: str

@dataclass
class SandboxFileParams:
    """ Contains the parameters for a sandbox file request """
    upload_id: str
    tz_offset: str
    files: ImmutableMultiDict


@dataclass
class SandboxRecoveryParams:
    """ Contains the parameters for sandbox recovery calls """
    coll_id: str
    upload_key: str
    loc_id: str
    source_path: str

@dataclass
class S3UploadTarget:
    """ Internal class which contains the S3 destination information for an upload """
    s3_info: S3Info
    s3_bucket: str
    s3_path: str

# Needs to be after S3UploadTarget instead of alphabetic order
@dataclass
class FileProcessContext:
    """ Contains the context needed to process a single uploaded file """
    s3_target: S3UploadTarget
    file_obj: FileStorage
    file_ext: str
    upload_id: str
    tz_offset: float
    sb_location: Optional[dict]

@dataclass
class UploadCounts:
    """ Contains the counts of uploads over different time periods """
    num_month: int
    num_year: int
    num_total: int


def __calculate_files_with_species(obs_info: dict) -> int:
    """ Calculates the number of files with observations
    Arguments:
        obs_info: the observation information to review
    Return:
        Returns the number of files that have one or more observed species
    """
    if not obs_info:
        return 0

    # Loop through the file names
    files_species = 0
    for key, data in obs_info.items():
        have_species = False
        if data:
            for one_row in data:
                if one_row and len(one_row) > camtrap.CAMTRAP_OBSERVATION_COUNT_IDX:
                    if one_row[camtrap.CAMTRAP_OBSERVATION_COUNT_IDX] and \
                                one_row[camtrap.CAMTRAP_OBSERVATION_SCIENTIFIC_NAME_IDX] :
                        have_species = True

        if have_species is True:
            files_species += 1

    return files_species


def __compare_one_file(s3_info: S3Info, s3_bucket: str, s3_path: str,
                      file_obj: FileStorage) -> FileCompareResult:
    """ Downloads a single S3 file and compares its checksum to the uploaded one
    Arguments:
        s3_info: S3 endpoint access information
        s3_bucket: the bucket of the file
        s3_path: the path to the file on the S3 endpoint
        file_obj: one request's file object
    """
    file_name = file_obj.filename
    file_ext = os.path.splitext(file_name)[1].lower()
    temp_file = tempfile.mkstemp(suffix=file_ext, prefix=SPARCD_PREFIX)
    os.close(temp_file[0])
    comp_file = tempfile.mkstemp(suffix=file_ext, prefix=SPARCD_PREFIX)
    try:
        file_obj.save(temp_file[1])
        s3_comp_path = make_s3_path((s3_path, file_name))
        S3ImageConnection.download_image(s3_info, s3_bucket, s3_comp_path, comp_file[1])

        if sdfu.file_checksum(temp_file[1]) != sdfu.file_checksum(comp_file[1]):
            return FileCompareResult(False,
                'The current upload folder appears to be incorrect due to existing '
                'images not matching')
        return FileCompareResult(True, 'Success')

    except S3Error as ex:
        s3_comp_path = make_s3_path((s3_path, file_name))  # for error msg
        if ex.code == 'NoSuchKey':
            print(f'ERROR: Missing uploaded file: {s3_bucket} {s3_comp_path}', flush=True)
            print(ex, flush=True)
            return FileCompareResult('Missing',
                f'The uploaded file is not found on the server {file_name}')
        print(f'ERROR: Unexpected exception: {s3_bucket} {s3_comp_path}', flush=True)
        print(ex, flush=True)
        return FileCompareResult(None,
            'An unexpected error occurred while checking already uploaded files')
    finally:
        for path in (temp_file[1], comp_file[1]):
            if os.path.exists(path):
                os.unlink(path)


def __convert_movie(source_name: str, s3_name: str) -> tuple:
    """ Converts movie to MP4 format
    Arguments:
        source_name: the name of the source file to convert
        s3_name: the name of the file on S3
    Return:
        Returns a tuple containing the upload file name, the name of the file on S3, and
        the mime type of the file
    """
    mp4_filename = os.path.splitext(source_name)[0] + '.mp4'
    remote_name = os.path.splitext(s3_name)[0] + '.mp4'
    try:
        video_clip = VideoFileClip(source_name)
        video_clip.write_videofile(mp4_filename,
                         codec='libx264',
                         audio_codec='aac',
                         ffmpeg_params=['-preset', 'fast', '-crf', '23', '-threads', '4'],
                         logger=None)
        video_clip.close()

        metadata_output = mp4_filename.replace('.mp4', '_meta.mp4')
        subprocess.run(
            [
                'ffmpeg', '-y',
                '-i', mp4_filename,
                '-i', source_name,
                '-map', '0',
                '-map_metadata', '1',
                '-codec', 'copy',
                metadata_output
            ],
            check=True,
            capture_output=True
        )
        os.replace(metadata_output, mp4_filename)

        return mp4_filename, remote_name, 'video/mp4'

    except (OSError, subprocess.CalledProcessError) as ex:
        if os.path.exists(mp4_filename):
            os.unlink(mp4_filename)
        raise ex


def __count_uploads(all_collections: list) -> UploadCounts:
    """ Counts uploads over different time periods
    Arguments:
        all_collections: the list of collections to count uploads for
    Return:
        Returns an UploadCounts instance containing the counts
    """
    now_dt = datetime.datetime.today()
    one_month_ago = now_dt - relativedelta(months=1)
    one_year_ago = now_dt - relativedelta(years=1)
    num_month = 0
    num_year = 0
    num_total = 0
    for coll in all_collections:
        num_total += len(coll['uploads'])
        for upload in coll['uploads']:
            up_dt = datetime.datetime(year=int(upload['date']['date']['year']),
                                      month=int(upload['date']['date']['month']),
                                      day=int(upload['date']['date']['day']))
            if up_dt >= one_year_ago:
                num_year += 1
                if up_dt >= one_month_ago:
                    num_month += 1
    return UploadCounts(num_month=num_month, num_year=num_year, num_total=num_total)


def __get_file_info(temp_path: str, file_ext: str, tz_offset: float) -> FileInfo:
    """ Extracts metadata from an uploaded file, applying timezone if needed
    Arguments:
        temp_path: path to the temporary file
        file_ext: the file extension, lowercased
        tz_offset: the timezone offset in hours
    Return:
        Returns a FileInfo instance containing the extracted information
    """
    if file_ext not in sdupu.UPLOAD_KNOWN_MOVIE_EXT:
        species, location, timestamp = image_utils.get_embedded_image_info(temp_path)
    else:
        species, location, timestamp = (None, None, image_utils.get_movie_timestamp(temp_path))

    # Apply timezone if timestamp is naive
    # https://docs.python.org/3/library/datetime.html#determining-if-an-object-is-aware-or-naive
    if timestamp and (timestamp.tzinfo is None or
                      timestamp.tzinfo.utcoffset(timestamp) is None):
        timestamp = timestamp.replace(tzinfo=dateutil.tz.tzoffset(None, tz_offset * 60 * 60))

    return FileInfo(species=species, location=location, timestamp=timestamp)


def __prepare_upload_file(context: FileUploadContext,
                          metadata: FileInfo) -> PreparedFile:
    """ Updates file location metadata and converts format if needed
    Arguments:
        context: the file upload context
        metadata: the extracted file metadata
    Return:
        Returns a PreparedFile instance containing the upload path, working name, and mimetype
    """
    # Update location in file metadata if needed
    needs_location_update = metadata is None or not metadata.location or \
        (context.sb_location and metadata.location and
         context.sb_location['idProperty'] != metadata.location['id'])

    if needs_location_update and context.file_ext not in sdupu.UPLOAD_KNOWN_MOVIE_EXT:
        if not image_utils.update_image_file_exif(context.temp_path,
                                           location=image_utils.ImageLocationData(
                                                loc_id=context.sb_location['idProperty'],
                                                loc_name=context.sb_location['nameProperty'],
                                                loc_ele=context.sb_location['elevationProperty'],
                                                loc_lat=context.sb_location['latProperty'],
                                                loc_lon=context.sb_location['lngProperty']
                                            )
                                         ):
            print(f'Warning: Unable to update sandbox file with the location: '
                  f'{context.file_obj.filename} with upload_id {context.upload_id}', flush=True)

    if context.file_ext in ('.mov', '.avi'):
        try:
            upload_path, working_name, working_mimetype = \
                __convert_movie(context.temp_path, context.file_obj.filename)
        except (OSError, subprocess.CalledProcessError) as ex:
            print(f'Exception caught when converting MOV to .mp4: {context.temp_path}',
                  flush=True)
            print(ex, flush=True)
            if os.path.exists(context.temp_path):
                os.unlink(context.temp_path)
            raise
    else:
        upload_path = context.temp_path
        working_name = context.file_obj.filename
        working_mimetype = context.file_obj.mimetype

    return PreparedFile(upload_path=upload_path,
                        working_name=working_name,
                        working_mimetype=working_mimetype)


def __prepare_and_upload(context: FileProcessContext) -> UploadResult:
    """ Handles preparing and uploading a file to S3 with no database access
    Arguments:
        context: the parameters needed for processing one file
    Return:
        Returns an UploadResult containing everything needed for the database write
    """
    temp_file = tempfile.mkstemp(suffix=context.file_ext, prefix=SPARCD_PREFIX)
    os.close(temp_file[0])
    context.file_obj.save(temp_file[1])

    upload_context = FileUploadContext(file_obj=context.file_obj,
                                       temp_path=temp_file[1],
                                       file_ext=context.file_ext,
                                       upload_id=context.upload_id,
                                       sb_location=context.sb_location)
    prepared_file = None
    try:
        if context.file_ext in sdupu.UPLOAD_KNOWN_MOVIE_EXT:
            prepared_file = __prepare_upload_file(upload_context, None)
            file_info = __get_file_info(prepared_file.upload_path, '.mp4', context.tz_offset)
        else:
            file_info = __get_file_info(upload_context.temp_path, upload_context.file_ext,
                                        context.tz_offset)
            prepared_file = __prepare_upload_file(upload_context, file_info)

        working_ts = file_info.timestamp.isoformat() if file_info.timestamp else None

        S3UploadConnection.upload_file(context.s3_target.s3_info,
                                       context.s3_target.s3_bucket,
                                       make_s3_path((context.s3_target.s3_path,
                                                     prepared_file.working_name)),
                                       prepared_file.upload_path)

        return UploadResult(working_name=prepared_file.working_name,
                            working_mimetype=prepared_file.working_mimetype,
                            timestamp=working_ts,
                            species=file_info.species,
                            location=file_info.location,
                            upload_id=context.upload_id,
                            original_name=context.file_obj.filename)
    finally:
        if os.path.exists(upload_context.temp_path):
            os.unlink(upload_context.temp_path)
        if prepared_file and os.path.exists(prepared_file.upload_path):
            os.unlink(prepared_file.upload_path)


def __update_media_csv(db: SPARCdDatabase,
                       user_info: UserInfo,
                       target: S3UploadTarget,
                       upload_id: str,
                       renamed_files: tuple) -> None:
    """ Updates the media CSV file with mime types and timestamps
    Arguments:
        db: the database instance
        user_info: the user information
        target: the S3 destination information
        upload_id: the ID of the upload
        renamed_files: tuple of renamed files
    """
    media_info = ctu.load_camtrap_media(target.s3_info, target.s3_bucket, target.s3_path)
    if not media_info:
        return

    if renamed_files:
        media_info = ctu.media_renamed(media_info, renamed_files)

    for one_key, one_type in db.get_file_mimetypes(user_info.name, upload_id):
        media_info[one_key][camtrap.CAMTRAP_MEDIA_TYPE_IDX] = one_type

    for one_key, one_ts in db.get_file_created_timestamp(user_info.name, upload_id):
        media_info[one_key][camtrap.CAMTRAP_MEDIA_TIMESTAMP_IDX] = one_ts

    S3UploadConnection.upload_camtrap_data(target.s3_info,
                                     target.s3_bucket,
                                     make_s3_path((target.s3_path, MEDIA_CSV_FILE_NAME)),
                                     (media_info[one_key] for one_key in media_info.keys()))


def __update_observations_csv(db: SPARCdDatabase,
                               user_info: UserInfo,
                               target: S3UploadTarget,
                               upload_id: str,
                               renamed_files: tuple) -> None:
    """ Updates the observations CSV file with species information
    Arguments:
        db: the database instance
        user_info: the user information
        target: the S3 destination information
        upload_id: the ID of the upload
        renamed_files: tuple of renamed files
    """
    file_species = tuple(db.get_file_species(user_info.name, upload_id))
    if not file_species and not renamed_files:
        return

    deployment_info = ctu.load_camtrap_deployments(target.s3_info, target.s3_bucket,
                                                    target.s3_path)
    obs_info = ctu.load_camtrap_observations(target.s3_info, target.s3_bucket, target.s3_path)

    if renamed_files:
        obs_info = ctu.observations_renamed(obs_info, renamed_files)

    if file_species:
        obs_info = ctu.update_observations(target.s3_path, obs_info, file_species,
                                    deployment_info[0][camtrap.CAMTRAP_DEPLOYMENT_ID_IDX])

    row_groups = (obs_info[one_key] for one_key in obs_info)
    S3UploadConnection.upload_camtrap_data(target.s3_info,
                                target.s3_bucket,
                                make_s3_path((target.s3_path, OBSERVATIONS_CSV_FILE_NAME)),
                                [one_row for one_set in row_groups for one_row in one_set])


def handle_sandbox(db: SPARCdDatabase, user_info: UserInfo, s3_info: S3Info) -> tuple:
    """ Handles loading sandbox information
    Arguments:
        db: the database instance
        user_info: the user information
        s3_info: the S3 endpoint information
    Return:
        Returns a tuple of the loaded sandbox information
    """
    is_admin = bool(user_info.admin)

    # Get the sandbox information from the database
    sandbox_items = db.get_sandbox(s3_info.id)
    if not is_admin:
        sandbox_items = [item for item in sandbox_items if item["user"] == user_info.name]

    # Get the collections to fill in the return data (from the DB only - no S3 connection info)
    all_collections = sdc.load_collections(db, is_admin, s3_info)

    # Get the sandbox collection regardless if we were able to load collections
    return sdsu.get_sandbox_collections(s3_info, sandbox_items, all_collections)


def handle_sandbox_stats(db: SPARCdDatabase, user_info: UserInfo, s3_info: S3Info,
                                        stats_temp_filename: str, stats_timeout_sec: int) -> list:
    """ Handles loading and/or creating sandbox statistics
    Arguments:
        db: the database instance
        user_info: the user information
        s3_info: the S3 endpoint information
        stats_temp_filename: the file path of the temporary stats file
        stats_timeout_sec: the timeout of the stats file
    Return:
        Return a list of the sandbox statistics, or an empty list if data can't be found
    """
    # Check if we already have the stats in a well known file name (known to us)
    temp_path = os.path.join(tempfile.gettempdir(), stats_temp_filename)
    stats = sdfu.load_timed_info(temp_path, stats_timeout_sec)
    if stats is not None:
        return stats

    # Get all the collections so we can parse them for our stats
    all_collections = sdc.load_collections(db, bool(user_info.admin), s3_info)
    if not all_collections:
        return []

    # Get the upload counts
    counts = __count_uploads(all_collections)

    # Save the stats and then return them
    stats = [['Uploads last month', counts.num_month],
             ['Uploads last year', counts.num_year],
             ['Total uploads', counts.num_total],
            ]
    sdfu.save_timed_info(temp_path, stats)

    return stats

def handle_sandbox_recovery_update(db: SPARCdDatabase,
                                   user_info: UserInfo,
                                   s3_info: S3Info,
                                   recovery_params: SandboxRecoveryParams) \
                                                                    -> Union[tuple, None, False]:
    """ Handles updating the database for sandbox recovery
    Arguments:
        db: the database instance
        user_info: the user information
        s3_info: the S3 endpoint information
        recovery_params: the recovery parameters dataclass instance
    Return:
        A tuple containing the upload ID, and the list of files for the upload upon success. False
        is returned if there is a problem. None is returned if the upload isn't found or the
        database can't be updated
    """
    is_admin = bool(user_info.admin)

    # Get the collection we need
    all_colls = sdc.load_collections(db, is_admin, s3_info)
    if not all_colls:
        print('Unable to load collections for updating an upload recovery', flush=True)
        return False

    coll = [one_coll for one_coll in all_colls if one_coll["id"] == recovery_params.coll_id]
    if not coll:
        print('Unable to find the collection needed to update an upload recovery ' \
                            f'{recovery_params.coll_id} {recovery_params.upload_key}', flush=True)
        return False
    coll = coll[0]

    # Find the upload in the collection
    upload = [one_up for one_up in coll['uploads'] if one_up["key"] == recovery_params.upload_key]
    if not upload:
        print('Unable to find the recovery upload in the collections ' \
                                        f'{recovery_params.coll_id} {recovery_params.upload_key}',
                                                                                        flush=True)
        return False
    upload = upload[0]

    # Find the location
    cur_locations = sdlu.load_locations(s3_info)
    our_location = sdlu.get_location_info(recovery_params.loc_id, cur_locations)
    if not our_location:
        print('Unable to find the location for upload recovery ' \
              f'{recovery_params.coll_id} {recovery_params.upload_key} {recovery_params.loc_id}',
                                                                                        flush=True)
        return False

    # Make sure this user has permissions to do this
    if not is_admin and user_info.name != upload['uploadUser']:
        return False

    # Update the upload in the database
    result = db.sandbox_upload_recovery_update(s3_info.id,
                                                user_info.name,
                                                coll['bucket'],
                                                upload['key'],
                                                recovery_params.source_path,
                                                our_location['idProperty'],
                                                our_location['nameProperty'],
                                                our_location['latProperty'],
                                                our_location['lngProperty'],
                                                our_location['elevationProperty'])
    return result


def handle_sandbox_check_continue_upload(db: SPARCdDatabase,
                                         user_info: UserInfo,
                                         s3_info: S3Info,
                                         upload_id: str,
                                         files: tuple) -> tuple:
    """ Checks if a sandbox file already uploaded matches what we've just received
    Arguments:
        db: the database instance
        user_info: the user information
        s3_info: the S3 endpoint information
        upload_id: the ID of the upload to check
        files: the list of files to check
    Return:
        Returns a tuple containing a boolean indicating all that all the files on the
        server appear to match (when True), or not (when False), and a message indicating
        the sucess, or information on what went wrong
    """
    # Get the S3 information
    s3_bucket, s3_path = db.sandbox_get_s3_info(user_info.name, upload_id)

    if S3ImageConnection.have_images(s3_info, s3_bucket, s3_path):
        for one_file in files:
            result = __compare_one_file(s3_info, s3_bucket, s3_path, files[one_file])

        if result.matched is not True:
            return result.matched, result.message

    return True, 'Success'


def handle_sandbox_new(db: SPARCdDatabase,
                       user_info: UserInfo,
                       s3_info: S3Info,
                       new_params: SandboxNewParams) -> Optional[str]:
    """ Handles a new sandbox request
    Arguments:
        db: the database instance
        user_info: the user information
        s3_info: the S3 endpoint information
        new_params: the parameters for the new sandbox
    Return:
        Returns the ID of the new sandbox upload
    """
    client_ts = datetime.datetime.fromisoformat(new_params.timestamp).\
                                                astimezone(dateutil.tz.gettz(new_params.timezone))
    s3_bucket, s3_path = S3UploadConnection.create_upload(s3_info,
                                                    new_params.collection_id,
                                                    new_params.comment,
                                                    client_ts,
                                                    len(new_params.all_files)
                                                    )

    # Upload the CAMTRAP files to S3 storage
    cur_locations = sdlu.load_locations(s3_info)
    our_location = sdlu.get_location_info(new_params.location_id, cur_locations)
    deployment_id = s3_bucket[len(SPARCD_PREFIX):] + ':' + new_params.location_id
    for one_file in CAMTRAP_FILE_NAMES:
        if one_file == DEPLOYMENT_CSV_FILE_NAME:
            data = ','.join(ctu.create_deployment_data(camtrap.CamTrap,deployment_id, our_location))
        elif one_file == MEDIA_CSV_FILE_NAME:
            media_data = ctu.create_media_data(camtrap.CamTrap, deployment_id, s3_path,
                                                                            new_params.all_files)

            data = '\n'.join([','.join(one_media) for one_media in media_data])
        else:
            data = '\n'.join([','.join(one_obs) for one_obs in \
                    ctu.create_observation_data(camtrap.CamTrap,deployment_id, s3_path,
                                                                            new_params.all_files)])

        S3UploadConnection.upload_file_data(s3_info, s3_bucket,
                                        s3_path + '/' + one_file, data, 'application/csv')

    # Add the entries to the database
    upload_id = db.sandbox_new_upload(s3_info.id,
                                      user_info.name,
                                      new_params.rel_path,
                                      new_params.all_files,
                                      s3_bucket,
                                      s3_path,
                                      our_location['idProperty'],
                                      our_location['nameProperty'],
                                      our_location['latProperty'],
                                      our_location['lngProperty'],
                                      our_location['elevationProperty']
                                      )

    # Update the collection to reflect the new upload
    updated_collection = S3CollectionConnection.get_collection_info(s3_info, s3_bucket)
    if updated_collection:
        updated_collection = sdupu.normalize_collection(updated_collection)

        # Update the collection entry in the database
        sdc.collection_update(db, s3_info.id, updated_collection)

    # Return the new ID
    return upload_id


def handle_sandbox_file(db: SPARCdDatabase,
                       user_info: UserInfo,
                       s3_info: S3Info,
                       file_params: SandboxFileParams) -> None:
    """ Handles the upload of a sandbox file
    Arguments:
        db: the database instance
        user_info: the user information
        s3_info: the S3 endpoint information
        file_params: parameters for handling an uploaded sandbox file
    """
    # Normalize the timestamp into offset hours. If invalid, uses local timezone
    tz_offset = sdtsu.get_tz_offset(file_params.tz_offset)

    s3_bucket, s3_path = db.sandbox_get_s3_info(user_info.name, file_params.upload_id)
    s3_target = S3UploadTarget(s3_info=s3_info, s3_bucket=s3_bucket, s3_path=s3_path)
    sb_location = db.sandbox_get_location(user_info.name, file_params.upload_id)

    max_workers = min(len(file_params.files), 4)
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(__prepare_and_upload,
                            FileProcessContext(
                                s3_target=s3_target,
                                file_obj=file_params.files[one_file],
                                file_ext=os.path.splitext(one_file)[1].lower(),
                                upload_id=file_params.upload_id,
                                tz_offset=tz_offset,
                                sb_location=sb_location)): one_file
            for one_file in file_params.files
        }
        for future in concurrent.futures.as_completed(futures):
            result = future.result()
            db.sandbox_record_uploaded_file(user_info.name, result)


def handle_sandbox_completed(db: SPARCdDatabase,
                             user_info: UserInfo,
                             s3_info: S3Info,
                             upload_id: str) -> bool:
    """ Handles when a sandbox upload is complete
    Arguments:
        db: the database instance
        user_info: the user information
        s3_info: the S3 endpoint information
        upload_id: the ID of the upload
    """
    s3_bucket, s3_path = db.sandbox_get_s3_info(user_info.name, upload_id)

    if not s3_bucket or not s3_path:
        return False

    # Check where we left off — allows safe retry from any point
    completion_status = db.sandbox_get_completion_status(user_info.name, upload_id)
    if completion_status is None:
        return False

    # Already fully completed
    if completion_status >= 3:
        return True

    target = S3UploadTarget(s3_info=s3_info, s3_bucket=s3_bucket, s3_path=s3_path)
    renamed_files = tuple(db.get_files_renamed(user_info.name, upload_id))

    if completion_status < 1:
        __update_media_csv(db, user_info, target, upload_id, renamed_files)
        db.sandbox_set_completion_status(user_info.name, upload_id, 1)

    if completion_status < 2:
        __update_observations_csv(db, user_info, target, upload_id, renamed_files)
        db.sandbox_set_completion_status(user_info.name, upload_id, 2)

    # Always recalculate from the observations CSV — handles retry after crash
    # between status 2 and 3 where metadata update may not have completed
    obs_info = ctu.load_camtrap_observations(target.s3_info, target.s3_bucket, target.s3_path)
    #num_files_with_species = sum(1 for val in obs_info.values() if val) if obs_info else 0
    num_files_with_species = __calculate_files_with_species(obs_info)

    # Clean up any temporary files
    for one_filename in [MEDIA_CSV_FILE_NAME, OBSERVATIONS_CSV_FILE_NAME]:
        del_path = os.path.join(tempfile.gettempdir(),
                    SPARCD_PREFIX+s3_bucket+'_'+os.path.basename(s3_path)+'_'+one_filename)
        if os.path.exists(del_path):
            os.unlink(del_path)

    if num_files_with_species > 0:
        S3UploadConnection.update_upload_metadata_image_species(s3_info, s3_bucket, s3_path,
                                                                num_files_with_species)

    updated_collection = S3CollectionConnection.get_collection_info(s3_info, s3_bucket)
    if updated_collection:
        updated_collection = sdupu.normalize_collection(updated_collection)
        sdc.collection_update(db, s3_info.id, updated_collection)

    # Sets completion_status=3 and resets path to ""
    db.sandbox_upload_complete(user_info.name, upload_id)

    return True
