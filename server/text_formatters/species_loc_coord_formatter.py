""" Formats species with location/utm/latlng coordinates """

import dataclasses
import os

from .coordinate_utils import deg2utm
from .results import Results

# pylint: disable=consider-using-f-string
@dataclasses.dataclass
class SpeciesLocCoordFormatter:
    """ Formats species with location/utm/latlng coordinates
    """

    @staticmethod
    def print_species_by_loc_with_utm(results: Results) \
                                                                                            -> str:
        """ For each species a list of locations where the species was recorded, and the UTM and
            elevation of the location.
        Arguments:
            results: the results to search through
        Return:
            Returns the image analysis text
        """
        result = 'SPECIES BY LOCATION WITH UTM AND ELEVATION' + os.linesep
        for species in results.get_species_by_name():
            species_images = results.get_species_images(species['scientificName'])
            result += species['name'] + os.linesep

            result += 'Location                        UTMe-w   UTMn-s    Elevation   Lat        ' \
                      'Long' + os.linesep
            for location in results.locations_for_image_list(species_images):
                # Get the full location entry
                location = results.get_image_location(location)
                utm_coord = deg2utm(float(location['latProperty']), float(location['lngProperty']))

                # We format the easting then northing of the UTM coordiantes
                result += '{:<28s}  {:8d}  {:8d}  {:7.0f}      {:8.6f}  {:8.6f}'. \
                                format(
                                    location['nameProperty'],
                                    round(utm_coord[0]), 
                                    round(utm_coord[1]),
                                    float(location['elevationProperty']),
                                    float(location['latProperty']),
                                    float(location['lngProperty'])
                                ) + os.linesep

            result += os.linesep

        return result
