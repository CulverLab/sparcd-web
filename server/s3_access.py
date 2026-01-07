"""This script contains the interface to an S3 instance
"""

import csv
import concurrent.futures
import dataclasses
import datetime
from io import BytesIO, StringIO
import json
import os
import shutil
import tempfile
import traceback
from typing import Optional, Callable
import uuid
from minio import Minio, S3Error

# Prefix for SPARCd things
SPARCD_PREFIX='sparcd-'

# Our bucket prefix
BUCKET_PREFIX = SPARCD_PREFIX
# Prefix for settings buckets
SETTINGS_BUCKET_PREFIX = BUCKET_PREFIX + 'settings'
# Prefix for legacy settings bucket
SETTINGS_BUCKET_LEGACY = 'sparcd'

# Folder under which settings can be found
SETTINGS_FOLDER = 'Settings'


# Configuration file name for collections
COLLECTION_JSON_FILE_NAME = 'collection.json'

# Configuration file name for permissions
PERMISSIONS_JSON_FILE_NAME = 'permissions.json'

# Configuration file name for species
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


def make_s3_path(parts: tuple) -> str:
    """ Makes the parts into an S3 path
    Arguments:
        parts: the path particles
    Return:
        The parts joined into an S3 path
    """
    return "/".join([one_part.rstrip('/').rstrip('\\') for one_part in parts])


def get_s3_file(minio: Minio, bucket: str, file: str, dest_file: str):
    """Downloads files from S3 server
    Arguments:
        minio: the s3 client instance
        bucket: the bucket to download from
        file: the S3 file to download and read
        dest_file: the file to write the download to
    Returns:
        Returns the content of the file or None if there was an error
    """
    try:
        minio.fget_object(bucket, file, dest_file)
        with open(dest_file, 'r', encoding='utf-8') as in_file:
            return in_file.read()
    except S3Error as ex:
        if ex.code != "NoSuchKey":
            raise ex
    return None


def put_s3_file(minio: Minio, bucket: str, file: str, src_file: str, \
                content_type: str='text/plain'):
    """ Upload files to the S3 server
    Arguments:
        minio: the s3 client instance
        bucket: the bucket to download from
        file: the S3 file to update
        src_file: the location of the file to upload to the server
        content_type: the content type of the upload
    Returns:
        Returns the content of the file or None if there was an error
    """
    try:
        minio.fput_object(bucket, file, src_file, content_type=content_type)
    except S3Error as ex:
        if ex.code != "NoSuchKey":
            raise ex

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

    # Loop through and get all the information for a collection
    temp_file = tempfile.mkstemp(prefix=SPARCD_PREFIX)
    os.close(temp_file[0])
    for one_bucket in buckets:
        collections_path = 'Collections'
        base_path = make_s3_path((collections_path, one_bucket[len(SPARCD_PREFIX):]))

        coll_info_path = make_s3_path((base_path, COLLECTION_JSON_FILE_NAME))
        coll_data = get_s3_file(minio, one_bucket, coll_info_path, temp_file[1])
        if coll_data is None or not coll_data:
            continue
        coll_data = json.loads(coll_data)

        permissions_path = make_s3_path((base_path, PERMISSIONS_JSON_FILE_NAME))
        perm_data = get_s3_file(minio, one_bucket, permissions_path, temp_file[1])

        if perm_data is not None:
            perms = json.loads(perm_data)
            found_perm = None
            for one_perm in perms:
                if one_perm and 'usernameProperty' in one_perm and \
                                            one_perm['usernameProperty'] == user:
                    found_perm = one_perm
                    break
            coll_data.update({'bucket':one_bucket,
                              'base_path': base_path,
                              'permissions': found_perm,
                              'all_permissions': perms
                             })
            user_collections.append(coll_data)
    os.unlink(temp_file[1])

    return tuple(user_collections)


