"""This script contains testing of the interface instance to an S3 instance
"""
# We don't test the contents of what's downloaded as strongly here since that's done
# in the test_s3.py testing file

import datetime
import json
import os
import shutil
import tempfile
from typing import Optional

import pytest
from minio import Minio, S3Error

import s3_access

SPARCD_CONFIGURATION_FILE_NAMES = ['locations.json', 'settings.json', \
                                                                s3_access.SPECIES_JSON_FILE_NAME]

# pylint: disable=too-many-arguments, too-many-positional-arguments
def __fetch_upload_file_names(url: str, user: str, password: str, bucket: str, upload: str, \
                                                            max_count: int=1000) -> Optional[tuple]:
    """ Returns a path to a file (not a folder) on S3 in the specified upload
    Arguments:
        url: the S3 instance URL
        user: the S3 username
        password: the password associated with the user
        bucket: the target bucket
        upload: the upload to look for files in
        max_count: the maximum number of file names to return; fewer may be returned
    Return:
        Returns a path to a found file, or None
    """
    minio = Minio(url, access_key=user, secret_key=password)

    coll_name = bucket[len(s3_access.SPARCD_PREFIX):]
    search_paths = [s3_access.make_s3_path(('Collections', coll_name, 'Uploads', upload)) + '/']

    found_files = []
    while len(search_paths) > 0:
        new_paths = []  # Used to accumulate subfolders
        for one_path in search_paths:
            for one_obj in minio.list_objects(bucket, prefix=one_path):
                if one_obj.is_dir and not one_obj.object_name == one_path:
                    new_paths.append(one_obj.object_name)
                else:
                    found_files.append(one_obj.object_name)
                    if len(found_files) >= max_count:
                        return found_files

        print(f'HACK: SUBFOLDERS: {len(new_paths)}', flush=True)
        search_paths = new_paths    # Assign found subfolders to search them

    return found_files if len(found_files) > 0 else None


# DO NOT CALL THIS WITH ACTUAL SETTNGS FILES
def __confirm_delete_configuration_file(filename: str, url: str, user: str, password: str) -> tuple:
    """ Confirms a configuration file is on S3 and then deletes that file
    Arguments:
        filename: the name of the configuration file to check
        url: the S3 instance URL
        user: the S3 username
        password: the password associated with the user
    Return:
        Returns a tuple consisting of: True if the file is found (not influenced by the success of
        the deletion) or False if the file isn't found, and True if the file was deleted and False
        if it wasn't
    """
    minio = Minio(url, access_key=user, secret_key=password)

    # Find the name of our settings bucket
    settings_bucket = None
    for one_bucket in minio.list_buckets():
        if one_bucket.name == s3_access.SETTINGS_BUCKET_LEGACY:
            settings_bucket = one_bucket.name
            break
        if one_bucket.name.startswith(s3_access.SETTINGS_BUCKET_PREFIX):
            settings_bucket = one_bucket.name

    temp_file = tempfile.mkstemp(prefix=s3_access.SPARCD_PREFIX)
    os.close(temp_file[0])

    file_path = s3_access.make_s3_path((s3_access.SETTINGS_FOLDER, filename))

    # Look for the file
    print(f'__confirm_delete_configuration_file: settings file "{filename}" in {settings_bucket}',
                                                                                        flush=True)
    found = False
    for one_obj in minio.list_objects(settings_bucket, prefix=s3_access.SETTINGS_FOLDER + '/'):
        if one_obj.object_name == file_path:
            found = True
            break

    # Try to remove the object
    deleted = False
    if found:
        try:
            minio.remove_object(settings_bucket, file_path)
            deleted = True
        except S3Error as ex:
            print('__confirm_delete_configuration_file: error deleting settings file '\
                                                f'"{filename}" in {settings_bucket}', flush=True)
            print(ex, flush=True)

    return found, deleted


@pytest.fixture(scope='session')
def s3_endpoint(pytestconfig):
    """ S3 endpoint command line argument fixture"""
    endpoint_value = pytestconfig.getoption("s3_endpoint")
    return endpoint_value

@pytest.fixture(scope='session')
def s3_name(pytestconfig):
    """ S3 user name command line argument fixture"""
    name_value = pytestconfig.getoption("s3_name")
    return name_value

@pytest.fixture(scope='session')
def s3_secret(pytestconfig):
    """ S3 user secret command line argument fixture"""
    secret_value = pytestconfig.getoption("s3_secret")
    return secret_value

@pytest.fixture(scope='session')
def s3_test_bucket(pytestconfig):
    """ S3 test bucket command line argument fixture"""
    test_value = pytestconfig.getoption("s3_test_bucket")
    return test_value

@pytest.fixture(scope='session')
def s3_test_upload(pytestconfig):
    """ S3 test upload folder name under bucket command line argument fixture"""
    upload_value = pytestconfig.getoption("s3_test_upload")
    return upload_value


