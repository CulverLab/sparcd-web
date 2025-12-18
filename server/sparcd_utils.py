""" Utility functions for SPARCd server """

from datetime import datetime
import concurrent.futures
import hashlib
import json
import math
import os
import shutil
import tempfile
import time
import traceback
from typing import Callable, Optional
import uuid
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import image_utils
import spd_crypt as crypt
from sparcd_db import SPARCdDatabase
import sparcd_file_utils as sdfu
from s3_access import S3Connection, SPARCD_PREFIX, SPECIES_JSON_FILE_NAME
import s3_utils as s3u
from text_formatters.coordinate_utils import DEFAULT_UTM_ZONE, deg2utm, deg2utm_code

# Temporary collections file timeout length
TIMEOUT_COLLECTIONS_FILE_SEC = 12 * 60 * 60
# Name of temporary collections file
TEMP_COLLECTION_FILE_NAME = SPARCD_PREFIX + 'coll.json'
# Name of temporary species file
TEMP_LOCATIONS_FILE_NAME = SPARCD_PREFIX + 'locations.json'
# Configuration file name for locations
LOCATIONS_JSON_FILE_NAME = 'locations.json'

# Uploads table timeout length
TIMEOUT_UPLOADS_SEC = 3 * 60 * 60

# Allowed movie extensions for upload
UPLOAD_KNOWN_MOVIE_EXT = ['.mp4', '.mov']


def make_boolean(value) -> bool:
    """ Converts the parameter to a boolean value
    Arguments:
        value: The value to convert
    Return:
        Returns the boolean equivalent of the value
    Notes:
        Boolean values are returned as is. Strings that are "true" or "false" are converted
        to their boolean equivalent and returned, regardless of case.  Otherwise, the 
        truthy-ness of the value is returned as defined by Python
    """
    if isinstance(value, bool):
        return value

    if isinstance(value, str):
        if value.lower() == 'true':
            return True
        if value.lower() == 'false':
            return False

    # Default to the truthy-ness of the value
    if value:
        return True

    # Default to a False boolean value
    return False


def secure_email(email: str) -> Optional[str]:
    """ Secures the email address by replacing characters with asterisks while
        retaining legibility
    Arguments:
        email: the email to secure
    Return:
        Returns the secured email. None is returned if the email parameter is None
    """
    if email is None:
        return None

    if '@' in email:
        first_part = email[:email.index('@')]
        second_part = email[email.index('@'):]
    else:
        first_part = email[:max(1,math.floor(len(email) / 2))]
        second_part = email[max(1,math.ceil(len(email) / 2)):]
    match len(first_part):
        case 1:
            pass
        case 2:
            first_part = first_part[:1] + '*'
        case 3:
            first_part = first_part[:2] + '*'
        case 4:
            first_part = first_part[:3] + '*'
        case _:
            first_part = first_part[:3] + '*'*(min(7, len(first_part)-3))

    return first_part + second_part


def secure_user_settings(settings: dict) -> dict:
    """ Secures the user settings information
    Arguments:
        settings: the user settings
    Return:
        The secured user settings
    """
    if isinstance(settings, str):
        cur_settings = json.loads(settings)
    else:
        cur_settings = settings

    if 'email' in cur_settings and cur_settings['email'] and len(cur_settings['email']) > 2:
        cur_settings['email'] = secure_email(cur_settings['email'])

    return cur_settings


