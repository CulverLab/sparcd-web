""" Functions to handle basic requests for SPARCd server """

from dataclasses import dataclass
import hashlib
import json
import os
from typing import Callable, Optional, Union
import uuid

from flask import request
from minio.error import MinioException
import requests

import spd_crypt as crypt
import sparcd_collections as sdc
from sparcd_db import SPARCdDatabase
import sparcd_utils as sdu
import sparcd_location_utils as sdlu
from spd_types.userinfo import UserInfo
from spd_types.s3info import S3Info
from s3.s3_access_helpers import SPECIES_JSON_FILE_NAME, SPARCD_PREFIX
from s3.s3_admin import S3AdminConnection
from s3.s3_connect import s3_connect
from s3.s3_uploads import S3UploadConnection
import s3_utils as s3u
from text_formatters.coordinate_utils import DEFAULT_UTM_ZONE

# Name of temporary species file
TEMP_SPECIES_FILE_NAME = SPARCD_PREFIX + 'species.json'

@dataclass
class LoginResult:
    """ Internal use class which contains the results of logging in """
    new_key: str
    new_instance: bool
    needs_repair: bool
    user_name: str
    user_settings: dict

@dataclass
class LoginParams:
    """ Internal use class which contains the results of logging in """
    url: str
    user: bool
    password: bool
    token: bool

@dataclass
class NewLoginContext:
    """ Internal context for a new login """
    passcode: str
    client_ip: str
    user_agent_hash: str
    expire_sec: str
    temp_species_filename: str


def __get_login_params() -> LoginParams:
    """ Returns the request parameters
    Return:
        Returns a LoginParams instance
    """
    if request.method == 'POST':
        return LoginParams(url=request.form.get('url'),
                           user=request.form.get('user'),
                           password=request.form.get('password'),
                           token=request.form.get('token')
                          )

    return LoginParams(url=request.args.get('url'),
                       user=request.args.get('user'),
                       password=request.args.get('password'),
                       token=request.args.get('token')
                      )


def __get_new_login(db: SPARCdDatabase, s3_info: S3Info, params: LoginParams,
                                        context: NewLoginContext) -> Optional[LoginResult]:
    """ Handles the details of a new login
    Arguments:
        db: the working database
        s3_info: the S3 instance connection information
        params: the logging in parameters
        passcode: the passcode to use
    Return:
        Returns a tuple of
    """
    try:
        minio = s3_connect(s3_info)
        _ = minio.list_buckets()
    except MinioException as ex:
        print(f'WARNING: Failed login attempt: {params.url} {params.user}',flush=True)
        print('S3 exception caught:', ex, flush=True)
        return None

    # Get whether the endpoint is setup for SPARCd and if it needs repairs
    needs_repair, _ = S3AdminConnection.needs_repair(s3_info)
    new_instance = not s3u.sparcd_config_exists(minio)

    # Save information into the database - also cleans up old tokens if there's too many
    new_key = uuid.uuid4().hex
    db.reconnect()
    db.add_token(token=new_key,
                 user=params.user,
                 password=crypt.do_encrypt(context.passcode, params.password),
                 client_ip=context.client_ip,
                 user_agent=context.user_agent_hash,
                 s3_url=crypt.do_encrypt(context.passcode, params.url),
                 s3_id=s3_info.id,
                 token_timeout_sec=context.expire_sec)
    user_info = db.get_user(s3_info.id, params.user)
    if not user_info:
        # Get the species
        cur_species = s3u.load_sparcd_config(SPECIES_JSON_FILE_NAME,
                                             s3_info.id+'-'+context.temp_species_filename,
                                             s3_info)
        if cur_species is None:
            cur_species = []

        user_info = db.auto_add_user(s3_info.id, params.user, species=json.dumps(cur_species))

    # Add in the email if we have user settings
    if user_info.settings:
        try:
            cur_settings = json.loads(user_info.settings)
            user_info.settings = cur_settings|{'email':user_info.email}
        except json.JSONDecodeError as ex:
            print('Unable to add email to user settings:', user_info, flush=True)
            print(ex)

    user_info.settings = sdu.secure_user_settings(user_info.settings)

    return LoginResult(new_key=new_key,
                       new_instance=new_instance,
                       needs_repair=needs_repair,
                       user_name=user_info.name,
                       user_settings=user_info.settings
                      )


