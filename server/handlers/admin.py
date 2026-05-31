""" Functions to handle requests starting with /image for SPARCd server """

from dataclasses import dataclass
import json
from typing import Optional, Union

import sparcd_collections as sdc
from sparcd_db import SPARCdDatabase
from spd_types.userinfo import UserInfo
from spd_types.s3info import S3Info
import sparcd_utils as sdu
import sparcd_location_utils as sdlu
import sparcd_upload_utils as sdupu
from s3.s3_access_helpers import (make_s3_path, COLLECTIONS_FOLDER, LOCATIONS_JSON_FILE_NAME,
                                    SPARCD_PREFIX, SPECIES_JSON_FILE_NAME, S3_UPLOADS_PATH_PART)
from s3.s3_admin import S3AdminConnection
from s3.s3_collections import S3CollectionConnection
import s3_utils as s3u
from text_formatters.coordinate_utils import deg2utm, deg2utm_code, utm2deg


# Convertion factor of feet to metes
FEET_TO_METERS = 0.3048000097536



@dataclass
class LocationUtmInfo:
    """ Internal class which contains the UTM coordinate information for a location request """
    utm_zone: Optional[str]
    utm_letter: Optional[str]
    utm_x: Optional[str]
    utm_y: Optional[str]


@dataclass
class LocationCoordInfo:
    """ Internal class which contains the coordinate information for a location request """
    coordinate: Optional[str]
    new_lat: Optional[str]
    new_lng: Optional[str]
    old_lat: Optional[str]
    old_lng: Optional[str]
    utm: LocationUtmInfo


@dataclass
class LocationEditParams:
    """ Internal class which contains the parameters for a location edit request """
    loc_id: Optional[str]
    loc_name: Optional[str]
    loc_active: Optional[str]
    measure: Optional[str]
    loc_ele: Optional[str]
    description: Optional[str]
    coords: LocationCoordInfo


@dataclass
class CollectionEditParams:
    """ Internal class which contains the parameters for a collection edit request """
    col_id: str
    col_name: str
    col_desc: str
    col_email: str
    col_org: str
    col_all_perms: str


@dataclass
class CollectionAddParams:
    """ Internal class which contains the parameters for a collection add request """
    col_name: str
    col_desc: str
    col_email: str
    col_org: str
    col_all_perms: str


@dataclass
class SpeciesUpdateParams:
    """ Parameter class for updating species information """
    new_name: str
    old_scientific: str
    new_scientific: str
    key_binding: str
    icon_url: str


@dataclass
class UploadMoveParams:
    """ Parameter class for moving uploads """
    src_coll_id: str
    upload_key:  str
    dst_coll_id: str


@dataclass
class UserUpdateParams:
    """ Paramter class for updating user information """
    old_name: str
    new_email: str
    admin: bool



def __authorized_move_collection(check_coll: dict, name: str, admin: bool, upload_id: str,
                                                            check_has_upload: bool=True) -> bool:
    """ Checks if the user is authorized to move an upload to or from this collection
    Arguments:
        check_coll: the collection to check
        name: the user name to check for
        admin: when True the user doesn't need explicit permission
        upload_id: the ID of the upload that needs to be in the check collection
        check_has_upload: when True will check if upload is in the collection. False causes this
                        check to be skipped
    Return:
        Returns True if the user is authorized to change this collection and, if check_has_upload
        is set to True, the upload is contained in the collection. False is returned if the user
        is not authorized, and, if check_has_upload is set to True, the upload is contained in 
        the collection.
    """
    # Make sure we have permissions to search through
    if not check_coll.get('permissions') and not check_coll.get('allPermissions'):
        return False

    # Check for permissions
    auth = False
    all_perms = (check_coll['permissions'],) \
                        if 'permissions' in check_coll and check_coll['permissions'] \
                                                                else check_coll['allPermissions']
    for perm in all_perms:
        if perm['usernameProperty'] == name:
            if perm['ownerProperty'] or perm['uploadProperty']:
                auth = True
                break

    # If we don't have permission and we're not an administrator
    if not auth and not admin:
        return False

    # They have permission and we don't care if the upload is in the collection
    if check_has_upload is False:
        return True

    # Check that the upload is contained in the collection
    for upload in check_coll['uploads']:
        if upload['key'] == upload_id:
            return True

    return False