def get_later_timestamp(cur_ts: object, new_ts: object) -> Optional[object]:
    """ Returns the later of the two dates
    Arguments:
        cur_ts: the date and time to compare against
        new_ts: the date and time to check if it's later
    Return:
        Returns the later date. If cur_ts is None, then new_ts is returned.
        If new_ts is None, then cur_ts is returned
    """
    # pylint: disable=too-many-return-statements,too-many-branches
    if cur_ts is None:
        return new_ts
    if new_ts is None:
        return cur_ts

    if 'date' in cur_ts and 'date' in new_ts and cur_ts['date'] and new_ts['date']:
        if 'year' in cur_ts['date'] and 'year' in new_ts['date']:
            if int(cur_ts['date']['year']) < int(new_ts['date']['year']):
                return new_ts
        if 'month' in cur_ts['date'] and 'month' in new_ts['date']:
            if int(cur_ts['date']['month']) < int(new_ts['date']['month']):
                return new_ts
        if 'day' in cur_ts['date'] and 'day' in new_ts['date']:
            if int(cur_ts['date']['day']) < int(new_ts['date']['day']):
                return new_ts

    if 'time' in cur_ts and 'time' in new_ts and cur_ts['time'] and new_ts['time']:
        if 'hour' in cur_ts['time'] and 'hour' in new_ts['time']:
            if int(cur_ts['time']['hour']) < int(new_ts['time']['hour']):
                return new_ts
        if 'minute' in cur_ts['time'] and 'minute' in new_ts['time']:
            if int(cur_ts['time']['minute']) < int(new_ts['time']['minute']):
                return new_ts
        if 'second' in cur_ts['time'] and 'second' in new_ts['time']:
            if int(cur_ts['time']['second']) < int(new_ts['time']['second']):
                return new_ts
        if 'nano' in cur_ts['time'] and 'nano' in new_ts['time']:
            if int(cur_ts['time']['nano']) < int(new_ts['time']['nano']):
                return new_ts

    return cur_ts



def cleanup_old_queries(db: SPARCdDatabase, token: str) -> None:
    """ Cleans up old queries off the file system
    Arguments:
        db - connections to the current database
    """
    expired_queries = db.get_clear_queries(token)
    if expired_queries:
        for one_query_path in expired_queries:
            if os.path.exists(one_query_path):
                try:
                    os.unlink(one_query_path)
                # pylint: disable=broad-exception-caught
                except Exception as ex:
                    print(f'Unable to remove old query file: {one_query_path}')
                    print(ex)


def load_locations(s3_url: str, user_name: str, fetch_password: Callable, s3_id: str, \
                                                                    for_admin: bool=False) -> tuple:
    """ Loads locations and converts lat-lon to UTM
    Arguments:
        s3_url - the URL to the S3 instance
        user_name - the user's name for S3
        fetch_password: returns the user's password
        s3_id: ID for the S3 endpoint
        for_admin: when set to True, location details are not obscured
    Return:
        Returns the locations along with the converted coordinates
    """
    cur_locations = s3u.load_sparcd_config(LOCATIONS_JSON_FILE_NAME,
                                                    s3_id+'-'+TEMP_LOCATIONS_FILE_NAME,
                                                    s3_url, user_name, fetch_password)
    if not cur_locations:
        return cur_locations

    # TODO: Store this information somewhere for easy fetching
    for one_loc in cur_locations:
        if 'utm_code' not in one_loc or 'utm_x' not in one_loc or 'utm_y' not in one_loc:
            if 'latProperty' in one_loc and 'lngProperty' in one_loc:
                # Clip the lat-lon location values for non-admin purposes
                if not for_admin:
                    one_loc['latProperty'] = round(float(one_loc['latProperty']), 3)
                    one_loc['lngProperty'] = round(float(one_loc['lngProperty']), 3)
                else:
                    one_loc['latProperty'] = float(one_loc['latProperty'])
                    one_loc['lngProperty'] = float(one_loc['lngProperty'])

                # Calculate the UTM information
                utm_x, utm_y = deg2utm(one_loc['latProperty'], one_loc['lngProperty'])
                one_loc['utm_code'] = ''.join([str(one_res) for one_res in \
                                                    deg2utm_code(float(one_loc['latProperty']), \
                                                                 float(one_loc['lngProperty']))
                                              ])
                one_loc['utm_x'] = int(utm_x)
                one_loc['utm_y'] = int(utm_y)

    return cur_locations