def get_uploaded_folders(minio: Minio, bucket: str, upload_path: str) -> tuple:
    """ Gets the folders that were uploaded under the path
    Arguments:
        minio - the S3 instance
        bucket - the bucket to load from
        upload_path: the top-level folder for the upload
    Return:
        A tuple of folder names under the upload folder
    """
    subfolders = []

    # Make sure we end with a path separator
    upload_path = upload_path.rstrip('/') + '/'

    # Get the list of folders under a single upload
    for one_obj in minio.list_objects(bucket, upload_path):
        if one_obj.is_dir and not one_obj.object_name == upload_path:
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
        # Get the uploads and their information
        uploads_path = make_s3_path((one_coll['base_path'], S3_UPLOADS_PATH_PART)) + '/'
        for one_obj in minio.list_objects(one_coll['bucket'], uploads_path):
            if one_obj.is_dir and not one_obj.object_name == uploads_path:
                if one_coll['bucket'] not in all_uploads_paths:
                    all_uploads_paths[one_coll['bucket']] = {'bucket':one_coll['bucket'], \
                                                            'paths':[one_obj.object_name], \
                                                            'collection':one_coll}
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
                if 'uploads' not in upload_results['collection'] or not \
                                                            upload_results['collection']['uploads']:
                    upload_results['collection']['uploads'] = upload_results['uploads']
                    user_collections.append(upload_results['collection'])
                else:
                    upload_results['collection']['uploads'] = \
                            [*upload_results['collection']['uploads'], *upload_results['uploads']]
            # pylint: disable=broad-exception-caught
            except Exception as ex:
                print(f'Generated update user collections exception: {ex}', flush=True)
                traceback.print_exception(ex)

    # Add in any collection that doesn't have an upload yet
    user_buckets = [one_coll['bucketProperty'] for one_coll in user_collections]
    empty_upload_coll = {'uploads': []}
    for one_coll in collections:
        if not one_coll['bucketProperty'] in user_buckets:
            user_collections.append(one_coll if 'uploads' in one_coll else \
                                                                    one_coll | empty_upload_coll)

    return user_collections

def get_upload_data_thread(minio: Minio, bucket: str, upload_paths: tuple, collection: object \
                                                                                        ) -> object:
    """  Gets upload information for the selected paths
    Arguments:
        minio - the S3 instance
        bucket - the bucket to load from
        upload_paths - the paths to check in the bucket and load data from
        collection - the collection object that represents the bucket
    Return:
        Returns an object containing the collection object and the upload information
    """
    # Get the data on each upload
    upload_info = []

    temp_file = tempfile.mkstemp(prefix=SPARCD_PREFIX)
    os.close(temp_file[0])

    for one_path in upload_paths:
        # Upload information
        upload_info_path = make_s3_path((one_path, S3_UPLOAD_META_JSON_FILE_NAME))
        coll_info_data = get_s3_file(minio, bucket, upload_info_path, temp_file[1])
        if coll_info_data is not None:
            try:
                coll_info = json.loads(coll_info_data)
            except json.JSONDecodeError:
                print('get_upload_data_thread: Unable to load JSON information: ' \
                      f'{upload_info_path}')
                continue
        else:
            print(f'get_upload_data_thread: Unable to get upload information: {upload_info_path}')
            continue

        # Location data
        upload_info_path = make_s3_path((one_path, DEPLOYMENT_CSV_FILE_NAME))
        csv_data = get_s3_file(minio, bucket, upload_info_path, temp_file[1])
        if csv_data is not None:
            reader = csv.reader(StringIO(csv_data))
            for csv_info in reader:
                if csv_info and len(csv_info) >= 23:
                    upload_info.append({
                                 'path':one_path,
                                 'info':coll_info,
                                 'location':csv_info[1],
                                 'elevation':csv_info[12],
                                 'key':os.path.basename(one_path.rstrip('/\\')),
                                 'uploaded_folders': get_uploaded_folders(minio, bucket, one_path)
                                })
                    break
        else:
            print(f'Unable to get deployment information: {upload_info_path}')

    os.unlink(temp_file[1])

    return {'collection': collection, 'uploads': upload_info}


def download_data_thread(minio: Minio, file_info: tuple, dest_root_path: str) -> tuple:
    """ Downloads the indicated file from S3
    Arguments:
        minio - the S3 instance
        file_info: a tuple containing the bucket, path, and (optional) destination path
        dest_root_path: folder under which to place downloaded file
    Return:
        The orignal bucket and path, and the path to the downloaded file
    """
    dest_file = make_s3_path((dest_root_path, file_info[2] if len(file_info) >= 3 else \
                                                                                    file_info[1]))
    # Make sure the destination folders exist
    base = os.path.dirname(dest_file)
    if not os.path.exists(base):
        os.makedirs(base, exist_ok=True)

    # Download the file (bucket, path, destination)
    minio.fget_object(file_info[0], file_info[1], dest_file)
    return file_info[0], file_info[1], dest_file


