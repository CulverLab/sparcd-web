#!/usr/bin/python3
"""This script creates a sparcd collection database at the specified path
"""

import argparse
import os
import sqlite3
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
DB_NAME_DEFAULT = 'sparcd_coll.sqlite'

if DB_ENV_PATH is not None:
    DB_PATH_DEFAULT, DB_NAME_DEFAULT = os.path.split(DB_ENV_PATH)

# Argparse-related definitions
# Declare the progam description
ARGPARSE_PROGRAM_DESC = 'Creates a SQLite collection database for the SPARCd web server'
# Epilog for help
ARGPARSE_EPILOG = f'Set the {DB_ENV_NAME} environment variable to the collection database path'
# Help for the database path
ARGPARSE_DB_PATH_HELP = 'Path to create the collection database file on ' \
                                                                    f'(default: {DB_PATH_DEFAULT})'
# Help for the database name
ARGPARSE_DB_NAME_HELP = 'Name of the collection database file to create ' \
                                                                    f'(default: {DB_NAME_DEFAULT})'
# Help for forcing an overwrite of an existing database file
ARGPARSE_OVERWRITE_HELP = 'Specify this flag if you want to force the destructive overwrite of ' \
                          'an existing file'

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
    args = parser.parse_args()

    # We only need to check one admin parameter since we already checked for
    # admin parameter sameness
    return os.path.join(args.db_path, args.db_name), args.overwrite


def build_database(path: str) -> None:
    """ Builds the database file
    Arguments:
        path: the path to the database file to create
    """
    # Loop through and create all the database objects
    stmts = ('CREATE TABLE collections(id INTEGER PRIMARY KEY ASC, ' \
                            's3_id TEXT NOT NULL,' \
                            'bucket TEXT NOT NULL, ' \
                            'name TEXT NOT NULL, ' \
                            'json TEXT NOT NULL,' \
                            'json_hash TEXT NOT NULL, ' \
                            'timestamp INTEGER NOT NULL)',
             'CREATE TABLE uploads(id INTEGER PRIMARY KEY ASC,' \
                            'collection_id INTEGER NOT NULL, ' \
                            'name TEXT NOT NULL,' \
                            'json TEXT NOT NULL,' \
                            'json_hash TEXT NOT NULL, ' \
                            'timestamp INTEGER NOT NULL)',
        )
    with sqlite3.connect(path) as conn:
        cursor = conn.cursor()
        idx = 1
        for cmd in stmts:
            print(f'{idx}.',cmd)
            cursor.execute(cmd)
            idx = idx + 1


if __name__ == '__main__':
    database_path, force_overwrite = get_arguments()
    if not os.path.exists(database_path) or force_overwrite:
        if force_overwrite:
            print(f'{SCRIPT_NAME}: Forcing the overwrite of existing collection database file: ' \
                  f'{database_path}')
            if os.path.exists(database_path) and not os.path.isdir(database_path):
                os.unlink(database_path)
        else:
            print(f'{SCRIPT_NAME}: Creating collection database file: {database_path}')
        build_database(database_path)
    else:
        print(f'{SCRIPT_NAME}: The specified collection database file already exists: ' \
                f'{database_path}')
