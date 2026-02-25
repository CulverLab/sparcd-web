""" Functions to help queries """

import concurrent.futures
import datetime
import json
import traceback
from typing import Callable, Optional
import dateutil.tz

from sparcd_db import SPARCdDatabase
from s3_access import S3Connection, SPARCD_PREFIX
from format_dr_sanderson import get_dr_sanderson_output, get_dr_sanderson_pictures
from format_csv import get_csv_raw, get_csv_location, get_csv_species
from format_image_downloads import get_image_downloads
from text_formatters.results import Results


# Uploads table timeout length
TIMEOUT_UPLOADS_SEC = 3 * 60 * 60

# Default timezone offset in seconds
# TODO: Set the default timezone elsewhere; perhaps as a environment variable?
DEFAULT_TIMEZONE_OFFSET = -7.00*60*60


def filter_uploads(uploads_info: tuple, filters: tuple) -> tuple:
    """ Filters the uploads against the filters and returns the selected
        images and their associated data
    Arguments:
        uploads_info: the tuple of uploads to filter
        filters: the filters to apply to the uploads
    Notes:
        Does not filter on collection
    """
    cur_uploads = uploads_info

    # Filter at the upload level
    for one_filter in filters:
        match(one_filter[0]):
            case 'locations':
                cur_uploads = [one_upload for one_upload in cur_uploads if \
                                one_upload['info']['loc'] in one_filter[1]]
            case 'elevation':
                cur_uploads = filter_elevation(cur_uploads, json.loads(one_filter[1]))

    # Filter at the image level
    filtering_names = [one_filter[0] for one_filter in filters]
    years_filter = None
    try:
        start_date_ts = None if 'startDate' not in filtering_names else \
                                                        get_filter_dt('startDate', filters)
        end_date_ts = None if 'endDate' not in filtering_names else \
                                                        get_filter_dt('endDate', filters)
    except Exception as ex:
        print('Invalid start or end filter date')
        print(ex)
        raise ex

    matches = []
    for one_upload in cur_uploads:
        cur_images = []
        for one_image in one_upload['info']['images']:
            excluded = False
            image_dt = None
            # pylint: disable=broad-exception-caught
            if 'timestamp' in one_image and one_image['timestamp']:
                try:
                    image_dt = datetime.datetime.fromisoformat(one_image['timestamp'])
                    # Add a timezone if there isn't one
                    if image_dt and (image_dt.tzinfo is None or \
                                            image_dt.tzinfo.utcoffset(image_dt) is None):
                        image_dt = image_dt.replace(tzinfo=\
                                        dateutil.tz.tzoffset(None,DEFAULT_TIMEZONE_OFFSET))
                except Exception as ex:
                    print(f'Error converting image timestamp: {one_image["name"]} ' \
                          f'{one_image["timestamp"]} from upload {one_upload["bucket"]} '\
                          f'{one_upload["name"]}')
                    print(ex)
                    excluded = True
                    continue

            # Filter the image
            for one_filter in filters:
                match(one_filter[0]):
                    case 'dayofweek':
                        if image_dt is None or image_dt.weekday() not in one_filter[1]:
                            excluded = True
                    case 'hour':
                        if image_dt is None or image_dt.hour not in one_filter[1]:
                            excluded = True
                    case 'month':
                        if image_dt is None or image_dt.month not in one_filter[1]:
                            excluded = True
                    case 'species':
                        found = False
                        for one_species in one_image['species']:
                            if one_species['scientificName'] in one_filter[1]:
                                found = True

                        if not found:
                            excluded = True
                    case 'years':
                        if years_filter is None:
                            years_filter = one_filter[1]
                        if image_dt is None or \
                            not int(years_filter['yearStart']) <= image_dt.year <= \
                                                                    int(years_filter['yearEnd']):
                            excluded = True
                    case 'endDate': # Need to compare against GMT of filter
                        if image_dt is None or image_dt > end_date_ts:
                            excluded = True
                    case 'startDate': # Need to compare against GMT of filter
                        if image_dt is None or image_dt < start_date_ts:
                            excluded = True

                # Break loop as soon as it's excluded
                if excluded:
                    break

            # Return it if it's not excluded
            if not excluded:
                one_image['image_dt'] = image_dt
                cur_images.append(one_image)

        if len(cur_images) > 0:
            matches.append((one_upload, cur_images))

    return [cur_upload['info']|{'images':cur_images} for cur_upload,cur_images in matches]


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