def __check_location_edit_params(params: LocationEditParams) -> bool:
    """ Checks the parameters for the needed consistency
    Arguments:
        params: the Parameters to check
    Return:
        Returns True if the parameters are consistent and False if not
    """
    # Check what we have from the requestor
    if not all(item for item in [params.loc_name, params.loc_id, params.loc_active, \
                                                        params.measure, params.coords.coordinate]):
        return False
    if params.measure not in ['feet', 'meters'] or \
                                                params.coords.coordinate not in ['UTM', 'LATLON']:
        return False
    if params.coords.coordinate == 'UTM' and \
            not all(item for item in [params.coords.utm.utm_zone, params.coords.utm.utm_letter, \
                                                params.coords.utm.utm_x, params.coords.utm.utm_y]):
        return False
    if not all(item for item in [params.coords.new_lat, params.coords.new_lng]):
        return False
    if params.loc_ele is None:
        return False

    return True


def __get_authorized_collection(collections: tuple, user_info: UserInfo, collection_id: str,
                                    upload_id: str, check_has_upload: bool=True) -> Optional[dict]:
    """ Returns a collection that's authorized to move for the user
    Arguments:
        collections: the collections to iterater through
        user_inf: information on the used that made the request
        collection_id: the ID of the collection of interest
        upload_id: the ID of the upload to search for
        check_had_upload: set to True to have the upload looked for in the collection
    Return:
    """
    check_coll = [one_coll for one_coll in collections if one_coll['id'] == collection_id]
    if not check_coll:
        return None

    check_coll = check_coll[0]

    # Check user permissions level
    if not __authorized_move_collection(check_coll, user_info.name, user_info.admin,
                                                                    upload_id, check_has_upload):
        return None

    return check_coll


def __handle_move_upload_result(db: SPARCdDatabase, s3_id: str, user: str,
                                                            params: UploadMoveParams, res) -> dict:
    """ Handles the result of copying an upload
    Arguments:
        db: the working database
        s3_id: the ID of the S3 instance
        user: the name of the user performing the move
        params: the move request parameters
        res: the result of the move
    Return:
        Returns the result of the move to be sent to the client
    """

    if res is None:
        message = 'An unknown server error ocurred while attempting to copy the upload'
        client_result = {'success': False,  'message': message}
    elif isinstance(res, str):
        message = res
        client_result = {'success': False, 'message': res}
    else:
        message = f'The move of {params.upload_key} completed successfully'
        client_result = {'success': True }

    mail_message = f'Source collection: {params.src_coll_id}\n' \
                        f'Upload: {params.upload_key}\n' \
                        f'Destination: {params.dst_coll_id}\n\n' + \
                        message

    db.message_add(s3_id,
                    user,
                    user,
                    'Move upload {params.upload_key} results', 
                    mail_message,
                    "normal")

    return client_result


def __make_dest_path_func(start_path_len: int, dest_path: str):
    """ Returns a function that maps a source path to its destination path
    Arguments:
        start_path_len: the length of the source starting path
        dest_path: the destination base path
    Return:
        Returns a function that maps source paths to destination paths
    """
    def _map(src_path: str) -> str:
        path_particle = src_path[start_path_len:]
        if path_particle.startswith('/'):
            path_particle = path_particle[1:]
        return make_s3_path((dest_path, path_particle))
    return _map