# pylint: disable=redefined-outer-name
def test_list_collections(s3_endpoint, s3_name, s3_secret) -> None:
    """ Tests listing collections
    """
    assert s3_endpoint is not None
    assert s3_name is not None
    assert s3_secret is not None

    colls = s3_access.S3Connection.list_collections(s3_endpoint, s3_name, s3_secret)
    assert colls is not None and len(colls) > 0


# pylint: disable=redefined-outer-name
def test_get_collections(s3_endpoint, s3_name, s3_secret) -> None:
    """ Tests getting collection information
    """
    assert s3_endpoint is not None
    assert s3_name is not None
    assert s3_secret is not None

    colls = s3_access.S3Connection.get_collections(s3_endpoint, s3_name, s3_secret)
    assert colls is not None and len(colls) > 0


# pylint: disable=redefined-outer-name
def test_get_collection_info(s3_endpoint, s3_name, s3_secret, s3_test_bucket) -> None:
    """ Tests getting collection information for a collection
    """
    assert s3_endpoint is not None
    assert s3_name is not None
    assert s3_secret is not None
    assert s3_test_bucket is not None

    coll = s3_access.S3Connection.get_collection_info(s3_endpoint, s3_name, s3_secret,
                                                                                    s3_test_bucket)
    assert coll is not None


# pylint: disable=redefined-outer-name
def test_get_collection_info_with_upload(s3_endpoint, s3_name, s3_secret, s3_test_bucket, \
                                                                            s3_test_upload) -> None:
    """ Tests getting collection information for an upload withing a collection
    """
    assert s3_endpoint is not None
    assert s3_name is not None
    assert s3_secret is not None
    assert s3_test_bucket is not None
    assert s3_test_upload is not None

    coll = s3_access.S3Connection.get_collection_info(s3_endpoint, s3_name, s3_secret,
                                                                    s3_test_bucket, s3_test_upload)
    assert coll is not None


# pylint: disable=redefined-outer-name
def test_get_upload_info_with_upload(s3_endpoint, s3_name, s3_secret, s3_test_bucket, \
                                                                            s3_test_upload) -> None:
    """ Tests getting upload information from a collection
    """
    assert s3_endpoint is not None
    assert s3_name is not None
    assert s3_secret is not None
    assert s3_test_bucket is not None
    assert s3_test_upload is not None

    coll_name = s3_test_bucket[len(s3_access.SPARCD_PREFIX):]
    upload_path = s3_access.make_s3_path(['Collections', coll_name, 'Uploads', s3_test_upload])

    coll = s3_access.S3Connection.get_upload_info(s3_endpoint, s3_name, s3_secret, s3_test_bucket,
                                                                                        upload_path)
    assert coll is not None


# pylint: disable=redefined-outer-name
def test_get_image_paths(s3_endpoint, s3_name, s3_secret, s3_test_bucket, \
                                                                            s3_test_upload) -> None:
    """ Tests getting upload information from a collection
    """
    assert s3_endpoint is not None
    assert s3_name is not None
    assert s3_secret is not None
    assert s3_test_bucket is not None
    assert s3_test_upload is not None

    coll_name = s3_test_bucket[len(s3_access.SPARCD_PREFIX):]
    images = s3_access.S3Connection.get_image_paths(s3_endpoint, s3_name, s3_secret, coll_name,
                                                                                    s3_test_upload)
    assert images is not None and len(images) > 0


# pylint: disable=redefined-outer-name
def test_get_images(s3_endpoint, s3_name, s3_secret, s3_test_bucket, s3_test_upload) -> None:
    """ Gets image information from S3
    """
    assert s3_endpoint is not None
    assert s3_name is not None
    assert s3_secret is not None
    assert s3_test_bucket is not None
    assert s3_test_upload is not None

    coll_name = s3_test_bucket[len(s3_access.SPARCD_PREFIX):]
    images = s3_access.S3Connection.get_images(s3_endpoint, s3_name, s3_secret, coll_name,
                                                                            s3_test_upload, False)
    assert images is not None and len(images) > 0
    assert images[0]['s3_url'] is None


# pylint: disable=redefined-outer-name
def test_get_images_with_url(s3_endpoint, s3_name, s3_secret, s3_test_bucket, \
                                                                            s3_test_upload) -> None:
    """ Gets image information from S3
    """
    assert s3_endpoint is not None
    assert s3_name is not None
    assert s3_secret is not None
    assert s3_test_bucket is not None
    assert s3_test_upload is not None

    coll_name = s3_test_bucket[len(s3_access.SPARCD_PREFIX):]
    images = s3_access.S3Connection.get_images(s3_endpoint, s3_name, s3_secret, coll_name,
                                                                                    s3_test_upload)
    assert images is not None and len(images) > 0
    assert images[0]['s3_url'] is not None

