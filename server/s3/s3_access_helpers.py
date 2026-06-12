""" Shared helpers, constants, and private functions for S3 access modules """

import csv
import concurrent.futures
from contextlib import contextmanager
from io import BytesIO, StringIO
import json
import os
import tempfile
import traceback
from typing import Optional, Union
import uuid
from minio import Minio, S3Error

from camtrap.v016 import camtrap

# Prefix for SPARCd things
SPARCD_PREFIX = 'sparcd-'

# Our bucket prefix
BUCKET_PREFIX = SPARCD_PREFIX
# Prefix for settings buckets
SETTINGS_BUCKET_PREFIX = BUCKET_PREFIX + 'settings-'
# Prefix for legacy settings bucket
SETTINGS_BUCKET_LEGACY = 'sparcd'

# Folder under which settings can be found
SETTINGS_FOLDER = 'Settings'

# Folder under which collections can be found
COLLECTIONS_FOLDER = 'Collections'

# Configuration file name for collections
COLLECTION_JSON_FILE_NAME = 'collection.json'

# Configuration file name for permissions
PERMISSIONS_JSON_FILE_NAME = 'permissions.json'

# Configuration file name for locations (case must match S3)
LOCATIONS_JSON_FILE_NAME = 'locations.json'
# Configuration file name for settings (case must match S3)
SETTINGS_JSON_FILE_NAME = 'settings.json'
# Configuration file name for species (case must match S3)
SPECIES_JSON_FILE_NAME = 'species.json'

# CamTrap deployment CSV name on S3
DEPLOYMENT_CSV_FILE_NAME = 'deployments.csv'
# CamTrap media CSV name on S3
MEDIA_CSV_FILE_NAME = 'media.csv'
# CamTrap observation CSV name on S3
OBSERVATIONS_CSV_FILE_NAME = 'observations.csv'
# All CamTrap CSV names on S3
CAMTRAP_FILE_NAMES = [DEPLOYMENT_CSV_FILE_NAME, MEDIA_CSV_FILE_NAME, OBSERVATIONS_CSV_FILE_NAME]

# S3 path particle for uploads
S3_UPLOADS_PATH_PART = 'Uploads/'

# The metadata JSON file name for uploads
S3_UPLOAD_META_JSON_FILE_NAME = 'UploadMeta.json'

# Array of configuration files
CONFIGURATION_FILES_LIST = [LOCATIONS_JSON_FILE_NAME, SETTINGS_JSON_FILE_NAME,
                             SPECIES_JSON_FILE_NAME]

# Maximum number of times to attempt to create a bucket
MAX_NEW_BUCKET_TRIES = 10


# =============================================================================
# Context managers
# =============================================================================

@contextmanager
def temp_s3_file(suffix: str = None):
    """ Context manager that creates a temporary file and removes it on exit
    Arguments:
        suffix: optional suffix to the file name
    """
    temp_file = tempfile.mkstemp(prefix=SPARCD_PREFIX, suffix=suffix)
    os.close(temp_file[0])
    try:
        yield temp_file[1]
    finally:
        if os.path.exists(temp_file[1]):
            os.unlink(temp_file[1])


# =============================================================================
# Low-level S3 file operations
# =============================================================================

def make_s3_path(parts: tuple) -> str:
    """ Makes the parts into an S3 path
    Arguments:
        parts: the path particles
    Return:
        The parts joined into an S3 path
    """
    return '/'.join([one_part.rstrip('/').rstrip('\\') for one_part in parts])


def download_s3_file(minio: Minio, bucket: str, file: str, dest_file: str) -> bool:
    """Downloads files from S3 server
    Arguments:
        minio: the s3 client instance
        bucket: the bucket to download from
        file: the S3 file to download and read
        dest_file: the file to write the download to
    Return:
        Returns True if the file was downloaded, and False if there was a problem
    Notes:
        It is up to the caller to clean up the downloaded file
    """
    try:
        minio.fget_object(bucket, file, dest_file)
        return True
    except S3Error as ex:
        if ex.code != 'NoSuchKey':
            raise ex
    return False


