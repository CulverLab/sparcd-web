"""This script contains testing of the interface instance to an S3 instance
"""
# We don't test the contents of what's downloaded as strongly here since that's done
# in the test_s3.py testing file

import pytest
from minio import Minio

import s3_access

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
