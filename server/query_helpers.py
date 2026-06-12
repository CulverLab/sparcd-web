""" Functions to help queries """

import concurrent.futures
from dataclasses import dataclass
import datetime
import json
import traceback
from typing import Optional
import dateutil.tz

from sparcd_env import DEFAULT_TIMEZONE_OFFSET
from sparcd_db import SPARCdDatabase
from spd_types.s3info import S3Info
from sparcd_stats_utils import list_uploads_thread
from format_dr_sanderson import get_dr_sanderson_output, get_dr_sanderson_pictures
from format_csv import get_csv_raw, get_csv_location, get_csv_species
from format_image_downloads import get_image_downloads
from text_formatters.results import Results


# Uploads table timeout length
TIMEOUT_UPLOADS_SEC = 3 * 60 * 60

@dataclass
class DateFilters:
    """ Contains the date-related filter values for image filtering """
    start_date_ts: Optional[datetime.datetime]
    end_date_ts: Optional[datetime.datetime]
    years_filter: Optional[dict]


def __parse_image_timestamp(one_image: dict) -> tuple:
    """ Parses the timestamp from an image dict
    Arguments:
        one_image: the image to parse the timestamp from
    Return:
        Returns a tuple of (image_dt, failed) where image_dt is the parsed datetime
        or None if not present, and failed is True if parsing failed
    """
    if 'timestamp' not in one_image or not one_image['timestamp']:
        return None, False
    try:
        image_dt = datetime.datetime.fromisoformat(one_image['timestamp'])
        if image_dt and (image_dt.tzinfo is None or
                         image_dt.tzinfo.utcoffset(image_dt) is None):
            image_dt = image_dt.replace(
                tzinfo=dateutil.tz.tzoffset(None, DEFAULT_TIMEZONE_OFFSET))
        return image_dt, False
    except Exception as ex:  # pylint: disable=broad-exception-caught
        print(f'Error converting image timestamp: {one_image["name"]} '
              f'{one_image["timestamp"]}')
        print(ex)
        return None, True


def __image_passes_filter(one_image: dict, one_filter: tuple,
                          image_dt: Optional[datetime.datetime],
                          date_filters: DateFilters) -> bool:
    """ Checks if an image passes a single filter
    Arguments:
        one_image: the image to check
        one_filter: the filter to apply
        image_dt: the parsed image datetime, or None
        date_filters: the date-related filter values
    Return:
        Returns True if the image passes the filter, False if excluded
    """
    # pylint: disable=too-many-return-statements
    match one_filter[0]:
        case 'dayofweek':
            return image_dt is not None and image_dt.weekday() in one_filter[1]
        case 'hour':
            return image_dt is not None and image_dt.hour in one_filter[1]
        case 'month':
            return image_dt is not None and image_dt.month in one_filter[1]
        case 'species':
            return any(s['scientificName'] in one_filter[1]
                       for s in one_image['species'])
        case 'years':
            return (date_filters.years_filter is not None and image_dt is not None and
                    int(date_filters.years_filter['yearStart']) <= image_dt.year
                    <= int(date_filters.years_filter['yearEnd']))
        case 'endDate':
            return image_dt is not None and image_dt <= date_filters.end_date_ts
        case 'startDate':
            return image_dt is not None and image_dt >= date_filters.start_date_ts
        case _:
            return True


def __filter_image(one_image: dict, filters: tuple,
                   date_filters: DateFilters) -> Optional[dict]:
    """ Applies all filters to a single image
    Arguments:
        one_image: the image to filter
        filters: the filters to apply
        date_filters: the date-related filter values
    Return:
        Returns the image with image_dt added if it passes all filters, or None if excluded
    """
    image_dt, failed = __parse_image_timestamp(one_image)
    if failed:
        return None

    if all(__image_passes_filter(one_image, one_filter, image_dt, date_filters)
           for one_filter in filters):
        return one_image | {'image_dt': image_dt}

    return None


def __filter_upload_images(one_upload: dict, filters: tuple,
                           date_filters: DateFilters) -> Optional[tuple]:
    """ Filters all images in a single upload
    Arguments:
        one_upload: the upload to filter
        filters: the filters to apply
        date_filters: the date-related filter values
    Return:
        Returns a tuple of (upload, matching_images) or None if no images match
    """
    if not one_upload['info'] or 'images' not in one_upload['info']:
        return None

    cur_images = [result for one_image in one_upload['info']['images']
                  if (result := __filter_image(one_image, filters,
                                               date_filters)) is not None]

    return (one_upload, cur_images) if cur_images else None