# pylint: disable=redefined-outer-name
def test_list_uploads(s3_endpoint, s3_name, s3_secret, s3_test_bucket, s3_test_upload) -> None:
    """ Gets uploads information from S3
    """
    assert s3_endpoint is not None
    assert s3_name is not None
    assert s3_secret is not None
    assert s3_test_bucket is not None
    assert s3_test_upload is not None

    uploads = s3_access.S3Connection.list_uploads(s3_endpoint, s3_name, s3_secret, s3_test_bucket)
    assert uploads is not None and len(uploads) > 0

# pylint: disable=redefined-outer-name
def test_get_configuration(s3_endpoint, s3_name, s3_secret) -> None:
    """ Gets configuration information from S3
    """
    assert s3_endpoint is not None
    assert s3_name is not None
    assert s3_secret is not None

    for one_file in SPARCD_CONFIGURATION_FILE_NAMES:
        config = s3_access.S3Connection.get_configuration(one_file, s3_endpoint, s3_name, s3_secret)
        assert config is not None and len(config) > 0

# pylint: disable=redefined-outer-name
def put_configuration(s3_endpoint, s3_name, s3_secret) -> None:
    """ Gets configuration information from S3
    """
    assert s3_endpoint is not None
    assert s3_name is not None
    assert s3_secret is not None

    test_filename = SPARCD_CONFIGURATION_FILE_NAMES[0]
    config = s3_access.S3Connection.get_configuration(test_filename, s3_endpoint, s3_name,
                                                                                        s3_secret)
    if config is None:
        assert f'Missing testing configuration data on server {test_filename}' is False

    s3_access.S3Connection.put_configuration('testing.txt', config, s3_endpoint, s3_name, s3_secret)
    found, deleted = __confirm_delete_configuration_file('testing', s3_endpoint, s3_name, s3_secret)

    assert found is True

    # We care if the file was deleted, failing the test will allow someone to notice and clean it up
    assert deleted is True

# pylint: disable=redefined-outer-name
def test_get_object_urls(s3_endpoint, s3_name, s3_secret, s3_test_bucket, s3_test_upload) -> None:
    """ Tests getting a URL to an S3 object
    """
    assert s3_endpoint is not None
    assert s3_name is not None
    assert s3_secret is not None
    assert s3_test_bucket is not None
    assert s3_test_upload is not None

    test_path = __fetch_upload_file_names(s3_endpoint, s3_name, s3_secret, s3_test_bucket,
                                                                            s3_test_upload, 1)[0]
    assert test_path is not None

    url = s3_access.S3Connection.get_object_urls(s3_endpoint, s3_name, s3_secret,
                    [
                        (s3_test_bucket, test_path),
                    ])
    assert url is not None


# pylint: disable=redefined-outer-name
def test_download_images_cb(s3_endpoint, s3_name, s3_secret, s3_test_bucket, \
                                                                            s3_test_upload) -> None:
    """ Tests the download callback function
    """
    assert s3_endpoint is not None
    assert s3_name is not None
    assert s3_secret is not None
    assert s3_test_bucket is not None
    assert s3_test_upload is not None

    cb_test_data_parameter = 1

    test_paths = __fetch_upload_file_names(s3_endpoint, s3_name, s3_secret, s3_test_bucket,
                                                                            s3_test_upload, 5)

    # Temporary folder to hold download filed
    test_dir = tempfile.mkdtemp(prefix=s3_access.SPARCD_PREFIX)
    print('test_download_images_cb: temporary folder: ', test_dir, flush=True)

    def test_cb(cb_data: int, bucket: str, s3_path: str, local_path: str) -> None:
        """ Testing callback function
        """
        if bucket is None:
            print('test_download_images_cb: COMPLETED')
            return

        print(f'test_download_images_cb: callback: Confirming {s3_path}', flush=True)
        assert cb_data == cb_test_data_parameter
        assert bucket == s3_test_bucket
        assert s3_test_upload in s3_path
        assert test_dir in local_path
        assert os.path.exists(local_path)

    try:
        file_info = [(s3_test_bucket, one_path, str(idx)+".dat") for idx, one_path \
                                                                        in enumerate(test_paths)]
        s3_access.S3Connection.download_images_cb(s3_endpoint, s3_name, s3_secret, file_info,
                                                        test_dir,test_cb, cb_test_data_parameter)
    finally:
        shutil.rmtree(test_dir)