def update_admin_locations(url: str, user: str, password: str, s3_id: str, changes: dict) -> bool:
    """ Updates the master list of locations with the changes under the
        'locations' key
    Arguments:
        url: the URL to the S3 instance
        user: the S3 user name
        password: the S3 password
        s3_id: ID associated with the s3 endpoint
        changes: the list of changes for locations
    Return:
        Returns True unless a problem is found
    """
    # Easy case where there's no changes
    if 'locations' not in changes or not changes['locations']:
        return True

    # Try to get the configuration information from S3
    all_locs = S3Connection.get_configuration(LOCATIONS_JSON_FILE_NAME, url, user, password)
    if all_locs is None:
        return False
    all_locs = json.loads(all_locs)

    all_locs = {crypt.generate_hash((one_loc['idProperty'], one_loc['latProperty'],
                                one_loc['lngProperty']))
                    : one_loc
                for one_loc in all_locs}

    for one_change in changes['locations']:
        loc_id = one_change[changes['loc_id']]
        loc_old_lat = one_change[changes['loc_old_lat']]
        loc_old_lon = one_change[changes['loc_old_lng']]

        # Update the entry if we have it, otherwise add it
        cur_key = crypt.generate_hash((loc_id, loc_old_lat, loc_old_lon))
        if cur_key in all_locs:
            cur_loc = all_locs[cur_key]
            cur_loc['nameProperty'] = one_change[changes['loc_name']]
            cur_loc['latProperty'] = one_change[changes['loc_new_lat']]
            cur_loc['lngProperty'] = one_change[changes['loc_new_lng']]
            cur_loc['elevationProperty'] = one_change[changes['loc_elevation']]
            if 'activeProperty' in cur_loc:
                cur_loc['activeProperty'] = one_change[changes['loc_active']]
            elif one_change[changes['loc_active']] == 1:
                cur_loc['activeProperty'] = True
        else:
            all_locs[cur_key] = {
                                    'idProperty': one_change[changes['loc_id']],
                                    'nameProperty': one_change[changes['loc_name']],
                                    'latProperty': one_change[changes['loc_new_lat']],
                                    'lngProperty': one_change[changes['loc_new_lng']],
                                    'elevationProperty': one_change[changes['loc_elevation']],
                                    'activeProperty': one_change[changes['loc_active']] == 1
                                }

    all_locs = tuple(all_locs.values())

    # Save to S3 and the local file system
    S3Connection.put_configuration(LOCATIONS_JSON_FILE_NAME, json.dumps(all_locs, indent=4),
                                    url, user, password)


    config_file_path = os.path.join(tempfile.gettempdir(), s3_id + '-' + TEMP_LOCATIONS_FILE_NAME)
    sdfu.save_timed_info(config_file_path, all_locs)

    return True


def format_upload_date(date_json: object) -> str:
    """ Returns the date string from an upload's date JSON
    Arguments:
        date_json: the JSON containing the 'date' and 'time' objects
    Returns:
        Returns the formatted date and time, or an empty string if a problem is found
    """
    return_str = ''

    if 'date' in date_json and date_json['date']:
        cur_date = date_json['date']
        if 'year' in cur_date and 'month' in cur_date and 'day' in cur_date:
            return_str += f'{cur_date["year"]:4d}-{cur_date["month"]:02d}-{cur_date["day"]:02d}'

    if 'time' in date_json and date_json['time']:
        cur_time = date_json['time']
        if 'hour' in cur_time and 'minute' in cur_time:
            return_str += f' at {cur_time["hour"]:02d}:{cur_time["minute"]:02d}'

    return return_str


