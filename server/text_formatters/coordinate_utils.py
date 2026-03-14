""" Handles coordinate system conversions and measurements """

import math
from osgeo import ogr
from osgeo import osr

LAT_LONG_WGS84_EPSG = 4326
DEFAULT_UTM_ZONE = '12N'

def _get_utm_zone(lat: float, lon: float) -> int:
    """ Returns the UTM zone for the latitude and longitude
    Arguments:
        lat: the latitude of interest
        lon: the longitude of interest
    Return:
        The UTM zone number
    """
    # Special zones for Svalbard and Norway
    if 72.0 <= lat < 84.0 and lon >= 0.0:
        if lon < 9.0:
            return 31
        if lon < 12.0:
            return 33
        if lon < 33.0:
            return 35
        if lon < 42.0:
            return 37
    if 56.0 <= lat < 64.0 and 3.0 <= lon < 12.0:
        return 32

    return int(math.floor(((float(lon) + 180) / 6) % 60) + 1)


def _get_utm_letter(lat: float) -> str:
    """ Returns the UTM zone letter from the latitude
    Arguments:
        lat: the latitude of interest
    Return:
        Returns the zone letter or None if the l;atitude is invalid
    """
    if -80.0 <= lat <= 84.0:
        return 'CDEFGHJKLMNPQRSTUVWXX'[int(float(lat) + 80) >> 3]

    return None


def _deg2utm_epsg_code(lat: float, lon: float) -> int:
    """ Returns the EPSG code for UTM from the lat lon
    Arguments:
        lat: the latitude of interest
        lon: the longitude of interest
    Return:
        The EPSG code
    """
    zone = _get_utm_zone(lat, lon)

    epsg_code = 32600 + int(zone)
    # Check for southern hemisphere
    if lat < 0.0:
        epsg_code += 100

    return epsg_code


def _utm_epsg_code(zone: int, letter: str) -> int:
    """ Returns the EPSG code for the UTM Zone and letter
    Arguments:
        zone: the UTM zone
        letter: the UTM zone associated letter
    Return:
        The EPSG code
    """
    epsg_code = 32600 + int(zone)
    # Check for southern hemisphere
    if letter[0] <= 'M':
        epsg_code += 100

    return epsg_code


def deg2utm_code(lat: float, lon: float) -> tuple:
    """ Returns the UTM zone and letter from the lat lon
    Arguments:
        lat: the latitude of interest
        lon: the longitude of interest
    Return:
        A tupe containing the UTM zone number and associated letter
    """
    utm_zone = _get_utm_zone(lat, lon)
    utm_letter = _get_utm_letter(lat)

    if not utm_letter:
        utm_letter = 'X'

    return utm_zone, utm_letter


def distance_between(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """ Measures the distance between two points
    Arguments:
        lat1: the latitude of the first point
        lon1: the longitude of the first point
        lat2: the latitude of the second point
        lon2: the longitude of the second point
    Return:
        Returns the distance in meters between the two points
    """
    point1 = ogr.Geometry(ogr.wkbPoint)
    point1.AddPoint(lat1, lon1)
    point2 = ogr.Geometry(ogr.wkbPoint)
    point2.AddPoint(lat2, lon2)

    return point1.Distance(point2)


def deg2utm(lat: float, lon: float) -> tuple:
    """ Converts a point in lat-lon degrees to UTM
    Arguments:
        lat: the latitude of the point
        lon: the longitude of the point
    Return:
        Returns the converted point in an X,Y tuple
    """
    point = ogr.Geometry(ogr.wkbPoint)
    point.AddPoint(lat, lon)

    # Lat-Lon spatial reference
    latlon_ref = osr.SpatialReference()
    latlon_ref.ImportFromEPSG(LAT_LONG_WGS84_EPSG)

    # UTM spatial reference
    utm_ref = osr.SpatialReference()
    utm_ref.ImportFromEPSG(_deg2utm_epsg_code(lat, lon))

    # Transform from Lat-Lon to UTM
    transform = osr.CoordinateTransformation(latlon_ref, utm_ref)

    point.Transform(transform)

    return (point.GetX(), point.GetY())


def utm2deg(utm_x: float, utm_y: float, zone: int, letter: str) -> tuple:
    """ Converts the UTM information to latitude and longitude
    Arguments:
        utm_x: the UTM X value
        utm_y: the UTM Y value
        zone: the utm Zone number
        letter: the UTM zone associated letter
    Return:
        A tuple containing the latitude and longitude
    """
    point = ogr.Geometry(ogr.wkbPoint)
    point.AddPoint(utm_x, utm_y)

    # Lat-Lon spatial reference
    latlon_ref = osr.SpatialReference()
    latlon_ref.ImportFromEPSG(LAT_LONG_WGS84_EPSG)

    # UTM spatial reference
    utm_ref = osr.SpatialReference()
    utm_ref.ImportFromEPSG(_utm_epsg_code(zone, letter))

    # Transform from UTM to Lat-Lon
    transform = osr.CoordinateTransformation(utm_ref, latlon_ref)

    point.Transform(transform)

    return (point.GetX(), point.GetY())