def get_s3_file(minio: Minio, bucket: str, file: str, dest_file: str):
    """Downloads files from S3 server and returns the contents
    Arguments:
        minio: the s3 client instance
        bucket: the bucket to download from
        file: the S3 file to download and read
        dest_file: the file to write the download to
    Returns:
        Returns the content of the file or None if there was an error
    Notes:
        It is up to the caller to clean up the downloaded file
    """
    try:
        minio.fget_object(bucket, file, dest_file)
        with open(dest_file, 'r', encoding='utf-8') as in_file:
            return in_file.read()
    except S3Error as ex:
        if ex.code != 'NoSuchKey':
            raise ex
    return None


def put_s3_file(minio: Minio, bucket: str, file: str, src_file: str,
                content_type: str = 'text/plain') -> None:
    """ Upload files to the S3 server
    Arguments:
        minio: the s3 client instance
        bucket: the bucket to upload to
        file: the S3 file to update
        src_file: the location of the file to upload to the server
        content_type: the content type of the upload
    """
    try:
        minio.fput_object(bucket, file, src_file, content_type=content_type)
    except S3Error as ex:
        if ex.code != 'NoSuchKey':
            raise ex


# =============================================================================
# JSON helpers
# =============================================================================

def load_s3_json(minio: Minio, bucket: str, path: str, temp_path: str,
                   caller: str) -> Union[dict, bool, None]:
    """ Loads and parses a JSON file from S3
    Arguments:
        minio: the S3 client instance
        bucket: the bucket to load from
        path: the path to the file on S3
        temp_path: the temporary file path to use for downloading
        caller: the calling function name for error messages
    Return:
        Returns the parsed JSON dict, None if there is no data to load, and False if a
        problem is found
    """
    data = get_s3_file(minio, bucket, path, temp_path)
    if data is None:
        print(f'{caller}: Unable to get upload information: {path}')
        return None
    try:
        return json.loads(data)
    except json.JSONDecodeError:
        print(f'{caller}: Unable to load JSON information: {path}')
        return False


def put_s3_json(minio: Minio, bucket: str, path: str, data: dict) -> str:
    """ Serializes a dict to JSON and uploads it to S3
    Arguments:
        minio: the S3 client instance
        bucket: the bucket to upload to
        path: the path to upload to
        data: the dict to serialize and upload
    Return:
        Returns the serialized JSON string
    """
    json_str = json.dumps(data, indent=2)
    minio.put_object(bucket, path, BytesIO(json_str.encode()), len(json_str),
                     content_type='application/json')
    return json_str


def load_upload_meta(minio: Minio, bucket: str,
                       upload_path: str, caller: str) -> Optional[dict]:
    """ Loads the upload metadata JSON from S3
    Arguments:
        minio: the S3 client instance
        bucket: the bucket to load from
        upload_path: the upload path
        caller: the calling function name for error messages
    Return:
        Returns the parsed upload metadata dict, or None if a problem is found
    """
    upload_info_path = make_s3_path((upload_path, S3_UPLOAD_META_JSON_FILE_NAME))
    with temp_s3_file() as temp_path:
        return load_s3_json(minio, bucket, upload_info_path, temp_path, caller)


# =============================================================================
# CSV helpers
# =============================================================================