def normalize_upload(upload_entry: dict) -> dict:
    """ Normalizes an S3 upload
    Arguments:
        upload_entry: the upload to normalize
    Return:
        The normalized upload
    """
    return {'name': upload_entry['info']['uploadUser'] + ' on ' + \
                                            format_upload_date(upload_entry['info']['uploadDate']),
            'description': upload_entry['info']['description'],
            'imagesCount': upload_entry['info']['imageCount'],
            'imagesWithSpeciesCount': upload_entry['info']['imagesWithSpecies'],
            'location': upload_entry['location'],
            'edits': upload_entry['info']['editComments'],
            'key': upload_entry['key'],
            'date': upload_entry['info']['uploadDate'],
            'folders': upload_entry['uploaded_folders']
          }


def normalize_collection(coll: dict) -> dict:
    """ Takes a collection from the S3 instance and normalizes the data for the website
    Arguments:
        coll: the collection to normalize
    Return:
        The normalized collection
    """
    cur_col = { 'name': coll['nameProperty'],
                'bucket': coll['bucket'],
                'organization': coll['organizationProperty'],
                'email': coll['contactInfoProperty'],
                'description': coll['descriptionProperty'],
                'id': coll['idProperty'],
                'permissions': coll['permissions'],
                'allPermissions': coll['all_permissions'],
                'uploads': []
              }
    cur_uploads = []
    last_upload_date = None
    for one_upload in coll['uploads']:
        last_upload_date = get_later_timestamp(last_upload_date, \
                                                            one_upload['info']['uploadDate'])
        cur_uploads.append(normalize_upload(one_upload))

    cur_col['uploads'] = cur_uploads
    cur_col['last_upload_ts'] = last_upload_date
    return cur_col


def get_sandbox_collections(url: str, user: str, password: str, items: tuple, \
                                                            all_collections: tuple=None) -> tuple:
    """ Returns the sandbox information as collection information
    Arguments:
        url: the URL to the S3 instance
        user: the S3 user name
        password: the S3 password
        items: the sandbox items as returned by the database
        all_collections: the list of known collections
    Return:
        Returns the sandbox entries in collection format
    """
    coll_uploads = {}
    return_info = []

    # Get information on all the items
    for one_item in items:
        add_collection = False
        cur_upload = None
        s3_upload = False

        bucket = one_item['bucket']
        if bucket not in coll_uploads:
            coll_uploads[bucket] = {'s3_collection':False, 'uploads':[]}

        # Try to see if we've added the collection to the list already
        found = [one_info for one_info in return_info if one_info['bucket'] == bucket]
        if found:
            found = found[0]

            # Try to see if we can find the upload
            if 'uploads' in found:
                found_uploads = [one_upload for one_upload in found['uploads'] \
                                            if one_item['s3_path'].endswith(one_upload['key']) ]
                if len(found_uploads) > 0:
                    cur_upload = found_uploads[0]
        else:
            # Try to find the collection in the list of collections, otherwise fetch it
            add_collection = True
            if all_collections:
                found = [one_col for one_col in all_collections if one_col['bucket'] == bucket]
                if found:
                    # Save the found collection and look for the upload
                    found = found[0]

                    found_uploads = [one_upload for one_upload in found['uploads'] \
                                            if one_item['s3_path'].endswith(one_upload['key']) ]
                    if len(found_uploads) > 0:
                        cur_upload = found_uploads[0]
            else:
                found = S3Connection.get_collection_info(url, user, password, bucket,
                                                                            one_item['s3_path'])
                if found:
                    # Indicate we've downloaded collection from S3 and look for the upload
                    coll_uploads[bucket]['s3_collection'] = True

                    found_uploads = [one_upload for one_upload in found['uploads'] \
                                            if one_item['s3_path'] == one_upload['path'] ]
                    if len(found_uploads) > 0:
                        cur_upload = found['uploads'][0]
                        s3_upload = True

        if not found:
            print(f'ERROR: Unable to find collection bucket {bucket}. Continuing')
            continue

        if cur_upload is None:
            cur_upload = S3Connection.get_upload_info(url, user, password, bucket,
                                                                                one_item['s3_path'])
            if cur_upload is None:
                print(f'ERROR: Unable to retrieve upload for bucket {bucket}: ' \
                                                                f'Path: "{one_item['s3_path']}"')
                continue

            s3_upload = True

        # Check if we need to normalize the upload now
        if s3_upload is True and coll_uploads[bucket]['s3_collection'] is False:
            cur_upload = normalize_upload(cur_upload)
            if 'complete' in one_item:
                cur_upload['uploadCompleted'] = one_item['complete']
            coll_uploads[bucket]['uploads'].append(cur_upload)
        else:
            if 'complete' in one_item:
                cur_upload['uploadCompleted'] = one_item['complete']
            coll_uploads[bucket]['uploads'].append(cur_upload)

        if add_collection is True:
            return_info.append(found)

    # Assign the uploads and normalize any return information that's not done already
    for idx, one_return in enumerate(return_info):
        one_return['uploads'] = coll_uploads[one_return['bucket']]['uploads']
        if coll_uploads[one_return['bucket']]['s3_collection'] is True:
            return_info[idx] = normalize_collection(one_return)

    # Return out result
    return return_info