# pylint: disable=redefined-outer-name
def test_download_image(s3_endpoint, s3_name, s3_secret, s3_test_bucket, s3_test_upload) -> None:
    """ Tests getting an image
    """
    assert s3_endpoint is not None
    assert s3_name is not None
    assert s3_secret is not None
    assert s3_test_bucket is not None
    assert s3_test_upload is not None

    # File to download
    test_path = __fetch_upload_file_names(s3_endpoint, s3_name, s3_secret, s3_test_bucket,
                                                                            s3_test_upload, 1)[0]
    assert test_path is not None

    # Local file name to put data
    temp_file = tempfile.mkstemp(prefix=s3_access.SPARCD_PREFIX)
    os.close(temp_file[0])
    if os.path.exists(temp_file[1]):
        os.unlink(temp_file[1])

    try:
        s3_access.S3Connection.download_image(s3_endpoint, s3_name, s3_secret, s3_test_bucket,
                                                                            test_path, temp_file[1])
        assert os.path.exists(temp_file[1])
    finally:
        if os.path.exists(temp_file[1]):
            os.unlink(temp_file[1])

# pylint: disable=redefined-outer-name
def test_create_upload(s3_endpoint, s3_name, s3_secret, s3_test_bucket) -> None:
    """ Tests creating an upload
    """
    assert s3_endpoint is not None
    assert s3_name is not None
    assert s3_secret is not None
    assert s3_test_bucket is not None

    comment = "Automated testing upload"
    image_count = 10
    timestamp = datetime.datetime(2100, 6, 16, hour=13, minute=14, second=15,
                                                                    tzinfo=datetime.timezone.utc)
    created_upload_name = timestamp.strftime('%Y.%m.%d.%H.%M.%S') + '_' + s3_name

    # In case of error, may help with cleanup
    print(f'test_create_upload: creating upload {created_upload_name} in {s3_test_bucket}',
                                                                                        flush=True)

    # Make the call
    coll_name = s3_test_bucket[len(s3_access.SPARCD_PREFIX):]
    s3_access.S3Connection.create_upload(s3_endpoint, s3_name, s3_secret, coll_name, comment,
                                                                            timestamp, image_count)

    # Local file name to put downloaded data
    temp_file = tempfile.mkstemp(prefix=s3_access.SPARCD_PREFIX)
    os.close(temp_file[0])
    if os.path.exists(temp_file[1]):
        os.unlink(temp_file[1])

    # Get the upload data back
    minio = Minio(s3_endpoint, access_key=s3_name, secret_key=s3_secret)
    upload_path = s3_access.make_s3_path(('Collections', coll_name, 'Uploads', created_upload_name))
    upload_info_path = s3_access.make_s3_path((upload_path,s3_access.S3_UPLOAD_META_JSON_FILE_NAME))

    try:
        # Get the data to test the creation
        upload_data = s3_access.get_s3_file(minio, s3_test_bucket, upload_info_path, temp_file[1])
        upload_data = json.loads(upload_data)

        # Remove the upload folder and its contents from the server
        minio.remove_object(s3_test_bucket, upload_path)

        assert upload_data['uploadUser'] == s3_name
        assert upload_data['imageCount'] == image_count
        assert upload_data['bucket'] == s3_test_bucket
        assert upload_data['description'] == comment
        assert upload_data['uploadPath'] == upload_path
        assert 'editComments' in upload_data
        assert 'imagesWithSpecies' in upload_data
        assert int(upload_data['uploadDate']['date']['year']) == timestamp.year
        assert int(upload_data['uploadDate']['date']['month']) == timestamp.month
        assert int(upload_data['uploadDate']['date']['day']) == timestamp.day
        assert int(upload_data['uploadDate']['time']['hour']) == timestamp.hour
        assert int(upload_data['uploadDate']['time']['minute']) == timestamp.minute
        assert int(upload_data['uploadDate']['time']['second']) == timestamp.second
        assert int(upload_data['uploadDate']['time']['nano']) == timestamp.microsecond
    finally:
        if os.path.exists(temp_file[1]):
            os.unlink(temp_file[1])

# pylint: disable=redefined-outer-name
def test_upload_file(s3_endpoint, s3_name, s3_secret, s3_test_bucket, s3_test_upload) -> None:
    """ Tests upload a file to S3
    """
    assert s3_endpoint is not None
    assert s3_name is not None
    assert s3_secret is not None
    assert s3_test_bucket is not None
    assert s3_test_upload is not None

    test_data = "This is some testing data"

    coll_name = s3_test_bucket[len(s3_access.SPARCD_PREFIX):]
    remote_path = s3_access.make_s3_path(('Collections', coll_name, 'Uploads', s3_test_upload,
                                                                                    'testing.dat'))

    print(f'test_upload_file: creating file at path: {remote_path} in {s3_test_bucket}', flush=True)

    # Local file name to put data
    temp_file = tempfile.mkstemp(prefix=s3_access.SPARCD_PREFIX)
    os.close(temp_file[0])
    if os.path.exists(temp_file[1]):
        os.unlink(temp_file[1])

    # Write something to the file on disk
    with open(temp_file[1], 'w', encoding="utf-8") as ofile:
        ofile.write(test_data)

    try:
        # Make the call
        s3_access.S3Connection.upload_file(s3_endpoint, s3_name, s3_secret, s3_test_bucket,
                                                                        remote_path, temp_file[1])
        if os.path.exists(temp_file[1]):
            os.unlink(temp_file[1])

        # Get the data from the server to make sure it made it up there
        minio = Minio(s3_endpoint, access_key=s3_name, secret_key=s3_secret)
        upload_data = s3_access.get_s3_file(minio, s3_test_bucket, remote_path, temp_file[1])

        # Remove the file from the server
        minio.remove_object(s3_test_bucket, remote_path)

        assert upload_data is not None
        assert upload_data == test_data
    finally:
        if os.path.exists(temp_file[1]):
            os.unlink(temp_file[1])

