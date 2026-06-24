#!python3
"""This script migrates the SPARCd database to the new sandbox database structure"""

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
ARGPARSE_PROGRAM_DESC = 'Migrates the SPARCd main database to the new sandbox database structure'
ARGPARSE_EPILOG = 'All database names are based upon the main database file name.\n' \
                  f'Can set the {DB_ENV_NAME} environment variable to the full database path'
ARGPARSE_DB_PATH_HELP = f'Path to the database file (default: {DB_PATH_DEFAULT})'
ARGPARSE_DB_NAME_HELP = f'Name of the main database file (default: {DB_NAME_DEFAULT})'
ARGPARSE_OVERWRITE_HELP = 'Specify this flag to force overwrite of an existing sandbox database'

# Sandbox tables that should be in the main DB before migration
SANDBOX_TABLES = {'sandbox', 'sandbox_files', 'sandbox_species', 'sandbox_locations'}


def get_arguments() -> tuple:
    """ Returns the data from the parsed command line arguments
    Returns:
        A tuple of the main database path, sandbox database path, and force flag
    """
    parser = argparse.ArgumentParser(prog=SCRIPT_NAME,
                                     description=ARGPARSE_PROGRAM_DESC,
                                     epilog=ARGPARSE_EPILOG)
    parser.add_argument('db_path', help=ARGPARSE_DB_PATH_HELP, nargs='?', default=DB_PATH_DEFAULT)
    parser.add_argument('db_name', help=ARGPARSE_DB_NAME_HELP, nargs='?', default=DB_NAME_DEFAULT)
    parser.add_argument('--overwrite', action='store_true', help=ARGPARSE_OVERWRITE_HELP)
    args = parser.parse_args()

    main_db = os.path.join(args.db_path, args.db_name)
    base, ext = os.path.splitext(args.db_name)
    sandbox_db = os.path.join(args.db_path, base + '_sandbox' + ext)

    return main_db, sandbox_db, args.overwrite


def get_existing_tables(conn: sqlite3.Connection) -> set:
    """ Returns the set of table names in the database
    Arguments:
        conn: the database connection
    Return:
        Returns a set of table name strings
    """
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    res = cursor.fetchall()
    cursor.close()
    return {row[0] for row in res}


def build_sandbox_database(path: str) -> None:
    """ Builds the sandbox database file
    Arguments:
        path: the path to the sandbox database file to create
    """
    stmts = ('CREATE TABLE sandbox(id INTEGER PRIMARY KEY ASC, '
                'name TEXT NOT NULL, '
                'path TEXT NOT NULL, '
                's3_id TEXT NOT NULL, '
                'bucket TEXT NOT NULL, '
                's3_base_path TEXT NOT NULL, '
                'location_id TEXT DEFAULT NULL, '
                'location_name TEXT DEFAULT NULL, '
                'location_lat REAL DEFAULT NULL, '
                'location_lon REAL DEFAULT NULL, '
                'location_ele REAL DEFAULT NULL, '
                'completion_status INTEGER DEFAULT 0,'
                'recovered INT DEFAULT 0, '
                'timestamp INTEGER, '
                'upload_id TEXT DEFAULT NULL)',
             'CREATE TABLE sandbox_files(id INTEGER PRIMARY KEY ASC, '
                'sandbox_id INTEGER NOT NULL, '
                'filename TEXT NOT NULL, '
                'source_path TEXT, '
                'completion_status INTEGER DEFAULT 0, '
                'mimetype TEXT DEFAULT NULL, '
                'created_timestamp TEXT DEFAULT NULL,'
                'original_filename TEXT DEFAULT NULL, '
                'timestamp INTEGER)',
             'CREATE TABLE sandbox_species(id INTEGER PRIMARY KEY ASC, '
                'sandbox_file_id INTEGER NOT NULL, '
                'obs_date TEXT, '
                'obs_common TEXT, '
                'obs_scientific TEXT, '
                'obs_count INTEGER)',
             'CREATE TABLE sandbox_locations(id INTEGER PRIMARY KEY ASC, '
                'sandbox_file_id INTEGER NOT NULL, '
                'loc_name TEXT, '
                'loc_id TEXT, '
                'loc_elevation REAL)',
             'CREATE TABLE sparcd(version TEXT)'
            )
    version_stmt = 'INSERT INTO sparcd(version) VALUES("1.0")'

    with sqlite3.connect(path) as conn:
        conn.execute('PRAGMA journal_mode=WAL')
        conn.execute('PRAGMA synchronous=NORMAL')
        conn.execute('PRAGMA busy_timeout=10000')
        cursor = conn.cursor()

        for cmd in stmts:
            cursor.execute(cmd)

        cursor.execute(version_stmt)
        conn.commit()
        cursor.close()

    print(f'{SCRIPT_NAME}: Sandbox database created at {path}')


if __name__ == '__main__':
    main_db_path, sandbox_db_path, force_overwrite = get_arguments()

    # Verify the main database exists
    if not os.path.exists(main_db_path):
        sys.exit(f'{SCRIPT_NAME}: Main database not found: {main_db_path}')

    # Check for sandbox tables in the main database
    with sqlite3.connect(main_db_path) as main_conn:
        existing_tables = get_existing_tables(main_conn)

    found_sandbox_tables = SANDBOX_TABLES & existing_tables

    if found_sandbox_tables:
        # Sandbox tables still in main DB — migration needed but sandbox DB
        # data cannot be preserved since schema has changed
        print(f'{SCRIPT_NAME}: Sandbox tables found in main database: '
              f'{", ".join(sorted(found_sandbox_tables))}')
        print(f'{SCRIPT_NAME}: Sandbox data cannot be migrated as the schema has changed.')

        if os.path.exists(sandbox_db_path):
            print(f'{SCRIPT_NAME}: Remove the existing sandbox database and re-run this script:')
            print(f'        {sandbox_db_path}')
        else:
            print(f'{SCRIPT_NAME}: Drop the sandbox tables from the main database and '
                  f're-run this script:')
            for table in sorted(found_sandbox_tables):
                print(f'       DROP TABLE {table};')

        sys.exit(1)

    # Sandbox tables not in main DB — sandbox DB should already be migrated or new
    if os.path.exists(sandbox_db_path):
        if not force_overwrite:
            sys.exit(f'{SCRIPT_NAME}: Sandbox database already exists at {sandbox_db_path}.\n'
                     f'Use --overwrite to force regeneration of the sandbox database.\n'
                     f'WARNING: --overwrite will delete all existing sandbox data.')
        print(f'{SCRIPT_NAME}: Overwriting existing sandbox database: {sandbox_db_path}')
        os.unlink(sandbox_db_path)

    build_sandbox_database(sandbox_db_path)
