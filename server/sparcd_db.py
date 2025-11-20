"""This script contains the database interface for the SPARCd Web app
"""

import os
import logging
from typing import Optional

from spd_types.userinfo import UserInfo
from spd_database.spdsqlite import SPDSQLite

MAX_ALLOWED_EXPIRED_TOKENS_PER_USER = 1

class SPARCdDatabase:
    """Class handling access connections to the database
    """

    _db = None

    def __init__(self, db_path: str, logger: logging.Logger=None, verbose: bool=False):
        """Initialize an instance
        """
        self._db = SPDSQLite(db_path, logger, verbose)

    def __del__(self):
        """Handles closing the connection and other cleanup
        """
        if self._db is not None:
            del self._db

    def database_info(self) -> tuple:
        """ Returns information on the database as a tuple of strings
        """
        if self._db is not None:
            return self._db.database_info()

        return ('Not defined yet',)

    def connect(self, database_path: str = None) -> None:
        """Performs the actual connection to the database
        Arguments:
            database_path: the database to connect to
        """
        self._db.connect(database_path)

    def reconnect(self) -> None:
        """Attempts a reconnection if we're not connected
        """
        self.connect()

    def is_connected(self) -> bool:
        """ Returns whether this class instance is connected (true), or not (false)
        """
        return self._db.is_connected()

    def add_token(self, token: str, user: str, password: str, client_ip: str,
                                user_agent: str, s3_url: str, token_timeout_sec: int=None) -> None:
        """ Saves the token and associated user information
        Arguments:
            token: the unique token to save
            user: the user associated with the token
            password: the password associated with the user
            client_ip: the IP address of the client
            user_agent: a user agent value
            s3_url: the URL of the s3 instance
            token_timeout_sec: timeout for cleaning up expired tokens from the table
        """
        # pylint: disable=too-many-arguments, too-many-positional-arguments
        self._db.add_token(token, user, password, client_ip, user_agent, s3_url)

        self._db.clean_expired_tokens(user, token_timeout_sec)

    def update_token_timestamp(self, token: str) -> None:
        """Updates the token's timestamp to the database's now
        Arguments:
            token: the token to update
        """
        self._db.update_token_timestamp(token)

    def remove_token(self, token: str) -> None:
        """ Attempts to remove the token from the database
        Arguments:
            token: the token to remove
        """
        self._db.remove_token(token)

    def get_token_user_info(self, token: str) -> Optional[UserInfo]:
        """ Looks up token and user information
        Arguments:
            The token to lookup
        Return:
            The a tuple of UserInfo and the elapsed seconds when the user is found and None
            otherwise
        """
        res = self._db.get_user_by_token(token)

        if res and len(res) >= 10:
            user_info = UserInfo(res[0], res[4]) # name and admin
            user_info.email = res[1]
            user_info.settings = res[2]
            user_info.species = res[3]
            user_info.url = res[5]
            user_info.timestamp = res[6]
            user_info.client_ip = res[7]
            user_info.user_agent = res[8]

            return user_info, res[9]

        return None, None

    def get_user(self, username: str) -> Optional[UserInfo]:
        """ Looks up the specified user
        Arguments:
            username: the name of the user to lookup
        Returns:
            A dict containing the user's name, email, settings, and admin level.
        """
        res = self._db.get_user_by_name(username)

        if res and len(res) >= 4:
            user_info = UserInfo(res[0], res[4])  # Name and admin
            user_info.email = res[1]
            user_info.settings = res[2]
            user_info.species = res[3]
            return user_info

        return None

    def auto_add_user(self, username: str, species: str, email: str=None) -> Optional[UserInfo]:
        """ Add a user that doesn't exist. The user received default permissions as defined
            in the DB
        Arguments:
            username: the name of the user to add
            species: the species information for the user
            email: the user's email
        Returns:
            The user information
        Note:
            Assumes the user to be added has already been vetted. It is not an error if the user
            already exists in the database - however, the user's email won't be updated if the
            user already exists.
        """
        self._db.auto_add_user(username, species, email)
        return self.get_user(username)

    def get_password(self, token: str) -> str:
        """ Returns the password associated with the token
        Arguments:
            token: the token to lookup
        Return:
            Returns the associated password, or an empty string if the token is not found
        """
        res = self._db.get_password(token)

        if res and len(res) >= 1:
            return res[0]

        return ''

    def update_user_settings(self, username: str, settings: str, email: str) -> None:
        """ Updates the user's settings in the database
        Arguments
            username: the name of the user to update
            settings: the new settings to set
            email: the updated email address
        """
        self._db.update_user_settings(username, settings, email)

    def get_collections(self, timeout_sec:int) -> Optional[list]:
        """ Returns the collection information stored in the database
        Arguments:
            timeout_sec: the amount of time before the table entries can be
                         considered expired
        Returns:
            Returns None if there are no collections or a list of dict with the name and the
            json keys containing the names of the collections and their associated json
        """
        res = self._db.get_collections(timeout_sec)
        if not res or len(res) < 1:
            return None

        return [{'name':row[0], 'json':row[1]} for row in res]

    def save_collections(self, collections: tuple) -> bool:
        """ Saves the collections to the database
        Arguments:
            collections: a tuple of dicts containing the collection name and data json
        Return:
            Returns True if data is saved, and False if something went wrong
        """
        return self._db.save_collections(collections)

    def get_sandbox(self, s3_url: str) -> Optional[tuple]:
        """ Returns the sandbox items
        Arguments:
            s3_url: the url of the s3 instance to fetch for
        Returns:
            A tuple containing the known sandbox items
        """
        res = self._db.get_sandbox(s3_url)

        if not res or len(res) < 1:
            return tuple()

        return [{'complete': not row[0] or row[0] == '',
                 'bucket': row[1],
                 's3_path': row[2],
                 'location_id': row[3]
               } for row in res]

    def get_uploads(self, s3_url: str, bucket: str, timeout_sec: int) -> Optional[tuple]:
        """ Returns the uploads for this collection from the database
        Arguments:
            s3_url: the URL associated with this request
            bucket: The bucket to get uploads for
            timeout_sec: the amount of time before the table entries can be
                         considered expired
        Return:
            Returns the loaded tuple of upload names and data
        """
        res = self._db.get_uploads(s3_url, bucket, timeout_sec)

        if not res or len(res) < 1:
            return None

        return [{'name':row[0], 'json':row[1]} for row in res]

    def save_uploads(self, s3_url: str, bucket: str, uploads: tuple) -> bool:
        """ Save the upload information into the table
        Arguments:
            s3_url: the URL associated with this request
            bucket: the bucket name to save the uploads under
            uploads: the uploads to save containing the collection name,
                upload name, and associated JSON
        Return:
            Returns True if the data was saved and False if something went wrong
        """
        return self._db.save_uploads(s3_url, bucket, uploads)

    def save_query_path(self, token: str, file_path: str) -> bool:
        """ Stores the specified query file path in the database
        Arguments:
            token: a token associated with the path - can be used to manage paths
            file_path: the path to the saved query information
        Return:
            True is returned if the path is saved and False if a problem occurrs
        """
        return self._db.save_query_path(token, file_path)

    def get_clear_queries(self, token: str) -> tuple:
        """ Returns a tuple of saved query paths associated with this token and removes
            them from the database
        Arguments:
            token: a token associated with the paths to clean return
        Return:
            Returns a tuple of the saved query paths
        """
        return self._db.get_clear_queries(token)

    def get_query(self, token: str) -> tuple:
        """ Returns a tuple of saved query paths associated with this token
        Arguments:
            token: a token associated with the paths to clean return
        Return:
            A tuple of the path and elapsed seconds of any associated query
        """
        res = self._db.get_query(token)

        if not res or len(res) < 2:
            return []

        return res[0], res[1]

    def sandbox_get_upload(self, s3_url: str, username: str, path: str, \
                                                    new_upload_id: bool=False) -> Optional[tuple]:
        """ Checks if an upload for the user exists and returns the files that were loaded
        Arguments:
            s3_url: the URL to the s3 instance to look for
            username: the user associated with the upload
            path: the source path of the uploads
            new_upload_id: creates a new upload ID for an existing upload
        Returns:
            Returns a tuple containing the timestamp for the existing upload, and another tuple
            containing the files that have been uploaded, and a new upload ID if upload exists or
            None if new_upload_id is False or the upload doesn't exist
        """
        res = self._db.sandbox_get_upload(s3_url, username, path)

        if not res or len(res) < 3:
            return None, None, None, None

        sandbox_id = res[0]
        old_upload_id = res[1]
        elapsed_sec = res[2]

        # Update the upload ID if requested
        if new_upload_id is not False:
            upload_id = self._db.sandbox_new_upload_id(old_upload_id)
        else:
            upload_id = old_upload_id

        # Get all the uploaded files (used to filter down the remaining files that need uploading)
        res = self._db.sandbox_get_upload_files(sandbox_id)

        if not res or len(res) < 1:
            return elapsed_sec, [], upload_id, old_upload_id

        loaded_files = [row[0] for row in res]

        return elapsed_sec, loaded_files, upload_id, old_upload_id

    def sandbox_new_upload(self, s3_url: str, username: str, path: str, files: tuple, \
                                            s3_bucket: str, s3_path: str, location_id: str, \
                                            location_name: str, location_lat: float, \
                                            location_lon: float, location_ele: float) -> str:
        """ Adds new sandbox upload entries
        Arguments:
            s3_url: the URL to the s3 instance the upload is for
            username: the name of the person starting the upload
            path: the source path of the images
            files: the list of filenames (or partial paths) that's to be uploaded
            s3_bucket: the S3 bucket to load into
            s3_path: the base path of the S3 upload
            location_id: the ID of the location associated with the upload
            location_name: the name of the location
            location_lat: the latitude of the location
            location_lon: the longitude of the location
            location_ele: the elevation of the location
        Return:
            Returns the upload ID if entries are added to the database
        """
        # pylint: disable=too-many-arguments, too-many-positional-arguments
        return self._db.sandbox_new_upload(s3_url, username, path, files, s3_bucket, s3_path,
                                            location_id, location_name, location_lat, location_lon,
                                            location_ele)

    def sandbox_get_s3_info(self, username: str, upload_id: str) -> tuple:
        """ Returns the bucket and path associated with the sandbox
        Arguments:
            username: the name of the person starting the upload
            upload_id: the ID of the upload
        Return:
            Returns a tuple of the bucket and upload path of the S3 instance. If the user and path
            aren't found, None is returned for both items
        """
        res= self._db.sandbox_get_s3_info(username, upload_id)

        if not res or len(res) < 2:
            return None, None

        return res[0], res[1]

    def sandbox_upload_counts(self, username: str, upload_id: str) -> tuple:
        """ Returns the total and uploaded count of the files
        Arguments:
            username: the name of the person starting the upload
            upload_id: the ID of the upload
        Return:
            Returns a tuple with the number of files marked as uploaded and the total
            number of files
        """
        res = self._db.sandbox_upload_counts(username, upload_id)

        if not res or len(res) < 2:
            return 0, 0

        return res[0] if res[0] is not None else 0, res[1] if res[1] is not None else 0

    def sandbox_reset_upload(self, username: str, upload_id: str, files: tuple) -> str:
        """ Resets an upload for another attempt
        Arguments:
            username: the name of the person starting the upload
            upload_id: the ID of the upload
            files: the list of filenames (or partial paths) that's to be uploaded
        Return:
            Returns the upload ID if entries are added to the database
        """
        return self._db.sandbox_reset_upload(username, upload_id, files)

    def sandbox_upload_complete(self, username: str, upload_id: str) -> None:
        """ Marks the sandbox upload as completed by resetting the path
        Arguments:
            username: the name of the person starting the upload
            upload_id: the ID of the upload
        """
        self._db.sandbox_upload_complete(username, upload_id)

    def sandbox_abandon_upload(self, s3_url: str, username: str, upload_id: str) -> Optional[int]:
        """ Marks the upload as abandoned
        Arguments:
            s3_url: the URL to the s3 instance the upload is for
            username: the name of the person starting the upload
            upload_id: the ID of the upload
        Return:
            Returns the count of completed file uploads or None if the upload can't be found
        """
        res = self._db.sandbox_get_upload(s3_url, username, path)

        if not res or len(res) < 3:
            return None

        sandbox_id = res[0]

        res = self._db.sandbox_uploaded_files(username, sandbox_id)

        if not res or len(res) < 1:
            return None

        self._db.sandbox_abandon_upload(s3_url, username, upload_id)
        
        return int(res[0]) if res[0] is not None else None


    def sandbox_file_uploaded(self, username: str, upload_id: str, filename: str, \
                                                                    mimetype: str) -> Optional[str]:
        """ Marks the file as upload as uploaded
        Arguments:
            username: the name of the person starting the upload
            upload_id: the ID of the upload
            filename: the name of the uploaded file to mark as uploaded
            mimetype: the mimetype of the file uploaded
        Return:
            Returns the ID of the updated file
        """
        return self._db.sandbox_file_uploaded(username, upload_id, filename, mimetype)

    def sandbox_add_file_info(self, file_id: str, species: tuple, location: dict, \
                                                                        timestamp: str) -> None:
        """ Marks the file as upload as uploaded
        Arguments:
            file_id: the ID of the uploaded file add species and location to
            species: a tuple containing tuples of species common and scientific names, and counts
            location: a dict containing name, id, and elevation information
            timestamp: the timestamp associated with the entries
        """
        self._db.sandbox_add_file_info(file_id, species, location, timestamp)

    def sandbox_get_location(self, username: str, upload_id: str) -> Optional[dict]:
        """ Returns a dict of the upload location information
        Arguments:
            username: the name of the person starting the upload
            upload_id: the ID of the upload
        Return:
            Returns a dict containing the location information
        """
        res = self._db.sandbox_get_location(username, upload_id)
        if not res or len(res) < 3:
            return None

        return {'idProperty': res[0], 'nameProperty': res[1], 'latProperty':res[2], \
                                                'lngProperty': res[3], 'elevationProperty': res[4]}

    def get_file_mimetypes(self, username: str, upload_id: str) -> Optional[tuple]:
        """ Returns the file paths and mimetypes for an upload
        Arguments:
            username: the name of the person starting the upload
            upload_id: the ID of the upload
        Return:
            Returns a tuple containing tuples of the found file paths and mimetypes
        """
        res = self._db.get_file_mimetypes(username, upload_id)

        if not res or len(res) < 1:
            return ()

        return ((one_row[0], one_row[1]) for one_row in res)


    def get_file_species(self, username: str, upload_id: str) -> Optional[tuple]:
        """ Returns the file species information for an upload
        Arguments:
            username: the name of the person starting the upload
            upload_id: the ID of the upload
        Return:
            Returns a tuple containing a dict for each species entry of the upload. Each dict
            has the filename, timestamp, scientific name, count, common name, and location id
        """
        res = self._db.get_file_species(username, upload_id)

        if not res or len(res) < 1:
            return ()

        return ({'loc_id': one_row[0],
                 'filename': one_row[1],
                 'timestamp': one_row[2],
                 'common': one_row[3],
                 'scientific': one_row[4],
                 'count': one_row[5]
                 } for one_row in res)

    def add_collection_edit(self, s3_url: str, bucket: str, upload_path: str, username: str, \
                                timestamp: str, loc_id: str, loc_name: str, loc_ele: float) -> None:
        """ Stores the edit for a collection
        Arguments:
            s3_url: the URL of the S3 instance
            bucket: the S3 bucket the collection is in
            upload_path: the path to the uploads folder under the bucket
            username: the name of the user making the change
            timestamp: the timestamp of the change
            loc_id: the new location ID
            loc_name: the name of the new location
            loc_ele: the elevation of the new location
        """
        # pylint: disable=too-many-arguments, too-many-positional-arguments
        self._db.add_collection_edit(s3_url, bucket, upload_path, username, timestamp, loc_id,
                                     loc_name, loc_ele)

    def add_image_species_edit(self, s3_url: str, bucket: str, file_path: str, username: str, \
                                timestamp: str, common: str, species: str, count: str, \
                                request_id: str) -> None:
        """ Adds a species entry for a file to the database
        Arguments:
            s3_url: the URL to the S3 instance
            bucket: the S3 bucket the file is in
            file_path: the path to the file the change applies to
            username: the name of the user making the change
            timestamp: the timestamp of the change
            common: the common name of the species
            species: the scientific name of the species
            count: the number of individuals of the species
            request_id: distinct ID of the edit request
        """
        # pylint: disable=too-many-arguments, too-many-positional-arguments
        self._db.add_image_species_edit(s3_url, bucket, file_path, username,  timestamp, common,
                                        species, count, request_id)

    def save_user_species(self, username: str, species: str) -> None:
        """ Saves the species entry for the user
        Arguments:
            username: the name of the user to update
            species: the species information to save
        """
        self._db.save_user_species(username, species)

    def get_image_species_edits(self, s3_url: str, bucket: str, upload_path: str) -> dict:
        """ Returns all the saved edits for this bucket and upload path
        Arguments:
            s3_url: the URL to the S3 instance
            bucket: the S3 bucket the collection is in
            upload_path: the upload path to get the edit for
        Return:
            Returns a dict with the edits. The dict has a key of <bucket>:<upload_path> and
            contains a dict with keys consisting of the file's S3 paths. The value associated with
            the file's paths is a tuple of tuples that contain the scientific name and the count
        """
        res = self._db.get_image_species_edits(s3_url, bucket, upload_path)

        if not res or len(res) < 1:
            return {bucket + ':' + upload_path:tuple()}

        file_species = {}
        for one_result in res:
            if one_result[0] in file_species:
                file_species[one_result[0]].append(one_result[1:])
            else:
                file_species[one_result[0]] = [one_result[1:]]

        return {bucket + ':' + upload_path:file_species}

    def get_admin_edit_users(self) -> tuple:
        """ Returns the user information for administrative editing
        Return:
            Returns a tuple of name, email, administrator privileges, and if they were auto-added
            for each user
        """
        return self._db.get_admin_edit_users()

    def admin_count(self) -> int:
        """ Returns the count of administrators in the database
        Returns:
            The count of administrators in the database
        """
        return self._db.admin_count()

    def update_user(self, old_name: str, new_email: str, admin: bool=None) -> None:
        """ Updates the user in the database
        Arguments:
            old_name: the old user name
            new_email: the new email to set for the user
            admin: if set to True the user as admin privileges, if None this permission is unchanged
        """
        self._db.update_user(old_name, new_email, admin)

    def update_species(self, s3_url: str, username: str, old_scientific: str, new_scientific: str, \
                                        new_name: str, new_keybind: str, new_icon_url: str) -> bool:
        """ Adds the species in the database for later submission
        Arguments:
            s3_url: the URL to the S3 instance
            username: the name of the user making the change
            old_scientific: the old scientific name of the species
            new_scientific: the new scientific name of the species
            new_name: the new name of the species
            new_keybind: the new keybinding of the species
            new_icon_url: the new icon url
        Return:
            Returns True if no issues were found and False otherwise
        """
        # pylint: disable=too-many-arguments, too-many-positional-arguments
        return self._db.update_species(s3_url, username, old_scientific, new_scientific, new_name,
                                       new_keybind, new_icon_url)

    def update_location(self, s3_url: str, username: str, loc_name: str, loc_id: str, \
                        loc_active: bool, loc_ele: float, loc_old_lat: float, loc_old_lng: float, \
                        loc_new_lat: float, loc_new_lng: float) -> bool:

        """ Adds the location information to the database for later submission
        Arguments:
            s3_url: the URL to the S3 isntance
            username: the name of the user making the change
            loc_name: the name of the location
            loc_id: the ID of the location
            loc_active: is this an active location
            loc_ele: location elevation in meters
            loc_old_lat: the old latitude
            loc_old_lon: the old longitude
            loc_new_lat: the new latitude
            loc_new_lon: the new longitude
        Return:
            Returns True if no issues were found and False otherwise
        """
        # pylint: disable=too-many-arguments, too-many-positional-arguments
        return self._db.update_location(s3_url, username, loc_name, loc_id, loc_active, loc_ele,
                                        loc_old_lat, loc_old_lng, loc_new_lat, loc_new_lng)

    def get_admin_changes(self, s3_url: str, username: str) -> dict:
        """ Returns any saved administrative location and species changes
        Arguments:
            s3_url: the URL to the S3 instance
            username: the name of the user to fetch for
        Return:
            Returns a dict of 'locations' and 'species' changes as tuples off the keys. Also returns
            keys for the index of the columns in the returned data - 'loc_*' for locations, 
            and 'sp_*' for species
        """
        location_idxs = {'loc_name':0, 'loc_id':1, 'loc_active':2, 'loc_elevation':3, \
                         'loc_old_lat':4, 'loc_old_lng':5, 'loc_new_lat':6, 'loc_new_lng':7 }

        res = self._db.get_admin_locations(s3_url, username)
        if not res:
            locations = []
        else:
            locations = res

        species_idxs = {'sp_old_scientific':0, 'sp_new_scientific':1, 'sp_name':2, 'sp_keybind': 3,\
                        'sp_icon_url':4}

        res = self._db.get_admin_species(s3_url, username)
        if not res:
            species = []
        else:
            species = res

        return {'locations': locations, 'species': species} | location_idxs | species_idxs

    def have_admin_changes(self, s3_url: str, username: str) -> dict:
        """ Returns any saved administrative location and species changes
        Arguments:
            s3_url: the URL to the S3 instance
            username: the name of the user to fetch for
        Return:
            Returns a dict of 'locationsCount' and 'speciesCount'
        """
        res = self._db.admin_location_counts(s3_url, username)
        if not res or len(res) <= 0:
            locations_count = 0
        else:
            locations_count = res[0]

        res = self._db.admin_species_counts(s3_url, username)
        if not res or len(res) <= 0:
            species_count = 0
        else:
            species_count = res[0]

        return {'locationsCount': locations_count, 'speciesCount': species_count}

    def clear_admin_location_changes(self, s3_url: str, username: str) -> None:
        """ Cleans up the administration location changes for this use
        Arguments:
            s3_url: the URL to the S3 instance
            username: the name of the user to mark the locations for
        """
        self._db.clear_admin_location_changes(s3_url, username)

    def clear_admin_species_changes(self, s3_url: str, username: str) -> None:
        """ Cleans up the administration species changes for this use
        Arguments:
            s3_url: the URL to the S3 instance
            username: the name of the user to mark the species for
        """
        self._db.clear_admin_species_changes(s3_url, username)

    def get_next_upload_location(self, s3_url: str, username: str) -> Optional[dict]:
        """ Returns the next edit location for this user at the specified endpoint
        Arguments:
            s3_url: the URL to the S3 instance
            username: the name of the user to check for
        Return:
            Returns a tuple with the location edit's as a dict containing bucket, 
            base_path (on S3), loc_id, loc_name, loc_ele (with loc_ele containing the elevation).
            None is returned if there are no location changes to process
        """
        res = self._db.get_next_upload_location(s3_url, username)

        if not res or len(res) <= 0 or len(res[0]) < 5:
            return None

        return {'s3_url': s3_url, 'bucket':res[0], 'base_path':res[1], \
                 'loc_id':res[2], 'loc_name':res[3], 'loc_ele':res[4]}

    def complete_upload_location(self, s3_url: str, username: str, bucket: str, \
                                                                            base_path: str) -> None:
        """ Marks the location information as having completed updating
        Arguments:
            s3_url: the URL to the S3 instance
            username: the name of the user to check for
            bucket: the bucket associated with the location change
            base_path: the upload path where the location was change
        """
        self._db.complete_upload_location(s3_url, username, bucket, base_path)

    def get_next_files_info(self, s3_url: str, username: str, s3_path:str=None) -> Optional[tuple]:
        """ Returns the file editing information for a user, possibly for only one location
        Arguments:
            s3_url: the URL to the S3 instance
            username: the name of the user to check for
            s3_path: the S3 upload path to get changes for
        Return:
            Returns a tuple of file information dict containing each image's name, bucket, s3_path,
            and species. The species key contains a tuple of species common (name), 
            scientific (name), and the count. None is returned if there are no records
        Notes:
            See add_image_species_edit()
        """
        return self.common_get_next_files_info(s3_url, username, 0, s3_path=s3_path)

    def get_edited_files_info(self, s3_url: str, username: str, upload_id: str) -> Optional[tuple]:
        """ Returns the file editing information for a user, possibly for only one location
        Arguments:
            s3_url: the URL to the S3 instance
            username: the name of the user to check for
            upload_id: the ID of the upload to search for
        Return:
            Returns a tuple of file information dict containing each image's name, bucket, s3_path,
            and species. The species key contains a tuple of species common (name), 
            scientific (name), and the count. None is returned if there are no records
        """
        return self.common_get_next_files_info(s3_url, username, 1, upload_id=upload_id)

    def common_get_next_files_info(self, s3_url: str, username: str, updated_value: int, \
                                        s3_path:str=None, upload_id: str=None) -> Optional[tuple]:
        """ Returns the file editing information for a user, possibly for only one location
        Arguments:
            s3_url: the URL to the S3 instance
            username: the name of the user to check for
            updated_level: the numeric updated value to check for in the query
            s3_path: optional S3 upload path to get changes for
            upload_id: optional upload ID to look for
        Return:
            Returns a tuple of file information dict containing each image's name, bucket, s3_path,
            and species. The species key contains a tuple of species common (name), 
            scientific (name), and the count. None is returned if there are no records
        Notes:
            It's recommended that only one of the S3 path, or the upload ID, is specified, not both.
        """
        # pylint: disable=too-many-arguments, too-many-positional-arguments
        res = self._db.get_next_files_info(s3_url, username, updated_value, s3_path, upload_id)

        res_dict = {}
        for one_res in res:
            # Check if we need to update a species or add a new one
            if one_res[1] in res_dict:
                cur_species = [one_species for one_species in res_dict[one_res[1]]['species'] if \
                                                            one_species['scientific'] == one_res[3]]
                if cur_species and len(cur_species) >= 1:
                    cur_species[0]['count'] = one_res[4]
                else:
                    res_dict[one_res[1]]['species'].append({'common':one_res[2],
                                                           'scientific':one_res[3],
                                                           'count':one_res[4],
                                                         })
                res_dict[one_res[1]]['request_id'] = one_res[5]
            else:
                res_dict[one_res[1]] = {'s3_url': s3_url,
                                        'filename': os.path.basename(one_res[1]),
                                        'bucket': one_res[0],
                                        's3_path': one_res[1],
                                        'species':[{'common':one_res[2],
                                                    'scientific':one_res[3],
                                                    'count':one_res[4],
                                                  }],
                                        'request_id': one_res[5],
                                       }

        return [one_item for _, one_item in res_dict.items()]

    def complete_collection_edits(self, username: str, collection_info: dict) -> None:
        """ Marks the collection edit as completed
        Arguments:
            collection_info: the dict containing the collection information
        Notes:
            See get_next_upload_location()
        """
        self._db.complete_collection_edits(username, collection_info)

    def complete_image_edits(self, username: str, files: tuple) -> None:
        """ Marks the passed in files as having completed their edits
        Arguments:
            username: the username associated with these changes
            files: a tuple of file dict containing the s3_url, bucket, and path to the file
        Notes:
            See get_next_files_info()
        """
        self.common_complete_image_edits(username, files, 0, 1)


    def finish_image_edits(self, username: str, files: tuple) -> None:
        """ Marks the passed in files as having completely finished their editing updates
        Arguments:
            username: the username associated with these changes
            files: a tuple of file dict containing the s3_url, bucket, and path to the file
        Notes:
            See get_next_files_info()
        """
        self.common_complete_image_edits(username, files, 1, 2)


    def common_complete_image_edits(self, username: str, files: tuple, old_updated: int, \
                                                                        new_updated: int) -> None:
        """ Common function to mark the files as having completed their edits
        Arguments:
            username: the username associated with these changes
            files: a tuple of file dict containing the s3_url, bucket, and path to the file
            old_updated: the old updated column value to look for
            new_updated: the new updated column value for entries that were found
        """
        self._db.complete_image_edits(username, files, old_updated, new_updated)