# pylint: disable=redefined-outer-name
def test_upload_file_data(s3_endpoint, s3_name, s3_secret, s3_test_bucket, s3_test_upload) -> None:
    """ Tests uploading data a file to S3
    """
    assert s3_endpoint is not None
    assert s3_name is not None
    assert s3_secret is not None
    assert s3_test_bucket is not None
    assert s3_test_upload is not None

    test_data = "Another set of test data to put onto S3"

    coll_name = s3_test_bucket[len(s3_access.SPARCD_PREFIX):]
    remote_path = s3_access.make_s3_path(('Collections', coll_name, 'Uploads', s3_test_upload,
                                                                                'testing_data.dat'))

    print(f'test_upload_file_data: uplading data to file {remote_path} in {s3_test_bucket}',
                                                                                        flush=True)

    s3_access.S3Connection.upload_file_data(s3_endpoint, s3_name, s3_secret,
                                                            s3_test_bucket, remote_path, test_data)

    # Local file name to put data
    temp_file = tempfile.mkstemp(prefix=s3_access.SPARCD_PREFIX)
    os.close(temp_file[0])
    if os.path.exists(temp_file[1]):
        os.unlink(temp_file[1])

    # Get the data and check it out
    try:
        # Get the data from the server to make sure it made it up there
        minio = Minio(s3_endpoint, access_key=s3_name, secret_key=s3_secret)
        upload_data = s3_access.get_s3_file(minio, s3_test_bucket, remote_path, temp_file[1])

        # Remove the file from the server
        minio.remove_object(s3_test_bucket, remote_path)

        assert upload_data is not None
        assert upload_data == test_data
    finally:
        if os.path.exists(temp_file[1]):
            os.unlink(temp_file[1])

# pylint: disable=redefined-outer-name
def test_get_camtrap_file(s3_endpoint, s3_name, s3_secret, s3_test_bucket, s3_test_upload) -> None:
    """ Tests getting the CAMTRAP files from the S3 endpoint
    """
    assert s3_endpoint is not None
    assert s3_name is not None
    assert s3_secret is not None
    assert s3_test_bucket is not None
    assert s3_test_upload is not None

    coll_name = s3_test_bucket[len(s3_access.SPARCD_PREFIX):]

    for one_file in s3_access.CAMTRAP_FILE_NAMES:
        camtrap_path = s3_access.make_s3_path(('Collections', coll_name, 'Uploads', s3_test_upload,
                                                                                        one_file))
        print(f'test_get_camtrap_file: getting camtrap data {camtrap_path} in {s3_test_bucket}',
                                                                                        flush=True)
        res = s3_access.S3Connection.get_camtrap_file(s3_endpoint, s3_name, s3_secret,
                                                                        s3_test_bucket, one_file)

        assert res is not None
        assert len(res) >= 0

