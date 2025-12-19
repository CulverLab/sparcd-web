""" Collection functions for SPARCd server """

import time
from typing import Callable, Optional

from s3_access import S3Connection
from sparcd_db import SPARCdDatabase
import sparcd_utils as sdu

# Collections information timeout length
TIMEOUT_COLLECTIONS_SEC = 12 * 60 * 60
# Uploaded images timeout length
TIMEOUT_UPLOAD_SEC = 12 * 60 * 60
# Maximum tries to get a lock for loading collections
MAX_COLL_FETCH_TRIES = 10
# Maximium number of seconds to wait for collections to get loaded before giving up
MAX_COLL_FETCH_WAIT_SEC = 5 * 60
# Sleep interval value while waiting for collections to load
COLL_FETCH_WAIT_INTERVAL_SEC = (MAX_COLL_FETCH_WAIT_SEC) / \
                                                ((MAX_COLL_FETCH_TRIES+1)*MAX_COLL_FETCH_TRIES/2)


def __update_s3_from_db(s3_images, db_images) -> tuple:
    """ Assigns DB information to the S3 images
    Arguments:
        s3_images: the images to update
        db_images: the database images to use when updating the S3 images
    Return:
        Returns the tuple of the updated S3 images
    Notes:
        Will only update some of the S3 data for matching images
    """
    s3_dicts = {one_image['s3_path']:one_image for one_image in s3_images}

    for one_image in db_images:
        if one_image['s3_path'] in s3_dicts:
            s3_dicts[one_image['s3_path']]['s3_url'] = one_image['s3_url']
            s3_dicts[one_image['s3_path']]['key'] = one_image['key']

    return [s3_dicts[one_key] for one_key in s3_dicts]


def __get_loaded_collections(db: SPARCdDatabase, s3_id: str, s3_url: str, user_name: str, \
                                                    fetch_password: Callable) -> Optional[tuple]:
    """ Loads the collections from S3 and saves them in the database
    Arguments:
        db: the database to access
        s3_id: the unique ID of the S3 instance
        s3_url: the URL to the S3 instance
        user_name: the S3 user name
        fetch_password: callable that returns the S3 password
    Return:
        Returns the collection information associated with the S3 ID
    """
    loaded_colls = None

    # Get the collection information from the server
    # If we can get the lock we load the collections, otherwise wait for the collections to load
    have_lock = False
    lock_id = None
    try:
        lock_id = db.get_lock('fetch_collection')
        if lock_id is not None:
            have_lock = True

            all_collections = S3Connection.get_collections(s3_url, user_name, fetch_password())

            loaded_colls = []
            for one_coll in all_collections:
                loaded_colls.append(sdu.normalize_collection(one_coll))

            db.save_all_collections(s3_id, loaded_colls)

            db.release_lock('fetch_collection', lock_id)
            have_lock = False
            lock_id = None
        else:
            # We wait for the collections to get loaded
            # This uses a linear wait/sleep but that can be changed
            tries = 0
            while tries < MAX_COLL_FETCH_TRIES:
                tries += 1
                time.sleep(tries * COLL_FETCH_WAIT_INTERVAL_SEC)

                loaded_colls = db.get_all_collections(s3_id, TIMEOUT_COLLECTIONS_SEC)
                if loaded_colls:
                    tries += MAX_COLL_FETCH_TRIES
    finally:
        # If we have the lock, something must have happened so we release the lock
        if have_lock is True and lock_id is not None:
            db.release_lock('fetch_collection', lock_id)

    return loaded_colls