def get_location_info(location_id: str, all_locations: tuple) -> dict:
    """ Gets the location associated with the ID. Will return a unknown location if ID is not found
    Arguments:
        location_id: the ID of the location to use
        all_locations: the list of available locations
    Return:
        The location information
    """
    our_location = [one_loc for one_loc in all_locations if one_loc['idProperty'] == location_id]
    if our_location:
        our_location = our_location[0]
    else:
        our_location = {'nameProperty':'Unknown', 'idProperty':'unknown',
                                    'latProperty':0.0, 'lngProperty':0.0, 'elevationProperty':0.0,
                                    'utm_code':DEFAULT_UTM_ZONE, 'utm_x':0.0, 'utm_y':0.0}

    return our_location


def token_is_valid(token: str, client_ip: str, user_agent: str, db: SPARCdDatabase, \
                                                                    expire_seconds: int) -> bool:
    """Checks the database for a token and then checks the validity
    Arguments:
        token: the token to check
        client_ip: the client IP to check (use '*' to skip IP check)
        user_agent: the user agent value to check
        db: the database storing the token
        expire_seconds: the session expiration timeout
    Returns:
        Returns True if the token is valid and False if not
    """
    # Get the user information using the token
    db.reconnect()
    login_info, elapsed_sec = db.get_token_user_info(token)
    if login_info is not None and elapsed_sec is not None:
        if login_info.settings:
            login_info.settings = json.loads(login_info.settings)
        if login_info.species:
            login_info.species = json.loads(login_info.species)

        # Is the session still good
        if abs(int(elapsed_sec)) < expire_seconds and \
           client_ip.rstrip('/') in (login_info.client_ip.rstrip('/'), '*') and \
           login_info.user_agent == user_agent:
            # Update to the newest timestamp
            db.update_token_timestamp(token)
            return True, login_info

    return False, None


def update_admin_species(url: str, user: str, password: str, changes: dict) -> Optional[tuple]:
    """ Updates the master list of species with the changes under the
        'species' key
    Arguments:
        url: the URL to the S3 instance
        user: the S3 user name
        password: the S3 password
        changes: the list of changes for species
    Return:
        Returns the tuple of updated species, or None if a problem is found
    """
    # Easy case where there's no changes
    if 'species' not in changes or not changes['species']:
        return True

    # Try to get the configuration information from S3
    all_species = S3Connection.get_configuration(SPECIES_JSON_FILE_NAME, url, user, password)
    if all_species is None:
        return None
    all_species = json.loads(all_species)

    all_species = {one_species['scientificName']: one_species for one_species in all_species}

    for one_change in changes['species']:

        # Update the entry if we have it, otherwise add it
        cur_key = one_change[changes['sp_old_scientific']]
        if cur_key in all_species:
            cur_species = all_species[cur_key]
            cur_species['name'] = one_change[changes['sp_name']]
            cur_species['scientificName'] = one_change[changes['sp_new_scientific']]
            cur_species['speciesIconURL'] = one_change[changes['sp_icon_url']]
            cur_species['keyBinding'] = one_change[changes['sp_keybind']] if \
                                                        one_change[changes['sp_keybind']] else None
        else:
            all_species[cur_key] = {
                                    'name': one_change[changes['sp_name']],
                                    'scientificName': one_change[changes['sp_new_scientific']],
                                    'speciesIconURL': one_change[changes['sp_icon_url']],
                                    'keyBinding': one_change[changes['sp_keybind']],
                                }

    all_species = tuple(all_species.values())

    return all_species