def load_deployment_location(minio: Minio, bucket: str, upload_path: str,
                                temp_path: str) -> Optional[dict]:
    """ Loads location data from the deployment CSV file
    Arguments:
        minio: the S3 client instance
        bucket: the bucket to load from
        upload_path: the upload path
        temp_path: the temporary file path to use for downloading
    Return:
        Returns a dict of location data or None if not found
    """
    deployment_path = make_s3_path((upload_path, DEPLOYMENT_CSV_FILE_NAME))
    csv_data = get_s3_file(minio, bucket, deployment_path, temp_path)
    if csv_data is None:
        print(f'Unable to get deployment information: {deployment_path}')
        return None

    reader = csv.reader(StringIO(csv_data))
    for csv_info in reader:
        if csv_info and len(csv_info) >= 22:
            return {
                'location': csv_info[camtrap.CAMTRAP_DEPLOYMENT_LOCATION_ID_IDX],
                'elevation': csv_info[camtrap.CAMTRAP_DEPLOYMENT_CAMERA_HEIGHT_IDX],
                'loc_name': csv_info[camtrap.CAMTRAP_DEPLOYMENT_LOCATION_NAME_IDX],
                'loc_lon': csv_info[camtrap.CAMTRAP_DEPLOYMENT_LONGITUDE_IDX],
                'loc_lat': csv_info[camtrap.CAMTRAP_DEPLOYMENT_LATITUDE_IDX],
            }
    return None


def load_upload_observations(minio: Minio, bucket: str, obj_path: str,
                                temp_path: str) -> list:
    """ Loads the observations CSV and builds a list of images with species data
    Arguments:
        minio: the S3 client instance
        bucket: the bucket to load from
        obj_path: the upload object path
        temp_path: temporary file path for downloads
    Return:
        Returns a list of image dicts with species information
    """
    upload_info_path = make_s3_path((obj_path, OBSERVATIONS_CSV_FILE_NAME))
    csv_data = get_s3_file(minio, bucket, upload_info_path, temp_path)
    if csv_data is None:
        print(f'Unable to get observation information: {upload_info_path}')
        return []

    cur_images = []
    cur_row = 0
    reader = csv.reader(StringIO(csv_data))
    for csv_info in reader:
        cur_row += 1
        if len(csv_info) < 20:
            if csv_info:
                print(f'Invalid CSV row ({cur_row}) read from {upload_info_path}')
            continue

        cur_species = {
            'name': get_common_name(csv_info[camtrap.CAMTRAP_OBSERVATION_COMMENT_IDX]),
            'scientificName': csv_info[camtrap.CAMTRAP_OBSERVATION_SCIENTIFIC_NAME_IDX],
            'count': csv_info[camtrap.CAMTRAP_OBSERVATION_COUNT_IDX]
        }
        image_name = os.path.basename(
            csv_info[camtrap.CAMTRAP_OBSERVATION_MEDIA_ID_IDX].rstrip('/\\'))
        s3_path = csv_info[camtrap.CAMTRAP_OBSERVATION_MEDIA_ID_IDX]

        existing = next((img for img in cur_images
                         if img['name'] == image_name
                         and img['bucket'] == bucket
                         and img['s3_path'] == s3_path), None)
        if existing:
            existing['species'].append(cur_species)
        else:
            cur_images.append({
                'name': image_name,
                'timestamp': csv_info[camtrap.CAMTRAP_OBSERVATION_TIMESTAMP_IDX],
                'bucket': bucket,
                's3_path': s3_path,
                'species': [cur_species]
            })

    return cur_images


def apply_media_timestamps(minio: Minio, bucket: str, upload_path: str,
                              images_dict: dict, temp_path: str) -> None:
    """ Loads the media CSV and applies timestamps to the images dict
    Arguments:
        minio: the S3 client instance
        bucket: the bucket to load from
        upload_path: the upload path
        images_dict: the dict of images keyed by s3_path to update in place
        temp_path: temporary file path for downloads
    """
    media_info_path = make_s3_path((upload_path, MEDIA_CSV_FILE_NAME))
    csv_data = get_s3_file(minio, bucket, media_info_path, temp_path)
    if csv_data is None:
        print(f'Unable to get media information: {media_info_path}')
        return

    reader = csv.reader(StringIO(csv_data))
    for csv_info in reader:
        cur_img = images_dict.get(csv_info[camtrap.CAMTRAP_MEDIA_ID_IDX])
        if cur_img is not None:
            cur_img['timestamp'] = csv_info[camtrap.CAMTRAP_MEDIA_TIMESTAMP_IDX]
        else:
            print(f'Unable to find media image: {csv_info[camtrap.CAMTRAP_MEDIA_ID_IDX]}')