# pylint: disable=redefined-outer-name
def test_upload_camtrap_data(s3_endpoint, s3_name, s3_secret, s3_test_bucket) -> None:
    """ Tests uploading camtrap data to the server
    """
    assert s3_endpoint is not None
    assert s3_name is not None
    assert s3_secret is not None
    assert s3_test_bucket is not None

    # Some testing data
    comment = "Automated testing upload again"
    image_count = 10
    timestamp = datetime.datetime(2101, 6, 16, hour=13, minute=14, second=15,
                                                                    tzinfo=datetime.timezone.utc)
    fake_camtrap_data = [['fake', '2', '3', '4', '5', '6', '7'], ]

    created_upload_name = timestamp.strftime('%Y.%m.%d.%H.%M.%S') + '_' + s3_name

    print(f'test_upload_camtrap_data: Creating testing upload {created_upload_name} in ' \
                                                                    f'{s3_test_bucket}', flush=True)

    # Create an upload for this test
    coll_name = s3_test_bucket[len(s3_access.SPARCD_PREFIX):]
    s3_access.S3Connection.create_upload(s3_endpoint, s3_name, s3_secret, coll_name, comment,
                                                                            timestamp, image_count)

    # Get the upload path
    upload_path = s3_access.make_s3_path(('Collections', coll_name, 'Uploads', created_upload_name))

    camtrap_path = s3_access.make_s3_path((upload_path, s3_access.DEPLOYMENT_CSV_FILE_NAME))

    # Make the call
    s3_access.S3Connection.upload_camtrap_data(s3_endpoint, s3_name, s3_secret, s3_test_bucket,
                                                                    camtrap_path, fake_camtrap_data)

    # Local file name to put data
    temp_file = tempfile.mkstemp(prefix=s3_access.SPARCD_PREFIX)
    os.close(temp_file[0])
    if os.path.exists(temp_file[1]):
        os.unlink(temp_file[1])

    # Check that we have the camtrap data and clean up the server
    try:
        # Get the data from the server
        res = s3_access.S3Connection.get_camtrap_file(s3_endpoint, s3_name, s3_secret,
                                                                    s3_test_bucket, camtrap_path)

        # Clean up the upload folder and everything under it
        minio = Minio(s3_endpoint, access_key=s3_name, secret_key=s3_secret)
        minio.remove_object(s3_test_bucket, upload_path)

        print('HACK:test_upload_camtrap_data:',upload_path,camtrap_path,flush=True)
        print('HACK:test_upload_camtrap_data:',res,type(res),len(res),len(fake_camtrap_data),flush=True)

        assert res == fake_camtrap_data

    finally:
        if os.path.exists(temp_file[1]):
            os.unlink(temp_file[1])

def test_save_collection_info(s3_endpoint, s3_name, s3_secret, s3_test_bucket) -> None:
    """ Tests updating the collection information on the server
    """
    assert s3_endpoint is not None
    assert s3_name is not None
    assert s3_secret is not None
    assert s3_test_bucket is not None

    unique_str = datetime.datetime.now().strftime('%Y.%m.%d.%H.%M.%S')
    test_data = {
                'name': 'name_' + unique_str,
                'organization':  'organization_' +  unique_str,
                'email': unique_str + '@not.real.com',
                'description': 'description_' + unique_str,
                }

    print(f'test_save_collection_info: Updating collection info with unique string: {unique_str}',
                                                                                        flush=True)

    s3_access.S3Connection.save_collection_info(s3_endpoint, s3_name, s3_secret, s3_test_bucket,
                                                                                        test_data)

    # Confirm the update
    coll_name = s3_test_bucket[len(s3_access.SPARCD_PREFIX):]
    remote_path = s3_access.make_s3_path(('Collections', coll_name,
                                                            s3_access.COLLECTION_JSON_FILE_NAME))

    # Local file name to put data
    temp_file = tempfile.mkstemp(prefix=s3_access.SPARCD_PREFIX)
    os.close(temp_file[0])
    if os.path.exists(temp_file[1]):
        os.unlink(temp_file[1])

    # Check that we have updated the information on the server
    try:
        minio = Minio(s3_endpoint, access_key=s3_name, secret_key=s3_secret)
        res = s3_access.get_s3_file(minio, s3_test_bucket, remote_path, temp_file[1])
        res = json.loads(res)

        # Put the original data back
        orig_path = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'original_data', 'collection.json')
        print('HACK:test_save_collection_info:',orig_path,remote_path,os.path.exists(orig_path),flush=True)
        s3_access.put_s3_file(minio, s3_test_bucket, remote_path, orig_path,
                                                                    content_type='application/json')

        # Check if our data made it to the server
        assert res['nameProperty'] == test_data['name']
        assert res['organizationProperty'] == test_data['organization']
        assert res['contactInfoProperty'] == test_data['email']
        assert res['descriptionProperty'] == test_data['description']
        assert res['idProperty'] == coll_name
        assert res['bucketProperty'] == s3_test_bucket
    finally:
        if os.path.exists(temp_file[1]):
            os.unlink(temp_file[1])

def test_save_collection_permissions(s3_endpoint, s3_name, s3_secret, s3_test_bucket) -> None:
    """ Tests updating the permissions information on the server
    """
    assert s3_endpoint is not None
    assert s3_name is not None
    assert s3_secret is not None
    assert s3_test_bucket is not None

    # Get the base permissions and add to them
    local_path = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'original_data',
                                                            s3_access.PERMISSIONS_JSON_FILE_NAME)
    with open(local_path, 'r', encoding='utf-8') as ifile:
        perms = json.loads(ifile.read())

    perms.append({
            "usernameProperty": "testing",
            "readProperty": False,
            "uploadProperty": False,
            "ownerProperty": False
        })

    # Make the call
    s3_access.S3Connection.save_collection_permissions(s3_endpoint, s3_name, s3_secret,
                                                                            s3_test_bucket, perms)

    # Local file name to put data
    temp_file = tempfile.mkstemp(prefix=s3_access.SPARCD_PREFIX)
    os.close(temp_file[0])
    if os.path.exists(temp_file[1]):
        os.unlink(temp_file[1])

    # Get the uploaded permissions, check the results, and restore the data
    try:
        coll_name = s3_test_bucket[len(s3_access.SPARCD_PREFIX):]
        remote_path = s3_access.make_s3_path(("Collections", coll_name, \
                                                            s3_access.PERMISSIONS_JSON_FILE_NAME))

        minio = Minio(s3_endpoint, access_key=s3_name, secret_key=s3_secret)
        res = s3_access.get_s3_file(minio, s3_test_bucket, remote_path, temp_file[1])
        res = json.loads(res)

        # Restore the permissions
        s3_access.put_s3_file(minio, s3_test_bucket, remote_path, local_path,
                                                                    content_type='application/json')

        assert res == perms
    finally:
        if os.path.exists(temp_file[1]):
            os.unlink(temp_file[1])