def filter_collections(db: SPARCdDatabase, cur_coll: tuple, s3_id: str, s3_url: str, \
                       user_name: str, fetch_password: Callable, filters: tuple) -> tuple:
    """ Filters the collections in an efficient manner
    Arguments:
        db - connections to the current database
        cur_coll - the list of applicable collections
        s3_id: the ID of the S3 endpoint
        s3_url - the URL to the S3 instance
        user_name - the user's name for S3
        fetch_password - returns the user's password
        filters - the filters to apply to the data
    Returns:
        Returns the filtered results
    """
    all_results = []
    s3_uploads = []

    # Load all the DB data first
    for one_coll in cur_coll:
        cur_bucket = one_coll['bucket']
        uploads_info = db.get_uploads(s3_id, cur_bucket, TIMEOUT_UPLOADS_SEC)
        if uploads_info is not None and uploads_info:
            uploads_info = [{'bucket':cur_bucket,                           \
                             'name':one_upload['name'],                     \
                             'info':json.loads(one_upload['json']) if       \
                                            one_upload['json'] else {} }    \
                                                for one_upload in uploads_info]
        else:
            s3_uploads.append(cur_bucket)
            continue

        # Filter on current DB uploads
        if len(uploads_info) > 0:
            cur_results = filter_uploads(uploads_info, filters)
            if cur_results:
                all_results = all_results + cur_results


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
                        db.save_uploads(s3_id, uploads_results['bucket'], uploads_info)

                        # Filter on current DB uploads
                        if len(uploads_info) > 0:
                            cur_results = filter_uploads(uploads_info, filters)
                            if cur_results:
                                all_results = all_results + cur_results
                # pylint: disable=broad-exception-caught
                except Exception as ex:
                    print(f'Generated exception: {ex}', flush=True)
                    traceback.print_exception(ex)

    return all_results


def filter_elevation(uploads: tuple, elevation_filter: dict) -> list:
    """ Returns the uploads that match the filter
    Arguments:
        uploads: the uploads to iterate through
        elevation_filter: the elevation filtering information
    Returns:
        Returns uploads that match the elevation filtering criteria
    Notes:
        The elevation filter needs 'type', 'value', and 'units' fields
        with ('=','<','>','<=','>='), elevation, and ('meters' or 'feet')
    """
    # Get the comparison value in meters
    if elevation_filter['units'] == 'meters':
        cur_elevation = elevation_filter['value']
    else:
        cur_elevation = elevation_filter['value'] * 0.3048

    # Filter the uploads based upon the filter type
    match(elevation_filter['type']):
        case '=':
            return [one_upload for one_upload in uploads if \
                                float(one_upload['info']['elevation']) == cur_elevation]
        case '<':
            return [one_upload for one_upload in uploads if \
                                float(one_upload['info']['elevation']) < cur_elevation]
        case '>':
            return [one_upload for one_upload in uploads if \
                                float(one_upload['info']['elevation']) > cur_elevation]
        case '<=':
            return [one_upload for one_upload in uploads if \
                                float(one_upload['info']['elevation']) <= cur_elevation]
        case '>=':
            return [one_upload for one_upload in uploads if \
                                float(one_upload['info']['elevation']) >= cur_elevation]
        case _:
            raise ValueError('Invalid elevation filter comparison specified: ' \
                             f'{elevation_filter["type"]}')


def get_filter_dt(filter_name: str, filters: tuple) -> Optional[datetime.datetime]:
    """ Returns the datetime of the associated filter
    Arguments:
        filter_name: the name of the filter to find
        filterrs: the list of filters to search
    Return:
        The timestamp as a datetime object, or None if the filter or timestamp is 
        missing or invalid
    """
    found_filter = [one_filter for one_filter in filters if one_filter[0] == filter_name]
    if len(found_filter) > 0:
        return found_filter[0][1]

    return None