def apply_observation_species(minio: Minio, bucket: str, upload_path: str,
                                 images_dict: dict, temp_path: str) -> None:
    """ Loads the observations CSV and applies species data to the images dict
    Arguments:
        minio: the S3 client instance
        bucket: the bucket to load from
        upload_path: the upload path
        images_dict: the dict of images keyed by s3_path to update in place
        temp_path: temporary file path for downloads
    """
    upload_info_path = make_s3_path((upload_path, OBSERVATIONS_CSV_FILE_NAME))
    csv_data = get_s3_file(minio, bucket, upload_info_path, temp_path)
    if csv_data is None:
        print(f'Unable to get observations information: {upload_info_path}')
        return

    reader = csv.reader(StringIO(csv_data))
    for csv_info in reader:
        cur_img = images_dict.get(csv_info[camtrap.CAMTRAP_OBSERVATION_MEDIA_ID_IDX])
        if cur_img is None:
            print(f'Unable to find observation image: '
                  f'{csv_info[camtrap.CAMTRAP_OBSERVATION_MEDIA_ID_IDX]}')
            continue

        if not csv_info[camtrap.CAMTRAP_OBSERVATION_SCIENTIFIC_NAME_IDX] or \
                not csv_info[camtrap.CAMTRAP_OBSERVATION_COUNT_IDX]:
            continue

        if cur_img.get('species') is None:
            cur_img['species'] = []

        cur_img['species'].append({
            'name': get_common_name(csv_info[camtrap.CAMTRAP_OBSERVATION_COMMENT_IDX]),
            'scientificName': csv_info[camtrap.CAMTRAP_OBSERVATION_SCIENTIFIC_NAME_IDX],
            'count': csv_info[camtrap.CAMTRAP_OBSERVATION_COUNT_IDX]
        })


# =============================================================================
# Collection and upload helpers
# =============================================================================

def get_common_name(csv_comment: str) -> Optional[str]:
    """ Returns the common name from a CSV observation comment
    Arguments:
        csv_comment: the comment to parse
    Return:
        The found common name or None
    Notes:
        The expected common name format is [COMMONNAME:<name>]
    """
    common_name = None
    if '[' in csv_comment and ']' in csv_comment and 'COMMONNAME:' in csv_comment:
        lindex = csv_comment.find('[')
        rindex = csv_comment.find(']')
        cindex = csv_comment.find('COMMONNAME:')
        if lindex < cindex < rindex:
            start_index = cindex + len('COMMONNAME:')
            common_name = csv_comment[start_index:rindex]
    return common_name


def get_user_collections(minio: Minio, user: str, buckets: tuple) -> tuple:
    """ Gets the collections that the user can access
    Arguments:
        minio: the s3 client instance
        user: the name of the user to check permissions for
        buckets: the list of buckets to check
    Return:
        Returns a tuple containing the collections and buckets that the user has permissions for
    """
    user_collections = []

    with temp_s3_file() as temp_path:
        for one_bucket in buckets:
            base_path = make_s3_path((COLLECTIONS_FOLDER, one_bucket[len(SPARCD_PREFIX):]))

            coll_info_path = make_s3_path((base_path, COLLECTION_JSON_FILE_NAME))
            coll_data = get_s3_file(minio, one_bucket, coll_info_path, temp_path)
            if coll_data is None or not coll_data:
                continue
            coll_data = json.loads(coll_data)

            permissions_path = make_s3_path((base_path, PERMISSIONS_JSON_FILE_NAME))
            perm_data = get_s3_file(minio, one_bucket, permissions_path, temp_path)

            if perm_data is not None:
                perms = json.loads(perm_data)
                found_perm = None
                for one_perm in perms:
                    if one_perm and 'usernameProperty' in one_perm and \
                            one_perm['usernameProperty'] == user:
                        found_perm = one_perm
                        break
                coll_data.update({'bucket': one_bucket,
                                  'base_path': base_path,
                                  'permissions': found_perm,
                                  'all_permissions': perms})
                user_collections.append(coll_data)

    return tuple(user_collections)