def test_update_upload_metadata_image_species(s3_endpoint, s3_name, s3_secret, s3_test_bucket, \
                                                                            s3_test_upload) -> None:
    """ Tests updating the upload metadata with a new count of images with species
    """
    assert s3_endpoint is not None
    assert s3_name is not None
    assert s3_secret is not None
    assert s3_test_bucket is not None
    assert s3_test_upload is not None

    coll_name = s3_test_bucket[len(s3_access.SPARCD_PREFIX):]
    upload_path = s3_access.make_s3_path(("Collections", coll_name, "Uploads", s3_test_upload))
    new_count = int(datetime.datetime.now().timestamp())

    # Make the call
    s3_access.S3Connection.update_upload_metadata_image_species(s3_endpoint, s3_name, s3_secret,
                                                            s3_test_bucket, upload_path, new_count)

    # Local file name to put data
    temp_file = tempfile.mkstemp(prefix=s3_access.SPARCD_PREFIX)
    os.close(temp_file[0])
    if os.path.exists(temp_file[1]):
        os.unlink(temp_file[1])

    # Check the results and restore the data
    try:
        remote_path = s3_access.make_s3_path((upload_path, s3_access.S3_UPLOAD_META_JSON_FILE_NAME))

        minio = Minio(s3_endpoint, access_key=s3_name, secret_key=s3_secret)
        res = s3_access.get_s3_file(minio, s3_test_bucket, remote_path, temp_file[1])
        res = json.loads(res)

        local_path = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'original_data',
                                                    s3_access.S3_UPLOAD_META_JSON_FILE_NAME)
        # Restore the upload metadata
        s3_access.put_s3_file(minio, s3_test_bucket, remote_path, local_path,
                                                                    content_type='application/json')

        assert res['imagesWithSpecies'] == new_count
    finally:
        if os.path.exists(temp_file[1]):
            os.unlink(temp_file[1])

def test_update_upload_metadata_with_comment(s3_endpoint, s3_name, s3_secret, s3_test_bucket, \
                                                                            s3_test_upload) -> None:
    """ Tests updating the upload metadata with a new comment
    """
    assert s3_endpoint is not None
    assert s3_name is not None
    assert s3_secret is not None
    assert s3_test_bucket is not None
    assert s3_test_upload is not None

    coll_name = s3_test_bucket[len(s3_access.SPARCD_PREFIX):]

    # Create our upload folder
    comment = "Automated testing to add comment to metadata"
    image_count = 10
    timestamp = datetime.datetime(2102, 6, 16, hour=13, minute=14, second=15,
                                                                    tzinfo=datetime.timezone.utc)
    created_upload_name = timestamp.strftime('%Y.%m.%d.%H.%M.%S') + '_' + s3_name
    print(f'test_update_upload_metadata_with_comment: Creating testing upload ' \
                                        f'{created_upload_name} in {s3_test_bucket}', flush=True)

    s3_access.S3Connection.create_upload(s3_endpoint, s3_name, s3_secret, coll_name, comment,
                                                                            timestamp, image_count)

    # Get the upload path
    upload_path = s3_access.make_s3_path(("Collections", coll_name, "Uploads", created_upload_name))
    comment = "Testing updating a upload metadata comment"

    # Make the call
    s3_access.S3Connection.update_upload_metadata(s3_endpoint, s3_name, s3_secret, s3_test_bucket,
                                                                upload_path, new_comment=comment)

    # Local file name to put data
    temp_file = tempfile.mkstemp(prefix=s3_access.SPARCD_PREFIX)
    os.close(temp_file[0])
    if os.path.exists(temp_file[1]):
        os.unlink(temp_file[1])

    # Check the results and restore the data
    try:
        remote_path = s3_access.make_s3_path((upload_path, s3_access.S3_UPLOAD_META_JSON_FILE_NAME))

        minio = Minio(s3_endpoint, access_key=s3_name, secret_key=s3_secret)
        res = s3_access.get_s3_file(minio, s3_test_bucket, remote_path, temp_file[1])
        res = json.loads(res)

        # Clean up the upload folder and everything under it
        minio.remove_object(s3_test_bucket, upload_path)

        found = False
        for one_comment in res['editComments']:
            if one_comment == comment:
                found = True

        assert found == True
    finally:
        if os.path.exists(temp_file[1]):
            os.unlink(temp_file[1])