def query_output(results: Results, results_id: str) -> tuple:
    """ Formats the results into something that can be returned to the caller
    Arguments:
        results: the results class containing the results of the filter_uploads function
        results_id: the unique identifier for this result
        user_settings: the user settings
    Return:
        Returns a tuple containing the formatted results
    """
    if not results:
        return tuple()

    if not results.have_results():
        return tuple()

    return {'id': results_id,
            'DrSandersonOutput': get_dr_sanderson_output(results),
            'DrSandersonAllPictures': get_dr_sanderson_pictures(results),
            'csvRaw': get_csv_raw(results),
            'csvLocation': get_csv_location(results),
            'csvSpecies': get_csv_species(results),
            'imageDownloads': get_image_downloads(results),
            'tabs': {   # Information on tabs to display
                 # The order that the tabs are to be displayed
                 'order':['DrSandersonOutput','DrSandersonAllPictures','csvRaw', \
                                            'csvLocation','csvSpecies','imageDownloads'],
                 # The tab names
                 'DrSandersonOutput':'Dr. Sanderson\'s Output',
                 'DrSandersonAllPictures':'Dr. Sanderson\'s Pictures',
                 'csvRaw':'All Results',
                 'csvLocation':'Locations',
                 'csvSpecies':'Species',
                 'imageDownloads':'Image Download'
                },
            # Display column information
            'columns': {
                'DrSandersonAllPictures': {'location':'Location','species':'Species',\
                                           'image':'Image'},
                'csvRaw': {'image':'Image',
                           'date':'Date',
                           'locationUTM':{'title':'Location','locName':'Name','locId':'ID', \
                                        'utm_code':'UTM Zone','utm_x':'Easting',\
                                        'utm_y':'Northing','locElevation':'Elevation'
                                       },
                           'LocationLATLON':{'title':'Location','locName':'Name','locId':'ID', \
                                            'locX':'Latitude','locY':'Longitude',
                                            'locElevation':'Elevation'
                                            },
                           'species':{'title':'Species',
                                     'common1':'Common Name','scientific1':'Scientific Name',\
                                     'count1':'Count','common2':'Common Name',\
                                     'scientific2':'Scientific Name','count2':'Count'
                                     },
                        },
                'csvLocation': {'UTM':{'name':'Name','id':'ID', 'utm_code':'UTM Zone', \
                                    'utm_x':'Easting', 'utm_y':'Northing', \
                                    'locElevation':'Elevation'},
                                'LATLON':{'name':'Name','id':'ID', 'locX':'Latitude', \
                                    'locY':'Longitude', 'locElevation':'Elevation'},
                                },
                'csvSpecies': {'common':'Common Name', 'scientific':'Scientific Name'},
                'imageDownloads': {'name':'Name'}
            },
            # Column modifications
            'columsMods': {
                'csvRaw': [{'type': 'hasLocations',
                           'UTM': 'locationUTM',
                           'LATLON': 'LocationLATLON',
                           'target': 'location'
                           }, {
                            'type': 'hasElevation',
                            'parent': 'location',
                            'meters': 'locElevation',
                            'feet': 'locElevationFeet',
                            'target': 'locElevation'
                           }, {
                            'type': 'date',
                            'target': 'dateFormatted',
                            'source': 'date',
                            'parent': None,
                            'settingsDate': results.user_settings['dateFormat'] if 'dateFormat' in \
                                                                results.user_settings else 'MDY',
                            'settingsTime': results.user_settings['timeFormat'] if 'timeFormat' in \
                                                                results.user_settings else '24',
                           }],
                'csvLocation':[{'type':'hasLocations',
                           'UTM':'UTM',
                           'LATLON': 'LATLON',
                           'target': None
                           }, {
                            'type': 'hasElevation',
                            'parent': None,
                            'meters': 'locElevation',
                            'feet': 'locElevationFeet',
                            'target': 'locElevation'
                           }],
            },
            # Download file information
            'downloads': {
                'DrSandersonOutput': 'drsanderson.txt',
                'DrSandersonAllPictures': 'drsanderson_all.csv',
                'csvRaw': 'allresults.csv',
                'csvLocation': 'locations.csv',
                'csvSpecies': 'species.csv',
                'imageDownloads': 'allimages.gz',
            }
          }
