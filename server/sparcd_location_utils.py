""" Location and species admin update utilities for SPARCd server """

import json
from typing import Optional

import spd_crypt as crypt
import s3_utils as s3u
from s3.s3_access_helpers import LOCATIONS_JSON_FILE_NAME, SPECIES_JSON_FILE_NAME, SPARCD_PREFIX
from s3.s3_admin import S3AdminConnection
from spd_types.s3info import S3Info
from text_formatters.coordinate_utils import DEFAULT_UTM_ZONE, deg2utm, deg2utm_code

# Name of temporary locations file
TEMP_LOCATIONS_FILE_NAME = SPARCD_PREFIX + 'locations.json'


def load_locations(s3_info: S3Info, for_admin: bool = False) -> tuple:
    """ Loads locations and converts lat-lon to UTM
    Arguments:
        s3_info: the information on the S3 endpoint
        for_admin: when set to True, location details are not obscured
    Return:
        Returns the locations along with the converted coordinates
    """
    cur_locations = s3u.load_sparcd_config(LOCATIONS_JSON_FILE_NAME,
                                           s3_info.id + '-' + TEMP_LOCATIONS_FILE_NAME,
                                           s3_info)
    if not cur_locations:
        return cur_locations

    # TODO: Store this information somewhere for easy fetching
    for one_loc in cur_locations:
        if 'utm_code' not in one_loc or 'utm_x' not in one_loc or 'utm_y' not in one_loc:
            if 'latProperty' in one_loc and 'lngProperty' in one_loc:
                if not for_admin:
                    one_loc['latProperty'] = round(float(one_loc['latProperty']), 3)
                    one_loc['lngProperty'] = round(float(one_loc['lngProperty']), 3)
                else:
                    one_loc['latProperty'] = float(one_loc['latProperty'])
                    one_loc['lngProperty'] = float(one_loc['lngProperty'])

                utm_x, utm_y = deg2utm(one_loc['latProperty'], one_loc['lngProperty'])
                one_loc['utm_code'] = ''.join([str(one_res) for one_res in
                                               deg2utm_code(float(one_loc['latProperty']),
                                                            float(one_loc['lngProperty']))])
                one_loc['utm_x'] = int(utm_x)
                one_loc['utm_y'] = int(utm_y)

    return cur_locations


def get_location_info(location_id: str, all_locations: tuple) -> dict:
    """ Gets the location associated with the ID. Will return an unknown location if not found
    Arguments:
        location_id: the ID of the location to use
        all_locations: the list of available locations
    Return:
        The location information
    """
    our_location = [one_loc for one_loc in all_locations
                    if one_loc['idProperty'] == location_id]
    if our_location:
        return our_location[0]

    return {'nameProperty': 'Unknown', 'idProperty': 'unknown',
            'latProperty': 0.0, 'lngProperty': 0.0, 'elevationProperty': 0.0,
            'utm_code': DEFAULT_UTM_ZONE, 'utm_x': 0.0, 'utm_y': 0.0}


def update_admin_locations(s3_info: S3Info, changes: dict) -> bool:
    """ Updates the master list of locations with the changes under the 'locations' key
    Arguments:
        s3_info: the information on the S3 endpoint
        changes: the list of changes for locations
    Return:
        Returns True unless a problem is found
    """
    if 'locations' not in changes or not changes['locations']:
        return True

    all_locs = S3AdminConnection.get_configuration(s3_info, LOCATIONS_JSON_FILE_NAME)
    if all_locs is None:
        return False
    all_locs = json.loads(all_locs)

    all_locs = {crypt.generate_hash((one_loc['idProperty'], one_loc['latProperty'],
                                     one_loc['lngProperty'])): one_loc
                for one_loc in all_locs}

    for one_change in changes['locations']:
        loc_id = one_change[changes['loc_id']]
        loc_old_lat = one_change[changes['loc_old_lat']]
        loc_old_lon = one_change[changes['loc_old_lng']]
        loc_descr = one_change[changes['loc_description']] \
            if one_change[changes['loc_description']] else ''

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
            cur_loc['descriptionProperty'] = loc_descr
        else:
            all_locs[cur_key] = {'idProperty': one_change[changes['loc_id']],
                                  'nameProperty': one_change[changes['loc_name']],
                                  'latProperty': one_change[changes['loc_new_lat']],
                                  'lngProperty': one_change[changes['loc_new_lng']],
                                  'elevationProperty': one_change[changes['loc_elevation']],
                                  'activeProperty': one_change[changes['loc_active']] == 1,
                                  'descriptionProperty': loc_descr}

    all_locs = tuple(all_locs.values())

    s3u.save_sparcd_config(all_locs, LOCATIONS_JSON_FILE_NAME,
                            f'{s3_info.id}-{TEMP_LOCATIONS_FILE_NAME}', s3_info)
    return True


def update_admin_species(s3_info: S3Info, changes: dict,
                                                    species_temp_filename: str) -> Optional[tuple]:
    """ Updates the master list of species with the changes under the 'species' key
    Arguments:
        s3_info: the information on the S3 endpoint
        changes: the list of changes for species
        species_temp_filename: the temporary species file name to use
    Return:
        Returns the tuple of updated species, or None if a problem is found
    """
    if 'species' not in changes or not changes['species']:
        return True

    all_species = S3AdminConnection.get_configuration(s3_info, SPECIES_JSON_FILE_NAME)
    if all_species is None:
        return None
    all_species = json.loads(all_species)

    all_species = {one_species['scientificName']: one_species for one_species in all_species}

    for one_change in changes['species']:
        cur_key = one_change[changes['sp_old_scientific']]
        if cur_key in all_species:
            cur_species = all_species[cur_key]
            cur_species['name'] = one_change[changes['sp_name']]
            cur_species['scientificName'] = one_change[changes['sp_new_scientific']]
            cur_species['speciesIconURL'] = one_change[changes['sp_icon_url']]
            cur_species['keyBinding'] = one_change[changes['sp_keybind']] \
                if one_change[changes['sp_keybind']] else None
        else:
            all_species[cur_key] = {'name': one_change[changes['sp_name']],
                                     'scientificName': one_change[changes['sp_new_scientific']],
                                     'speciesIconURL': one_change[changes['sp_icon_url']],
                                     'keyBinding': one_change[changes['sp_keybind']]}

    ret_species = tuple(all_species.values())
    s3u.save_sparcd_config(ret_species, SPECIES_JSON_FILE_NAME,
                                        species_temp_filename,
                                        s3_info)
    return ret_species