def test_update_upload_metadata_with_count(s3_endpoint, s3_name, s3_secret, s3_test_bucket, \
                                                                            s3_test_upload) -> None:
    """ Tests updating the upload metadata with a new count
    """
    assert s3_endpoint is not None
    assert s3_name is not None
    assert s3_secret is not None
    assert s3_test_bucket is not None
    assert s3_test_upload is not None

    coll_name = s3_test_bucket[len(s3_access.SPARCD_PREFIX):]
    upload_path = s3_access.make_s3_path(("Collections", coll_name, "Uploads", s3_test_upload))
    new_count = int(datetime.datetime.now().timestamp())

    # Make the call
    s3_access.S3Connection.update_upload_metadata(s3_endpoint, s3_name, s3_secret, s3_test_bucket,
                                                        upload_path, images_species_count=new_count)

    # Local file name to put data
    temp_file = tempfile.mkstemp(prefix=s3_access.SPARCD_PREFIX)
    os.close(temp_file[0])
    if os.path.exists(temp_file[1]):
        os.unlink(temp_file[1])

    # Check the results and restore the data
    try:
        remote_path = s3_access.make_s3_path((upload_path, s3_access.S3_UPLOAD_META_JSON_FILE_NAME))

        minio = Minio(s3_endpoint, access_key=s3_name, secret_key=s3_secret)
        res = s3_access.get_s3_file(minio, s3_test_bucket, remote_path, temp_file[1])
        res = json.loads(res)

        local_path = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'original_data',
                                                    s3_access.S3_UPLOAD_META_JSON_FILE_NAME)
        # Restore the upload metadata
        s3_access.put_s3_file(minio, s3_test_bucket, remote_path, local_path,
                                                                    content_type='application/json')

        assert res['imagesWithSpecies'] == new_count
    finally:
        if os.path.exists(temp_file[1]):
            os.unlink(temp_file[1])

def test_update_upload_metadata_with_count_comment(s3_endpoint, s3_name, s3_secret, s3_test_bucket,\
                                                                            s3_test_upload) -> None:
    """ Tests updating the upload metadata with a new comment and a new count
    """
    assert s3_endpoint is not None
    assert s3_name is not None
    assert s3_secret is not None
    assert s3_test_bucket is not None
    assert s3_test_upload is not None

    coll_name = s3_test_bucket[len(s3_access.SPARCD_PREFIX):]

    # Create our upload folder
    comment = "Automated testing adding comment and changing counts"
    image_count = 10
    timestamp = datetime.datetime(2103, 6, 16, hour=13, minute=14, second=15,
                                                                    tzinfo=datetime.timezone.utc)
    created_upload_name = timestamp.strftime('%Y.%m.%d.%H.%M.%S') + '_' + s3_name
    print(f'test_update_upload_metadata_with_count_comment: Creating testing upload ' \
                                        f'{created_upload_name} in {s3_test_bucket}', flush=True)

    s3_access.S3Connection.create_upload(s3_endpoint, s3_name, s3_secret, coll_name, comment,
                                                                            timestamp, image_count)

    # Get the upload path
    upload_path = s3_access.make_s3_path(("Collections", coll_name, "Uploads", created_upload_name))

    # Initialize testing variables
    new_count = int(datetime.datetime.now().timestamp())
    comment = "Testing another update of an upload metadata comment"

    # Make the call
    s3_access.S3Connection.update_upload_metadata(s3_endpoint, s3_name, s3_secret, s3_test_bucket,
                                upload_path, new_comment=comment, images_species_count=new_count)

    # Local file name to put data
    temp_file = tempfile.mkstemp(prefix=s3_access.SPARCD_PREFIX)
    os.close(temp_file[0])
    if os.path.exists(temp_file[1]):
        os.unlink(temp_file[1])

    # Check the results and restore the data
    try:
        remote_path = s3_access.make_s3_path((upload_path, s3_access.S3_UPLOAD_META_JSON_FILE_NAME))

        minio = Minio(s3_endpoint, access_key=s3_name, secret_key=s3_secret)
        res = s3_access.get_s3_file(minio, s3_test_bucket, remote_path, temp_file[1])
        res = json.loads(res)

        # Clean up the upload folder and everything under it
        minio.remove_object(s3_test_bucket, upload_path)

        found = False
        for one_comment in res['editComments']:
            if one_comment == comment:
                found = True

        assert res['imagesWithSpecies'] == new_count
        assert found == True
    finally:
        if os.path.exists(temp_file[1]):
            os.unlink(temp_file[1])
