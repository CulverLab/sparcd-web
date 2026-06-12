"""This script contains the SQLite database interface for the SPARCd Web app sandbox tabled
"""

from contextlib import contextmanager
import datetime
import hashlib
import logging
import sqlite3
from typing import Generator, Optional
import uuid

class SPDSQLiteSandbox:
    """Class handling access connections to the database for sandbox tables
    """

    def __init__(self, db_path: str, logger: logging.Logger=None, verbose: bool=False):
        """Initialize an instance
        Arguments:
            db_path: the path to the database file
            logger: a logging instance
            verbose: set to True to have more verbose logging
        """
        self._conn = None
        self._path = db_path
        self._verbose = verbose
        self._logger = logger
        self._savepoint_counter = 0

    def __del__(self):
        """Handles closing the connection and other cleanup
        """
        self.close()

    @contextmanager
    def transaction(self) -> Generator:
        """Context manager for atomic database transactions
        Yields:
            The active database connection
        Raises:
            RuntimeError: If called before connecting to the database
        Usage:
            with self.transaction():
                cursor.execute(...)
                cursor.execute(...)
        """
        if self._conn is None:
            raise RuntimeError('Attempting to start a transaction before connecting')

        # Use a savepoint if a transaction is already active
        in_transaction = self._conn.in_transaction
        savepoint = None

        try:
            if in_transaction:
                self._savepoint_counter += 1
                savepoint = f'sp_{self._savepoint_counter}'
                self._conn.execute(f'SAVEPOINT {savepoint}')
            yield self._conn
            if in_transaction:
                self._conn.execute(f'RELEASE SAVEPOINT {savepoint}')
            else:
                self._conn.commit()
        except Exception:  # pylint: disable=broad-exception-caught
            if in_transaction:
                self._conn.execute(f'ROLLBACK TO SAVEPOINT {savepoint}')
                self._conn.execute(f'RELEASE SAVEPOINT {savepoint}')
            else:
                self._conn.rollback()
            raise

    def hash2str(self, text: str) -> str:
        """ Returns the hash of the passed in string
        Arguments:
            text: the string to hash
        Return:
            The hash value as a string
        """
        return hashlib.md5(text.encode('utf-8')).hexdigest()

    def database_info(self) -> tuple:
        """ Returns information on the database as a tuple of strings
        """
        return (
             'SQLite database',
             f'Version: {sqlite3.sqlite_version}',
             f'thread safety: {sqlite3.threadsafety}',
             f'api level: {sqlite3.apilevel}',
            )

    def connect(self, database_path: str = None) -> None:
        """Performs the actual connection to the database
        Arguments:
            database: the database to connect to
        """
        database_path = database_path if database_path is not None else self._path
        if self._conn is None:
            if self._verbose:
                print_params = \
                    (param for param in (
                        f'database={database_path}' if database_path is not None else None,
                   ) if param is not None)
                self._logger.info(f'Connecting to the database {print_params}')
            # We disable thread checking since we're using thread-safe Sqlite
            self._conn = sqlite3.connect(database_path, check_same_thread=False)
            self._conn.execute('PRAGMA journal_mode=WAL')
            self._conn.execute('PRAGMA synchronous=NORMAL')
            self._conn.execute('PRAGMA busy_timeout=10000')

    def reconnect(self) -> None:
        """Attempts a reconnection if we're not connected
        """
        if self._conn is None:
            self.connect()

    def close(self) -> None:
        """ Closes the connection to the database
        """
        if self._conn:
            self._conn.close()
            self._conn = None

    def get_sandbox(self, s3_id: str) -> Optional[tuple]:
        """ Returns the sandbox items
        Arguments:
            s3_id: the id of the s3 instance to fetch for
        Returns:
            A tuple containing the field indexes of the return data, the row tuples of the s3_path,
            bucket, the base upload path, and location ID
        """
        if self._conn is None:
            raise RuntimeError('Attempting to get sandbox information from the database before ' \
                                                                                    'connecting')

        # Indexes of return values
        indexes = { 'user': 0,
                    'path': 1,
                    'bucket': 2,
                    's3_path': 3,
                    'location_id': 4,
                    'recovered': 5
                    }

        # Get the Sandbox information
        cursor = self._conn.cursor()
        cursor.execute('SELECT name, path, bucket, s3_base_path, location_id, recovered '\
                                                                    'FROM sandbox WHERE s3_id=?',
                        (s3_id,))
        res = cursor.fetchall()

        cursor.close()

        return indexes, res

    def sandbox_exists(self, s3_id: str, bucket: str, username: str, s3_path: str) -> bool:
        """ Checks if the sandbox entry exists
        Arguments:
            s3_id: the ID of the s3 instance
            bucket: the bucket to match
            username: the user that uploaded images
            s3_path: the path to the upload folder
        Return:
            Returns True if an active upload matches the parameter. Fals if the upload is
            not found
        """
        if self._conn is None:
            raise RuntimeError('Attempting to check if sandbox entry in the database before ' \
                                                                                    'connecting')

        # Find the upload
        cursor = self._conn.cursor()
        cursor.execute('SELECT count(1) FROM sandbox WHERE s3_id=? AND bucket=? AND name=? AND ' \
                                                            's3_base_path=? AND path IS NOT NULL',
                        (s3_id, bucket, username, s3_path))

        res = cursor.fetchone()
        cursor.close()

        if not res or len(res) <= 0:
            return False

        return int(res[0]) > 0

    def sandbox_add_recovered(self, s3_id: str, bucket: str, username: str, s3_path: str, \
                                                                timestamp: datetime) -> bool:
        """ Adds a recovered sandbox entry to the database
        Arguments:
            s3_id: the ID of the s3 instance
            bucket: the bucket to match
            username: the user that uploaded images
            s3_path: the path to the upload folder
            timestamp: the timestamp of the upload
        Return:
            Returns True if an active upload matches the parameter. Fals if the upload is
            not found
        """
        if self._conn is None:
            raise RuntimeError('Attempting to add a recovered sandbox entry to the database ' \
                                                                                'before connecting')

        # Add the upload
        with self.transaction():
            cursor = self._conn.cursor()
            cursor.execute('INSERT INTO sandbox(s3_id, path, bucket, name, s3_base_path, ' \
                                    'timestamp, upload_id, recovered) ' \
                            'VALUES(?, "", ?, ?, ?, time(?), ?, 1)',
                        (s3_id, bucket, username, s3_path, timestamp.isoformat(), uuid.uuid4().hex))

            cursor.close()

    def sandbox_set_recovered(self, s3_id: str, bucket: str, username: str, s3_path: str, \
                                                                timestamp: datetime) -> bool:
        """ Sets a sandbox entry as recovered in the database
        Arguments:
            s3_id: the ID of the s3 instance
            bucket: the bucket to match
            username: the user that uploaded images
            s3_path: the path to the upload folder
            timestamp: the timestamp of the upload
        Return:
            Returns True if an active upload matches the parameter. Fals if the upload is
            not found
        """
        if self._conn is None:
            raise RuntimeError('Attempting to add a recovered sandbox entry to the database ' \
                                                                                'before connecting')

        # Add the upload
        with self.transaction():
            cursor = self._conn.cursor()
            cursor.execute('UPDATE sandbox SET recovered=1,timestamp=?,upload_id=? WHERE ' \
                                            's3_id=? AND bucket=? AND name=? AND s3_base_path=?',
                        (timestamp.isoformat(), uuid.uuid4().hex, s3_id, bucket, username, s3_path))

            cursor.close()

    def sandbox_get_upload(self, s3_id: str, username: str, path: str) -> Optional[tuple]:
        """ Gets the upload associated with the url , user, and upload path
        Arguments:
            s3_id: the ID to the s3 instance to look for
            username: the user associated with the upload
            path: the source path of the uploads
        Returns:
            Returns a tuple containing the sandbox unique ID, the upload ID, and the elapsed seconds
            for the upload
        """
        if self._conn is None:
            raise RuntimeError('Attempting to get sandbox uploads from the database before ' \
                                                                                    'connecting')

        # Find the upload
        cursor = self._conn.cursor()
        cursor.execute('SELECT id, upload_id, (strftime("%s", "now")-timestamp) AS elapsed_sec ' \
                        'FROM sandbox WHERE s3_id=? AND name=? AND path=? LIMIT 1',
                                                                        (s3_id, username, path))

        res = cursor.fetchone()
        cursor.close()

        return res

    def sandbox_get_upload_files(self, sandbox_id: str) -> Optional[tuple]:
        """ Returns the files that are associated with the sandbox_id
        Arguments:
            sandbox_id: the ID of the sandbox to get the files for
        Returns:
            Returns a tuple of rows containing a tuple of the file information
        """
        if self._conn is None:
            raise RuntimeError('Attempting to get sandbox uploads from the database before ' \
                                                                                    'connecting')

        # Get all the uploaded files
        cursor = self._conn.cursor()
        cursor.execute('SELECT source_path FROM sandbox_files WHERE sandbox_id=? AND ' \
                                                            'completion_status=2', (sandbox_id,))
        res = cursor.fetchall()

        cursor.close()

        return res

    def sandbox_new_upload_id(self, upload_id: str) -> Optional[str]:
        """ Returns a newly assigned upload ID
        Arguments:
            upload_id: the old upload ID to swap for a new one
        Return:
            Returns the new upload ID
        """
        if self._conn is None:
            raise RuntimeError('Attempting to get new sandbox upload ID before connecting')

        # Update the upload ID if requested
        new_upload_id = uuid.uuid4().hex
        with self.transaction():
            cursor = self._conn.cursor()
            cursor.execute('UPDATE sandbox SET upload_id=? WHERE upload_id=?',
                                                        (new_upload_id, upload_id))
            cursor.close()

        return new_upload_id

    def sandbox_new_upload(self, s3_id: str, username: str, path: str, files: tuple, \
                                            s3_bucket: str, s3_path: str, location_id: str, \
                                            location_name: str, location_lat: float, \
                                            location_lon: float, location_ele: float) -> str:
        """ Adds new sandbox upload entries
        Arguments:
            s3_id: the ID to the s3 instance the upload is for
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
        # pylint: disable=too-many-arguments,too-many-positional-arguments
        if self._conn is None:
            raise RuntimeError('Attempting to add a new sandbox upload to the database before ' \
                                                                                    'connecting')

        # Create the upload
        upload_id = uuid.uuid4().hex
        with self.transaction():
            cursor = self._conn.cursor()
            cursor.execute('INSERT INTO sandbox(s3_id, name, path, bucket, s3_base_path, ' \
                                                'location_id, location_name, location_lat, ' \
                                                'location_lon, location_ele, '\
                                                'timestamp, upload_id) ' \
                                        'VALUES(?,?,?,?,?,?,?,?,?,?,strftime("%s", "now"),?)', 
                                (s3_id, username, path, s3_bucket, s3_path, location_id, \
                                    location_name, location_lat, location_lon, location_ele,\
                                    upload_id)
                          )

            sandbox_id = cursor.lastrowid

            for one_file in files:
                cursor.execute('INSERT INTO sandbox_files(sandbox_id, filename, source_path, ' \
                                                                                    'timestamp) ' \
                                        'VALUES(?,?,?,strftime("%s", "now"))',
                                (sandbox_id, one_file, one_file))

            cursor.close()

        return upload_id

    def sandbox_upload_recovery_update(self, s3_id: str, username: str, bucket: str, \
                                    upload_key: str, source_path: str, \
                                    location_id: str, location_name: str, location_lat: float, \
                                    location_lon: float, location_ele: float) -> Optional[tuple]:
        """ Updates the database with an upload recovery information
        Arguments:
            s3_id: the ID of the S3 instance
            username: the name of the user associated with this upload recovery
            bucket: the bucket of the upload
            upload_key: the key of the upload
            source_path: the path that the images are being uploaded from
            location_id: the ID of the location associated with the upload
            location_name: the name of the location
            location_lat: the latitude of the location
            location_lon: the longitude of the location
            location_ele: the elevation of the location
        Return:
            When successful, returns a tuple containing the the upload ID and a list of file names
            that failed upload. None is returned upon failure
        """
        # pylint: disable=too-many-arguments,too-many-positional-arguments
        if self._conn is None:
            raise RuntimeError('Attempting to add a new sandbox upload to the database before ' \
                                                                                    'connecting')

        # Make sure we have a recovery upload by getting the sandbox ID
        cursor = self._conn.cursor()
        cursor.execute('SELECT id FROM SANDBOX WHERE name=? AND s3_id=? AND ' \
                                            'bucket=? AND s3_base_path like ? AND ' \
                                            '( recovered=1 OR (path != "" AND path is not NULL))',
                        (username, s3_id, bucket, '%'+upload_key+'%'))
        res = cursor.fetchone()
        cursor.close()

        if not res or len(res) <= 0:
            return None

        sandbox_id = res[0]

        # Update the upload
        upload_id = uuid.uuid4().hex
        with self.transaction():
            cursor = self._conn.cursor()
            cursor.execute('UPDATE sandbox SET path=?, location_id=?, location_name=?, '\
                            'location_lat=?, location_lon=?, location_ele=?, recovered=0, ' \
                            'upload_id=? ' \
                        'WHERE s3_id=? AND name=? AND bucket=? AND s3_base_path like ?', 
                    (source_path, location_id, location_name, location_lat, location_lon, \
                        location_ele, upload_id, s3_id,username, bucket, "%"+upload_key+"%"))

            # Get all the files with the changes
            cursor.execute('SELECT filename FROM sandbox_files WHERE sandbox_id=? AND ' \
                                                                            'completion_status=0',
                                        (sandbox_id,))

            res = cursor.fetchall()
            cursor.close()

        if not res or len(res) <= 0:
            return None

        return upload_id, [oneFile[0] for oneFile in res]

    def sandbox_get_s3_info(self, username: str, upload_id: str) -> tuple:
        """ Returns the bucket and path associated with the sandbox
        Arguments:
            username: the name of the person starting the upload
            upload_id: the ID of the upload
        Return:
            Returns a tuple containing bucket and upload path of the S3 instance
        """
        if self._conn is None:
            raise RuntimeError('Attempting to get sandbox S3 information from the database before '\
                                                                                    'connecting')

        # Get the S3 information from the sandbox
        cursor = self._conn.cursor()
        cursor.execute('SELECT bucket, s3_base_path FROM sandbox WHERE name=? AND upload_id=?',
                                                                    (username, upload_id))

        res = cursor.fetchone()
        cursor.close()

        return res

    def sandbox_upload_counts(self, username: str, upload_id: str) -> tuple:
        """ Returns the total and uploaded count of the files
        Arguments:
            username: the name of the person starting the upload
            upload_id: the ID of the upload
        Return:
            Returns a tuple with the number of files marked as uploaded and the total
            number of files
        """
        if self._conn is None:
            raise RuntimeError('Attempting to count sandbox uploaded files in the database '\
                                                                                'before connecting')

        # Return the sandbox upload count
        cursor = self._conn.cursor()
        cursor.execute('WITH '\
                'upid AS ' \
                    '(SELECT id FROM sandbox ' \
                                    'WHERE name=? AND upload_id=? AND path <> ""),' \
                'uptot AS ' \
                    '(SELECT sandbox_id,count(1) AS tot FROM sandbox_files,upid WHERE ' \
                                                                    'sandbox_id=upid.id),' \
                ' uphave AS ' \
                    '(SELECT sandbox_id,count(1) AS have FROM sandbox_files,upid WHERE ' \
                                    'sandbox_id = upid.id AND sandbox_files.completion_status=2)' \
                'SELECT uptot.tot,uphave.have FROM uptot LEFT JOIN uphave ON '\
                                                    'uptot.sandbox_id=uphave.sandbox_id LIMIT 1',
                                                                            (username, upload_id))

        res = cursor.fetchone()
        cursor.close()

        return res


    def sandbox_files_not_uploaded(self, username: str, upload_id: str) -> Optional[tuple]:
        """ Gets the list of file names of any files not yet marked as uploaded
        Arguments:
            username: the name of the person starting the upload
            upload_id: the ID of the upload
        Return:
            Returns the list of files that are waiting to be uploaded
        """
        if self._conn is None:
            raise RuntimeError('Attempting to get files not uploaded to the database '\
                                                                                'before connecting')

        # Return the list of IDs for files not loaded
        cursor = self._conn.cursor()
        cursor.execute('WITH upid AS ' \
                    '(SELECT id FROM sandbox ' \
                                    'WHERE name=? AND upload_id=? AND path <> "")' \
                'SELECT filename FROM sandbox_files, upid WHERE ' \
                                                'sandbox_id = upid.id AND completion_status = 0',
                                                                            (username, upload_id))

        res = cursor.fetchall()
        cursor.close()

        if not res or len(res) <= 0:
            return None

        return res

    def sandbox_reset_upload(self, username: str, upload_id: str, files: tuple) -> Optional[str]:
        """ Resets an upload for another attempt
        Arguments:
            username: the name of the person starting the upload
            upload_id: the ID of the upload
            files: the list of filenames (or partial paths) that's to be uploaded
        Return:
            Returns the upload ID if entries are added to the database, and None otherwise
        """
        if self._conn is None:
            raise RuntimeError('Attempting to add a new sandbox upload to the database before ' \
                                                                                    'connecting')

        # Get the sandbox ID
        cursor = self._conn.cursor()
        cursor.execute('SELECT id FROM sandbox WHERE name=? AND upload_id=?',
                                                                            (username, upload_id))
        res = cursor.fetchone()
        cursor.close()

        if not res or len(res) < 1:
            return None

        sandbox_id = res[0]
        if sandbox_id is None:
            return None

        # Clear the old files and add the new ones
        with self.transaction():
            cursor = self._conn.cursor()
            cursor.execute('DELETE FROM sandbox_files WHERE sandbox_id=?', (sandbox_id, ))

            for one_file in files:
                cursor.execute('INSERT INTO sandbox_files(sandbox_id, filename, source_path, ' \
                                                                                'timestamp) ' \
                                'VALUES(?,?,?,strftime("%s", "now"))',
                        (sandbox_id, one_file, one_file))

            cursor.close()

        return upload_id

    def sandbox_upload_complete(self, username: str, upload_id: str) -> None:
        """ Marks the sandbox upload as completed by resetting the path
        Arguments:
            username: the name of the person starting the upload
            upload_id: the ID of the upload
        """
        if self._conn is None:
            raise RuntimeError('Attempting to complete sandbox upload in the database '\
                                                                                'before connecting')

        # Update the sandbox
        with self.transaction():
            cursor = self._conn.cursor()
            cursor.execute('UPDATE sandbox SET path="", recovered=0  WHERE name=? AND upload_id=?',
                                                                            (username, upload_id))

            cursor.close()

    def sandbox_upload_complete_by_info(self, s3_id: str, username: str, bucket: str, \
                                                                        upload_name: str) -> None:
        """ Marks the sandbox upload as completed
        Arguments:
            s3_id: the ID of the S3 instance
            username: the name of the person associated with the upload
            bucket: the bucket of the upload
            upload_name: the name of the upload
        """
        if self._conn is None:
            raise RuntimeError('Attempting to complete repair sandbox upload in the database '\
                                                                                'before connecting')

        # Mark the sandbox as complete
        with self.transaction():
            cursor = self._conn.cursor()
            query = 'UPDATE sandbox SET path="", recovered=0 WHERE name=? AND s3_id=? AND ' \
                                                                'bucket=? AND s3_base_path like ?'
            params = (username, s3_id, bucket, '%'+upload_name+'%')
            cursor.execute(query, params)

            cursor.close()

    def sandbox_file_uploaded(self, username: str, upload_id: str, filename: str, \
                                                    mimetype: str, timestamp: str) -> Optional[str]:
        """ Marks the file as upload as uploaded
        Arguments:
            username: the name of the person starting the upload
            upload_id: the ID of the upload
            filename: the name of the uploaded file to mark as uploaded
            mimetype: the mimetype of the file uploaded
            timestamp: the timestamp associted with this file
        Return:
            Returns the ID of the updated file
        """
        if self._conn is None:
            raise RuntimeError('Attempting to mark file as uploaded in the database ' \
                                                                                'before connecting')

        # Get the file's ID
        sandbox_file_id = None
        with self.transaction():
            cursor = self._conn.cursor()
            cursor.execute('SELECT id FROM sandbox_files WHERE '\
                                'sandbox_files.filename=(?) AND sandbox_id in ' \
                           '(SELECT id FROM sandbox WHERE name=? AND upload_id=?) LIMIT 1',
                                                            (filename, username, upload_id))

            res = cursor.fetchall()

            if res and len(res) >= 1 and len(res[0]) >= 1 and res[0][0] is not None:
                sandbox_file_id = res[0][0]

                cursor.execute('UPDATE sandbox_files SET completion_status=1, mimetype=?, '\
                                'created_timestamp=? WHERE sandbox_files.filename=? AND id=?',
                                                (mimetype, timestamp, filename, sandbox_file_id))

            cursor.close()

        return sandbox_file_id

    def sandbox_file_rename(self, username: str, upload_id: str, original_name: str, \
                            new_name: str) -> Optional[str]:
        """ Renames an upload filename to a new name
        Arguments:
            username: the name of the person starting the upload
            upload_id: the ID of the upload
            original_name: the original name of the upload file
            new_name: the replacement name
        Return:
            The ID of the updated file
        """
        if self._conn is None:
            raise RuntimeError('Attempting to rename a file upload in the database ' \
                                                                                'before connecting')

        # Get the file's ID
        sandbox_file_id = None
        with self.transaction():
            cursor = self._conn.cursor()
            cursor.execute('SELECT id, source_path FROM sandbox_files WHERE '\
                                'sandbox_files.filename=(?) AND sandbox_id in ' \
                           '(SELECT id FROM sandbox WHERE name=? AND upload_id=?) LIMIT 1',
                                                        (original_name, username, upload_id))

            res = cursor.fetchall()

            if res and len(res) >= 1 and len(res[0]) >= 2 and res[0][0] is not None:
                sandbox_file_id = res[0][0]
                sandbox_source_path = res[0][1]

                # Update the source path
                idx = sandbox_source_path.index(original_name)
                sandbox_source_path = sandbox_source_path[:idx] + new_name

                cursor.execute('UPDATE sandbox_files SET filename=?, source_path=?, ' \
                                                    'original_filename=? WHERE filename=? AND id=?',
                                    (new_name, sandbox_source_path, original_name,
                                     original_name, sandbox_file_id)
                      )

            cursor.close()

        return sandbox_file_id


    def sandbox_add_file_info(self, file_id: str, species: tuple, location: dict, \
                                                                        timestamp: str) -> None:
        """ Marks the file as upload as uploaded
        Arguments:
            file_id: the ID of the uploaded file add species and location to
            species: a tuple containing tuples of species common and scientific names, and counts
            location: a dict containing name, id, and elevation information
            timestamp: the timestamp associated with the entries
        """
        if self._conn is None:
            raise RuntimeError('Attempting to add species and location to an upload file in the ' \
                                                                    'database before connecting')

        if not species and not location:
            print('INFO: No species or location specified for updating uploaded file ',
                        f'{file_id}', flush=True)
            self.sandbox_file_processing_complete(file_id)
            return

        with self.transaction():
            cursor = self._conn.cursor()
            if species:
                cursor.executemany('INSERT INTO ' \
                                        'sandbox_species(sandbox_file_id, obs_date, obs_common,' \
                                                                    'obs_scientific, obs_count) ' \
                                        'VALUES (?,?,?,?,?)',
                        ((file_id,timestamp,one_species['common'],one_species['scientific'], \
                                        int(one_species['count'])) \
                                for one_species in species) )

            if location:
                cursor.execute('INSERT INTO sandbox_locations(sandbox_file_id, loc_name, loc_id, ' \
                                                                                'loc_elevation) ' \
                                        'VALUES (?,?,?,?)', 
                            (file_id, location['name'], location['id'], \
                                                                    float(location['elevation'])) )

            cursor.execute('UPDATE sandbox_files SET completion_status=2 WHERE id=?', (file_id,))
            cursor.close()

    def sandbox_get_location(self, username: str, upload_id: str) -> Optional[tuple]:
        """ Returns a tuple of the upload location information
        Arguments:
            username: the name of the person starting the upload
            upload_id: the ID of the upload
        Return:
            Returns a tuple containing the location ID, name, latitude, longitude, and elevation
        """
        if self._conn is None:
            raise RuntimeError('Attempting to get sandbox location information from the database '\
                                                                                'before connecting')

        # Get the location
        cursor = self._conn.cursor()
        cursor.execute('SELECT location_id, location_name, location_lat, location_lon, ' \
                                        'location_ele FROM sandbox WHERE name=? AND upload_id=?',
                            (username, upload_id))

        res = cursor.fetchone()
        cursor.close()

        return res

    def get_files_renamed(self, username: str, upload_id: str) -> Optional[tuple]:
        """ Returns the original and new names of renamed files
        Arguments:
            username: the name of the person starting the upload
            upload_id: the ID of the upload
        Return:
            Returns a tuple containing tuples of the original name and new name
        """
        if self._conn is None:
            raise RuntimeError('Attempting to get renamed files from the database '\
                                                                                'before connecting')

        # Get the file mime type
        cursor = self._conn.cursor()
        cursor.execute('SELECT original_filename, filename FROM sandbox_files ' \
                        'WHERE original_filename NOT NULL AND sandbox_id IN '\
                            '(SELECT id FROM sandbox WHERE name=? AND upload_id=?)',
                                                                            (username, upload_id))

        res = cursor.fetchall()
        cursor.close()

        return res

    def get_file_mimetypes(self, username: str, upload_id: str) -> Optional[tuple]:
        """ Returns the file paths and mimetypes for an upload
        Arguments:
            username: the name of the person starting the upload
            upload_id: the ID of the upload
        Return:
            Returns a tuple containing tuples of the found file paths and mimetypes
        """
        if self._conn is None:
            raise RuntimeError('Attempting to get upload mimetypes from the database '\
                                                                                'before connecting')

        # Get the file mime type
        cursor = self._conn.cursor()
        cursor.execute('SELECT source_path, mimetype FROM sandbox_files WHERE sandbox_id IN '\
                        '(SELECT id FROM sandbox WHERE name=? AND upload_id=?)',
                                                                            (username, upload_id))

        res = cursor.fetchall()
        cursor.close()

        return res

    def sandbox_file_processing_complete(self, file_id: str) -> None:
        """ Marks the file as fully processed by setting completion_status to 2
        Arguments:
            file_id: the ID of the sandbox file to mark as complete
        """
        if self._conn is None:
            raise RuntimeError('Attempting to mark file processing complete in the database '
                               'before connecting')

        with self.transaction():
            cursor = self._conn.cursor()
            cursor.execute('UPDATE sandbox_files SET completion_status=2 WHERE id=?', (file_id,))
            cursor.close()

    def get_file_created_timestamp(self, username: str, upload_id: str) -> Optional[tuple]:
        """ Returns the file paths and created timestamp for an upload
        Arguments:
            username: the name of the person starting the upload
            upload_id: the ID of the upload
        Return:
            Returns a tuple containing tuples of the found file paths and created timestamp
        """
        if self._conn is None:
            raise RuntimeError('Attempting to get upload mimetypes from the database '\
                                                                                'before connecting')

        # Get the file mime type
        cursor = self._conn.cursor()
        cursor.execute('SELECT source_path, created_timestamp FROM sandbox_files WHERE sandbox_id '\
                        'IN (SELECT id FROM sandbox WHERE name=? AND upload_id=?)',
                                                                            (username, upload_id))

        res = cursor.fetchall()
        cursor.close()

        return res


    def get_file_species(self, username: str, upload_id: str) -> Optional[tuple]:
        """ Returns the file species information for an upload
        Arguments:
            username: the name of the person starting the upload
            upload_id: the ID of the upload
        Return:
            Returns a tuple containing a tuple for each species entry of the upload. Each row
            tuple has the filename, timestamp, scientific name, count, common name, and location id
        """
        if self._conn is None:
            raise RuntimeError('Attempting to get upload mimetypes from the database '\
                                                                                'before connecting')

        # Return the files species
        cursor = self._conn.cursor()
        query = \
            'WITH loc AS (SELECT id, location_id as loc_id ' \
                                                'FROM sandbox WHERE name=? AND upload_id=?),' \
                    'files AS (SELECT loc.loc_id AS loc_id,sf.id AS id, sf.filename ' \
                                        'FROM sandbox_files sf,loc WHERE sf.sandbox_id=loc.id) ' \
                'SELECT files.loc_id, files.filename, ssp.obs_date, ssp.obs_common, ' \
                                                            'ssp.obs_scientific, ssp.obs_count ' \
                            'FROM sandbox_species ssp, files WHERE ssp.sandbox_file_id=files.id'

        cursor.execute(query, (username, upload_id))

        res = cursor.fetchall()
        cursor.close()

        return res