def process_upload_changes(s3_url: str, username: str, fetch_password: Callable, \
                            collection_id: str, upload_name: str,  species_timed_file: str, \
                            change_locations: tuple=None, files_info: tuple=None) -> tuple:
    """ Updates the image files with the information passed in
    Argument:
        s3_url: the URL to the S3 endpoint (in clear text)
        username: the name of the user associated with the token
        fetch_password: returns the user password
        collection_id: the ID of the collection the files are in
        upload_name: the name of the upload
        species_timed_file: the name of the timed file to load species from
        change_locations: the location information for all the images in an upload
        files_info: the file species changes
    Return:
        Returns a tuple of files that did not update. If a location is specified, this list
        can include files not found in the original list
    Notes:
        If the location information doesn't have a location ID then only the files are processed.
        If the location does have a location ID then all the files in the location are processed,
        including the ones passed in
    """
    success_files = []
    failed_files = []

    # Make a dict of the files passed in for easier lookup
    if files_info:
        file_info_dict = {one_file['name']+one_file['s3_path']+one_file['bucket']: one_file \
                                                                        for one_file in files_info}
    else:
        file_info_dict = {}

    # Get the list of files to update
    update_files = files_info if not change_locations else \
                        S3Connection.get_image_paths(s3_url, username, fetch_password(), \
                                                                        collection_id, upload_name)

    edit_folder = tempfile.mkdtemp(prefix=SPARCD_PREFIX + 'edits_' + uuid.uuid4().hex)

    try: # We have this "try" for the "finally" clause to remove the temporary folder
        # All species and locations in case we have to look something up
        cur_species = s3u.load_sparcd_config(SPECIES_JSON_FILE_NAME, species_timed_file, \
                                                        s3_url, username, fetch_password)

        # Loop through the files
        for idx, one_file in enumerate(update_files):
            file_ext = os.path.splitext(one_file['s3_path'])[1].lower()
            temp_file_name = ("-"+str(idx)).join(os.path.splitext(\
                                                            os.path.basename(one_file['s3_path'])))
            save_path = os.path.join(edit_folder, temp_file_name)

            file_key = one_file['name']+one_file['s3_path']+one_file['bucket']
            file_edits = file_info_dict[file_key] if file_key in file_info_dict else None

            # Only manipulate the image if there appears to be some reason for downloading it
            if not file_edits and not change_locations:
                success_files.append(one_file)
                continue

            # Get the image to work with
            if file_ext not in UPLOAD_KNOWN_MOVIE_EXT:
                S3Connection.download_image(s3_url, username, fetch_password(), one_file['bucket'],
                                                                    one_file['s3_path'], save_path)
                cur_species, cur_location, _ = image_utils.get_embedded_image_info(save_path)
                if cur_species is None:
                    cur_species = []
                if cur_location is None:
                    cur_location = []
            else:
                cur_species, cur_location = ([], [])

            # Species: get the current species and add our changes to that before writing them out
            save_species = None

            if file_edits:
                for new_species in file_edits['species']:
                    found = False
                    changed = False
                    for orig_species in cur_species:
                        if orig_species['scientific'] == new_species['scientific']:
                            if orig_species['common'] != new_species['common']:
                                orig_species['common'] = new_species['common']
                                changed = True
                            if orig_species['count'] != new_species['count']:
                                orig_species['count'] = new_species['count']
                                changed = True
                            found = True
                            break

                    if not found:
                        cur_species.append({'common': new_species['common'], \
                                             'scientific': new_species['scientific'], \
                                             'count': new_species['count']})
                        changed = True

                if changed:
                    save_species = cur_species

                # Get rid of species that have a count of zero
                save_species = [one_species for one_species in save_species \
                                                                if int(one_species['count']) > 0]

            # Location: if the location is different from what's in the file, write the data out
            save_location = None
            if change_locations and \
                        (cur_location is None or change_locations['loc_id'] != cur_location['id']):
                save_location = change_locations

            # Check if we have any changes
            if save_species or save_location:
                # Update the image file if it's not a movie file and uplooad
                if file_ext not in UPLOAD_KNOWN_MOVIE_EXT:
                    if image_utils.update_image_file_exif(save_path,
                                loc_id = save_location['loc_id'] if save_location else None,
                                loc_name = save_location['loc_name'] if save_location else None,
                                loc_ele = save_location['loc_ele'] if save_location else None,
                                loc_lat = save_location['loc_lat'] if save_location else None,
                                loc_lon = save_location['loc_lon'] if save_location else None,
                                species_data = save_species):
                        # Put the file back onto S3
                        S3Connection.upload_file(s3_url, username, fetch_password(),
                                                    one_file['bucket'], one_file['s3_path'],
                                                    save_path)

                        # Register this file as a success
                        success_files.append(one_file)
                    else:
                        # File did not update
                        failed_files.append(file_info_dict[file_key] if file_key in file_info_dict \
                                                else one_file|{'species': []})
                else:
                    # Register this movie file as a success
                    success_files.append(one_file)
            else:
                # Register this file as a success
                success_files.append(one_file)

            # Perform some cleanup
            for one_path in [save_path+"_original", save_path]:
                if one_path and os.path.exists(one_path):
                    os.unlink(one_path)
    finally:
        # Remove the downloading folder
        shutil.rmtree(edit_folder)
        pass

    return success_files, failed_files


