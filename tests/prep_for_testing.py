#!/usr/bin/python3
""" Prepares the S3 instance for testing
"""

import argparse
import os
import sys

from minio import Minio, S3Error

# Environment variable names
ENV_S3_ENDPOINT = 'S3_ENDPOINT'
ENV_S3_USER = 'S3_USER'
ENV_S3_SECRET = 'S3_SECRET'
ENV_S3_BUCKET = 'S3_BUCKET'
ENV_S3_UPLOAD = 'S3_UPLOAD'

# Get information from the environment
S3_ENDPOINT = os.environ.get(ENV_S3_ENDPOINT)
S3_USER = os.environ.get(ENV_S3_USER)
S3_SECRET = os.environ.get(ENV_S3_SECRET)
S3_BUCKET = os.environ.get(ENV_S3_BUCKET)
S3_UPLOAD = os.environ.get(ENV_S3_UPLOAD)

# Argparse help strings
ARGPARSE_HELP_S3_ENDPOINT = 'The S3 server URL and optional port number. ' \
                            f'Set the {ENV_S3_ENDPOINT} environment variable to avoid using this ' \
                            'command line option'
ARGPARSE_HELP_S3_USER = 'The name of the S3 user account used to access the collection. ' \
                            f'Set the {ENV_S3_USER} environment variable to avoid using this ' \
                            'command line option'
ARGPARSE_HELP_S3_SECRET = 'The secret used to log onto the S3 instance. It is NOT advised to use ' \
                            'this command line parameter, use the environment variable. ' \
                            f'Set the {ENV_S3_SECRET} environment variable to avoid using this ' \
                            'command line option'
ARGPARSE_HELP_S3_BUCKET = 'The bucket to use as the testing collection. This can be the bucket ' \
                            'name or the collection name. The data in this bucket WILL BE DELETED '\
                            ' and otherwise modified as part of this initialization. ' \
                            f'Set the {ENV_S3_BUCKET} environment variable to avoid using this ' \
                            'command line option'
ARGPARSE_HELP_S3_UPLOAD = 'The name of the upload folder to use. Must be in the form of ' \
                            'YYYY.MO.DD.HH.MM.SS_NAME where NAME is the user name and the other ' \
                            'values are numbers. ' \
                            f'Set the {ENV_S3_UPLOAD} environment variable to avoid using this ' \
                            'command line option'
ARGPARSE_HELP_DUMP = 'Prints out the S3 parameters as specified on the command line or with ' \
                            'environment variables. The S3 secret will display as TRUE or FALSE ' \
                            'indicating whether it was specified or not. '
ARGPARSE_HELP_AUTOMATED = 'Run the script in an automated fashion with no further user input. '\
                            'WARNING: when this flag is set the specified collection will have ' \
                            'objects deleted and uploaded without asking for permissions '

# The name of our script
SCRIPT_NAME = os.path.basename(__file__)

# Description of what this script does
ARGPARSE_PROGRAM_DESC = "Destructively prepares a collection at an S3 endpoint for testing"


# The test files and types
TEST_FILES_UPLOAD = [
                    {
                     'name':'deployments.csv', 
                     'type':'text/csv',
                     'local_path':'tests/original_data',
                     's3_path':None,
                    }, {
                     'name':'media.csv',
                     'type':'text/csv',
                     'local_path':'tests/original_data',
                     's3_path':None,
                    }, {
                     'name':'observations.csv',
                     'type':'text/csv',
                     'local_path':'tests/original_data',
                     's3_path':None,
                    }, {
                     'name':'UploadMeta.json',
                     'type':'application/json',
                     'local_path':'tests/original_data',
                     's3_path':None,
                    }, {
                     'name':'NSCF----_250816105104_0001.JPG',
                     'type':'image/jpeg',
                     'local_path':'tests/data',
                     's3_path':'DCIM112',
                    }, {
                     'name':'NSCF----_250816105117_0002.JPG',
                     'type':'image/jpeg',
                     'local_path':'tests/data',
                     's3_path':'DCIM112',
                    }, {
                     'name':'NSCF----_250816105127_0003.JPG',
                     'type':'image/jpeg',
                     'local_path':'tests/data',
                     's3_path':'DCIM112',
                    },
                    ]