def get_s3_images(minio: Minio, bucket: str, upload_paths: tuple, need_url: bool=True) -> tuple:
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

    # Get the image names and urls
    while len(new_paths) > 0:
        cur_paths = new_paths
        new_paths = []

        for one_path in cur_paths:
            for one_obj in minio.list_objects(bucket, one_path):
                if one_obj.is_dir:
                    if not one_obj.object_name == one_path:
                        new_paths.append(one_obj.object_name)
                else:
                    _, file_name = os.path.split(one_obj.object_name)
                    name, ext = os.path.splitext(file_name)
                    if ext.lower().endswith('.jpg') or ext.lower().endswith('.mp4'):
                        s3_url = minio.presigned_get_object(bucket, one_obj.object_name) if need_url \
                                                                                            else None
                        images.append({'name':name,
                                       'bucket':bucket, \
                                       's3_path':one_obj.object_name,
                                       's3_url':s3_url,
                                       'key':uuid.uuid4().hex,
                                       'type': 'movie' if ext.lower().endswith('.mp4') else 'image',
                                       'species': []
                                       })

    return images


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

    # Extract the common name if it exists
    if '[' in csv_comment and ']' in csv_comment and 'COMMONNAME:' in csv_comment:
        lindex = csv_comment.find('[')
        rindex = csv_comment.find(']')
        cindex = csv_comment.find('COMMONNAME:')
        if lindex < cindex < rindex:
            start_index = cindex + len('COMMONNAME:')
            common_name = csv_comment[start_index:rindex]

    return common_name