def __update_move_collections(db: SPARCdDatabase, s3_info: S3Info,
                               src_coll: dict, dst_coll: Union[dict, None]) -> None:
    """ Updates the collection entries in the database after a move
    Arguments:
        db: the database instance
        s3_info: the S3 endpoint information
        src_coll: the source collection
        dst_coll: the destination collection, or None if destination is a raw bucket
    """
    buckets = filter(None, [src_coll['bucket'],
                             dst_coll.get('bucket') if isinstance(dst_coll, dict) else None])
    for bucket in buckets:
        updated_collection = S3CollectionConnection.get_collection_info(s3_info, bucket)
        if updated_collection:
            updated_collection = sdupu.normalize_collection(updated_collection)
            sdc.collection_update(db, s3_info.id, updated_collection)


def location_update_params_check(params: LocationEditParams) -> Optional[LocationEditParams]:
    """ Validates the request parameters for a location update request
    Arguments:
        params: the location edit parameters
    Return:
        Returns the request parameters in LocationEditParams when valid. None is returned otherwise
    """
    if not __check_location_edit_params(params):
        return None

    # Change data to a format we can use (also used to check what we've received)
    try:
        params.loc_ele = float(params.loc_ele)
        if params.coords.new_lat:
            params.coords.new_lat = float(params.coords.new_lat)
        if params.coords.new_lng:
            params.coords.new_lng = float(params.coords.new_lng)
        if params.coords.old_lat:
            params.coords.old_lat = float(params.coords.old_lat)
        if params.coords.old_lng:
            params.coords.old_lng = float(params.coords.old_lng)
    except ValueError:
        return None

    if params.loc_active is not None:
        if isinstance(params.loc_active, str):
            params.loc_active = params.loc_active.upper() == 'TRUE'
        else:
            params.loc_active = bool(params.loc_active)
    else:
        params.loc_active = None

    return params


def handle_admin_collection_details(db: SPARCdDatabase, user_info: UserInfo, s3_info: S3Info,
                                bucket: str, is_admin: bool=True) -> Union[dict,bool, None]:
    """ Implementation for getting collection details
    Arguments:
        db: the database instance
        user_info: the user information
        s3_info: the S3 endpoint information
        bucket: the bucket of interes
        is_admin: True if the user is an administrator and False if not
    Return:
        Returns the loaded collection data upon success. Returns False if there's a problem with
        the request paramters. None is returned if the collection can't be found and the user is
        an administrator, otherwise False is returned if the collection can't be found
    """
    # Get the collection information
    collection = None

    return_colls = sdc.load_collections(db, is_admin, s3_info)
    if return_colls:
        found_colls = [one_coll for one_coll in return_colls if one_coll['bucket'] == bucket]
        if found_colls:
            collection = found_colls[0]

    if not collection:
        collection = S3CollectionConnection.get_collection_info(s3_info, bucket)
        if collection:
            collection = sdupu.normalize_collection(collection)

    if not collection:
        return None if is_admin else False

    # If we're not an admin, we need to have collection level permissions
    if not is_admin:
        if not collection['permissions']['usernameProperty'] == user_info.name or not \
                                                collection['permissions']['ownerProperty'] is True:
            return False


    return collection


def handle_admin_location_details(s3_info: S3Info, loc_id: str) -> Union[dict,bool, None]:
    """ Implementation for getting location details for administrators
    Arguments:
        s3_info: the S3 endpoint information
        loc_id: the location ID of interest
    Return:
        Returns the location information identified in the request upon success. False
        is returned if there is a problem with the request parameterss. None is returned
        if the location can't be found
    """
    # Get the location information
    location = None

    cur_locations = sdlu.load_locations(s3_info, True)

    if cur_locations:
        found_locs = [one_loc for one_loc in cur_locations if one_loc['idProperty'] == loc_id]
        if found_locs:
            location = found_locs[0]

    return location