def get_uploaded_folders(minio: Minio, bucket: str, upload_path: str) -> tuple:
    """ Gets the folders that were uploaded under the path
    Arguments:
        minio: the S3 instance
        bucket: the bucket to load from
        upload_path: the top-level folder for the upload
    Return:
        A tuple of folder names under the upload folder
    """
    subfolders = []
    upload_path = upload_path.rstrip('/') + '/'
    for one_obj in minio.list_objects(bucket, prefix=upload_path):
        if one_obj.is_dir and one_obj.object_name != upload_path:
            subfolders.append(one_obj.object_name[len(upload_path):].strip('/').strip('\\'))
    return subfolders


def update_user_collections(minio: Minio, collections: tuple) -> tuple:
    """Updates the collections returned by get_user_collections()
    Arguments:
        minio: the s3 client instance
        collections: the tuple of collections
    Return:
        Returns the tuple of updated collections
    """
    user_collections = []
    all_uploads_paths = {}

    for one_coll in collections:
        uploads_path = make_s3_path((one_coll['base_path'], S3_UPLOADS_PATH_PART)) + '/'
        for one_obj in minio.list_objects(one_coll['bucket'], prefix=uploads_path):
            if one_obj.is_dir and one_obj.object_name != uploads_path:
                if one_coll['bucket'] not in all_uploads_paths:
                    all_uploads_paths[one_coll['bucket']] = {'bucket': one_coll['bucket'],
                                                              'paths': [one_obj.object_name],
                                                              'collection': one_coll}
                else:
                    all_uploads_paths[one_coll['bucket']]['paths'].append(one_obj.object_name)

    with concurrent.futures.ThreadPoolExecutor() as executor:
        cur_futures = {executor.submit(get_upload_data_thread, minio,
                                       one_upload['bucket'],
                                       one_upload['paths'],
                                       one_upload['collection']):
                       one_upload for _, one_upload in all_uploads_paths.items()}

        for future in concurrent.futures.as_completed(cur_futures):
            try:
                upload_results = future.result()
                if 'uploads' not in upload_results['collection'] or \
                        not upload_results['collection']['uploads']:
                    upload_results['collection']['uploads'] = upload_results['uploads']
                    user_collections.append(upload_results['collection'])
                else:
                    upload_results['collection']['uploads'] = \
                        [*upload_results['collection']['uploads'], *upload_results['uploads']]
            # pylint: disable=broad-exception-caught
            except Exception as ex:
                print(f'Generated update user collections exception: {ex}', flush=True)
                traceback.print_exception(ex)

    user_buckets = [one_coll['bucketProperty'] for one_coll in user_collections]
    empty_upload_coll = {'uploads': []}
    for one_coll in collections:
        if one_coll['bucketProperty'] not in user_buckets:
            user_collections.append(one_coll if 'uploads' in one_coll
                                    else one_coll | empty_upload_coll)

    return user_collections


def get_image_counts(minio: Minio, bucket: str, check_folders: tuple) -> int:
    """ Gets the count of images from the selected folder and its subfolders
    Arguments:
        minio: the S3 instance
        bucket: the bucket the upload is found in
        check_folders: a tuple of folder paths to check against
    Return:
        Returns the count of images found
    Note:
        Files are considered images if they don't end in .csv or .json
    """
    uploaded_images = 0

    while check_folders is not None and len(check_folders) > 0:
        new_folders = []
        for one_folder in check_folders:
            if not one_folder.endswith('/'):
                one_folder += '/'
            for one_sub_obj in minio.list_objects(bucket, prefix=one_folder):
                if one_sub_obj.is_dir and one_sub_obj.object_name != one_folder:
                    cur_sub_folder = one_sub_obj.object_name
                    if not cur_sub_folder.endswith('/'):
                        cur_sub_folder += '/'
                    new_folders.append(cur_sub_folder)
                else:
                    ext = os.path.splitext(one_sub_obj.object_name)[1]
                    if not ext.lower in ['.csv', '.json']:
                        uploaded_images += 1
        check_folders = new_folders

    return uploaded_images


