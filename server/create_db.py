#!/usr/bin/python3
"""This script creates a sparcd database at the specified path
"""

import argparse
import os
import sqlite3
import sys
import tempfile

# The name of our script
SCRIPT_NAME = os.path.basename(__file__)

# Environment variable name for database
DB_ENV_NAME = 'SPARCD_DB'
# Environment database variable value
DB_ENV_PATH = os.environ.get(DB_ENV_NAME, None)
# Working database storage path
DB_PATH_DEFAULT = tempfile.gettempdir()
# Working database name
DB_NAME_DEFAULT = 'sparcd.sqlite'

if DB_ENV_PATH is not None:
    DB_PATH_DEFAULT, DB_NAME_DEFAULT = os.path.split(DB_ENV_PATH)

# Argparse-related definitions
# Declare the progam description
ARGPARSE_PROGRAM_DESC = 'Creates a SQLite database for the SPARCd web server'
# Epilog for help
ARGPARSE_EPILOG = f'Can set the {DB_ENV_NAME} environment variable to the database path'
# Help for the database path
ARGPARSE_DB_PATH_HELP = f'Path to create the database file on (default: {DB_PATH_DEFAULT})'
# Help for the database name
ARGPARSE_DB_NAME_HELP = f'Name of the database file to create (default: {DB_NAME_DEFAULT})'
# Help for forcing an overwrite of an existing database file
ARGPARSE_OVERWRITE_HELP = 'Specify this flag if you want to force the destructive overwrite of ' \
                          'an existing file'
# Help for specifying a default administrator account
ARGPARSE_ADMIN_HELP = 'The username of the default administrator (also specify --admin_email)'
# Help for specifying the email of an adminstrator
ARGPARSE_ADMIN_EMAIL_HELP = 'The default administrator\'s email address (see --admin)'

def get_arguments() -> str:
    """ Returns the data from the parsed command line arguments
    Returns:
        The path of the database file to create
    """
    parser = argparse.ArgumentParser(prog=SCRIPT_NAME,
                                     description=ARGPARSE_PROGRAM_DESC,
                                     epilog=ARGPARSE_EPILOG)
    parser.add_argument('db_path', help=ARGPARSE_DB_PATH_HELP, nargs='?', default=DB_PATH_DEFAULT)
    parser.add_argument('db_name', help=ARGPARSE_DB_NAME_HELP, nargs='?', default=DB_NAME_DEFAULT)
    parser.add_argument('--overwrite', action='store_true', help=ARGPARSE_OVERWRITE_HELP)
    parser.add_argument('--admin', help=ARGPARSE_ADMIN_HELP)
    parser.add_argument('--admin_email', help=ARGPARSE_ADMIN_EMAIL_HELP)
    args = parser.parse_args()

    if (args.admin is None and args.admin_email is not None) or \
       (args.admin_email is None and args.admin is not None):
        print('ERROR: Not all administrator information has been specified')
        sys.exit(10)

    # We only need to check one admin parameter since we already checked for
    # admin parameter sameness
    return os.path.join(args.db_path, args.db_name), args.overwrite, \
                            (args.admin, args.admin_email) if args.admin else None


