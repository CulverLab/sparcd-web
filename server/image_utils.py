""" Utlities for images"""

import os
import json
import subprocess
from typing import Optional
from dateutil import parser

EXIFTOOL_ORIGINAL_DATE = 'DateTimeOriginal'
EXIFTOOL_MODIFY_DATE = 'ModifyDate'
EXIF_CODE_SPARCD = "Exif_0x0227"
EXIF_CODE_SPECIES = "Exif_0x0228"
EXIF_CODE_LOCATION = "Exif_0x0229"

def _parse_exiftool_readout(parse_lines: tuple) -> tuple:
    """ Parses the output from an exiftool binary listing
    Arguments:
        parse_lines: a tuple of the lines to parse
    Return:
        Returns a tuple of the found location, species, and date
    """
    # Disable pylint message about too many branches here
    # pylint: disable=too-many-branches
    skip_line = 0
    found_species = False
    found_location = False
    date_string = ''
    species_string = ''
    location_string = ''
    for one_line in parse_lines:
        if skip_line > 0:
            skip_line = skip_line - 1
            continue
        if EXIFTOOL_ORIGINAL_DATE in one_line:
            skip_line = 0
            # Only use the original date if we don't have a modification date
            if not date_string and '=' in one_line:
                date_string = one_line[one_line.index('=') + 1:].strip()
        elif EXIFTOOL_MODIFY_DATE in one_line:
            skip_line = 0
            if '=' in one_line:
                date_string = one_line[one_line.index('=') + 1:].strip()
        elif EXIF_CODE_SPECIES in one_line:
            skip_line = 1
            found_species = True
            found_location = False
            continue
        elif EXIF_CODE_LOCATION in one_line:
            skip_line = 1
            found_location = True
            found_species = False
            continue
        if found_species is True:
            if '[' in one_line:
                species_string = species_string + one_line[one_line.index('[') + 1:].rstrip(']')
            else:
                found_species = False
        elif found_location is True:
            if '[' in one_line:
                location_string = location_string + one_line[one_line.index('[') + 1:].rstrip(']')
            else:
                found_location = False

    return location_string, species_string, date_string


def _split_species_string(species: str) -> tuple:
    """ Splits the EXIF string into an array of species information
    Arguments:
        species :the EXIT species string
    Returns:
        A tuple of species information strings
    """
    return_species = []
    working_str = species
    last_sep = 0
    cur_start = 0
    while True:
        cur_sep = working_str.find(',', last_sep)
        if cur_sep == -1:
            break
        last_sep = cur_sep + 1
        cur_sep = working_str.find(',', last_sep)
        if cur_sep == -1:
            break
        last_sep = cur_sep + 1
        cur_sep = working_str.find('.', last_sep)
        if cur_sep == -1:
            break
        last_sep = cur_sep + 1
        return_species.append(working_str[cur_start:cur_sep])
        cur_start = last_sep + 0
        if cur_start > len(species):
            break
    return return_species


def get_embedded_image_info(image_path: str) -> Optional[tuple]:
    """ Loads the embedded SPARCd information
    Arguments:
        image_path: the path of the image to check
    Returns:
        Retuns a tuple containing the species and location information that was
        embedded in the image
    """

    try:
        cmd = ["exiftool", "-U", "-v3", image_path]
        res = subprocess.run(cmd, capture_output=True, check=True)
    except subprocess.CalledProcessError as ex:
        print(f'ERROR: Exception getting exif information on image {image_path}', flush=True)
        print(f'       {ex}', flush=True)
        return None, None, None

    location_string, species_string, date_string = \
                                    _parse_exiftool_readout(res.stdout.decode("utf-8").split('\n'))

    if len(species_string) <= 0 and len(location_string) <= 0:
        del res
        #print(f"WARNING: no species or locations found in image: {image_path}", flush=True)
        return None, None, None

    return_species = []
    if len(species_string) > 0:
        for one_species in _split_species_string(species_string):
            common, scientific, count = [val.strip() for val in one_species.split(',')]
            return_species.append({'common': common, 'scientific': scientific, 'count': count})

    if len(location_string) > 0:
        locs = location_string.rstrip('.').split('.')
        return_location = {"name": locs[0], "id": locs[len(locs)-1]}
        if len(locs) == 4:
            return_location["elevation"] = locs[1] + '.' + locs[2]
        elif len(locs) == 3:
            return_location["elevation"] = locs[1]
        else:
            print("WARNING: Unknown location format in image, returning 0 for elevation",
                                                                                        flush=True)
            return_location["elevation"] = 0

    del res

    # Check for formatting of date string
    if '-' not in date_string and ' ' in date_string:
        parts = date_string.split(' ')
        parts[0] = parts[0].replace(':', '-')
        date_string = ' '.join(parts)

    return return_species, return_location, parser.parse(date_string)



def write_embedded_image_info(image_path: str, location_json: str, species_json: str) -> bool:
    """ Updates the embedded SPARCd information
    Arguments:
        image_path: the path of the image to update
        location_json: the JSON data for the locations
        species_json: the JSON data for the species
    Return:
        Returns True if the file was updated and False if a problem ocurred
    """
    # Check for nothing to do
    if not location_json and not species_json:
        return True

    # Setup the command to execute
    cmd = ["java", "-jar", "ExifWriter.jar"]
    cmd.append(f"-file={image_path}")
    if species_json:
        cmd.append(f"-species={species_json}")
    if location_json:
        cmd.append(f"-location={location_json}")

    # Run the command
    try:
        _ = subprocess.run(cmd, capture_output=True, check=True)
    except subprocess.CalledProcessError as ex:
        print(f'ERROR: Exception setting exif information into image {image_path}', flush=True)
        print(f'       {ex}', flush=True)
        print(ex.stdout, flush=True)
        print(ex.stderr, flush=True)
        return False

    return True


def update_image_file_exif(file_path: str, loc_id: str=None, loc_name: str=None, \
                                            loc_ele: float=None, loc_lat: float=None, \
                                            loc_lon: float=None, species_data: tuple=None) -> bool:
    """ Updates the image file with location exif information
    Arguments:
        file_path: the path to the file to modify
        loc_id: the location id
        loc_name: the location name
        loc_ele: the location elevation
        loc_lat: the location latitude
        loc_lon: the location longitude
        species_data: a tuple containing dicts of each species' common and scientific names, and
                      count
    Return:
        Returns whether or not the file was successfully updated
    """
    exif_location_data = None
    if loc_id and loc_name and loc_ele is not None:
        exif_location_data = ",".join((loc_name, loc_id, str(loc_lat), str(loc_lon), str(loc_ele)))

    exif_species_data = None
    if species_data is not None:
        exif_species_data = [','.join((one_species['common'], \
                                       one_species['scientific'], \
                                       str(one_species['count']))) \
                                for one_species in species_data
                            ]

    # Check if we have any changes
    if not exif_location_data and not exif_species_data:
        return True

    # Update the image file
    result = write_embedded_image_info(
                        file_path,
                        json.dumps(exif_location_data) if exif_location_data is not None else None,
                        json.dumps(exif_species_data) if exif_species_data is not None else None
                        )

    return result