def get_upload_data_thread(minio: Minio, bucket: str, upload_paths: tuple,
                           collection: object) -> object:
    """ Gets upload information for the selected paths
    Arguments:
        minio: the S3 instance
        bucket: the bucket to load from
        upload_paths: the paths to check in the bucket and load data from
        collection: the collection object that represents the bucket
    Return:
        Returns an object containing the collection object and the upload information
    """
    upload_info = []

    with temp_s3_file() as temp_path:
        for one_path in upload_paths:
            upload_info_path = make_s3_path((one_path, S3_UPLOAD_META_JSON_FILE_NAME))
            upload_meta = load_s3_json(minio, bucket, upload_info_path, temp_path,
                                         'get_upload_data_thread')
            if not upload_meta:
                continue

            loc_data = load_deployment_location(minio, bucket, one_path, temp_path)
            if loc_data is None:
                continue

            upload_info.append({
                'path': one_path,
                'info': upload_meta,
                'location': loc_data['location'],
                'elevation': loc_data['elevation'],
                'key': os.path.basename(one_path.rstrip('/\\')),
                'uploaded_folders': get_uploaded_folders(minio, bucket, one_path)
            })

    return {'collection': collection, 'uploads': upload_info}


def download_data_thread(minio: Minio, file_info: tuple, dest_root_path: str) -> tuple:
    """ Downloads the indicated file from S3
    Arguments:
        minio: the S3 instance
        file_info: a tuple containing the bucket, path, and (optional) destination path
        dest_root_path: folder under which to place downloaded file
    Return:
        The original bucket and path, and the path to the downloaded file
    """
    dest_file = make_s3_path((dest_root_path, file_info[2] if len(file_info) >= 3
                               else file_info[1]))
    base = os.path.dirname(dest_file)
    if not os.path.exists(base):
        os.makedirs(base, exist_ok=True)

    minio.fget_object(file_info[0], file_info[1], dest_file)
    return file_info[0], file_info[1], dest_file


def get_s3_images(minio: Minio, bucket: str, upload_paths: tuple,
                  need_url: bool = True) -> tuple:
    """ Finds the images by recursing the specified paths
    Arguments:
        minio: the S3 client instance
        bucket: the bucket to search
        upload_paths: a tuple of upload paths to search
        need_url: set to False if a remote URL to the image isn't needed
    Return:
        Returns the tuple of found images
    """
    images = []
    new_paths = upload_paths if not isinstance(upload_paths, str) else [upload_paths]

    while len(new_paths) > 0:
        cur_paths = new_paths
        new_paths = []

        for one_path in cur_paths:
            for one_obj in minio.list_objects(bucket, prefix=one_path):
                if one_obj.is_dir:
                    if one_obj.object_name != one_path:
                        new_paths.append(one_obj.object_name)
                else:
                    _, file_name = os.path.split(one_obj.object_name)
                    name, ext = os.path.splitext(file_name)
                    if ext.lower().endswith('.jpg') or ext.lower().endswith('.mp4'):
                        s3_url = minio.presigned_get_object(bucket, one_obj.object_name) \
                            if need_url else None
                        images.append({'name': name,
                                       'bucket': bucket,
                                       's3_path': one_obj.object_name,
                                       's3_url': s3_url,
                                       'key': uuid.uuid4().hex,
                                       'type': 'movie' if ext.lower().endswith('.mp4')
                                       else 'image',
                                       'species': []})
    return images


def __get_upload_subfolders(minio: Minio, bucket: str, obj_path: str) -> list:
    """ Returns the immediate subfolders of an upload path
    Arguments:
        minio: the S3 client instance
        bucket: the bucket to search
        obj_path: the upload object path to list subfolders for
    Return:
        Returns a list of subfolder paths with trailing slashes
    """
    cur_folder = obj_path if obj_path.endswith('/') else obj_path + '/'
    return [
        one_sub.object_name if one_sub.object_name.endswith('/')
        else one_sub.object_name + '/'
        for one_sub in minio.list_objects(bucket, prefix=cur_folder)
        if one_sub.is_dir and one_sub.object_name != cur_folder
    ]