def __get_date_filters(filtering_names: list,
                       filters: tuple) -> tuple:
    """ Extracts and validates the start and end date filters
    Arguments:
        filtering_names: the list of active filter names
        filters: the full filter list
    Return:
        Returns a tuple of (start_date_ts, end_date_ts)
    """
    start_date_ts = None if 'startDate' not in filtering_names else \
                    get_filter_dt('startDate', filters)
    end_date_ts = None if 'endDate' not in filtering_names else \
                  get_filter_dt('endDate', filters)
    return start_date_ts, end_date_ts


def __filter_and_accumulate(uploads_info: list, filters: tuple,
                             all_results: list) -> None:
    """ Filters uploads and appends matching results to all_results
    Arguments:
        uploads_info: the list of upload information to process
        filters: the filters to apply
        all_results: the list to append matching results to
    """
    cur_results = filter_uploads(uploads_info, filters)
    if cur_results:
        all_results.extend(cur_results)


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

    for one_filter in filters:
        match one_filter[0]:
            case 'locations':
                cur_uploads = [one_upload for one_upload in cur_uploads
                               if one_upload['info']['loc'] in one_filter[1]]
            case 'elevation':
                cur_uploads = filter_elevation(cur_uploads, json.loads(one_filter[1]))

    filtering_names = [one_filter[0] for one_filter in filters]
    try:
        start_date_ts, end_date_ts = __get_date_filters(filtering_names, filters)
    except Exception as ex:  # pylint: disable=broad-exception-caught
        print('Invalid start or end filter date')
        print(ex)
        raise ex

    date_filters = DateFilters(
        start_date_ts=start_date_ts,
        end_date_ts=end_date_ts,
        years_filter=next((f[1] for f in filters if f[0] == 'years'), None)
    )

    matches = [result for one_upload in cur_uploads
               if (result := __filter_upload_images(one_upload, filters,
                                                    date_filters)) is not None]

    return [cur_upload['info'] | {'images': cur_images}
            for cur_upload, cur_images in matches]


def filter_collections(db: SPARCdDatabase, cur_coll: tuple, s3_info: S3Info,
                       filters: tuple) -> tuple:
    """ Filters the collections in an efficient manner
    Arguments:
        db - connections to the current database
        cur_coll - the list of applicable collections
        s3_info - the information on the S3 instance
        filters - the filters to apply to the data
    Returns:
        Returns the filtered results
    """
    all_results = []
    s3_uploads = []

    for one_coll in cur_coll:
        cur_bucket = one_coll['bucket']
        uploads_info = db.get_uploads(s3_info.id, cur_bucket, TIMEOUT_UPLOADS_SEC)
        if uploads_info is not None and uploads_info:
            uploads_info = [{'bucket': cur_bucket,
                             'name': one_upload['name'],
                             'info': json.loads(one_upload['json'])
                                     if one_upload['json'] else {}}
                            for one_upload in uploads_info]
            __filter_and_accumulate(uploads_info, filters, all_results)
        else:
            s3_uploads.append(cur_bucket)

    if s3_uploads:
        with concurrent.futures.ThreadPoolExecutor() as executor:
            cur_futures = {executor.submit(list_uploads_thread, s3_info, cur_bucket):
                           cur_bucket for cur_bucket in s3_uploads}

            for future in concurrent.futures.as_completed(cur_futures):
                try:
                    uploads_results = future.result()
                    if 'uploads_info' in uploads_results and uploads_results['uploads_info']:
                        uploads_info = [{'bucket': uploads_results['bucket'],
                                         'name': one_upload['name'],
                                         'info': one_upload,
                                         'json': json.dumps(one_upload)}
                                        for one_upload in uploads_results['uploads_info']]
                        db.save_uploads(s3_info.id, uploads_results['bucket'], uploads_info)
                        __filter_and_accumulate(uploads_info, filters, all_results)
                except Exception as ex:  # pylint: disable=broad-exception-caught
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


def query_output(results: Results, results_id: str) -> dict:
    """ Formats the results into something that can be returned to the caller
    Arguments:
        results: the results class containing the results of the filter_uploads function
        results_id: the unique identifier for this result
        user_settings: the user settings
    Return:
        Returns a dict containing the formatted results and supporting information
    """
    if not results:
        return tuple()

    if not results.have_results():
        return tuple()

    return {'id': results_id,
            'resultsCount': len(results.get_images()),
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
            'columnsMods': {
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