def handle_login(db: SPARCdDatabase, passcode: str, expire_sec: int,
                                temp_species_filename: str, hash_fn: Callable) -> Optional[dict]:
    """ Handles the user logging in either through a token, or username/password
    Arguments:
        db: the database to use
        passcode: the working passcode
        expire_sec: the number of seconds before a token is considered expired
        temp_species_filename: the name of the temporary species file
        hash_fn: function for hashing a value
    Return:
        A dict of the login results is returned upon success, and None is returned if there's a
        problem with the login information
    """
    client_ip = request.environ.get('HTTP_X_FORWARDED_FOR', request.environ.get('HTTP_ORIGIN', \
                                    request.environ.get('HTTP_REFERER',request.remote_addr) \
                                    ))
    client_user_agent =  request.environ.get('HTTP_USER_AGENT', None)
    if not client_ip or client_ip is None or not client_user_agent or client_user_agent is None:
        return None

    user_agent_hash = hashlib.sha256(client_user_agent.encode('utf-8')).hexdigest()

    params = __get_login_params()

    # If the token is here for checking, and we have session information, see if it's valid
    if params.token is not None:
        # Checking the token for validity
        token_valid, login_info = sdu.token_is_valid(params.token,
                                                     client_ip,
                                                     user_agent_hash,
                                                     db,
                                                     expire_sec
                                                    )
        if token_valid:
            # Everything checks out
            s3_url, _ = s3u.web_to_s3_url(crypt.do_decrypt(passcode,login_info.url),
                                                    lambda x: crypt.do_decrypt(passcode, x))
            return {'success': True,
                    'value': params.token,
                    'name': login_info.name,
                    'settings': \
                        sdu.secure_user_settings(login_info.settings|{'email':login_info.email}),
                     'messageCount': db.message_count(hash_fn(s3_url), login_info.name),
                     'newInstance': False,
                    }

        # Delete the old token from the database
        db.reconnect()
        db.remove_token(params.token)

    # Make sure we have the components we need for logging in
    if not params.url or not params.user or not params.password:
        return None

    # Log onto S3 to make sure the information is correct
    s3_info = s3u.get_s3_info(params.url,
                              params.user,
                              params.password,
                              lambda x: crypt.do_decrypt(passcode, x))

    # Attempt the login
    result = __get_new_login(db,
                             s3_info,
                             params,
                             NewLoginContext(passcode=passcode,
                                             client_ip=client_ip,
                                             user_agent_hash=user_agent_hash,
                                             expire_sec=expire_sec,
                                             temp_species_filename=temp_species_filename
                                            )
                            )

    if not result:
        return None

    return {'success':True,
            'value':result.new_key,
            'name':result.user_name,
            'settings':result.user_settings,
            'newInstance':result.new_instance,
            'needsRepair':result.needs_repair
           }


def handle_species(db: SPARCdDatabase, user_info: UserInfo, s3_info: S3Info,
                                                            temp_species_filename: str) -> tuple:
    """ Handles returning the current species list
    Arguments:
        db: the database instance
        user_info: the user information
        s3_info: the S3 endpoint information
        temp_species_filename: the temporary species filename to use
    Return:
        Returns a tuple containing the loaded species, and a flag indicating if the species
        is already in JSON format (True) or not (False)
    """
    user_species = user_info.species

    # Get the current species to see if we need to update the user's species
    cur_species = s3u.load_sparcd_config(SPECIES_JSON_FILE_NAME,
                                         temp_species_filename,
                                         s3_info
                                        )

    if cur_species:
        keyed_species = {one_species['scientificName']:one_species for one_species in cur_species}
    else:
        keyed_species = {}
    keyed_user = {one_species['scientificName']:one_species for one_species in user_species}

    # Check the easy path first
    updated = False
    if not user_species:
        user_species = cur_species if cur_species else {}
    else:
        # Try to find meaningfull differences
        all_keys = tuple(set(keyed_species.keys())|set(keyed_user.keys()))
        for one_key in all_keys:
            # First check for changes to existing species, else check for and add new species
            if one_key in keyed_species and one_key in keyed_user:
                if not keyed_species[one_key]['name'] == keyed_user[one_key]['name']:
                    keyed_user[one_key]['name'] = keyed_species[one_key]['name']
                    updated = True
                if not keyed_species[one_key]['speciesIconURL'] == \
                                                            keyed_user[one_key]['speciesIconURL']:
                    keyed_user[one_key]['speciesIconURL'] = keyed_species[one_key]['speciesIconURL']
                    updated = True
            elif one_key in keyed_species:
                # New species for this user (not in both sets of species but in downloaed species)
                keyed_user[one_key] = keyed_species[one_key]
                updated = True

    # Save changes if any were made
    if updated is True:
        user_species = [keyed_user[one_key] for one_key in keyed_user]
        species_json = json.dumps(user_species)
        db.save_user_species(s3_info.id, user_info.name, species_json)
        return species_json, True


    return user_species, False