def build_database(path: str, admin_info: tuple=None) -> None:
    """ Builds the database file
    Arguments:
        path: the path to the database file to create
        admin_info: contains the admin name and email address to add to the DB
    """
    # Loop through and create all the database objects
    stmts = ('CREATE TABLE users(id INTEGER PRIMARY KEY ASC, ' \
                'name TEXT UNIQUE NOT NULL, ' \
                'email TEXT DEFAULT NULL, ' \
                'settings TEXT DEFAULT "{}", ' \
                'species TEXT default "{}", ' \
                'administrator INT DEFAULT 0, ' \
                'auto_added INT DEFAULT 1)',
             'CREATE TABLE tokens(id INTEGER PRIMARY KEY ASC, ' \
                'name TEXT NOT NULL, ' \
                'password TEXT NOT NULL, ' \
                's3_url TEXT NOT NULL, ' \
                'token TEXT UNIQUE, ' \
                'timestamp INTEGER, ' \
                'client_ip TEXT, ' \
                'user_agent TEXT)',
             'CREATE TABLE table_timeout(id INTEGER PRIMARY KEY ASC, ' \
                'name TEXT NOT NULL, ' \
                'timestamp INTEGER)',
             'CREATE TABLE collections(id INTEGER PRIMARY KEY ASC, ' \
                's3_id TEXT NOT NULL, ' \
                'hash_id TEXT UNIQUE,' # Hash of s3, collection id \
                'name TEXT NOT NULL, ' \
                'coll_id TEXT NOT NULL, ' \
                'json TEXT NOT NULL, ' \
                'timestamp INTEGER NOT NULL)',
             'CREATE TABLE uploads(id INTEGER PRIMARY KEY ASC, ' \
                's3_id TEXT NOT NULL, ' \
                'bucket TEXT NOT NULL, ' \
                'hash_id TEXT UNIQUE, -- Hash of s3, collection id, upload ' + os.linesep + \
                'name TEXT NOT NULL, ' \
                'json TEXT DEFAULT "", -- Non-image data (see upload_images) ' + os.linesep + \
                'timestamp INTEGER)',
             'CREATE TABLE upload_images(id INTEGER PRIMARY KEY ASC, ' \
                'uploads_id INTEGER NOT NULL, ' \
                'hash_id TEXT UNIQUE, -- Hash of upload ID, img path ' + os.linesep + \
                'name TEXT NOT NULL, ' \
                'key TEXT NOT NULL, ' \
                'json TEXT NOT NULL, ' \
                'timestamp INTEGER)',
             'CREATE TABLE queries(id INTEGER PRIMARY KEY ASC, ' \
                'timestamp INTEGER, ' \
                'token TEXT, path TEXT NOT NULL)',
             'CREATE TABLE sandbox(id INTEGER PRIMARY KEY ASC, ' \
                'name TEXT NOT NULL, ' \
                'path TEXT NOT NULL, ' \
                's3_url TEXT NOT NULL, ' \
                'bucket TEXT NOT NULL, ' \
                's3_base_path TEXT NOT NULL, ' \
                'location_id TEXT NOT NULL, ' \
                'location_name TEXT NOT NULL, ' \
                'location_lat REAL NOT NULL, ' \
                'location_lon READ NOT NULL, ' \
                'location_ele REAL NOT NULL, '
                'timestamp INTEGER, ' \
                'upload_id TEXT DEFAULT NULL)',
             'CREATE TABLE sandbox_files(id INTEGER PRIMARY KEY ASC, ' \
                'sandbox_id INTEGER NOT NULL, '\
                'filename TEXT NOT NULL, ' \
                'source_path TEXT, ' \
                'uploaded BOOLEAN DEFAULT FALSE, ' \
                'mimetype TEXT DEFAULT NULL, ' \
                'timestamp INTEGER)',
             'CREATE TABLE sandbox_species(id INTEGER PRIMARY KEY ASC, ' \
                'sandbox_file_id INTEGER NOT NULL, ' \
                'obs_date TEXT, ' \
                'obs_common TEXT, ' \
                'obs_scientific TEXT, ' \
                'obs_count INTEGER)',
             'CREATE TABLE sandbox_locations(id INTEGER PRIMARY KEY ASC, '\
                'sandbox_file_id INTEGER NOT NULL, ' \
                'loc_name TEXT, ' \
                'loc_id TEXT, ' \
                'loc_elevation REAL)',
             'CREATE TABLE image_edits(id INTEGER PRIMARY KEY ASC, ' \
                's3_url TEXT NOT NULL, ' \
                'bucket TEXT NOT NULL, ' \
                's3_file_path TEXT NOT NULL,' \
                'username TEXT NOT NULL, ' \
                'edit_timestamp TEXT NOT NULL,' # Browser reported timestamp \
                'obs_common TEXT NOT NULL, ' \
                'obs_scientific TEXT NOT NULL,' \
                'obs_count INTEGER DEFAULT 0, '\
                'updated INTEGER DEFAULT 0,' # Various stages of update (including S3) \
                'request_id TEXT, ' # Used to keep track of requests \
                'timestamp INTEGER)',
             'CREATE TABLE collection_edits(id INTEGER PRIMARY KEY ASC, ' \
                's3_url TEXT NOT NULL, ' \
                'bucket TEXT NOT NULL, ' \
                's3_base_path TEXT NOT NULL,'\
                'username TEXT NOT NULL, ' \
                'edit_timestamp TEXT NOT NULL,'\
                'loc_id TEXT DEFAULT NULL, '\
                'loc_name TEXT NOT NULL,'\
                'loc_ele REAL NOT NULL, ' \
                'updated INTEGER DEFAULT 0, ' \
                'timestamp INTEGER)',
             'CREATE TABLE admin_species_edits(id INTEGER PRIMARY KEY ASC, ' \
                's3_url TEXT NOT NULL, ' \
                'user_id INTEGER NOT NULL,'\
                'old_scientific_name TEXT,'\
                'new_scientific_name TEXT NOT NULL, ' \
                'name TEXT NOT NULL,'\
                'keybind NOT NULL,'\
                'iconURL TEXT NOT NULL, ' \
                's3_updated INTEGER DEFAULT 0,' \
                'timestamp INTEGER)',
             'CREATE TABLE admin_location_edits(id INTEGER PRIMARY KEY ASC, ' \
                's3_url TEXT NOT NULL, '\
                'user_id INTEGER NOT NULL,'\
                'loc_name TEXT NOT NULL,'\
                'loc_id TEXT NOT NULL, '\
                'loc_active INTEGER DEFAULT 0,'\
                'loc_ele REAL NOT NULL, ' \
                'loc_old_lat REAL,'\
                'loc_old_lng REAL, ' \
                'loc_new_lat REAL NOT NULL,'\
                'loc_new_lng REAL NOT NULL, ' \
                'location_updated INTEGER DEFAULT 0, ' \
                'timestamp INTEGER)',
             'CREATE TABLE db_locks(id INTEGER PRIMARY KEY ASC, ' \
                'name TEXT NOT NULL, ' \
                'value INTEGER DEFAULT NULL, ' \
                'timestamp INTEGER)',
        )
    add_user_stmt = 'INSERT INTO users(name, email, administrator, auto_added) values(?, ?, 1, 0)'

    with sqlite3.connect(path) as conn:
        cursor = conn.cursor()
        idx = 1
        for cmd in stmts:
            print(f'{idx}.',cmd)
            cursor.execute(cmd)
            idx = idx + 1

        # If we have a administrator information, we add it to the users table
        if admin_info and len(admin_info) == 2:
            print(f'Adding administrator {admin_info[0]}')
            cursor.execute(add_user_stmt, admin_info)


if __name__ == '__main__':
    database_path, force_overwrite, admin = get_arguments()
    if not os.path.exists(database_path) or force_overwrite:
        if force_overwrite:
            print(f'{SCRIPT_NAME}: Forcing the overwrite of existing database file: ' \
                  f'{database_path}')
            if os.path.exists(database_path) and not os.path.isdir(database_path):
                os.unlink(database_path)
        else:
            print(f'{SCRIPT_NAME}: Creating database file: {database_path}')
        build_database(database_path, admin)
    else:
        print(f'{SCRIPT_NAME}: The specified database file already exists: {database_path}')