@dataclasses.dataclass
class S3Connection:
    """ Contains functions for handling access connections to an s3 instance
    """

    @staticmethod
    def list_collections(url: str, user: str, password: str) -> Optional[tuple]:
        """ Returns the collection information
        Arguments:
            url: the URL to the s3 instance
            user: the name of the user to use when connecting
            password: the user's password
        Returns:
            Returns the collections, or None
        """
        found_buckets = []

        minio = Minio(url, access_key=user, secret_key=password)
        all_buckets = minio.list_buckets()

        # Get the SPARCd buckets
        found_buckets = [one_bucket.name for one_bucket in all_buckets if \
                                                one_bucket.name.startswith(SPARCD_PREFIX)]

        user_collections = get_user_collections(minio, user, found_buckets)

        return user_collections

    @staticmethod
    def get_collections(url: str, user: str, password: str) -> Optional[tuple]:
        """ Returns the collection information
        Arguments:
            url: the URL to the s3 instance
            user: the name of the user to use when connecting
            password: the user's password
        Returns:
            Returns the collections, or None
        """
        found_buckets = []

        minio = Minio(url, access_key=user, secret_key=password)
        all_buckets = minio.list_buckets()

        # Get the SPARCd buckets
        found_buckets = [one_bucket.name for one_bucket in all_buckets if \
                                                one_bucket.name.startswith(SPARCD_PREFIX)]

        user_collections = get_user_collections(minio, user, found_buckets)

        return update_user_collections(minio, user_collections)

    @staticmethod
    def get_collection_info(url: str, user: str, password: str, bucket: str, \
                                                        upload_path: str=None) -> Optional[dict]:
        """ Returns information for one collection
        Arguments:
            url: the URL to the s3 instance
            user: the name of the user to use when connecting
            password: the user's password
            bucket: the bucket of interest
            upload_path: a specific upload path to return information on. Otherwise all the uploads
                        are returned
        Return:
            Returns the information on the collection or None if the collection isn't found
        """
        minio = Minio(url, access_key=user, secret_key=password)
        all_buckets = minio.list_buckets()

        # Get the matching bucket
        found_buckets = [one_bucket.name for one_bucket in all_buckets if \
                                                one_bucket.name == bucket]
        if not found_buckets:
            return None

        user_collections = get_user_collections(minio, user, found_buckets)
        if not user_collections:
            return None

        if upload_path is None:
            return update_user_collections(minio, user_collections)[0]

        for one_coll in user_collections:
            upload_results = get_upload_data_thread(minio, bucket, (upload_path,), one_coll)

            if upload_results:
                one_coll['uploads'] = upload_results['uploads']

        return user_collections[0]

    @staticmethod
    def get_upload_info(url: str, user: str, password: str, bucket: str, \
                                                        upload_path: str) -> Optional[dict]:
        """ Returns information for one upload in a collection
        Arguments:
            url: the URL to the s3 instance
            user: the name of the user to use when connecting
            password: the user's password
            bucket: the bucket of interest
            upload_path: a specific upload path to return information on
        Return:
            Returns the information on the collection or None if the collection isn't found
        """
        minio = Minio(url, access_key=user, secret_key=password)
        all_buckets = minio.list_buckets()

        # Get the matching bucket
        found_buckets = [one_bucket.name for one_bucket in all_buckets if \
                                                one_bucket.name == bucket]
        if not found_buckets:
            return None

        # Temporary file
        temp_file = tempfile.mkstemp(prefix=SPARCD_PREFIX)
        os.close(temp_file[0])

        # Upload information
        upload_info_path = make_s3_path((upload_path, S3_UPLOAD_META_JSON_FILE_NAME))
        upload_info_data = get_s3_file(minio, bucket, upload_info_path, temp_file[1])
        if upload_info_data is not None:
            try:
                coll_info = json.loads(upload_info_data)
            except json.JSONDecodeError:
                print(f'get_upload_info: Unable to load JSON information: {upload_info_path}')
                os.unlink(temp_file[1])
                return None
        else:
            print(f'get_upload_info: Unable to get upload information: {upload_info_path}')
            os.unlink(temp_file[1])
            return None

        # Location data
        upload_info = None
        upload_info_path = make_s3_path((upload_path, DEPLOYMENT_CSV_FILE_NAME))
        csv_data = get_s3_file(minio, bucket, upload_info_path, temp_file[1])
        if csv_data is not None:
            reader = csv.reader(StringIO(csv_data))
            for csv_info in reader:
                if csv_info and len(csv_info) >= 23:
                    upload_info = {
                                 'path':upload_path,
                                 'info':coll_info,
                                 'location':csv_info[1],
                                 'elevation':csv_info[12],
                                 'key':os.path.basename(upload_path.rstrip('/\\')),
                                 'uploaded_folders':get_uploaded_folders(minio, bucket, upload_path)
                                }
                    break
        else:
            print(f'Unable to get deployment information: {upload_info_path}')

        os.unlink(temp_file[1])

        return upload_info

    @staticmethod
    def get_image_paths(url: str, user: str, password: str, collection_id: str, \
                   upload_name: str) -> Optional[tuple]:
        """ Returns the information on the images found for an upload to the collection
        Arguments:
            url: the URL to the s3 instance
            user: the name of the user to use when connecting
            password: the user's password
            collection_id: the ID of the collection of the upload
            upload_name: the name of the upload to get image data on
        Returns:
            Returns the information on the images, or None. Each returned image dict contains
            the image file name, bucket s3_path, and unique key
        """
        bucket = SPARCD_PREFIX + collection_id
        upload_path = make_s3_path(('Collections', collection_id, 'Uploads', upload_name)) + '/'

        minio = Minio(url, access_key=user, secret_key=password)

        images = get_s3_images(minio, bucket, [upload_path])

        return images

    @staticmethod
    def get_images(url: str, user: str, password: str, collection_id: str, \
                   upload_name: str, need_url: bool=True) -> Optional[tuple]:
        """ Returns the image information for an upload of a collection
        Arguments:
            url: the URL to the s3 instance
            user: the name of the user to use when connecting
            password: the user's password
            collection_id: the ID of the collection of the upload
            upload_name: the name of the upload to get image data on
            need_url: set to False if a remote URL to the image isn't needed
        Returns:
            Returns the images, or None
        """
        bucket = SPARCD_PREFIX + collection_id
        upload_path = make_s3_path(('Collections', collection_id, S3_UPLOADS_PATH_PART, \
                                                                                upload_name)) + '/'

        minio = Minio(url, access_key=user, secret_key=password)

        images = get_s3_images(minio, bucket, [upload_path], need_url)

        images_dict = {obj['s3_path']: obj for obj in images}

        # Temp file for getting observations
        temp_file = tempfile.mkstemp(prefix=SPARCD_PREFIX)
        os.close(temp_file[0])

        # Get the species information for each image
        upload_info_path = make_s3_path((upload_path, OBSERVATIONS_CSV_FILE_NAME))
        csv_data = get_s3_file(minio, bucket, upload_info_path, temp_file[1])
        if csv_data is not None:

            reader = csv.reader(StringIO(csv_data))
            for csv_info in reader:
                common_name = get_common_name(csv_info[19])

                # Update the image with a species if we find it
                cur_img = images_dict.get(csv_info[3])
                if cur_img is not None:

                    # Add the species
                    if cur_img.get('species') is None:
                        cur_img['species'] = []

                    # Only return items that have data
                    if not csv_info[8] or not csv_info[9]:
                        continue

                    cur_img['species'].append({ 'name':common_name, \
                                                'scientificName':csv_info[8], \
                                                'count':csv_info[9]})
                else:
                    print(f'Unable to find collection image: {csv_info[3]}')
        else:
            print(f'Unable to get observations information: {upload_info_path}')

        os.unlink(temp_file[1])

        return images


    @staticmethod
    def list_uploads(url: str, user: str, password: str, bucket: str) -> Optional[tuple]:
        """ Returns the upload information for a collection
        Arguments:
            url: the URL to the s3 instance
            user: the name of the user to use when connecting
            password: the user's password
            bucket: the bucket of the uploads
        Returns:
            Returns the uploads, or None
        """
        if not bucket.startswith(SPARCD_PREFIX):
            print(f'Invalid bucket name specified: {bucket}')
            return None

        uploads_path = make_s3_path(('Collections', bucket[len(SPARCD_PREFIX):],
                                                                S3_UPLOADS_PATH_PART)) + '/'

        minio = Minio(url, access_key=user, secret_key=password)

        # Get the uploads and their information
        coll_uploads = []
        temp_folder = tempfile.mkdtemp(prefix=SPARCD_PREFIX)
        for one_obj in minio.list_objects(bucket, uploads_path):
            if one_obj.is_dir and not one_obj.object_name == uploads_path:
                # Get the data on this upload
                temp_file = tempfile.mkstemp(prefix=SPARCD_PREFIX, dir=temp_folder)
                os.close(temp_file[0])

                # Upload information
                upload_info_path = make_s3_path((one_obj.object_name,S3_UPLOAD_META_JSON_FILE_NAME))
                meta_info_data = get_s3_file(minio, bucket, upload_info_path, \
                                             temp_file[1])
                if meta_info_data is not None:
                    meta_info_data = json.loads(meta_info_data)
                else:
                    print(f'list_uploads: Unable to get upload information: {upload_info_path}')
                    continue

                # Add the name
                meta_info_data['name'] = os.path.basename(one_obj.object_name.rstrip('/\\'))

                # Location data
                meta_info_data['loc'] = None
                upload_info_path = make_s3_path((one_obj.object_name, DEPLOYMENT_CSV_FILE_NAME))
                csv_data = get_s3_file(minio, bucket, upload_info_path, temp_file[1])
                if csv_data is not None:
                    reader = csv.reader(StringIO(csv_data))
                    for csv_info in reader:
                        if len(csv_info) >= 23:
                            meta_info_data['loc'] = csv_info[1]
                            meta_info_data['elevation'] =  csv_info[12]
                            break
                else:
                    print(f'Unable to get deployment information: {upload_info_path}')
                    continue

                # Uploaded images data
                cur_images = []
                upload_info_path = make_s3_path((one_obj.object_name, OBSERVATIONS_CSV_FILE_NAME))
                csv_data = get_s3_file(minio, bucket, upload_info_path, temp_file[1])
                if csv_data is not None:
                    cur_row = 0
                    reader = csv.reader(StringIO(csv_data))
                    for csv_info  in reader:
                        cur_row = cur_row + 1
                        if len(csv_info) >= 20:
                            # Get the fields of interest
                            cur_species = { 'name':get_common_name(csv_info[19]), \
                                            'scientificName':csv_info[8], \
                                            'count':csv_info[9]}

                            image_name = os.path.basename(csv_info[3].rstrip('/\\'))
                            temp_image = [one_image for one_image in cur_images if \
                                                one_image['name'] == image_name and \
                                                one_image['bucket'] == bucket and \
                                                one_image['s3_path'] == csv_info[3]]
                            if temp_image and len(temp_image) > 0:
                                temp_image = temp_image[0]

                            if temp_image:
                                temp_image['species'].append(cur_species)
                            else:
                                cur_images.append({ 'name':image_name,
                                                    'timestamp':csv_info[4],
                                                    'bucket': bucket,
                                                    's3_path': csv_info[3],
                                                    'species':[cur_species]})
                        elif csv_info:
                            print(f'Invalid CSV row ({cur_row}) read from {upload_info_path}')
                else:
                    print(f'Unable to get deployment information: {upload_info_path}')
                meta_info_data['images'] = cur_images
                coll_uploads.append(meta_info_data)

                if os.path.exists(temp_file[1]):
                    os.unlink(temp_file[1])

        shutil.rmtree(temp_folder)

        return coll_uploads

    @staticmethod
    def get_configuration(filename: str, url: str, user: str, password: str):
        """ Returns the configuration contained in the file
        Arguments:
            filename: the name of the configuration to download
            url: the URL to the s3 instance
            user: the name of the user to use when connecting
            password: the user's password
        """
        minio = Minio(url, access_key=user, secret_key=password)

        # Find the name of our settings bucket
        settings_bucket = None
        for one_bucket in minio.list_buckets():
            if one_bucket.name == SETTINGS_BUCKET_LEGACY:
                settings_bucket = one_bucket.name
                break
            if one_bucket.name.startswith(SETTINGS_BUCKET_PREFIX):
                settings_bucket = one_bucket.name

        temp_file = tempfile.mkstemp(prefix=SPARCD_PREFIX)
        os.close(temp_file[0])

        file_path = make_s3_path((SETTINGS_FOLDER, filename))
        config_data = None
        try:
            config_data = get_s3_file(minio, settings_bucket, file_path, temp_file[1])
        except S3Error as ex:
            print(f'Unable to get configuration file {filename} from {settings_bucket}')
            print(ex)
        finally:
            os.unlink(temp_file[1])

        return config_data

    @staticmethod
    def put_configuration(filename: str, config: str, url: str, user: str, password: str):
        """ Updates the server with the configuration string in the file
        Arguments:
            filename: the name of the configuration to update
            config: the configuration to write to the file
            url: the URL to the s3 instance
            user: the name of the user to use when connecting
            password: the user's password
        """
        minio = Minio(url, access_key=user, secret_key=password)

        # Find the name of our settings bucket
        settings_bucket = None
        for one_bucket in minio.list_buckets():
            if one_bucket.name == SETTINGS_BUCKET_LEGACY:
                settings_bucket = one_bucket.name
                break
            if one_bucket.name.startswith(SETTINGS_BUCKET_PREFIX):
                settings_bucket = one_bucket.name

        temp_file = tempfile.mkstemp(prefix=SPARCD_PREFIX)
        os.close(temp_file[0])


        file_path = make_s3_path((SETTINGS_FOLDER, filename))
        try:
            with open(temp_file[1], 'w', encoding="utf-8") as ofile:
                ofile.write(config)

            put_s3_file(minio, settings_bucket, file_path, temp_file[1],
                        content_type='application/json')
        except S3Error as ex:
            print(f'Unable to get configuration file {filename} from {settings_bucket}')
            print(ex)
        finally:
            os.unlink(temp_file[1])

    @staticmethod
    def get_object_urls(url: str, user: str, password: str, object_info: tuple) -> tuple:
        """ Returns the URLs of the objects listed in object_info
        Arguments:
            url: the URL to the s3 instance
            user: the name of the user to use when connecting
            password: the user's password
            object_info: tuple containing tuple pairs of bucket name and the object path
        Return:
            Returns a tuple containing the S3 URLs for the objects (each url subject to timeout)
        """
        minio = Minio(url, access_key=user, secret_key=password)

        return [minio.presigned_get_object(one_obj[0], one_obj[1]) for one_obj in object_info]

    @staticmethod
    def download_images_cb(url: str, user: str, password:str, files: tuple, dest_path: str, \
                                                        callback: Callable, callback_data) -> None:
        """ Downloads files into the destination path and calls the callback for each file
            downloaded
        Arguments:
            url: the URL to the s3 instance
            user: the name of the user to use when connecting
            password: the user's password
            files: a tuple containing the bucket, path, and (optionally) the destination path of the
                    downloaded file
            dest_path: the starting location to download files to
            callback: called for each file downloaded
            callback_data: data to pass to the callback as the first parameter (caller can use None)
        Notes:
            If a destination path is not specified for a file, the S3 path is used (starting at the
            root of the dest_path)
        """
        minio = Minio(url, access_key=user, secret_key=password)

        # Download the files one at a time and call the callback
        with concurrent.futures.ThreadPoolExecutor() as executor:
            cur_futures = {executor.submit(download_data_thread, minio, one_file, dest_path):
                                                                    one_file for one_file in files}

            for future in concurrent.futures.as_completed(cur_futures):
                try:
                    bucket, s3_path, downloaded_file = future.result()
                    callback(callback_data, bucket, s3_path, downloaded_file)
                # pylint: disable=broad-exception-caught
                except Exception as ex:
                    print(f'Generated download images callback exception: {ex}', flush=True)
                    traceback.print_exception(ex)

        # Final callback to indicate processing is done
        callback(callback_data, None, None, None)

    @staticmethod
    def download_image(url: str, user: str, password: str, bucket: str, s3_path: str, \
                                                                    dest_file_path: str) -> None:
        """ Downloads the file to the destination path
        Arguments:
            url: the URL to the s3 instance
            user: the name of the user to use when connecting
            password: the user's password
            bucket: the bucket to download from
            s3_path: the path to the file on S3
            dest_file_path: the location to download the file to
        """
        minio = Minio(url, access_key=user, secret_key=password)

        # Download the files one at a time and call the callback
        minio.fget_object(bucket, s3_path, dest_file_path)


    @staticmethod
    def create_upload(url: str, user: str, password: str, collection_id: str, \
                            comment: str, timestamp: datetime.datetime, file_count: int) -> tuple:
        """ Creates an upload folder on the server and returns the path
        Arguments:
            url: the URL to the s3 instance
            user: the name of the user to use when connecting
            password: the user's password
            collection_id: the ID of the collection to create the upload in
            comment: user comment on this upload
            timestamp: the timestamp to use when creating the path
            file_count: the number of files to be uploaded
        Return:
            The bucket name and the path of the upload folder on the S3 instance
        """
        minio = Minio(url, access_key=user, secret_key=password)

        bucket = SPARCD_PREFIX + collection_id
        upload_folder = timestamp.strftime('%Y.%m.%d.%H.%M.%S') + '_' + user
        new_path = make_s3_path(('Collections',collection_id,'Uploads',upload_folder))

        temp_file = tempfile.mkstemp(prefix=SPARCD_PREFIX)
        os.close(temp_file[0])

        with open(temp_file[1], 'w', encoding='utf-8') as o_file:
            json.dump({'uploadUser':user,
                        'uploadDate': {
                            'date':
                                {'year':timestamp.year,'month':timestamp.month,'day':timestamp.day},
                            'time':
                                {'hour':timestamp.hour,'minute':timestamp.minute,
                                    'second':timestamp.second,'nano':timestamp.microsecond}
                        },
                        'imagesWithSpecies':0,
                        'imageCount':file_count,
                        'editComments':[],
                        'bucket':bucket,
                        'uploadPath':new_path,
                        'description': comment
                        }
                , o_file, indent=2)

        minio.fput_object(bucket, new_path + '/' + S3_UPLOAD_META_JSON_FILE_NAME, temp_file[1], \
                                                                    content_type='application/json')

        os.unlink(temp_file[1])

        return bucket, new_path


    @staticmethod
    def upload_file(url: str, user: str, password: str, bucket: str, path: str, \
                                                                            localname:str) -> None:
        """ Uploads the data from the file to the specified bucket in the specified
            object path
        Arguments:
            url: the URL to the s3 instance
            user: the name of the user to use when connecting
            password: the user's password
            bucket: the bucket to upload to
            path: path under the bucket to the object data
            localname: the local filename of the file to upload
        """
        minio = Minio(url, access_key=user, secret_key=password)

        minio.fput_object(bucket, path, localname)

    @staticmethod
    def upload_file_data(url: str, user: str, password: str, bucket: str, path: str, \
                            data: str, content_type: str='text/plain') -> None:
        """ Uploads the data to the specified bucket in the specified object path
        Arguments:
            url: the URL to the s3 instance
            user: the name of the user to use when connecting
            password: the user's password
            bucket: the bucket to upload to
            path: path under the bucket to the object data
            data: the data to upload
            content_type: the content type of the upload
        """
        minio = Minio(url, access_key=user, secret_key=password)

        minio.put_object(bucket, path, BytesIO(data.encode()), len(data), content_type=content_type)

    @staticmethod
    def get_camtrap_file(url: str, user: str, password: str, bucket: str, \
                                                                    path: str) -> Optional[tuple]:
        """ Loads the CAMTRAP CSV and returns a tuple containing the row data as tuples
        Arguments:
            url: the URL to the s3 instance
            user: the name of the user to use when connecting
            password: the user's password
            bucket: the bucket to upload to
            path: path under the bucket to the camtrap data
        Return:
            Returns the loaded data or None
        """
        minio = Minio(url, access_key=user, secret_key=password)

        temp_file = tempfile.mkstemp(prefix=SPARCD_PREFIX)
        os.close(temp_file[0])

        csv_data = get_s3_file(minio, bucket, path, temp_file[1])

        os.unlink(temp_file[1])

        camtrap_data = []
        if csv_data is not None:
            reader = csv.reader(StringIO(csv_data))
            for csv_row in reader:
                if csv_row and len(csv_row) >= 5:
                    camtrap_data.append(list(csv_row))

        return camtrap_data

    @staticmethod
    def upload_camtrap_data(url: str, user: str, password: str, bucket: str, \
                                                        path: str, data: tuple) -> None:
        """ Uploads camtrap data as a CSV file to the specified path
        Arguments:
            url: the URL to the s3 instance
            user: the name of the user to use when connecting
            password: the user's password
            bucket: the bucket to upload to
            path: path under the bucket to the camtrap data
            data: a tuple of camtrap data containing tuples of each row's data
        """
        temp_file = tempfile.mkstemp(suffix='.csv', prefix=SPARCD_PREFIX)
        os.close(temp_file[0])

        with open(temp_file[1], 'w', newline='', encoding='utf-8') as ofile:
            csv_writer = csv.writer(ofile)
            for one_row in data:
                csv_writer.writerow(one_row)

        S3Connection.upload_file(url, user, password, bucket, path, temp_file[1])

        os.unlink(temp_file[1])

    @staticmethod
    def save_collection_info(url: str, user: str, password: str, bucket: str, \
                                                                        coll_info: object) -> None:
        """ Saves the collection information on the S3 server
        Arguments:
                url: the URL to the s3 instance
                user: the name of the user to use when connecting
                password: the user's password
                bucket: the bucket to upload to
                coll_info: the collection information to save
        """
        collections_path = 'Collections'
        base_path = make_s3_path((collections_path, bucket[len(SPARCD_PREFIX):]))

        coll_info_path = make_s3_path((base_path, COLLECTION_JSON_FILE_NAME))

        # Upload the data making sure to only update what's expected
        S3Connection.upload_file_data(url, user, password, bucket, coll_info_path,
                                    json.dumps(
                                        {'nameProperty': coll_info['name'],
                                         'organizationProperty':  coll_info['organization'],
                                         'contactInfoProperty': coll_info['email'],
                                         'descriptionProperty': coll_info['description'],
                                         'idProperty': bucket[len(SPARCD_PREFIX):],
                                         'bucketProperty': bucket,
                                        }),
                                    content_type='application/json')


    @staticmethod
    def save_collection_permissions(url: str, user: str, password: str,  bucket: str, \
                                                                        perm_info: tuple) -> None:
        """ Saves the permissions information on the S3 server
        Arguments:
                url: the URL to the s3 instance
                user: the name of the user to use when connecting
                password: the user's password
                bucket: the bucket to upload to
                perm_info: the tuple of permissions information
        """
        collections_path = 'Collections'
        base_path = make_s3_path((collections_path, bucket[len(SPARCD_PREFIX):]))

        perms_info_path = make_s3_path((base_path, PERMISSIONS_JSON_FILE_NAME))

        # Upload the data making sure to only update what's expected
        S3Connection.upload_file_data(url, user, password, bucket, perms_info_path,
                                            json.dumps(
                                                [
                                                 {'usernameProperty': one_perm['usernameProperty'],
                                                  'readProperty': one_perm['readProperty'],
                                                  'uploadProperty': one_perm['uploadProperty'],
                                                  'ownerProperty': one_perm['ownerProperty'],
                                                 } for one_perm in perm_info
                                                ],
                                                indent=4
                                                ),
                                            content_type='application/json')


    @staticmethod
    def update_upload_metadata_image_species(url: str, user: str, password: str, bucket: str, \
                                                        upload_path: str, new_count: int) -> bool:
        """ Update the upload's metadata on the S3 instance with a new count
        Arguments:
            url: the URL to the s3 instance
            user: the name of the user to use when connecting
            password: the user's password
            bucket: the bucket to upload to
            upload_path: path under the bucket to the metadata
            new_count: the new count of images with species
        Return:
            Returns True if no problem was found and False otherwise
        """
        minio = Minio(url, access_key=user, secret_key=password)

        temp_file = tempfile.mkstemp(prefix=SPARCD_PREFIX)
        os.close(temp_file[0])

        # Get the upload information
        upload_info_path = make_s3_path((upload_path, S3_UPLOAD_META_JSON_FILE_NAME))
        coll_info_data = get_s3_file(minio, bucket, upload_info_path, temp_file[1])
        if coll_info_data is not None:
            try:
                coll_info = json.loads(coll_info_data)
            except json.JSONDecodeError:
                print('update_upload_metadata_image_species: Unable to load JSON information: ' \
                      f'{upload_info_path}')
                return False
        else:
            print('update_upload_metadata_image_species: Unable to get upload information: ' \
                  f'{upload_info_path}')
            return False

        # Update and save the upload information
        coll_info['imagesWithSpecies'] = new_count
        data = json.dumps(coll_info, indent=2)
        minio.put_object(bucket, upload_info_path, BytesIO(data.encode()), len(data),
                                                                    content_type='application/json')

        os.unlink(temp_file[1])
        return True


    @staticmethod
    def update_upload_metadata(url: str, user: str, password: str, bucket: str, upload_path: str, \
                                    new_comment: str=None, images_species_count: int=None) -> bool:
        """ Update the upload's metadata on the S3 instance with a new count
        Arguments:
            url: the URL to the s3 instance
            user: the name of the user to use when connecting
            password: the user's password
            bucket: the bucket to upload to
            upload_path: path under the bucket to the metadata
            new_comment: the comment to add to the metadata
            images_species_count: The count of images that have species
        Return:
            Returns True if no problem was found and False otherwise
        """
        minio = Minio(url, access_key=user, secret_key=password)

        temp_file = tempfile.mkstemp(prefix=SPARCD_PREFIX)
        os.close(temp_file[0])

        # Get the upload information
        upload_info_path = make_s3_path((upload_path, S3_UPLOAD_META_JSON_FILE_NAME))
        coll_info_data = get_s3_file(minio, bucket, upload_info_path, temp_file[1])
        if coll_info_data is not None:
            try:
                coll_info = json.loads(coll_info_data)
            except json.JSONDecodeError:
                print('update_upload_metadata_comment: Unable to load JSON information: ' \
                      f'{upload_info_path}')
                return False
        else:
            print('update_upload_metadata_comment: Unable to get upload information: ' \
                 f'{upload_info_path}')
            return False

        # Update and save the upload information
        if new_comment is not None:
            coll_info['editComments'].append(new_comment)
        if images_species_count is not None:
            coll_info['imagesWithSpecies'] = images_species_count
        data = json.dumps(coll_info, indent=2)
        minio.put_object(bucket, upload_info_path, BytesIO(data.encode()), len(data),
                                                                    content_type='application/json')

        os.unlink(temp_file[1])
        return True