def token_user_valid(db: SPARCdDatabase, request, token, session_expire_sec: int) -> tuple:
    """ Checks that the token and user are valid
    Arguments:
        db: the database to access
        request: the incoming request environment
        session_expire_sec: the number of seconds before the session is considered expired
    Return:
        Returns a tuple with the first boolean value indicating if the token is valid, and the
        second value containing the loaded user information. None is returned for each of these
        values if there is an issue
    """
    if not db or not request or not token or not session_expire_sec:
        return None, None

    # Get the client IP and check against the user agent information to ensure the IP is well
    # formed
    client_ip = request.environ.get('HTTP_X_FORWARDED_FOR', request.environ.get('HTTP_ORIGIN', \
                                    request.environ.get('HTTP_REFERER',request.remote_addr) \
                                    ))
    client_user_agent =  request.environ.get('HTTP_USER_AGENT', None)
    if not client_ip or client_ip is None or not client_user_agent or client_user_agent is None:
        return None, None

    user_agent_hash = hashlib.sha256(client_user_agent.encode('utf-8')).hexdigest()
    return token_is_valid(token, client_ip, user_agent_hash, db, session_expire_sec)


def get_ts_offset(tz_offset: str) -> int:
    """ Converts a timezone offset or name to a numeric value. If the passed in parameter can't
        be converted, the local offset is used
    Arguments:
        tz_offset: the number offset of the timezone in hours, or the timezone name
        (eg: "America/Phoenix")
    """
    # Normalize our timestamp
    if tz_offset is not None:
        try:
            tz_offset = int(tz_offset)
        except ValueError:
            pass
        # Convert string to numeric offset
        if not isinstance(tz_offset, int):
            try:
                # We use an arbitrary date and time since we just want the offset
                tz_offset = datetime(2025, 10, 9, 0, 0, 0, 0, ZoneInfo(tz_offset)).strftime('%z')
                tz_offset = int(tz_offset) / 100.0
            except (ZoneInfoNotFoundError, ValueError):
                # Unknown timezone name specified or bad return
                tz_offset = None

    # Get local timezone offset (from zeconds to hours) if we don't have anything else
    if tz_offset is None:
        tz_offset = time.localtime().tm_gmtoff / (60.0*60.0)

    return tz_offset


