""" Contains the results of a query """

from typing import Optional

from .analysis import Analysis
from .coordinate_utils import deg2utm_code, deg2utm, DEFAULT_UTM_ZONE

from spd_types.s3info import S3Info

# The default interval value
DEFAULT_INTERVAL_MIN=0

class Results:
    """ Contains the results of a query """

    def __init__(self, results: tuple, all_species: tuple, all_locations: tuple, \
                 s3_info: S3Info, user_settings: dict, \
                 interval_minutes:int=DEFAULT_INTERVAL_MIN):
        """ Initializer
        Arguments:
            results: the search results
            all_locations: all the known locations
            all_species: all the known species
            s3_info: the information on the S3 instance
            user_settings: the user's settings
            interval_minutes: the number of minutes between images to discard
        """
        # Disabling this because we don't want to assign to class instance until all
        # the processing is done
        # pylint: disable=too-many-locals

        # We do this assignment so that it can be seen that the initializer was called even if a
        # problem ocurrs
        self._all_species = all_species
        self._results = results
        self._images = []
        self._locations = []
        self._species = []
        self._years = []
        self._interval_minutes = interval_minutes
        self._location_images = []
        self._species_images = []
        self._year_images = []
        self._s3_info = s3_info
        self._user_settings = user_settings

        # Check that we have results
        if results is None:
            return

        # Make sure results are iterable
        try:
            _ = results[0]
        except TypeError:
            return
        except IndexError:
            return

        try:
            cur_images, cur_locations, cur_years, cur_species = self._initialize(results, \
                                                                        all_locations)
        except KeyError as ex:
            print('Invalid results specified', flush=True)
            print(ex, flush=True)
            return

        # Sort images by year (we need a list of lists)
        year_images = [[]] * len(cur_years)
        for one_image in cur_images:
            cur_index = cur_years.index(one_image['image_dt'].year)
            year_images[cur_index].append(one_image)

        # Get pre-filtered lists of images
        by_location, by_species, by_year = self._prefilter(cur_images, cur_locations, cur_species, \
                                                                                        cur_years)

        # We are initialized, set our results
        self._results = results
        self._images = cur_images
        self._locations = cur_locations
        self._species = cur_species
        self._years = cur_years
        self._location_images = by_location
        self._species_images = by_species
        self._year_images = by_year

    @property
    def s3_info(self):
        """ Returns the S3 information """
        return self._s3_info

    @property
    def user_settings(self):
        """ Returns the user's settings """
        return self._user_settings

    def have_results(self):
        """ Returns whether or not we have results """
        return self._results is not None and len(self._results) > 0

    def _initialize(self, results: tuple, all_locations: tuple) -> tuple:
        """ Returns the image, locations, years, and species of the search results
        Arguments:
            results: the search results
            all_locations: all the known locations
            all_species: all the known species
        Returns:
            Returns a tupe containing the images (sorted by date and time), unique locations
            (sorted by nane), unique years (sorted by year), and unique species (sorted by name)
            of the search results
        """
        # pylint: disable=too-many-branches
        sorted_images = []
        for one_result in results:
            if one_result['images']:
                # Add the images, with location, to the list of all images
                sorted_images.extend([{'loc':one_result['loc']} | one_image for one_image in \
                                                                            one_result['images']])

        sorted_images = sorted(sorted_images, key=lambda cur_img: cur_img['image_dt'])

        # Get all the locations and check for an unknown (we use set here to remove duplicates)
        sorted_locations = sorted(set(map(lambda cur_img: cur_img['loc'], sorted_images)))
        have_unknown = False
        mapped_values = []
        for test_value in sorted_locations: # TODO: Handle only active locations
            found_items = [one_location for one_location in all_locations if \
                                        one_location['idProperty'].lower() == test_value.lower()]
            if found_items and len(found_items) > 0:
                mapped_values.append(found_items[0])
            else:
                # Try to find the entry in the results
                new_loc = None
                for one_result in results:
                    if 'loc' in one_result and one_result['loc'] and \
                                                                    one_result['loc'] == test_value:
                        if all(key in one_result for key in ('loc_name','loc_lat','loc_lon')):
                            try:
                                # Build up our entry. If there's a problem with this entry, maybe
                                # another would work out
                                utm_x, utm_y = deg2utm(float(one_result['loc_lat']),
                                                        float(one_result['loc_lon']))
                                utm_zone, utm_letter = deg2utm_code(float(one_result['loc_lat']),
                                                                    float(one_result['loc_lon']))
                                new_loc = {
                                    'nameProperty': one_result['loc_name'], \
                                    'idProperty': test_value,
                                    'latProperty': one_result['loc_lat'],
                                    'lngProperty': one_result['loc_lon'],
                                    'elevationProperty': one_result['elevation'],
                                    'utm_x': str(round(utm_x)),
                                    'utm_y': str(round(utm_y)),
                                    'utm_code': str(utm_zone)+str(utm_letter),
                                }
                                mapped_values.append(new_loc)
                                break
                            except ValueError:
                                pass
                # Make sure we have found it
                if new_loc is None:
                    have_unknown = True

        sorted_locations = mapped_values
        if have_unknown:
            sorted_locations.append({'nameProperty':'Unknown', 'idProperty':'unknown',
                                    'latProperty':0.0, 'lngProperty':0.0, 'elevationProperty':0.0,
                                    'utm_code':DEFAULT_UTM_ZONE, 'utm_x':0.0, 'utm_y':0.0})

        # Get all the species and check for unknown
        cur_species = {}
        for one_image in sorted_images:
            for one_species in one_image['species']:
                if 'name' not in one_species or 'scientificName' not in one_species or not \
                                        one_species['name'] or not one_species['scientificName']:
                    continue
                if not one_species['scientificName'] in cur_species:
                    cur_species[one_species['scientificName']] = {
                                                'first_image':one_image,
                                                'last_image':one_image,
                                                'name':one_species['name'],
                                                'scientificName':one_species['scientificName']
                                               }
                else:
                    # Update the last image for the species if it's later than the current
                    # last image
                    if one_image['image_dt'] > \
                            cur_species[one_species['scientificName']]['last_image']['image_dt']:
                        cur_species[one_species['scientificName']]['last_image'] = one_image

        sorted_species = sorted(map(lambda one_species: one_species['scientificName'], \
                                [{'name':key} | item for key, item in cur_species.items()]))
        have_unknown = False
        mapped_values = []
        for test_value in sorted_species:
            if test_value in cur_species:
                mapped_values.append(cur_species[test_value])
            else:
                have_unknown = True

        sorted_species = mapped_values
        if have_unknown:
            sorted_species.append({'name': 'Unknown', 'scientificName': 'unknown', \
                                  'speciesIconURL': 'https://i.imgur.com/4qz5mI0.png', \
                                  'keyBinding': None
                                  })

        # Get all the years sorted
        sorted_years = sorted(set(map(lambda item: item['image_dt'].year, sorted_images)))

        return (sorted_images, sorted_locations, sorted_years, sorted_species)

    def _prefilter(self, images: tuple, locations: tuple, species: tuple, years: tuple) -> tuple:
        """ Performs prefiltering of the images by various values
        Arguments:
            images: the images to filter
            locations: the list of unique locations to filter on
            species: the list of unique species to filter on
            years: the list of unique years to filter on
        Return:
            Returns a tuple of dicts with the values (such as location ID) as keys with the matching
            images in a tuple. Image tuples may contain duplicate image entries across different
            keys
            e.g.: ((location image dict), (species image dict), (year image dict))
        """
        locations_filtered = {one_location['idProperty']: [] for one_location in locations}
        species_filtered = {one_species['scientificName']: [] for one_species in species}
        years_filtered = {one_year: [] for one_year in years}
        upper_locations_filtered = [one_loc.upper() for one_loc in locations_filtered]

        # Loop through the images and add them to the correct buckets
        for one_image in images:
            if one_image['loc'] in locations_filtered:
                locations_filtered[one_image['loc']].append(one_image)
            elif one_image['loc'].upper() in upper_locations_filtered:
                # Find the right bucket to put this in
                for one_loc in locations_filtered:
                    if one_loc.upper() == one_image['loc'].upper():
                        locations_filtered[one_loc].append(one_image)
                        break
            else:
                locations_filtered['unknown'].append(one_image)
            for one_species in one_image['species']:
                if 'name' not in one_species or 'scientificName' not in one_species or not \
                                        one_species['name'] or not one_species['scientificName']:
                    continue
                species_filtered[one_species['scientificName']].append(one_image)
            years_filtered[one_image['image_dt'].year].append(one_image)

        return locations_filtered, species_filtered, years_filtered

    def get_interval(self) -> int:
        """ Returns the image interval in seconds """
        return self._interval_minutes

    def get_images(self) -> tuple:
        """ Returns the date sorted list of images
        Return:
            The tuple of images sorted by date
        """
        if self._images is not None:
            return self._images

        raise RuntimeError('Call made to Results.get_images after bad initialization')

    def get_locations(self) -> tuple:
        """ Returns the unique locations sorted by ID
        Return:
            Returns the tuple of location IDs
        """
        if self._locations is not None:
            return self._locations

        raise RuntimeError('Call made to Results.get_locations after bad initialization')

    def get_species(self) -> tuple:
        """ Returns the unique species sorted by scientific name
        Return:
            Returns the tuple of species
        """
        if self._species is not None:
            return self._species

        raise RuntimeError('Call made to Results.get_species after bad initialization')

    def get_species_by_name(self) -> tuple:
        """ Returns the unique species sorted by name
        Return:
            Returns the tuple of species
        """
        if self._species is not None:
            return sorted(self._species, key=lambda item: item['name'])

        raise RuntimeError('Call made to Results.get_species after bad initialization')

    def get_years(self) -> tuple:
        """ Returns the unique sorted years
        Return:
            Returns the tuple of years
        """
        if self._years is not None:
            return self._years

        raise RuntimeError('Call made to Results.get_years after bad initialization')

    def get_all_species(self) -> tuple:
        """ Returns the list of all the species """
        if self._all_species is not None:
            return self._all_species

        raise RuntimeError('Call made to Results.get_all_species after bad initialization')

    def get_location_images(self, location_id: str) -> tuple:
        """ Returns the list of images filtered by species name
        Arguments:
            location_id: the id of the location
        Return:
            A tuple containing the images for that location
        """
        if self._location_images is not None:
            if location_id in self._location_images:
                return self._location_images[location_id]
            return ()

        raise RuntimeError('Call made to Results.get_location_images after bad initialization')

    def get_species_images(self, species_sci_name: str) -> tuple:
        """ Returns the list of images filtered by species name
        Arguments:
            species_sci_name: the scientific species name
        Return:
            A tuple containing the images for that species
        """
        if self._species_images is not None:
            if species_sci_name in self._species_images:
                return self._species_images[species_sci_name]
            return ()

        raise RuntimeError('Call made to Results.get_species_images after bad initialization')

    def get_year_images(self, year: int) -> tuple:
        """ Returns the list of images for a specific year
        Arguments:
            year: the year to return
        Returns:
            Returns the tuple of images for the specified year. An empty tuple is returned if the
            year doesn't have any images associated with it
        """
        if self._year_images is not None:
            if year in self._year_images:
                return self._year_images[year]
            return ()

        raise RuntimeError('Call made to Results.get_year_images after bad initialization')

    def get_first_image(self) -> Optional[dict]:
        """ Returns the first image in the timestamp sorted result set
        Return:
            Returns the first image in the result set
        """
        if self._images is not None:
            if len(self._images) > 0:
                return self._images[0]
            return None

        raise RuntimeError('Call made to Results.get_first_image after bad initialization')

    def get_last_image(self) -> Optional[dict]:
        """ Returns the last image in the timestamp sorted result set
        Return:
            Returns the last image in the result set
        """
        if self._images is not None:
            if len(self._images) > 0:
                return self._images[len(self._images) - 1]
            return None

        raise RuntimeError('Call made to Results.get_last_image after bad initialization')

    def get_first_year(self) -> Optional[int]:
        """ Returns the first unique year
        Return:
            Returns the first year from the result set
        """
        if self._years is not None:
            if len(self._years) > 0:
                return self._years[0]
            return None

        raise RuntimeError('Call made to Results.get_first_year after bad initialization')

    def get_last_year(self) -> Optional[int]:
        """ Returns the last unique year
        Return:
            Returns the last unique year from the result set
        """
        if self._years is not None:
            if len(self._years) > 0:
                return self._years[len(self._years) - 1]
            return None

        raise RuntimeError('Call made to Results.get_last_year after bad initialization')


    def get_image_location(self, location_id: str) -> str:
        """ Finds the location object for the specified location ID
        Arguments:
            location_id: the location ID for returning the instance
        Return:
            The location instance or None if it's not found
        """
        if self._locations is not None:
            possible_loc = tuple((one_loc for one_loc in self._locations if \
                                        one_loc['idProperty'].lower() == location_id.lower()))
            # Check that it's not an unknown location
            if len(possible_loc) <= 0:
                possible_loc = tuple(({'nameProperty':'Unknown', 'idProperty':location_id,
                                'latProperty':0.0, 'lngProperty':0.0, 'elevationProperty':0.0},))

            found_loc = next(iter(possible_loc))
            if found_loc:
                return found_loc

            return None

        raise RuntimeError('Call made to Results.get_image_location after bad initialization')


    def get_location_name(self, location_id: str) -> str:
        """ Finds the location name for the specified location ID
        Arguments:
            location_id: the location ID for returning the name
        Return:
            The name of the location or None if it's not found
        """
        if self._locations is not None:
            found_loc = self.get_image_location(location_id)
            if found_loc and 'nameProperty' in found_loc:
                return found_loc['nameProperty']
            return None

        raise RuntimeError('Call made to Results.get_location_name after bad initialization')

    def filter_year(self, images: tuple, year: int) -> tuple:
        """ Filters the images by year
        Arguments:
            images: the tuple of images to search through
            year: the year to filter on
        Return:
            A tuple containing the images for that hour range
        """
        return [one_image for one_image in images if \
                                            one_image['image_dt'].year == year]

    def filter_hours(self, images: tuple, hour_start: int, hour_end: int) -> tuple:
        """ Filters the images by hour range (not including ending hour)
        Arguments:
            images: the tuple of images to search through
            hour_start: the starting hour value (hours start at 0)
            hour_end: the ending hour value (hours start at 0)
        Return:
            A tuple containing the images for that hour range
        """
        return [one_image for one_image in images if \
                                            one_image['image_dt'].hour >= hour_start and \
                                            one_image['image_dt'].hour < hour_end]

    def filter_month(self, images: tuple, month: int) -> tuple:
        """ Filters the images by image month
        Arguments:
            images: the tuple of images to search through
            month: the month to filter on (months start at zero - 0)
        Return:
            A tuple containing the images for that month
        """
        return [one_image for one_image in images if one_image['image_dt'].month == month]

    def filter_month_list(self, images: tuple, months: tuple) -> tuple:
        """ Filters the images by image month
        Arguments:
            images: the tuple of images to search through
            month: a tuple of months to filter on (months start at zero - 0)
        Return:
            A tuple containing the images for those months
        """
        return [one_image for one_image in images if one_image['image_dt'].month in months]

    def filter_location(self, images: tuple, location_id: str) -> tuple:
        """ Filters the image by the location ID
        Arguments:
            images: the tuple of images to search through
            location_id: the location ID to filter on
        Return:
            A tuple containing the images for that location
        """
        return [one_image for one_image in images if one_image['loc'].lower() == \
                                                                            location_id.lower()]

    def filter_species(self, images: tuple, species_sci_name: str) -> tuple:
        """ Filters the image by the species scientific name
        Arguments:
            images: the tuple of images to search through
            species_sci_name: the scientific species name to sort on
        Return:
            A tuple containing the images for that species
        """
        return [one_image for one_image in images if \
                                            Analysis.image_has_species(one_image, species_sci_name)]

    def locations_for_image_list(self, images: tuple) -> tuple:
        """ Returns a list of locations that the image list contains
        Arguments:
            images: the tuple of images to search
        Return:
            Returns the tuple consisting of the unique locations
        """

        # pylint: disable=consider-using-set-comprehension
        return tuple(set([item['loc'] for item in images]))