def handle_image(db: SPARCdDatabase, s3_info: S3Info, image: str,
                        image_fetch_timeout_sec: int,
                        passcode: str) -> Optional[tuple]:
    """ Handles return the bytes of an image
    Arguments:
        db: the database instance
        s3_info: the S3 endpoint information
        image: the request parameter with the image information
        image_fetch_timeout_sec: the timeout for getting an image
        passcode: the working passcode
    Return:
        A tuple containing the loaded image in a requests.Response object and the file extension
        upon success. None is returned for each tuple position otherwise
    """

    # Check the rest of the parameters
    try:
        image_req = json.loads(crypt.do_decrypt(passcode, image))
    except json.JSONDecodeError:
        image_req = None, None

    # Check what we have from the requestor
    if not image_req or not isinstance(image_req, dict) or \
                not all(one_key in image_req.keys() for one_key in ('k','p')):
        return None, None

    image_key = image_req['k']
    image_path = image_req['p']

    collection_id, collection_upload = os.path.basename(image_path).split(':')
    if collection_id.startswith(SPARCD_PREFIX):
        collection_id = collection_id[len(SPARCD_PREFIX):]

    # Load the image data
    image_data = sdc.load_image_data(db, s3_info.id, collection_id, collection_upload, image_key)
    if image_data is None or not isinstance(image_data, dict):
        return None, None

    # Get the image data (not to be confused with Flask's request)
    res = requests.get(image_data['s3_url'],
                       timeout=image_fetch_timeout_sec,
                       allow_redirects=False)

    ext = os.path.splitext(image_data['s3_url'])[1].lower().split('?')[0]

    return res, ext


def handle_settings(db: SPARCdDatabase, user_info: UserInfo, s3_info: S3Info,
                                                    new_settings: dict, new_email: str) -> UserInfo:
    """ Applied changes to the settings and save any changes
    Arguments:
        db: the database instance
        user_info: the user information
        s3_info: the S3 endpoint information
        new_settings: the new settings values
        new_email: the new email to set
    Return:
        Returns the updated user information
    """
    # Update any settings that have changed
    modified = False
    new_keys = tuple(new_settings.keys())
    for one_key in new_keys:
        if not one_key in user_info.settings or \
                                        not new_settings[one_key] == user_info.settings[one_key]:
            user_info.settings[one_key] = new_settings[one_key]
            modified = True
    if not new_email == user_info.email:
        user_info.email = new_email
        modified = True

    if modified:
        db.update_user_settings(s3_info.id, user_info.name, json.dumps(user_info.settings),
                                                                                    user_info.email)

    user_info.settings = sdu.secure_user_settings(user_info.settings|{'email':user_info.email})

    return user_info


def handle_settings_admin(user_info: UserInfo, s3_info: S3Info) -> Union[bool, None]:
    """ Implementation for checking if the user is an admin password is ok for settings purposes
    Arguments:
        user_info: the user information
        s3_info: the S3 endpoint information
    Return:
        Returns True if the password checks out, False if there's a problem with the parameters,
        and None if unable to complete the request
    """
    # Get the rest of the request parameters
    pw = request.form.get('value', None)
    if not pw:
        return False

    if not bool(user_info.admin):
        return None

    # Log onto S3 to make sure the information is correct
    try:
        minio = s3_connect(s3_info)
        _ = minio.list_buckets()
    except MinioException as ex:
        print(f'Admin password check failed for {user_info.name}:', ex)
        return None

    return True