def handle_admin_users(db:SPARCdDatabase, user_info: UserInfo,
                                                        s3_info: S3Info) -> Union[tuple,bool, None]:
    """ Implementation of getting user details when an administrator
    Arguments:
        db: the database instance
        user_info: the user information
        s3_info: the S3 endpoint information
    Return:
        Returns a tuple of the user details when successful. False is returned if there was a
        problem with the request parameters. None is returned if the request couldn't be
        completed
    """
    is_admin = bool(user_info.admin)

    # Make sure this user is an admin
    if not is_admin:
        return False

    # Get the users and fill in the collection information
    all_users = db.get_admin_edit_users(s3_info.id)

    if not all_users:
        return []

    # Organize the collection permissions by user
    all_collections = sdc.load_collections(db, is_admin, s3_info)
    user_collections = {}
    if all_collections:
        for one_coll in all_collections:
            if 'allPermissions' in one_coll and one_coll['allPermissions'] is not None:
                for one_perm in one_coll['allPermissions']:
                    if one_perm['usernameProperty'] not in user_collections:
                        user_collections[one_perm['usernameProperty']] = []
                    user_collections[one_perm['usernameProperty']].append({
                        'name':one_coll['name'],
                        'id':one_coll['id'],
                        'owner':one_perm['ownerProperty'] if 'ownerProperty' in \
                                                                        one_perm else False,
                        'read':one_perm['readProperty'] if 'readProperty' in \
                                                                        one_perm else False,
                        'write':one_perm['uploadProperty'] if 'uploadProperty' in \
                                                                        one_perm else False,
                        })

    # Put it all together
    return_users = []
    for one_user in all_users:
        return_users.append({'name': one_user[0], 'email': sdu.secure_email(one_user[1]), \
                         'admin': one_user[2] == 1, 'autoAdded': one_user[3] == 1,
                         'collections': user_collections[one_user[0]] if \
                                    user_collections and one_user[0] in user_collections else []})

    return return_users


def handle_admin_species(user_info: UserInfo,
                            s3_info: S3Info, species_temp_filename: str) -> Union[tuple,bool, None]:
    """ Implementation of getting species details when an administrator
    Arguments:
        db: the database instance
        user_info: the user information
        s3_info: the S3 endpoint information
        species_temp_filename: the temporary filename used to store species information
    Return:
        Returns a tuple of the species details when successful. False is returned if there was a
        problem with the request parameters. None is returned if the request couldn't be
        completed
    """
    is_admin = bool(user_info.admin)

    # Make sure this user is an admin
    if not is_admin:
        return None

    cur_species = s3u.load_sparcd_config(SPECIES_JSON_FILE_NAME,
                                         species_temp_filename,
                                         s3_info)

    return cur_species


def handle_user_update(db:SPARCdDatabase, s3_info: S3Info,
                                                params: UserUpdateParams) -> Union[dict,bool, None]:
    """ Implementation of updating user details when an administrator
    Arguments:
        db: the database instance
        user_info: the user information
        s3_info: the S3 endpoint information
        params: the user update paramters
    Return:
        Returns a status dict when successful. False is returned if there was
        a problem with the request parameters. None is returned if the request couldn't be
        completed
    """
    old_user_info = db.get_user(s3_info.id, params.old_name)
    if old_user_info is None:
        return {'success': False, 'message': f'User "{params.old_name}" not found'}

    db.update_user(s3_info.id, params.old_name, params.new_email, params.admin)

    return {'success': True, 'message': f'Successfully updated user "{params.old_name}"', \
            'email': sdu.secure_email(params.new_email)}


