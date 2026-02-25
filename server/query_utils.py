""" Query utilities """

import re


def query_raw2csv(raw_data: tuple, settings: dict, mods: tuple=None) -> str:
    """ Returns the CSV of the specified raw query results
    Arguments:
        raw_data: the query data to convert
        settings: user settings
        mods: modifictions to make on the data based upon user settings
    """
    all_results = ''

    # Loop through any modifiers
    location_keys = ['locX', 'locY']
    elevation_keys = ['locElevation']
    timestamp_keys = 'date'
    if not mods is None:
        for one_mod in mods:
            if 'type' in one_mod:
                match one_mod['type']:
                    case 'hasLocations':
                        coord_format = settings['coordinatesDisplay'] if 'coordinatesDisplay' in \
                                                                        settings else 'LATLON'
                        if coord_format == 'UTM':
                            location_keys = ['utm_code', 'utm_x', 'utm_y']

                    case 'hasElevation':
                        measure_format = settings['measurementFormat'] if 'measurementFormat' in \
                                                                        settings else 'meters'
                        if measure_format == 'feet':
                            elevation_keys = ['locElevationFeet']

                    case 'date':
                        date_format = settings['dateFormat'] if 'dateFormat' in settings else 'MDY'
                        time_format = settings['timeFormat'] if 'timeFormat' in settings else '24'

                        timestamp_keys = {'date': 'date'+date_format, 'time': 'time'+time_format}


    for one_row in raw_data:
        # Build up the row based upon modifications
        cur_row = [one_row['image'] if one_row['image'] else '']

        if isinstance(timestamp_keys, str):
            cur_row.append('"' + one_row['date'] + '"')
        else:
            cur_row.append('"' + one_row[timestamp_keys['date']] + ' ' + \
                                            one_row[timestamp_keys['time']] + '"')

        cur_row.append(one_row['locName'] if one_row['locName'] else 'Unknown')
        cur_row.append(one_row['locId'] if one_row['locId'] else 'unknown')
        for one_key in location_keys:
            cur_row.append(str(one_row[one_key]) if one_row[one_key] else '0')
        for one_key in elevation_keys:
            cur_row.append(re.sub(r"[^\d\.]", "", str(one_row[one_key]) if one_row[one_key] \
                                                                                        else '0'))

        cur_idx = 1
        while True:
            if 'scientific' + str(cur_idx) in one_row and 'common' + str(cur_idx) in one_row and \
                    'count' + str(cur_idx) in one_row:
                cur_row.append(one_row['scientific' + str(cur_idx)])
                cur_row.append(one_row['common' + str(cur_idx)])
                cur_row.append(str(one_row['count' + str(cur_idx)]))
            else:
                break

            cur_idx += 1

        all_results += ','.join(cur_row) + '\n'

    return all_results


def query_location2csv(location_data: tuple, settings: dict, mods: dict=None) -> str:
    """ Returns the CSV of the specified location query results
    Arguments:
        location_data: the location data to convert
        settings: user settings
        mods: modifictions to make on the data based upon user settings
    """
    all_results = ''


    # Loop through any modifiers
    location_keys = ['locX', 'locY']
    elevation_keys = ['locElevation']
    if not mods is None:
        for one_mod in mods:
            if 'type' in one_mod:
                match one_mod['type']:
                    case 'hasLocations':
                        coord_format = settings['coordinatesDisplay'] if 'coordinatesDisplay' in \
                                                                        settings else 'LATLON'
                        if coord_format == 'UTM':
                            location_keys = ['utm_code', 'utm_x', 'utm_y']
                        break

                    case 'hasElevation':
                        measure_format = settings['measurementFormat'] if 'measurementFormat' in \
                                                                        settings else 'meters'

                        if measure_format == 'feet':
                            elevation_keys = ['locElevationFeet']
                        break

    for one_row in location_data:
        cur_row = [one_row['name'], one_row['id']]

        for one_key in location_keys:
            cur_row.append(str(one_row[one_key]))
        for one_key in elevation_keys:
            cur_row.append(re.sub(r"[^\d\.]", "", str(one_row[one_key])))

        all_results += ','.join(cur_row) + '\n'

    return all_results


def query_species2csv(species_data: tuple, settings: dict, mods: dict=None) -> str:
    """ Returns the CSV of the specified species query results
    Arguments:
        species_data: the species data to convert
        settings: user settings
        mods: modifictions to make on the data based upon user settings
    """
    # pylint: disable=unused-argument
    all_results = ''
    for one_row in species_data:
        all_results += ','.join([one_row['common'], one_row['scientific']]) + '\n'

    return all_results


def query_allpictures2csv(allpictures_data: tuple, settings: dict, mods: dict = None) -> str:
    """ Returns the CSV of the specified Sanderson all pictures query results
    Arguments:
        allpictures_data: the all pictures data to convert
        settings: user settings
        mods: modifictions to make on the data based upon user settings
    """
    # pylint: disable=unused-argument
    all_results = ''
    for one_row in allpictures_data:
        all_results += ','.join([one_row['location'], one_row['species'], one_row['image']]) + '\n'

    return all_results