def handle_settings_owner(user_info: UserInfo, s3_info: S3Info) -> Union[bool, None]:
    """ Implementation for checking if the user owner password is OK for settings purposes
    Arguments:
        user_info: the user information
        s3_info: the S3 endpoint information
    Return:
        Returns True if the password checks out, False if there's a problem with the parameters,
        and None if unable to complete the request
    """
    # Get the rest of the request parameters
    pw = request.form.get('value', None)
    if not pw:
        return False

    if bool(user_info.admin):
        return None

    # Log onto S3 to make sure the information is correct
    try:
        minio = s3_connect(s3_info)
        _ = minio.list_buckets()
    except MinioException as ex:
        print(f'Owner password check failed for {user_info.name}:', ex)
        return None

    return True


def handle_location_info(s3_info: S3Info) -> dict:
    """ implementation for looking up the location information in the request
    Arguments: 
        s3_info: the S3 endpoint information
    Return:
        Returns the found location information, or the unknown location if not found
    """
    # Check the rest of the request parameters
    loc_id = request.form.get('id')
    loc_name = request.form.get('name')
    loc_lat = request.form.get('lat')
    loc_lon = request.form.get('lon')
    loc_ele = request.form.get('ele')
    try:
        if loc_lat is not None:
            loc_lat = float(loc_lat)
        if loc_lon is not None:
            loc_lon = float(loc_lon)
        if loc_ele is not None:
            loc_ele = float(loc_ele)
    except ValueError:
        return None

    # Check what we have from the requestor
    if not all(item for item in [loc_id, loc_name, loc_lat, loc_lon, loc_ele]):
        return None

    cur_locations = sdlu.load_locations(s3_info)

    for one_loc in cur_locations:
        if one_loc['idProperty'] == loc_id and one_loc['nameProperty'] == loc_name and \
                        one_loc['latProperty'] == loc_lat and one_loc['lngProperty'] == loc_lon and\
                        one_loc['elevationProperty'] == loc_ele:
            return one_loc

    return {'idProperty': loc_id,
            'nameProeprty': 'Unknown',
            'latProperty':0.0,
            'lngProperty':0.0,
            'elevationProperty':0.0,
            'utm_code':DEFAULT_UTM_ZONE,
            'utm_x':0.0,
            'utm_y':0.0
           }


def handle_upload_complete(db: SPARCdDatabase, user_info: UserInfo,
                                                        s3_info: S3Info) -> Union[dict, bool, None]:
    """ Handles when a sandbox upload is complete
    Arguments:
        db: the database instance
        user_info: the user information
        s3_info: the S3 endpoint information
        upload_id: the ID of the upload
    Return:
        A dict for marking an upload complete upon success. False is returned if there is a problem
        with the request parameters. None is returned if the request can't be completed
    """
    # Get the rest of the request parameters
    col_id = request.form.get('collectionId')
    up_key = request.form.get('uploadKey')

    # Check what we have from the requestor
    if not all(item for item in [col_id, up_key]):
        return False

    # Get the collection we need
    all_colls = sdc.load_collections(db, bool(user_info.admin), s3_info)
    if not all_colls:
        return {'success': False,
                'message': "Unable to load collections for marking upload complete"}

    coll = [one_coll for one_coll in all_colls if one_coll["id"] == col_id]
    if not coll:
        return {'success': False,
                'message': 'Unable to find the collection needed to mark upload as completed'}
    coll = coll[0]

    # Find the upload in the collection
    upload = [one_up for one_up in coll['uploads'] if one_up["key"] == up_key]
    if not upload:
        return {'success': False,
                'message': 'Unable to find the incomplete upload in the collections'}
    upload = upload[0]

    # Make sure this user has permissions to do this
    if not bool(user_info.admin) and user_info.name == upload['uploadUser']:
        return None

    # Update the counts of the uploaded images to reflect what's on the server
    S3UploadConnection.upload_recalculate_image_count(s3_info, coll['bucket'], upload['key'])

    # Remove the upload from the database
    db.sandbox_upload_complete_by_info(s3_info.id, user_info.name, coll['bucket'], upload['key'])

    return {'success': True, 'message': 'Successfully marked upload as completed'}