def handle_species_update(db:SPARCdDatabase, user_info: UserInfo, s3_info: S3Info,
                            species_temp_filename: str,
                            params: SpeciesUpdateParams) -> Union[tuple,bool, None]:
    """ Implementation of updating species details when an administrator
    Arguments:
        db: the database instance
        user_info: the user information
        s3_info: the S3 endpoint information
        species_temp_filename: the temporary filename used to store species information
        params: the parameters for updating a species
    Return:
        Returns a status dict when successful. False is returned if there was
        a problem with the request parameters. None is returned if the request couldn't be
        completed
    """
    # Get the species
    cur_species = s3u.load_sparcd_config(SPECIES_JSON_FILE_NAME,
                                            species_temp_filename,
                                            s3_info)

    # Make sure this is OK to do
    find_scientific = params.old_scientific if params.old_scientific else params.new_scientific
    found_match = [one_species for one_species in cur_species if \
                                                one_species['scientificName'] == find_scientific]

    # If we're replacing, we should have found the entry
    if params.old_scientific is not None and (not found_match or len(found_match) <= 0):
        return {'success': False, 'message': f'Species "{params.old_scientific}" not found'}
    # If we're not replaceing, we should NOT find the entry
    if params.old_scientific is None and (found_match and len(found_match) > 0):
        return {'success': False, 'message': f'Species "{params.new_scientific}" already exists'}

    # Put the change in the DB
    if db.update_species(s3_info.id,user_info.name, params.old_scientific, params.new_scientific,
                                            params.new_name, params.key_binding, params.icon_url):
        return {'success': True, 'message': f'Successfully updated species "{find_scientific}"'}

    return {'success': False, \
                'message': f'A problem ocurred while updating species "{find_scientific}"'}


def handle_location_update(db:SPARCdDatabase, user_info: UserInfo, s3_info: S3Info,
                                            params: LocationEditParams) -> Union[tuple,bool, None]:
    """ Implementation of updating species details when an administrator
    Arguments:
        db: the database instance
        user_info: the user information
        s3_info: the S3 endpoint information
        params: the location editing parameters
    Return:
        Returns a status dict when successful. False is returned if there was
        a problem with the request parameters. None is returned if the request couldn't be
        completed
    """
    # Get the locations to work with
    cur_locations = sdlu.load_locations(s3_info, True)

    # Make sure this is OK to do by finding the location
    if params.coords.old_lat and params.coords.old_lng:
        found_match = [one_location for one_location in cur_locations if \
                            one_location['idProperty'] == params.loc_id and
                            float(one_location['latProperty']) == float(params.coords.old_lat) and
                            float(one_location['lngProperty']) == float(params.coords.old_lng)]

        # If we're replacing, we should have found the entry
        if not found_match or len(found_match) <= 0:
            return {'success': False, 'message': f'Location {params.loc_id} not found ' \
                        f'with Lat/Lon {params.coords.old_lat}, {params.coords.old_lng}'}
    else:
        found_match = [one_location for one_location in cur_locations if \
                            one_location['idProperty'] == params.loc_id and
                            float(one_location['latProperty']) == float(params.coords.new_lat) and
                            float(one_location['lngProperty']) == float(params.coords.new_lng)]

        # If we're not replacing, we should NOT find the entry
        if found_match and len(found_match) > 0:
            return {'success': False, 'message': f'Location {params.loc_id} already exists with ' \
                        f'Lat/Lon {params.coords.new_lat}, {params.coords.new_lng}'}

    # Convert elevation to meters if needed
    if params.measure.lower() == 'feet':
        params.loc_ele = round((params.loc_ele * FEET_TO_METERS) * 100) / 100

    # Convert UTM to Lat/Lon if needed
    if params.coords.coordinate == 'UTM':
        params.coords.new_lat, params.coords.new_lng = \
                                    utm2deg(float(params.coords.utm.utm_x),
                                            float(params.coords.utm.utm_y),
                                            params.coords.utm.utm_zone,
                                            params.coords.utm.utm_letter)
        utm_code = params.coords.utm.utm_zone+params.coords.utm.utm_letter
    else:
        params.coords.utm.utm_x, params.coords.utm.utm_y = \
                                            deg2utm(float(params.coords.new_lat),
                                                    float(params.coords.new_lng))
        utm_code = ''.join([str(one_item) for one_item in \
                                    deg2utm_code(float(params.coords.new_lat),
                                                 float(params.coords.new_lng))
                            ])

    # Put the change in the DB
    if db.update_location(s3_info.id,
                          user_info.name,
                          params.loc_name,
                          params.loc_id,
                          params.loc_active,
                          params.loc_ele,
                          params.coords.old_lat,
                          params.coords.old_lng,
                          params.coords.new_lat,
                          params.coords.new_lng,
                          params.description):

        return_lat = round(float(params.coords.new_lat), 3)
        return_lng = round(float(params.coords.new_lng), 3)
        return_utm_x, return_utm_y = deg2utm(return_lat, return_lng)
        return {'success': True, 'message': f'Successfully updated location {params.loc_name}',
                'data':{'nameProperty': params.loc_name, 'idProperty': params.loc_id, \
                        'elevationProperty': params.loc_ele, 'activeProperty': params.loc_active, \
                        'latProperty': return_lat, 'lngProperty': return_lng, \
                        'utm_code': utm_code, 'utm_x': int(return_utm_x), 'utm_y': int(return_utm_y)
                        }
                }

    return {'success': False, \
                'message': f'A problem ocurred while updating location {params.loc_name}'}