def list_uploads_thread(s3_url: str, user_name: str, user_secret: str, bucket: str) -> object:
    """ Used to load upload information from an S3 instance
    Arguments:
        s3_url - the URL to connect to
        user_name - the name of the user to connect with
        user_secret - the secret used to connect
        bucket - the bucket to look in
    Return:
        Returns an object with the loaded uploads
    """
    uploads_info = S3Connection.list_uploads(s3_url, \
                                        user_name, \
                                        user_secret, \
                                        bucket)

    return {'bucket': bucket, 'uploads_info': uploads_info}


def species_stats(db: SPARCdDatabase, colls: tuple, s3_id: str, s3_url: str, user_name: str, \
                                                    fetch_password: Callable) -> Optional[dict]:
    """ Filters the collections in an efficient manner
    Arguments:
        db - connections to the current database
        colls - the list of collections
        s3_id - the ID of the S3 instance
        s3_url - the URL to the S3 instance
        user_name - the user's name for S3
        fetch_password - returns the user's password
    Returns:
        Returns the species stats
    """
    all_results = []
    s3_uploads = []

    # Load all the DB data first
    for one_coll in colls:
        cur_bucket = one_coll['bucket']
        uploads_info = db.get_uploads(s3_id, cur_bucket, TIMEOUT_UPLOADS_SEC)
        if uploads_info is not None and uploads_info:
            uploads_info = [{'bucket':cur_bucket,       \
                             'name':one_upload['name'],                     \
                             'info':json.loads(one_upload['json'])}         \
                                    for one_upload in uploads_info]
        else:
            s3_uploads.append(cur_bucket)
            continue

        # Accumulate the uploads we have
        if len(uploads_info) > 0:
            all_results = all_results + uploads_info

    # Load the S3 uploads in an aynchronous fashion
    if len(s3_uploads) > 0:
        user_secret = fetch_password()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            cur_futures = {executor.submit(list_uploads_thread, s3_url, user_name, \
                                                                        user_secret, cur_bucket):
                            cur_bucket for cur_bucket in s3_uploads}

            for future in concurrent.futures.as_completed(cur_futures):
                try:
                    uploads_results = future.result()
                    if 'uploads_info' in uploads_results and \
                                                        len(uploads_results['uploads_info']) > 0:
                        uploads_info = [{'bucket':uploads_results['bucket'],
                                         'name':one_upload['name'],
                                         'info':one_upload,
                                         'json':json.dumps(one_upload)
                                        } for one_upload in uploads_results['uploads_info']]
                        db.save_uploads(s3_id, uploads_results['bucket'][len(SPARCD_PREFIX):],
                                                                                    uploads_info)

                        # Accumulate the uploads we have
                        if len(uploads_info) > 0:
                            all_results = all_results + uploads_info

                # pylint: disable=broad-exception-caught
                except Exception as ex:
                    print(f'Generated exception: {ex}', flush=True)
                    traceback.print_exception(ex)

    # Build up the species count
    ret_stats = {}
    for one_result in all_results:
        if 'info' in one_result and 'images' in one_result['info']:
            for one_image in one_result['info']['images']:
                if 'species' in one_image:
                    for one_species in one_image['species']:
                        species_name = one_species['name']
                        if species_name:
                            species_name = species_name.strip()
                            if species_name in ret_stats:
                                ret_stats[species_name] += 1
                            else:
                                ret_stats[species_name] = 1

    return ret_stats