TEST_FILES_COLLECTION = [
                    {
                     'name':'collection.json', 
                     'type':'application/json',
                     'local_path':'tests/original_data',
                     's3_path':None,
                    }, {
                     'name':'permissions.json',
                     'type':'application/json',
                     'local_path':'tests/original_data',
                     's3_path':None,
                    }
                    ]


def __clear_files(minio: Minio, bucket: str, path: str, level: int=0) -> tuple:
    """ Clears the files from the specified path and returns a tuple of subfolders
    Arguments:
        minio: the S3 instance object
        bucket: the bucket in which to clean out folders
        paths: tuple of paths to remove the data from
        level: the recursion level used to indent print statements
    Return:
        Returns a tuple for any subpaths
    """
    indent = ' ' * ((level + 1) * 2)
    new_paths = []

    # Make sure we have the correct path format
    if not path.endswith('/'):
        path += '/'

    # List through and remove objects
    for one_obj in minio.list_objects(bucket, prefix=path):
        if one_obj.is_dir:
            if not one_obj.object_name == path:
                new_paths.append(one_obj.object_name)
        else:
            print(indent, one_obj.object_name)
            minio.remove_object(bucket, one_obj.object_name)

    return new_paths


def __clear_dirs(minio: Minio, bucket: str, paths: tuple, level: int=0) -> None:
    """ Clears out files and subfolders folders on the specified paths
    Arguments:
        minio: the S3 instance object
        bucket: the bucket in which to clean out folders
        paths: tuple of paths to remove the data from
        level: the recursion level used to indent print statements
    """
    indent = ' ' * ((level + 1) * 2)

    # Loop through the paths
    for one_path in paths:

        # Make sure we have the correct path format
        if not one_path.endswith('/'):
            one_path += '/'

        # List through and remove objects
        new_paths = __clear_files(minio, bucket, one_path, level)

        # If we have subfolders, clear them out as well
        if len(new_paths) > 0:
            __clear_dirs(minio, bucket, new_paths, level + 1)

        # Remove the current path
        print(indent, one_path)
        minio.remove_object(bucket, one_path)


def __upload_files(minio: Minio, bucket: str, upload_path: str, files_info: tuple) -> bool:
    """ Uploads files to the specified bucket
    Arguments:
        minio: the S3 instance object
        bucket: the bucket to upload to
        upload_path: the root path on S3 to upload to
        files_info: a tuple of files to upload
    """
    cur_dir = os.getcwd()
    error_count = 0

    # Loop through and upload the files
    for one_file in files_info:
        source_path = os.path.join(cur_dir, one_file['local_path'], one_file['name'])
        if one_file['s3_path'] is not None:
            dest_path = '/'.join((upload_path, one_file['s3_path'], one_file['name']))
        else:
            dest_path = '/'.join((upload_path, one_file['name']))

        print(f'  "{source_path}" to "{dest_path}"')

        try:
            minio.fput_object(bucket, dest_path, source_path, content_type=one_file['type'])
        except S3Error as ex:
            print('ERROR: Unable to upload file')
            print(ex)
            error_count += 1

    return error_count == 0