def handle_collection_update(db:SPARCdDatabase, user_info: UserInfo, s3_info: S3Info,
                                        params: CollectionEditParams,
                                        must_be_admin: bool=True) -> Union[tuple,bool, None]:
    """ Implementation of updating collection details when an administrator
    Arguments:
        db: the database instance
        user_info: the user information
        s3_info: the S3 endpoint information
        params: the collection update parameters
        must_be_admin: set to False if the user shouldn't be an admin
    Return:
        Returns a status dict when successful. False is returned if there was
        a problem with the request parameters. None is returned if the request couldn't be
        completed
    """
    is_admin = bool(user_info.admin)
    s3_bucket = SPARCD_PREFIX + params.col_id
    all_collections = sdc.load_collections(db, is_admin, s3_info)

    # Update the entry to what we need
    found_coll = None
    for one_coll in all_collections:
        if one_coll['id'] == params.col_id:
            one_coll['name'] = params.col_name
            one_coll['description'] = params.col_desc
            one_coll['email'] = params.col_email
            one_coll['organization'] = params.col_org
            found_coll = one_coll
            break

    if found_coll is None:
        return {'success': False, 'message': "Unable to find collection in list to update"}

    # Check that the caller has permission to modify
    if not must_be_admin:
        if not found_coll['permissions']['usernameProperty'] == user_info.name or not \
                                                found_coll['permissions']['ownerProperty'] is True:
            return None

    # Upload the changes
    S3AdminConnection.save_collection_info(s3_info, found_coll['bucket'], found_coll)

    S3AdminConnection.save_collection_permissions(s3_info, found_coll['bucket'],
                                                                            params.col_all_perms)

    # Update the collection to reflect the changes
    updated_collection = S3CollectionConnection.get_collection_info(s3_info, s3_bucket)
    if updated_collection:
        updated_collection = sdupu.normalize_collection(updated_collection)

        # Update the collection entry in the database
        sdc.collection_update(db, s3_info.id, updated_collection)

    return {'success':True, 'data': updated_collection, \
            'message': "Successfully updated the collection"}


def handle_collection_add(db:SPARCdDatabase, user_info: UserInfo, s3_info: S3Info,
                                            params:CollectionAddParams) -> Union[tuple,bool, None]:
    """ Implementation of adding a collection when an administrator
    Arguments:
        db: the database instance
        user_info: the user information
        s3_info: the S3 endpoint information
        params: the parameters for this call
    Return:
        Returns a status dict when successful. False is returned if there was
        a problem with the request parameters. None is returned if the request couldn't be
        completed
    """
    if params.col_desc is None:
        params.col_desc = ''
    if params.col_email is None:
        params.col_email = ''
    if params.col_org is None:
        params.col_org = ''

    try:
        col_all_perms = json.loads(params.col_all_perms)
    except json.JSONDecodeError as ex:
        print('Unable to convert permissions for collection update: ' \
                                                f'{params.col_name} {user_info.name}', flush=True)
        print(ex)
        return False
    if not col_all_perms:
        return False

    # Add the collection
    s3_bucket = S3AdminConnection.add_collection(s3_info,
                                {   'name': params.col_name,
                                    'description': params.col_desc,
                                    'email': params.col_email,
                                    'organization': params.col_org,
                                },
                                col_all_perms)
    print(f'INFO: Created new collection: {s3_bucket}', flush=True)

    # Update the collection to reflect the changes
    updated_collection = S3CollectionConnection.get_collection_info(s3_info, s3_bucket)
    if updated_collection:
        updated_collection = sdupu.normalize_collection(updated_collection)

        # Update the collection entry in the database
        sdc.collection_add(db, s3_info.id, updated_collection)

    return {'success':True, 'data': updated_collection, \
            'message': "Successfully updated the collection"}


