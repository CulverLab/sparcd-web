"""This script contains the SQLite collections database interface for the SPARCd Web app
"""

import logging
import sqlite3
from time import sleep
from typing import Optional
import uuid

class SPDSQLite_coll:
    """Class handling access connections to the database
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

    def __del__(self):
        """Handles closing the connection and other cleanup
        """
        if self._conn is not None:
            self._conn = None

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
            self._conn = sqlite3.connect(database_path)

    def reconnect(self) -> None:
        """Attempts a reconnection if we're not connected
        """
        if self._conn is None:
            self.connect()

    def is_connected(self) -> bool:
        """ Returns whether this class instance is connected (true), or not (false)
        """
        return self._conn is not None

    def have_expired_collections(self, s3_id: str, timeout_sec: int) -> Optional[int]:
        """ Returns the number of collection entries that have timed out
        Arguments:
            s3_id: the S3 identifier for the relevant collections
            timeout_sec: the number of seconds before the collection entries can be
                         considered expired
        Returns:
            Returns the number of expired collections. None is returned if a problem occurs
        """
        if self._conn is None:
            raise RuntimeError('Attempting to access database before connecting for counting ' \
                                                                            'expired collections')

        cursor = self._conn.cursor()
        cursor.execute('SELECT count(1) from collections WHERE ' \
                            's3_id = ? AND (strftime("%s", "now")-timestamp) >= ?',
                        (s3_id, timeout_sec))

        res = cursor.fetchone()
        if not res or len(res) < 1:
            return None

        cursor.close()

        return int(res)

    def get_expired_collections(self, s3_id: str, timeout_sec: int) -> Optional[tuple]:
        """ Returns the collection information for expired collection entries
        Arguments:
            s3_id: the S3 identifier for the relevant collections
            timeout_sec: the amount of time before the collection entries can be
                         considered expired
        Returns:
            Returns a tuple of the retrieved collections where each row tuple contains
            the bucket and collection name. None is returned if a problem occurs
        """
        if self._conn is None:
            raise RuntimeError('Attempting to access database before connecting for getting ' \
                                                                    'expired collection details')

        cursor = self._conn.cursor()
        cursor.execute('SELECT bucket, name from collections WHERE ' \
                            's3_id = ? AND (strftime("%s", "now")-timestamp) >= ?',
                        (s3_id, timeout_sec))

        res = cursor.fetchall()
        if not res or len(res) < 1:
            return None

        cursor.close()

        return res

    def get_collection(self, s3_id: str, bucket: str) -> tuple:
        """ Returns the collection information stored in the database
        Arguments:
            s3_id: the S3 identifier for the relevant collections
        Returns:
            Returns a tuple of the retrieved collections where each row tuple contains
            the collection name, its json, and the number of seconds the entry has been in
            the database
        """
        if self._conn is None:
            raise RuntimeError('Attempting to access database before connecting for fetching ' \
                                                                            'collection details')

        cursor = self._conn.cursor()

        cursor.execute('SELECT name, json, ' \
                                '(strftime("%s", "now")-timestamp) as elapsed_sec ' \
                                'FROM collections WHERE s3_id = ? AND bucket=?', (s3_id, bucket))

        res = cursor.fetchall()
        cursor.close()

        return res

    def get_all_collections(self, s3_id: str) -> tuple:
        """ Returns the collection information stored in the database
        Arguments:
            s3_id: the S3 identifier for the relevant collections
        Returns:
            Returns a tuple of the retrieved collections where each row tuple contains
            the bucket, collection name, its json, and the number of seconds the entry has been in
            the database
        """
        if self._conn is None:
            raise RuntimeError('Attempting to access database before connecting for fetching ' \
                                                                            'collection details')

        cursor = self._conn.cursor()

        cursor.execute('SELECT bucket, name, json, ' \
                                '(strftime("%s", "now")-timestamp) as elapsed_sec ' \
                                'FROM collections WHERE s3_id = ?', (s3_id,))

        res = cursor.fetchall()
        cursor.close()

        return res

    def save_collection(self, s3_id: str, bucket: str, name: str, json: str) -> bool:
        """ Saves the collections to the database
        Arguments:
            s3_id: the S3 identifier for the relevant collections
            bucket: the bucket associated with the collection
            name: The collection name
            json: the collection JSON
        Return:
            Returns True if data is saved, and False if something went wrong
        """
        if self._conn is None:
            raise RuntimeError('Attempting to access database before connecting for saving ' \
                                                                            'a single collection')

        cursor = self._conn.cursor()

        # Find out if we are adding a collection or saving an existing one
        query = 'SELECT name, json_hash FROM collections WHERE s3_id=? AND bucket=?'
        params = (s3_id, bucket)
        cursor.execute(query, params)

        json_hash = hash(json_)
        if not res or len(res) < 1 or res[0] != name or res[1] != json_hash:
            # Adding
            query = 'INSERT INTO collections(s3_id, bucket, name, json, json_hash,timestamp) ' \
                        'VALUES (?, ?, ?, ?, ?, strftime("%s", "now"))'
            params = (s3_id, bucket, name, json, json_hash)
        elif res[0] != json_hash:
            # Updating due to JSON being different
            query = 'UPDATE collections SET name=?, json=?, json_hash=?, ' \
                                                                'timestamp=strftime("%s", "now") ' \
                            'WHERE s3_id=? AND bucket=?'
            params = (name, json, json_hash, s3_id, bucket)
        else:
            #
            query


    def save_all_collections(self, s3_id: str, collections: tuple) -> bool:
        """ Saves the collections to the database
        Arguments:
            s3_id: the S3 identifier for the relevant collections
            collections: a tuple of dicts containing the collection 'name', 'json', and 'bucket'
        Return:
            Returns True if data is saved, and False if something went wrong
        """
        if self._conn is None:
            raise RuntimeError('Attempting to access database before connecting for saving ' \
                                                                                'all collections')

        cursor = self._conn.cursor()

        # Clear the collections
        tries = 0
        while tries < 10:
            try:
                cursor.execute('DELETE FROM collections WHERE s3_id=?', (s3_id,))
                break
            except sqlite3.Error as ex:
                if ex.sqlite_errorcode == sqlite3.SQLITE_BUSY:
                    tries = tries + 1
                    sleep(1)
                else:
                    print(f'Save collections clearing sqlite error detected: {ex.sqlite_errorcode}')
                    print('    Not processing request further: delete')
                    print('   ',ex)
                    tries = 10
        if tries >= 10:
            self._conn.rollback()
            cursor.close()
            return False

        # Try to save the new collections
        tries = 1                                       # Re-used for completion count
        for one_coll in collections:
            try:
                cursor.execute('INSERT INTO collections(s3_id, bucket, name, json, json_hash,' \
                                                                                    ' timestamp) ' \
                                        'values(?, ?, ?, ?, ?, strftime("%s", "now"))', \
                                (s3_id, one_coll['bucket'], one_coll['name'], one_coll['json'], \
                                                                            hash(one_coll['json']))
                              )
                tries += 1
            except sqlite3.Error as ex:
                print(f'Unable to update collections: {ex.sqlite_errorcode} {one_coll}')
                break

        if tries < len(collections):
            self._conn.rollback()
            cursor.close()
            return False

        self._conn.commit()
        cursor.close()

        return True

    def have_expired_uploads(self, s3_id: str, timeout_sec: int) -> Optional[int]:
        """ Returns the number of upload entries that have timed out
        Arguments:
            s3_id: the S3 identifier for the relevant uploads
            timeout_sec: the number of seconds before the upload entries can be
                         considered expired
        Returns:
            Returns the number of expired uploads. None is returned if a problem occurs
        """
        if self._conn is None:
            raise RuntimeError('Attempting to access database before connecting for counting ' \
                                                                            'expired uploads')

        cursor = self._conn.cursor()
        cursor.execute('WITH colls as (SELECT id FROM collections WHERE s3_id=?)' \
                        'SELECT count(1) from uploads, colls WHERE ' \
                            'collection_id=colls.id AND (strftime("%s", "now")-uploads.timestamp) >= ?',
                        (s3_id, timeout_sec))

        res = cursor.fetchone()
        if not res or len(res) < 1:
            return None

        cursor.close()

        return int(res)

    def get_expired_uploads(self, s3_id: str, timeout_sec: int) -> Optional[tuple]:
        """ Returns the uploads information for expired upload entries
        Arguments:
            s3_id: the S3 identifier for the relevant uploads
            timeout_sec: the amount of time before the upload entries can be
                         considered expired
        Returns:
            Returns a tuple of the retrieved uploads where each row tuple contains
            the bucket and upload name. None is returned if a problem occurs
        """
        if self._conn is None:
            raise RuntimeError('Attempting to access database before connecting for getting ' \
                                                                    'expired upload details')

        cursor = self._conn.cursor()
        cursor.execute('WITH colls as (SELECT id,bucket FROM collections WHERE s3_id=?)' \
                        'SELECT colls.bucket, uploads.name from uploads, colls WHERE ' \
                            'colls.s3_id = ? AND (strftime("%s", "now")-uploads.timestamp) >= ?',
                        (s3_id, timeout_sec))

        res = cursor.fetchall()
        if not res or len(res) < 1:
            return None

        cursor.close()

        return res

    def get_upload(self, s3_id: str, bucket: str, upload: str) -> tuple:
        """ Returns the collection information stored in the database
        Arguments:
            s3_id: the S3 identifier for the relevant collections
            bucket: the bucket to get the upload from
        Returns:
            Returns a tuple of the retrieved collections where each row tuple contains
            the bucket, collection name, its json, and the number of seconds the entry has been in
            the database
        """
        if self._conn is None:
            raise RuntimeError('Attempting to access database before connecting for fetching ' \
                                                                            'collection details')

        cursor = self._conn.cursor()

        cursor.execute('SELECT bucket, name, json, ' \
                                '(strftime("%s", "now")-timestamp) as elapsed_sec ' \
                                'FROM collections WHERE s3_id = ?', (s3_id,))

        res = cursor.fetchall()
        cursor.close()


        return res

    def get_all_uploads(self, s3_url: str, bucket: str, timeout_sec: int) -> Optional[tuple]:
        """ Returns the uploads for this collection from the database
        Arguments:
            s3_url: the URL associated with this request
            bucket: The bucket to get uploads for
            timeout_sec: the amount of time before the table entries can be
                         considered expired
        Return:
            Returns a tuple of row tuples containing the name and json of the upload, or None
            if no uploads are found
        """
        if self._conn is None:
            raise RuntimeError('Attempting to access database before connecting')

        # Check for expired collection uploads
        cursor = self._conn.cursor()
        cursor.execute('SELECT (strftime("%s", "now")-timestamp) AS elapsed_sec from ' \
                       'table_timeout where name=(?) ORDER BY elapsed_sec DESC LIMIT 1', \
                       (bucket,))

        res = cursor.fetchone()
        if not res or len(res) < 1 or int(res[0]) >= timeout_sec:
            return None

        cursor.execute('SELECT name,json FROM uploads WHERE s3_url=? AND bucket=?',
                                                                                (s3_url, bucket))
        res = cursor.fetchall()
        cursor.close()

        return res

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
        if self._conn is None:
            raise RuntimeError('Attempting to access database before connecting')

        cursor = self._conn.cursor()

        tries = 0
        while tries < 10:
            try:
                cursor.execute('DELETE FROM uploads where s3_url=? AND bucket=?',
                                                                                (s3_url, bucket))
                break
            except sqlite3.Error as ex:
                if ex.sqlite_errorcode == sqlite3.SQLITE_BUSY:
                    tries += 1
                    sleep(1)
                else:
                    print(f'Save uploads delete sqlite error detected: {ex.sqlite_errorcode}')
                    print('    Not processing request further: delete')
                    print('   ',ex)
                    tries = 10
        if tries >= 10:
            try:
                cursor.execute('ROLLBACK TRANSACTION')
            except sqlite3.Error:
                pass
            cursor.close()
            return False

        tries = 0
        for one_upload in uploads:
            try:
                cursor.execute('INSERT INTO uploads(s3_url, bucket,name, json) values(?,?,?,?)', \
                                        (s3_url, bucket, one_upload['name'], one_upload['json']))
                tries += 1
            except sqlite3.Error as ex:
                print(f'Unable to update uploads: {ex.sqlite_errorcode} {one_upload}')
                break

        if tries < len(uploads):
            cursor.execute('ROLLBACK TRANSACTION')
            cursor.close()
            return False

        # Update the timeout table for uploads and do some cleanup if needed
        cursor.execute('SELECT COUNT(1) FROM table_timeout WHERE name=(?)', (bucket,))
        res = cursor.fetchone()

        count = int(res[0]) if res and len(res) > 0 else 0
        if count > 1:
            # Remove multiple old entries
            cursor.execute('DELETE FROM table_timeout WHERE name=(?)', (bucket,))
            count = 0
        if count <= 0:
            cursor.execute('INSERT INTO table_timeout(name,timestamp) ' \
                                'VALUES (?,strftime("%s", "now"))', (bucket,))
        else:
            cursor.execute('UPDATE table_timeout SET timestamp=strftime("%s", "now") ' \
                                'WHERE name=(?)', (bucket,))

        self._conn.commit()
        cursor.close()

        return True