def get_testing_arguments() -> dict:
    """ Gets and checks the testing arguments from the command line and
        environment
    Return:
        Returns an object containing the testing information
    """
    parser = argparse.ArgumentParser(prog=SCRIPT_NAME,
                                     description=ARGPARSE_PROGRAM_DESC)
    parser.add_argument('--s3_endpoint', '-s3', help=ARGPARSE_HELP_S3_ENDPOINT)
    parser.add_argument('--s3_user', '-u', help=ARGPARSE_HELP_S3_USER)
    parser.add_argument('--s3_secret', '-s', help=ARGPARSE_HELP_S3_SECRET)
    parser.add_argument('--s3_bucket', '-b', help=ARGPARSE_HELP_S3_BUCKET)
    parser.add_argument('--s3_upload', '-p', help=ARGPARSE_HELP_S3_UPLOAD)
    parser.add_argument('--dump', '-d', help=ARGPARSE_HELP_DUMP, action='store_true')
    parser.add_argument('--automated', '-a', help=ARGPARSE_HELP_AUTOMATED, action='store_true')
    args = parser.parse_args()

    config = {
        'endpoint': args.s3_endpoint if args.s3_endpoint else S3_ENDPOINT,
        'user': args.s3_user if args.s3_user else S3_USER,
        'secret': args.s3_secret if args.s3_secret else S3_SECRET,
        'bucket': args.s3_bucket if args.s3_bucket else S3_BUCKET,
        'upload': args.s3_upload if args.s3_upload else S3_UPLOAD,
        'automated': args.automated,
    }

    # Check the parameters
    error = False
    if not config['endpoint']:
        print('ERROR: missing S3 endpoint')
        error = True
    if not config['user']:
        print('ERROR: missing S3 user')
        error = True
    if not config['secret']:
        print('ERROR: missing S3 secret')
        error = True
    if not config['bucket']:
        print('ERROR: missing S3 bucket')
        error = True
    if not config['upload']:
        print('ERROR: missing S3 upload')
        error = True

    if config['upload']:
        if len(config['upload'].split('.')) != 6 or len(config['upload'].split('_')) != 2:
            print('ERROR: specified upload format is incorrect')
            error = True

    # If the dump flag is set, print the information
    if args.dump:
        print('S3 endpoint: ', config['endpoint'] if config['endpoint'] else '')
        print('S3 user: ', config['user'] if config['user'] else '')
        print('S3 secret: ', 'TRUE' if config['secret'] else 'FALSE')
        print('S3 bucket: ', config['bucket'] if config['bucket'] else '')
        print('S3 upload: ', config['upload'] if config['upload'] else '')

    if error:
        print('Try again with the -help flag set to see command options')
        sys.exit(10)

    return config


def prepare_test_collection(s3_config: dict) -> bool:
    """ Prepares the S3 bucket for testing by deleting and adding data
    Arguments:
        s3_config: contains the endpoint, user, secret, bucket, and upload
    """
    minio = Minio(s3_config['endpoint'], access_key=s3_config['user'],
                                                                    secret_key=s3_config['secret'])

    collection_path = '/'.join(('Collections', s3_config['bucket'][len('sparcd-'):]))
    upload_path = '/'.join((collection_path, 'Uploads'))

    # Delete the uploads that are up there
    print(f'Clearing uploads: {upload_path}')
    __clear_dirs(minio, s3_config['bucket'], (upload_path + '/',))

    # Create the testing upload
    test_path = '/'.join((upload_path, s3_config['upload']))
    print(f'Creating upload: {test_path}')
    upload_errors = __upload_files(minio, s3_config['bucket'], test_path, TEST_FILES_UPLOAD)

    # Clear the files in the collection folder
    print('Clearing files in the Collection\'s root folder')
    __clear_files(minio, s3_config['bucket'], collection_path + '/')

    # Upload the collection files
    print('Uploading collection files')
    collection_errors = __upload_files(minio, s3_config['bucket'], collection_path,
                                                                            TEST_FILES_COLLECTION)

    return collection_errors is False and upload_errors is False


if __name__ == "__main__":
    # Get the arguments
    s3_info = get_testing_arguments()
    print(f'Preparing testing collection {s3_info["bucket"]} at specified endpoint')
    print('WARNING: this will delete data on the testing collection')

    # Check if we need permission to continue
    if not s3_info['automated']:
        print(' ')
        _ = input('Press <ENTER> key to start configuring the collection')
    else:
        print('Running automatically')

    # Make sure the data is in a format we can use
    if s3_info['bucket'] and not s3_info['bucket'].startswith('sparcd-'):
        s3_info['bucket'] = 'sparcd-' + s3_info['bucket']

    # Do what we're here to do
    res = prepare_test_collection(s3_info)
    if res is True:
        sys.exit(0)
    else:
        sys.exit(1)