def handle_check_incomplete(db:SPARCdDatabase, user_info: UserInfo, s3_info: S3Info,
                                                        colls: tuple) -> Union[tuple,bool, None]:
    """ Implementation of checking for incomplete uploads when an administrator
    Arguments:
        db: the database instance
        user_info: the user information
        s3_info: the S3 endpoint information
        colls: the collections to check
    Return:
        Returns a status dict when successful. False is returned if there was
        a problem with the request parameters. None is returned if the request couldn't be
        completed
    """
    # Make sure this user is an admin
    if not bool(user_info.admin):
        return None

    # Check if we're all done
    if len(colls) <= 0:
        return {'success': True}

    # Get the locations and species changes logged in the database

    incomplete = S3CollectionConnection.check_incomplete_uploads(s3_info, colls)

    if incomplete is None:
        print('ERROR: unable to check for incomplete uploads in indicated collections', colls,
                                                                                        flush=True)
        return {'success': False}

    # Nothing found
    if len(incomplete) == 0:
        return {'success': True}

    # Update the database with unknown incomplete uploads
    db.sandbox_new_incomplete_uploads(s3_info.id, incomplete)

    return {'success': True, 'count':len(incomplete)}


def handle_complete_changes(db:SPARCdDatabase, user_info: UserInfo, s3_info: S3Info,
                                                species_temp_filename: str) -> Union[tuple, None]:
    """ Implementation of completing admin changes
    Arguments:
        db: the database instance
        user_info: the user information
        s3_info: the S3 endpoint information
        species_temp_filename: the temporary filename used to store species information
    Return:
        Returns a status dict when successful. None is returned if the request couldn't be
        completed
    """
    # Make sure this user is an admin
    if not bool(user_info.admin):
        return None

    changes = db.get_admin_changes(s3_info.id, user_info.name)
    if not changes:
        return {'success': True, 'message': "There were no changes found to apply"}

    # Update the location
    if 'locations' in changes and changes['locations']:
        if not sdlu.update_admin_locations(s3_info, changes):
            return 'Unable to update the locations', 422
    # Mark the locations as done in the DB
    db.clear_admin_location_changes(s3_info.id, user_info.name)

    # Update the species
    if 'species' in changes and changes['species']:
        updated_species = sdlu.update_admin_species(s3_info, changes, species_temp_filename)
        if updated_species is None:
            return 'Unable to update the species. Any changed locations were updated', 422

    # Mark the species as done in the DB
    db.clear_admin_species_changes(s3_info.id, user_info.name)

    return {'success': True, 'message': "All changes were successully applied"}


def handle_abandon_changes(db:SPARCdDatabase, user_info: UserInfo,
                                                            s3_info: S3Info) -> Union[tuple, None]:
    """ Implementation of abandoning admin changes
    Arguments:
        db: the database instance
        user_info: the user information
        s3_info: the S3 endpoint information
    Return:
        Returns a status dict when successful. None is returned if the request couldn't be
        completed
    """
    # Make sure this user is an admin
    if not bool(user_info.admin):
        return None

    # Mark the locations as done in the DB
    db.clear_admin_location_changes(s3_info.id, user_info.name)

    # Mark the species as done in the DB
    db.clear_admin_species_changes(s3_info.id, user_info.name)

    return {'success': True, 'message': "All changes were successully abandoned"}