# pylint: disable=too-many-positional-arguments,too-many-arguments
def load_collections(db: SPARCdDatabase, s3_id: str, admin: bool, s3_url: str=None, \
                    user_name: str=None, fetch_password: Callable=None) -> Optional[tuple]:
    """ Loads collections from the database or S3 endpoint
    Arguments:
        db: the database to access
        s3_id: the unique ID of the S3 instance
        admin: boolean value indicating admin privileges when set to True
        s3_url: the URL to the S3 instance
        user_name: the S3 user name
        fetch_password: callable that returns the S3 password
    Return:
        Returns the collection information associated with the S3 ID
    Notes:
        If the desired information is not in the database, the collection information is fetched
        from the S3 endpoint and then stored in the database.
        If one of s3_url, user_name, or fetch_password is None then S3 will not be queried for
        collections
    """
    loaded_colls = db.get_all_collections(s3_id, TIMEOUT_COLLECTIONS_SEC)

    if not loaded_colls and all(item for item in [s3_url, user_name, fetch_password]):
        loaded_colls = __get_loaded_collections(db, s3_id, s3_url, user_name, fetch_password)

    # Make sure we have something
    if not loaded_colls:
        return None

    # Make sure we have a boolean value for admin and not Truthiness
    if not admin in [True, False]:
        admin = False

    # Get this user's permissions
    user_coll = []
    for one_coll in loaded_colls:
        user_has_permissions = False
        new_coll = one_coll
        new_coll['permissions'] = None
        if 'allPermissions' in one_coll and one_coll['allPermissions']:
            try:
                for one_perm in one_coll['allPermissions']:
                    if one_perm and 'usernameProperty' in one_perm and \
                                one_perm['usernameProperty'] == user_name:
                        new_coll['permissions'] = one_perm
                        user_has_permissions = True
                        break
            finally:
                pass

        # Only return collections that the user has permissions to
        if admin is True or user_has_permissions is True:
            user_coll.append(new_coll)

    # Return the collections
    return user_coll


def collection_update(db: SPARCdDatabase, s3_id: str, collection: dict) -> None:
    """ Updates the collection in the database if the collection data hasn't expired
    Arguments:
        db: the database to access
        s3_id: the unique ID of the S3 instance
        collection: collection information including the collection name and other values
    Note:
        If the data in the database is determined to be too old, the database is not updated
    """
    db.collection_update(s3_id, collection, TIMEOUT_COLLECTIONS_SEC)


def get_upload_images(db: SPARCdDatabase, s3_id: str, collection_id: str, upload_name: str, \
                    s3_url: str, user_name: str, fetch_password: Callable, \
                    force_refresh: bool=False, keep_image_url: bool=False) -> tuple:
    """ Gets the images for the specied collection upload
    Arguments:
        db: the database to access
        s3_id: the unique ID of the S3 instance
        collection_id: the ID of the collection of the upload
        upload_name: the name of the upload to get images for
        s3_url: the URL to the S3 instance
        user_name: the S3 user name
        fetch_password: callable that returns the S3 password
        force_refresh: when True, will force a refresh of the upload
        keep_image_url: keeps the image's URLs to S3 (don't overwrite) when True
    Return:
        Returns a tuple containing the tuples of the image information and whether the image
        s3 URL was updated or kept from the DB
    Notes:
        If the desired information is not in the database, the upload information is fetched
        from the S3 endpoint and then stored in the database.
        If one of s3_url, user_name, or fetch_password is None then S3 will not be queried for
        uploaded images
    """
    kept_urls = False
    db_images = None
    s3_images = None

    if not force_refresh or (force_refresh and keep_image_url):
        db_images = db.upload_images_get(s3_id, collection_id, upload_name, TIMEOUT_UPLOAD_SEC)

    if (not db_images or force_refresh) and \
                                        all(item for item in [s3_url, user_name, fetch_password]):
        # Get the upload information from the server
        s3_images = S3Connection.get_images(s3_url, user_name, fetch_password(),
                                                    collection_id, upload_name, not keep_image_url)

    # Check if we're keeping the image URLs after loading all images from S3
    if db_images and keep_image_url:
        kept_urls = True
        if s3_images:
            s3_images = __update_s3_from_db(s3_images, db_images)

    # Save the images so we can reload them later
    if s3_images:
        db.upload_images_save(s3_id, collection_id, upload_name, s3_images)

    return s3_images if s3_images else db_images, kept_urls


def load_image_data(db: SPARCdDatabase, s3_id: str, collection_id: str, upload_name: str, \
                                                                image_key: str) -> Optional[dict]:
    """ Returns the image data associated with the image key
    Arguments:
        db: the database to access
        s3_id: the unique ID of the S3 instance
        collection_id: the ID of the collection of the upload
        upload_name: the name of the upload to get images for
        image_key: the key of the image to get
    Return:
        Returns the data for the found image or None if not found
    """
    return db.get_image_data(s3_id, collection_id, upload_name, image_key)