def __check_upload_complete(minio: Minio, bucket: str, one_obj: object,
                             temp_path: str) -> Optional[dict]:
    """ Checks if a single upload is complete and returns incomplete info if not
    Arguments:
        minio: the S3 client instance
        bucket: the bucket to search
        one_obj: the S3 object representing the upload folder
        temp_path: temporary file path for downloads
    Return:
        Returns a dict of incomplete upload info, or None if the upload is complete
        or the metadata cannot be loaded
    """
    upload_info_path = make_s3_path((one_obj.object_name, S3_UPLOAD_META_JSON_FILE_NAME))
    upload_info = load_s3_json(minio, bucket, upload_info_path, temp_path,
                                 'check_incomplete_thread')
    if not upload_info:
        return None

    check_folders = __get_upload_subfolders(minio, bucket, one_obj.object_name)
    uploaded_images = get_image_counts(minio, bucket, check_folders)

    if uploaded_images == int(upload_info['imageCount']):
        return None

    upload_path = one_obj.object_name.rstrip('/\\')
    return {'upload_user': upload_info['uploadUser'],
            'expected': int(upload_info['imageCount']),
            'actual': uploaded_images,
            'bucket': bucket,
            's3_path': upload_path,
            'date': upload_info['uploadDate']}


def check_incomplete_thread(minio: Minio, bucket: str) -> Optional[tuple]:
    """ Looks for incomplete uploads
    Arguments:
        minio: the S3 client instance
        bucket: the bucket to search
    Return:
        Returns the tuple of found incomplete uploads
    """
    coll_id = bucket[len(SPARCD_PREFIX):]
    uploads_path = make_s3_path((COLLECTIONS_FOLDER, coll_id, S3_UPLOADS_PATH_PART)) + '/'

    incomplete_uploads = []
    with temp_s3_file() as temp_path:
        for one_obj in minio.list_objects(bucket, prefix=uploads_path):
            if not one_obj.is_dir or one_obj.object_name == uploads_path:
                continue
            result = __check_upload_complete(minio, bucket, one_obj, temp_path)
            if result is not None:
                incomplete_uploads.append(result)

    return incomplete_uploads


# =============================================================================
# Bucket helpers
# =============================================================================

def find_settings_bucket(minio: Minio) -> Optional[str]:
    """ Finds the settings bucket at the endpoint
    Arguments:
        minio: the minio instance to check
    Return:
        Returns the found Minio settings bucket
    """
    if minio.bucket_exists(SETTINGS_BUCKET_LEGACY):
        return SETTINGS_BUCKET_LEGACY

    settings_bucket = None
    for one_bucket in minio.list_buckets():
        if one_bucket.name.startswith(SETTINGS_BUCKET_PREFIX):
            settings_bucket = one_bucket.name

    return settings_bucket


def create_new_bucket(minio: Minio, prefix: str) -> Optional[str]:
    """ Attempts to create a new bucket
    Arguments:
        minio: the S3 instance to create a settings bucket on
        prefix: the prefix to the new bucket name (cannot be empty or None)
    Return:
        Returns the new bucket name when successful, else None.
        The name of the created bucket consists of the prefix followed by a UUID.
        An invalid prefix will also cause None to be returned
    """
    if not prefix:
        return None

    return_bucket = None
    for _ in range(0, MAX_NEW_BUCKET_TRIES):
        return_bucket = prefix + str(uuid.uuid4())
        try:
            if not minio.bucket_exists(return_bucket):
                minio.make_bucket(return_bucket)
                break
        except S3Error as ex:
            print('ERROR: Unable to create possible new bucket {return_bucket}', flush=True)
            print(f'     : exception code: {ex.code}', flush=True)
            print(ex, flush=True)

        return_bucket = None

    return return_bucket