def handle_move_upload(db:SPARCdDatabase, user_info: UserInfo, s3_info: S3Info,
                                                    params: UploadMoveParams) -> Union[tuple, None]:
    """ Implementation of moving an upload
    Arguments:
        db: the database instance
        user_info: the user information
        s3_info: the S3 endpoint information
        params: the parameters to move an upload
        params.src_coll_id: the source collection ID
        params.upload_key: the key of the upload to move
        params.dst_coll_id: the destination collection ID or bucket name
    Return:
        Returns a status dict when successful. None is returned if the request couldn't be
        completed
    """
    is_admin = bool(user_info.admin)

    # Find the collection
    all_collections = sdc.load_collections(db, is_admin, s3_info)
    if not all_collections:
        return False

    # Get the source collection
    src_coll = __get_authorized_collection(all_collections, user_info, params.src_coll_id,
                                                                            params.upload_key, True)
    # The source must be a collection
    if not src_coll:
        return False

    # Get the destination collection. If we can't find it assume it's an S3 bucket
    dst_coll = __get_authorized_collection(all_collections, user_info, params.dst_coll_id,
                                                                                        None, False)
    if dst_coll:
        dst_bucket = dst_coll['bucket']
    else:
        dst_bucket = params.dst_coll_id

    # Build up the upload starting path
    start_path = make_s3_path((COLLECTIONS_FOLDER, src_coll['id'], S3_UPLOADS_PATH_PART,
                                                                                params.upload_key))

    # Get the destination path if we're a collection bucket
    dest_path = make_s3_path((COLLECTIONS_FOLDER, dst_coll['id'], S3_UPLOADS_PATH_PART,
                                                        params.upload_key)) if dst_coll else None

    # Get the destination path mapping function
    path_func = __make_dest_path_func(len(start_path), dest_path) if dst_coll else lambda x: x

    # Move the data
    res = s3u.move_upload(s3_info, src_coll['bucket'], dst_bucket, start_path, path_func)

    # Update the collections to reflect the changed
    __update_move_collections(db, s3_info, src_coll, dst_coll)

    # Make a message based upon our return value
    return __handle_move_upload_result(db, s3_info.id, user_info.name, params, res)


def handle_delete_location(db:SPARCdDatabase, user_info: UserInfo, s3_info: S3Info,
                                                            location_id: str) -> Union[bool, None]:
    """ Handles removing the lcoation from the list of approved locations
    Argument:
        db: the database instance
        user_info: the user information
        s3_info: the S3 endpoint information
        location_id: the ID of the location to delete
    Return:
        Returns None if the location can't be found. Returns True if the location was deleted and
        False if the location was found but couldn't be removed
    """
    # Make sure we're admin
    if not user_info.admin:
        return None

    # Get the locations to from the server
    all_locs = S3AdminConnection.get_configuration(s3_info, LOCATIONS_JSON_FILE_NAME)
    if all_locs is None:
        return False

    all_locs = json.loads(all_locs)
    cur_loc_len = len(all_locs)

    all_locs = [loc for loc in all_locs if loc['idProperty'] != location_id]

    # If the new count's the same or somehow more than the original count, we haven't found
    # the location to remove. Maybe it's gone already? No way of telling so we say it's good
    if cur_loc_len == len(all_locs):
        return {'success': True}

    # Remove the location from any the databse entries
    db.remove_location_and_edits(s3_info.id, location_id)

    all_locs = [loc for loc in all_locs if loc['idProperty']]

    s3u.save_sparcd_config(all_locs, LOCATIONS_JSON_FILE_NAME,
                            f'{s3_info.id}-{sdlu.TEMP_LOCATIONS_FILE_NAME}', s3_info)

    return {'success': True}
