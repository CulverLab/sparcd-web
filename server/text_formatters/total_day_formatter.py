""" Formats calculations containing "total days" """

import dataclasses
import os

from .analysis import Analysis
from .results import Results

# pylint: disable=consider-using-f-string
@dataclasses.dataclass
class TotalDayFormatter:
    """ Formats calculations containing "total days"
    """

    @staticmethod
    def print_pictures_by_month_year_loc(results: Results) -> str:
        """ For each year and for each month a table of the number of independent pictures per
            month for each location. The last column shows the Total number of independent pictures
            at a location for all months. Total pictures for each month and then year is also given.
            For all locations Total days is the number of camera trap days (or effort) for each
            month, with the total of all months in the last column. The last row, Pictures/day,
            is Total pictures normalized (divided) by total effort for each month, and for all 12
            months
        Arguments:
            results: the results to search through
        Return:
            Returns the image analysis text
        """
        result = 'PICTURES FOR EACH LOCATION BY MONTH AND YEAR' + os.linesep
        result += '  Number of independent pictures per location' + os.linesep

        for one_year in results.get_years():
            result += str(one_year) + os.linesep
            result += 'Location                      Jan   Feb   Mar   Apr   May   Jun   Jul   ' \
                      'Aug   Sep   Oct   Nov   Dec   Total' + os.linesep

            for location in results.get_locations():

                year_location_images = results.filter_location(results.get_year_images(one_year),
                                                               location['idProperty'])

                if year_location_images:
                    result += '{:<28s}'.format(location['nameProperty'])

                    total = 0
                    for one_month in range(0, 12):
                        year_location_month_images = results.filter_month(year_location_images,
                                                                          one_month)

                        period = Analysis.period_for_image_list(year_location_month_images,
                                                                results.get_interval())
                        total = total + period
                        result += '{:5d} '.format(period)

                    result += '{:7d}'.format(total) + os.linesep

            result += 'Total pictures              '
            total_pic = 0
            total_pics = [0] * 12
            for one_month in range(0, 12):
                total_period = 0
                for location in results.get_locations():
                    year_location_month_images = results.filter_month(
                                                        results.filter_location(
                                                            results.get_year_images(one_year),
                                                            location['idProperty']),
                                                        one_month)

                    period = Analysis.period_for_image_list(year_location_month_images,
                                                                            results.get_interval())
                    total_pic += period
                    total_period += period
                    total_pics[one_month] += period

                result += '{:5d} '.format(total_period)

            result += '{:7d}'.format(total_pic) + os.linesep

            result += 'Total days                     '
            year_images = results.get_year_images(one_year)
            days_used = [0] * 12
            for location in results.get_locations():
                year_location_images = results.filter_location(year_images, location['idProperty'])

                if year_location_images:
                    first = year_location_images[0]
                    last = year_location_images[len(year_location_images) - 1]
                    first_cal = first['image_dt']
                    last_cal = last['image_dt']
                    first_days_in_month = 31
                    first_day = first_cal.day - 1
                    last_day = last_cal.day - 1
                    first_month = first_cal.month - 1
                    last_month = last_cal.month - 1
                    if first_month == last_month:
                        days_used[first_month] = days_used[first_month] + (last_day - first_day + 1)
                    else:
                        days_used[first_month] = days_used[first_month] + \
                                                            (first_days_in_month - (first_day - 1))
                        first_month += 1
                        while first_month < last_month:
                            days_used[first_month] = days_used[first_month] + 31
                            first_month += 1
                        days_used[last_month] = days_used[last_month] + last_day

            total_days = 0
            for one_month in days_used:
                result += '{:2d}    '.format(one_month)
                total_days = total_days + one_month

            result += ' {:3d}'.format(total_days) + os.linesep

            result += 'Pictures/day               '
            for one_month in range(0, 12):
                result += '{:6.2f}'.format(0.0 if days_used[one_month] == 0 else \
                                (float(total_pics[one_month]) / float(days_used[one_month])))

            result += '  {:6.2f}'.format(0.0 if total_days == 0 else \
                                                            (float(total_pic) / float(total_days)))

            result += os.linesep + os.linesep

        return result

    @staticmethod
    def print_pictures_by_month_loc(results: Results) -> str:
        """ Formats summary of each location by month and year
        Arguments:
            results: the results to search through
        Return:
            Returns the image analysis text
        """
        result = 'PICTURES FOR EACH LOCATION BY MONTH AND YEAR SUMMARY' + os.linesep
        result += '  Number of independent pictures per location' + os.linesep

        if results.get_years():
            result += 'Years ' + str(results.get_first_year()) + ' to ' + \
                                            str(results.get_last_year()) + os.linesep

        result += 'Location                      Jan   Feb   Mar   Apr   May   Jun   Jul   Aug   ' \
                  'Sep   Oct   Nov   Dec   Total' + os.linesep
        for location in results.get_locations():
            result += '{:<28s}'.format(location['nameProperty'])

            location_images = results.get_location_images(location['idProperty'])

            pics_in_year = 0
            for one_month in range(0, 12):
                location_month_images = results.filter_month(location_images, one_month)

                period = Analysis.period_for_image_list(location_month_images,
                                                                            results.get_interval())
                pics_in_year = pics_in_year + period
                result += '{:5d} '.format(period)

            result += '  {:5d}'.format(pics_in_year) + os.linesep

        result += 'Total pictures              '
        total_pic = 0
        total_pics = [0] * 12
        for one_month in range(0, 12):
            total_period = 0
            for location in results.get_locations():
                location_month_images = results.filter_month(results.get_location_images(
                                                                        location['idProperty']),
                                                            one_month)

                period = Analysis.period_for_image_list(location_month_images,
                                                                            results.get_interval())
                total_pic += period
                total_period += period
                total_pics[one_month] += period

            result += '{:5d} '.format(total_period)

        result += '{:7d}'.format(total_pic) + os.linesep

        result += 'Total days                     '
        days_used = [0] * 12
        for one_year in results.get_years():
            year_images = results.get_year_images(one_year)

            for location in results.get_locations():

                year_location_images = results.filter_location(year_images, location['idProperty'])
                if year_location_images:
                    first = year_location_images[0]
                    last = year_location_images[len(year_location_images) - 1]
                    first_cal = first['image_dt']
                    last_cal = last['image_dt']
                    first_days_in_month = 31
                    first_day = first_cal.month - 1
                    last_day = last_cal.month - 1
                    first_month = first_cal.month - 1
                    last_month = last_cal.month - 1
                    if first_month == last_month:
                        days_used[first_month] = days_used[first_month] + (last_day - first_day + 1)
                    else:
                        days_used[first_month] = days_used[first_month] + \
                                                            (first_days_in_month - (first_day - 1))
                        first_month += 1
                        while first_month < last_month:
                            days_used[first_month] = days_used[first_month] + 31
                            first_month += 1

                        days_used[last_month] = days_used[last_month] + last_day

        total_days = 0
        for month in days_used:
            result += '{:2d}    '.format(month)
            total_days = total_days + month

        result += ' {:3d}'.format(total_days) + os.linesep

        result += 'Pictures/day               '
        for one_month in range(0, 12):
            result += '{:6.2f}'.format(0.0 if days_used[one_month] == 0 else \
                                    (float(total_pics[one_month]) / float(days_used[one_month])))

        result += '  {:6.2f}'.format(0.0 if total_days == 0 else \
                                                            (float(total_pic) / float(total_days)))

        result += os.linesep + os.linesep

        return result

    @staticmethod
    def print_pictures_by_month_year_species_richness(results: Results) -> str:
        """ For each year a table of species records for each month, and the total number of each 
            species for the year. For all speies, for each month Total pictures, Total days
            (effort), 10*(number of pictures divived by total effort), and species richness is given
        Arguments:
            results: the results to search through
        Return:
            Returns the image analysis text
        """
        result = 'SPECIES AND SPECIES RICHNESS BY YEAR AND MONTH' + os.linesep
        result += '  One record of each species per location per PERIOD' + os.linesep

        for one_year in results.get_years():
            result += str(one_year) + os.linesep
            result += 'Species                       Jan   Feb   Mar   Apr   May   Jun   Jul   ' \
                      'Aug   Sep   Oct   Nov   Dec   Total' + os.linesep

            total_richness = [0] * 12
            for species in results.get_species_by_name():

                year_species_images = results.filter_year(results.get_species_images(
                                                                    species['scientificName']),
                                                          one_year)

                if year_species_images:
                    result += '{:<28s}'.format(species['name'])
                    total = 0
                    for one_month in range(0, 12):
                        year_species_month_images = results.filter_month(year_species_images,
                                                                         one_month)

                        period = Analysis.period_for_image_list(year_species_month_images,
                                                                            results.get_interval())
                        total = total + period
                        result += '{:5d} '.format(period)
                        total_richness[one_month] = total_richness[one_month] + \
                                                                        (0 if period == 0 else 1)

                    result += '{:7d}'.format(total) + os.linesep

            result += 'Total pictures              '

            total_pic = 0
            total_pics = [0] * 12
            for one_month in range(0, 12):
                year_month_images = results.filter_month(results.get_year_images(one_year),
                                                         one_month)

                total_period = 0
                for location in results.get_locations():
                    year_month_location_images = results.filter_location(year_month_images,
                                                                         location['idProperty'])
                    period = Analysis.period_for_image_list(year_month_location_images,
                                                            results.get_interval())
                    total_pic = total_pic + period
                    total_period = total_period + period
                    total_pics[one_month] = total_pics[one_month] + period

                result += '{:5d} '.format(total_period)

            result += '{:7d}'.format(total_pic) + os.linesep

            result += 'Total days                     '
            year_images = results.get_year_images(one_year)

            days_used = [0] * 12
            for location in results.get_locations():
                year_location_images = results.filter_location(year_images, location['idProperty'])
                if year_location_images:
                    first = year_location_images[0]
                    last = year_location_images[len(year_location_images) - 1]
                    first_cal = first['image_dt']
                    last_cal = last['image_dt']
                    first_days_in_month = 31
                    first_day = first_cal.day - 1
                    last_day = last_cal.day - 1
                    first_month = first_cal.month - 1
                    last_month = last_cal.month - 1
                    if first_month == last_month:
                        days_used[first_month] = days_used[first_month] + (last_day - first_day + 1)
                    else:
                        days_used[first_month] = days_used[first_month] + \
                                                            (first_days_in_month - (first_day - 1))
                        first_month += 1
                        while first_month < last_month:
                            days_used[first_month] = days_used[first_month] + 31
                            first_month += 1

                        days_used[last_month] = days_used[last_month] + last_day

            total_days = 0
            for month in days_used:
                result += '{:2d}    '.format(month)
                total_days = total_days + month

            result += ' {:3d}'.format(total_days) + os.linesep

            result += '10*Pic/effort              '

            for one_month in range(0, 12):
                result += '{:6.2f}'.format(0.0 if days_used[one_month] == 0 else \
                            10.0 * (float(total_pics[one_month]) / float(days_used[one_month])))

            result += os.linesep

            result += 'Species richness            '

            for one_month in range(0, 12):
                result += '{:5d} '.format(total_richness[one_month])

            result += os.linesep + os.linesep

        return result

    @staticmethod
    def print_pictures_by_month_species_richness(results: Results) -> str:
        """ SPecies by location, year, month, and elevation
        Arguments:
            results: the results to search through
            res_locations: all distinct result locations
            res_species: all distinct result species information
            interval_minutes: the interval between images to be considered the same period
                                (in minutes)
        Return:
            Returns the image analysis text
        """
        result = 'SPECIES ALL YEARS BY MONTH' + os.linesep
        result += '  One record of each species per location per PERIOD' + os.linesep
        result += 'Species                       Jan   Feb   Mar   Apr   May   Jun   Jul   Aug   ' \
                  'Sep   Oct   Nov   Dec   Total' + os.linesep

        total_richness = [0] * 12
        for species in results.get_species_by_name():
            result += '{:<28s}'.format(species['name'])

            species_images = results.get_species_images(species['scientificName'])
            total = 0
            for one_month in range(0, 12):
                species_month_images = results.filter_month(species_images, one_month)
                period = Analysis.period_for_image_list(species_month_images,
                                                                            results.get_interval())
                total = total + period
                result += '{:5d} '.format(period)
                total_richness[one_month] = total_richness[one_month] + (0 if period == 0 else 1)

            result += '{:7d}'.format(total) + os.linesep

        result += 'Total pictures              '

        total_pic = 0
        total_pics = [0] * 12
        for one_month in range(0, 12):
            month_images = results.filter_month(results.get_images(), one_month)
            total_period = 0
            for location in results.get_locations():
                for one_year in results.get_years():
                    month_location_year_images = results.filter_year(
                                                    results.filter_location(month_images,
                                                                        location['idProperty']),
                                                    one_year)

                    period = Analysis.period_for_image_list(month_location_year_images,
                                                                            results.get_interval())
                    total_pic = total_pic + period
                    total_period = total_period + period
                    total_pics[one_month] = total_pics[one_month] + period

            result += '{:5d} '.format(total_period)

        result += '{:7d}'.format(total_pic) + os.linesep

        result += 'Total days                     '

        days_used = [0] * 12
        for one_year in results.get_years():
            year_images = results.get_year_images(one_year)
            for location in results.get_locations():
                year_location_images = results.filter_location(year_images, location['idProperty'])
                if year_location_images:
                    first = year_location_images[0]
                    last = year_location_images[len(year_location_images) - 1]
                    first_cal = first['image_dt']
                    last_cal = last['image_dt']
                    first_days_in_month = 31
                    first_day = first_cal.day - 1
                    last_day = last_cal.day - 1
                    first_month = first_cal.month - 1
                    last_month = last_cal.month - 1
                    if first_month == last_month:
                        days_used[first_month] = days_used[first_month] + (last_day - first_day + 1)
                    else:
                        days_used[first_month] = days_used[first_month] + \
                                                            (first_days_in_month - (first_day - 1))
                        first_month += 1
                        while first_month < last_month:
                            days_used[first_month] = days_used[first_month] + 31
                            first_month += 1

                        days_used[last_month] = days_used[last_month] + last_day

        total_days = 0
        for month in days_used:
            result += '{:2d}    '.format(month)
            total_days = total_days + month

        result += ' {:3d}'.format(total_days) + os.linesep

        result += '10*Pic/effort              '

        for one_month in range(0, 12):
            result += '{:6.2f}'.format(0.0 if days_used[one_month] == 0 else \
                                10.0 * (float(total_pics[one_month]) / float(days_used[one_month])))

        result += os.linesep

        result += 'Species richness            '

        for one_month in range(0, 12):
            result += '{:5d} '.format(total_richness[one_month])

        result += os.linesep + os.linesep

        return result

    @staticmethod
    def print_pictures_by_month_species_loc_elevation(results: Results) -> str:
        """ Formats result bu location, year, and month
        Arguments:
            results: the results to search through
        Return:
            Returns the image analysis text
        """
        result = 'SPECIES BY LOCATION BY YEAR BY MONTH SORTED BY ELEVATION' + os.linesep
        result += '  One record of each species per location per PERIOD' + os.linesep

        for species in results.get_species_by_name():
            result += species['name'] + os.linesep

            for one_year in results.get_years():
                species_year_images = results.filter_year(
                                            results.get_species_images(species['scientificName']),
                                            one_year)

                if species_year_images:
                    result += str(one_year) + os.linesep

                    result += 'Location                  Elevation  Jan   Feb   Mar   Apr   May   '\
                              'Jun   Jul   Aug   Sep   Oct   Nov   Dec   Total' + os.linesep

                    for location in results.get_locations():
                        species_year_location_images = results.filter_location(species_year_images,
                                                                            location['idProperty'])
                        if species_year_location_images:
                            result += '{:<28s} {:6d}'.format(location['nameProperty'],
                                                        int(float(location['elevationProperty'])))
                            total = 0
                            for one_month in range(0, 12):
                                syl_month_images = results.filter_month(
                                                            species_year_location_images, one_month)
                                period = Analysis.period_for_image_list(syl_month_images,
                                                                            results.get_interval())
                                total = total + period
                                result += '{:5d} '.format(period)

                            result += '{:7d}'.format(total) + os.linesep

                    result += 'Total pictures                     '

                    total_pic = 0
                    total_pics = [0] * 12
                    for one_month in range(0, 12):
                        species_month_year_images = results.filter_year(
                                                        results.filter_month(
                                                            results.get_species_images(
                                                                    species['scientificName']),
                                                                one_month),
                                                            one_year)
                        total_period = 0
                        for location in results.get_locations():
                            smy_location_images = results.filter_location(
                                                                    species_month_year_images,
                                                                    location['idProperty'])
                            period = Analysis.period_for_image_list(smy_location_images,
                                                                            results.get_interval())
                            total_pic = total_pic + period
                            total_period = total_period + period
                            total_pics[one_month] = total_pics[one_month] + period

                        result += '{:5d} '.format(total_period)

                    result += '{:7d}'.format(total_pic) + os.linesep

                    result += 'Total days                            '

                    days_used = [0] * 12
                    year_images = results.get_year_images(one_year)

                    for location in results.get_locations():
                        year_location_images = results.filter_location(year_images,
                                                                       location['idProperty'])

                        if year_location_images:
                            first = year_location_images[0]
                            last = year_location_images[len(year_location_images) - 1]
                            first_cal = first['image_dt']
                            last_cal = last['image_dt']
                            first_days_in_month = 31
                            first_day = first_cal.day - 1
                            last_day = last_cal.day - 1
                            first_month = first_cal.month - 1
                            last_month = last_cal.month - 1
                            if first_month == last_month:
                                days_used[first_month] = days_used[first_month] + \
                                                                (last_day - first_day + 1)
                            else:
                                days_used[first_month] = days_used[first_month] + \
                                                            (first_days_in_month - (first_day - 1))
                                first_month += 1
                                while first_month < last_month:
                                    days_used[first_month] = days_used[first_month] + 31
                                    first_month += 1

                                days_used[last_month] = days_used[last_month] + last_day

                    total_days = 0
                    for month in days_used:
                        result += '{:2d}    '.format(month)
                        total_days = total_days + month

                    result += ' {:3d}'.format(total_days) + os.linesep

                    result += '10*Pic/effort                     '

                    for one_month in range(0, 12):
                        result += '{:6.2f}'.format(0.0 if days_used[one_month] == 0 else \
                                10.0 * (float(total_pics[one_month]) / float(days_used[one_month])))

                    result += os.linesep + os.linesep

            result += 'SUMMARY ALL YEARS' + os.linesep

            if len(results.get_years()) > 0:
                result += 'Years ' + str(results.get_first_year()) + ' to ' + \
                                                        str(results.get_last_year()) + os.linesep

            result += 'Location                  Elevation  Jan   Feb   Mar   Apr   May   Jun   ' \
                      'Jul   Aug   Sep   Oct   Nov   Dec   Total' + os.linesep

            for location in results.get_locations():
                location_species_images = results.filter_species(results.get_location_images(
                                                                        location['idProperty']),
                                                                species['scientificName'])

                if location_species_images:

                    result += '{:<28s} {:6d}'.format(location['nameProperty'],
                                                        int(float(location['elevationProperty'])))
                    total = 0
                    for one_month in range(0, 12):
                        location_species_month_images = results.filter_month(
                                                                        location_species_images,
                                                                        one_month)
                        total_period = 0
                        for one_year in results.get_years():
                            lsm_year_images = results.filter_year(location_species_month_images,
                                                                  one_year)
                            period = Analysis.period_for_image_list(lsm_year_images,
                                                                            results.get_interval())
                            total_period = total_period + period
                            total = total + period

                        result += '{:5d} '.format(total_period)

                    result += '{:7d}'.format(total) + os.linesep


            result += 'Total pictures                     '

            total_pic = 0
            total_pics = [0] * 12
            for one_month in range(0, 12):
                species_month_images = results.filter_month(results.get_species_images(
                                                                    species['scientificName']),
                                                            one_month)

                total_period = 0
                for one_year in results.get_years():
                    for location in results.get_locations():
                        sm_year_location_images = results.filter_location(results.filter_year(
                                                                        species_month_images,
                                                                        one_year),
                                                                    location['idProperty'])
                        period = Analysis.period_for_image_list(sm_year_location_images,
                                                                            results.get_interval())
                        total_pic = total_pic + period
                        total_period = total_period + period
                        total_pics[one_month] = total_pics[one_month] + period

                result += '{:5d} '.format(total_period)

            result += '{:7d}'.format(total_pic) + os.linesep

            result += 'Total days                            '

            days_used = [0] * 12
            for one_year in results.get_years():
                year_images = results.get_year_images(one_year)

                for location in results.get_locations():
                    year_location_images = results.filter_location(year_images,
                                                                   location['idProperty'])

                    if year_location_images:
                        first = year_location_images[0]
                        last = year_location_images[len(year_location_images) - 1]
                        first_cal = first['image_dt']
                        last_cal = last['image_dt']
                        first_days_in_month = 31
                        first_day = first_cal.day - 1
                        last_day = last_cal.day - 1
                        first_month = first_cal.month - 1
                        last_month = last_cal.month - 1
                        if first_month == last_month:
                            days_used[first_month] = days_used[first_month] + \
                                                                        (last_day - first_day + 1)
                        else:
                            days_used[first_month] = days_used[first_month] + \
                                                            (first_days_in_month - (first_day - 1))
                            first_month += 1
                            while first_month < last_month:
                                days_used[first_month] = days_used[first_month] + 31
                                first_month += 1

                            days_used[last_month] = days_used[last_month] + last_day

            total_days = 0
            for month in days_used:
                result += '{:2d}    '.format(month)
                total_days = total_days + month

            result += ' {:3d}'.format(total_days) + os.linesep

            result += '10*Pic/effort                     '

            for one_month in range(0, 12):
                result += '{:6.2f}'.format(0.0 if days_used[one_month] == 0 else \
                                10.0 * (float(total_pics[one_month]) / float(days_used[one_month])))
            result += os.linesep + os.linesep

        return result

    @staticmethod
    def print_abundance_by_month_species_loc_elevation(results: Results) -> str:
        """ Forrmats species abundance by location, year, and month
        Arguments:
            results: the results to search through
        Return:
            Returns the image analysis text
        """
        result = 'SPECIES ABUNDANCE BY LOCATION BY YEAR BY MONTH SORTED BY ELEVATION' + os.linesep
        result += '  One record of each species per location per PERIOD' + os.linesep
        result += '  Use maximum number of individuals per PERIOD' + os.linesep

        for species in results.get_species():
            result += species['name'] + os.linesep

            species_images = results.get_species_images(species['scientificName'])

            for one_year in results.get_years():

                species_year_images = results.filter_year(species_images, one_year)

                if species_year_images:
                    result += str(one_year) + os.linesep

                    result += 'Location                  Elevation  Jan   Feb   Mar   Apr   May   '\
                              'Jun   Jul   Aug   Sep   Oct   Nov   Dec   Total' + os.linesep

                    for location in results.get_locations():
                        species_year_location_images = results.filter_location(species_year_images,
                                                                            location['idProperty'])

                        if species_year_location_images:
                            result += '{:<28s} {:6d}'.format(location['nameProperty'],
                                                        int(float(location['elevationProperty'])))
                            total = 0
                            for one_month in range(0, 12):
                                syl_month_images = results.filter_month(
                                                                    species_year_location_images,
                                                                    one_month)
                                abundance = Analysis.abundance_for_image_list(syl_month_images,
                                                                        results.get_interval(),
                                                                        species['scientificName'])
                                total = total + abundance
                                result += '{:5d} '.format(abundance)

                            result += '{:7d}'.format(total) + os.linesep

                    result += 'Total pictures                     '

                    total_pic = 0
                    total_pics = [0] * 12
                    for one_month in range(0, 12):
                        species_year_month_images = results.filter_month(species_year_images,
                                                                         one_month)

                        total_period = 0
                        for location in results.get_locations():
                            sym_location_images = results.filter_location(
                                                                        species_year_month_images,
                                                                        location['idProperty'])
                            period = Analysis.period_for_image_list(sym_location_images,
                                                                            results.get_interval())
                            total_pic = total_pic + period
                            total_period = total_period + period
                            total_pics[one_month] = total_pics[one_month] + period

                        result += '{:5d} '.format(total_period)

                    result += '{:7d}'.format(total_pic) + os.linesep

                    result += 'Total abundance                    '
                    total_abundance_pics = 0
                    total_abundances = [0] * 12
                    for one_month in range(0, 12):
                        species_year_month_images = results.filter_month(species_year_images,
                                                                         one_month)
                        total_abundance = 0
                        for location in results.get_locations():
                            sym_location_images = results.filter_location(
                                                                        species_year_month_images,
                                                                        location['idProperty'])
                            abundance = Analysis.abundance_for_image_list(sym_location_images,
                                                                        results.get_interval(),
                                                                        species['scientificName'])
                            total_abundance_pics = total_abundance_pics + abundance
                            total_abundance = total_abundance + abundance

                        total_abundances[one_month] = total_abundances[one_month] + total_abundance
                        result += '{:5d} '.format(total_abundance)

                    result += '{:7d}'.format(total_abundance_pics) + os.linesep

                    result += 'Avg abundance                      '
                    for one_month in range(0, 12):
                        result += '{:5.2f} '.format(0.0 if total_pics[one_month] == 0 else \
                                                    float(total_abundances[one_month]) / \
                                                                    float(total_pics[one_month]))

                    result += '{:7.2f}'.format(0.0 if total_pic == 0 else \
                                                    float(total_abundance_pics) / float(total_pic))
                    result += os.linesep

                    result += 'Total days                            '
                    days_used = [0] * 12
                    year_images = results.get_year_images(one_year)

                    for location in results.get_locations():
                        year_location_images = results.filter_location(year_images,
                                                                       location['idProperty'])

                        if year_location_images:
                            first = year_location_images[0]
                            last = year_location_images[len(year_location_images)- 1]
                            first_cal = first['image_dt']
                            last_cal = last['image_dt']
                            first_days_in_month = 31
                            first_day = first_cal.day - 1
                            last_day = last_cal.day - 1
                            first_month = first_cal.month - 1
                            last_month = last_cal.month - 1
                            if first_month == last_month:
                                days_used[first_month] = days_used[first_month] + \
                                                                (last_day - first_day + 1)
                            else:
                                days_used[first_month] = days_used[first_month] + \
                                                            (first_days_in_month - (first_day - 1))
                                first_month += 1
                                while first_month < last_month:
                                    days_used[first_month] = days_used[first_month] + 31
                                    first_month += 1

                                days_used[last_month] = days_used[last_month] + last_day

                    total_days = 0
                    for month in days_used:
                        result += '{:2d}    '.format(month)
                        total_days = total_days + month

                    result += ' {:3d}'.format(total_days) + os.linesep

                    result += '10*Pic/effort                     '

                    for one_month in range(0, 12):
                        result += '{:6.2f}'.format(0.0 if days_used[one_month] == 0 else \
                                                    10.0 * (float(total_abundances[one_month]) / \
                                                                    float(days_used[one_month])))

                    result += os.linesep + os.linesep


            result += 'SUMMARY ALL YEARS' + os.linesep

            if results.get_years():
                result += 'Years ' + str(results.get_first_year()) + ' to ' + \
                                                        str(results.get_last_year()) + os.linesep

            result += 'Location                  Elevation  Jan   Feb   Mar   Apr   May   Jun   ' \
                      'Jul   Aug   Sep   Oct   Nov   Dec   Total' + os.linesep

            species_images = results.get_species_images(species['scientificName'])
            for location in results.get_locations():
                species_location_images = results.filter_location(species_images,
                                                                            location['idProperty'])

                if species_location_images:
                    result += '{:<28s} {:6d}'.format(location['nameProperty'],
                                                        int(float(location['elevationProperty'])))
                    total = 0
                    for one_month in range(0, 12):
                        species_location_month_images = results.filter_month(
                                                                        species_location_images,
                                                                        one_month)

                        abundance = 0
                        for one_year in results.get_years():
                            slm_year_images = results.filter_year(species_location_month_images,
                                                                  one_year)

                            abundance = abundance + \
                                        Analysis.abundance_for_image_list(slm_year_images,
                                                                          results.get_interval(),
                                                                          species['scientificName'])
                            total = total + abundance

                        result += '{:5d} '.format(abundance)

                    result += '{:7d}'.format(total) + os.linesep

            result += 'Total pictures                     '

            total_pic = 0
            total_pics = [0] * 12
            for one_month in range(0, 12):
                species_month_images = results.filter_month(species_images, one_month)
                period = Analysis.period_for_image_list(species_month_images,
                                                                            results.get_interval())
                total_pic = total_pic + period
                total_pics[one_month] = period
                result += '{:5d} '.format(period)

            result += '{:7d}'.format(total_pic) + os.linesep

            result += 'Total abundance                    '
            total_abundance_pics = 0
            total_abundances = [0] * 12
            for one_month in range(0, 12):
                species_month_images = results.filter_month(species_images, one_month)
                total_abundance = 0
                for location in results.get_locations():
                    species_month_location_images = results.filter_location(species_month_images,
                                                                            location['idProperty'])
                    abundance = 0
                    for one_year in results.get_years():
                        sml_year_images = results.filter_year(species_month_location_images,
                                                              one_year)
                        abundance = abundance + \
                                    Analysis.abundance_for_image_list(sml_year_images,
                                                                      results.get_interval(),
                                                                      species['scientificName'])

                    total_abundance_pics = total_abundance_pics + abundance
                    total_abundance = total_abundance + abundance

                result += '{:5d} '.format(total_abundance)
                total_abundances[one_month] = total_abundances[one_month] + total_abundance

            result += '{:7d}'.format(total_abundance_pics) + os.linesep

            result += 'Avg abundance                      '
            for one_month in range(0, 12):
                result += '{:5.2f} '.format(0.0 if total_pics[one_month] == 0 else \
                                float(total_abundances[one_month]) / float(total_pics[one_month]))

            result += '{:7.2f}'.format(0.0 if total_pic == 0 else \
                                                    float(total_abundance_pics) / float(total_pic))
            result += os.linesep

            result +=  'Total days                            '

            days_used = [0] * 12
            for one_year in results.get_years():
                year_images = results.get_year_images(one_year)

                for location in results.get_locations():
                    year_location_images = results.filter_location(year_images,
                                                                   location['idProperty'])
                    if year_location_images:
                        first = year_location_images[0]
                        last = year_location_images[len(year_location_images) - 1]
                        first_cal = first['image_dt']
                        last_cal = last['image_dt']
                        first_days_in_month = 31
                        first_day = first_cal.day - 1
                        last_day = last_cal.day - 1
                        first_month = first_cal.month - 1
                        last_month = last_cal.month - 1
                        if first_month == last_month:
                            days_used[first_month] = days_used[first_month] + \
                                                                        (last_day - first_day + 1)
                        else:
                            days_used[first_month] = days_used[first_month] + \
                                                            (first_days_in_month - (first_day - 1))
                            first_month += 1
                            while first_month < last_month:
                                days_used[first_month] = days_used[first_month] + 31
                                first_month += 1

                            days_used[last_month] = days_used[last_month] + last_day

            total_days = 0
            for month in days_used:
                result += '{:2d}    '.format(month)
                total_days = total_days + month

            result += ' {:3d}'.format(total_days) + os.linesep

            result += '10*Pic/effort                     '

            for one_month in range(0, 12):
                result += '{:6.2f}'.format(0.0 if days_used[one_month] == 0 else \
                        10.0 * (float(total_abundances[one_month]) / float(days_used[one_month])))

            result += os.linesep + os.linesep

        return result

    @staticmethod
    def print_species_by_loc_elevation_and_effort(results: Results)-> str:
        """ Species by location, elevation, and normalized by effort
        Arguments:
            results: the results to search through
        Return:
            Returns the image analysis text
        """
        result = 'SPECIES BY LOCATION SORTED BY ELEVATION AND NORMALIZED BY EFFORT' + os.linesep
        result += '  One record of each species per location per PERIOD' + os.linesep
        result += os.linesep
        result += 'SUMMARY ALL YEARS' + os.linesep

        if results.get_years():
            result += 'Years ' + str(results.get_first_year()) + ' to ' + \
                                            str(results.get_last_year()) + os.linesep

        for species in results.get_species_by_name():
            species_images = results.get_species_images(species['scientificName'])

            result += 'Location                  Elevation   # pics/Effort   Percent' + os.linesep
            result += species['name'] + os.linesep
            pics_over_effort_totals = [0.0] * len(results.get_locations())
            pics_over_effort_total = 0.0
            for location_index, location in enumerate(results.get_locations()):
                species_location_images = results.filter_location(species_images,
                                                                  location['idProperty'])

                period_total = 0
                for one_year in results.get_years():
                    species_location_year_images = results.filter_year(species_location_images,
                                                                       one_year)
                    if species_location_year_images:
                        period_total = period_total + \
                                    Analysis.period_for_image_list(species_location_year_images,
                                                                            results.get_interval())

                effort_total = 0
                for one_year in results.get_years():
                    year_location_images = results.filter_location(
                                                                results.get_year_images(one_year),
                                                                location['idProperty'])

                    if year_location_images:
                        first = year_location_images[0]
                        last = year_location_images[len(year_location_images) - 1]
                        first_cal = first['image_dt']
                        last_cal = last['image_dt']
                        first_days_in_month = 31
                        first_day = first_cal.day
                        last_day = last_cal.day
                        first_month = first_cal.month
                        last_month = last_cal.month
                        if first_month == last_month:
                            effort_total = effort_total + (last_day - first_day + 1)
                        else:
                            effort_total = effort_total + (first_days_in_month - (first_day - 1))
                            first_month += 1
                            while first_month < last_month:
                                effort_total = effort_total + 31
                                first_month += 1

                            effort_total = effort_total + last_day

                pics_over_effort = (0.0 if effort_total == 0 else \
                                                        float(period_total) / float(effort_total))

                pics_over_effort_total = pics_over_effort_total + pics_over_effort
                pics_over_effort_totals[location_index] = pics_over_effort

            for location_index, location in enumerate(results.get_locations()):
                if pics_over_effort_totals[location_index] != 0.0:
                    result += '{:<28s} {:6.0f}        {:5.3f}       {:5.2f}'.format( \
                                    location['nameProperty'], \
                                    float(location['elevationProperty']), \
                                    pics_over_effort_totals[location_index], \
                                    (pics_over_effort_totals[location_index] \
                                                            / pics_over_effort_total) * 100.0) + \
                                os.linesep

        result += os.linesep

        return result

    @staticmethod
    def print_species_by_loc_elevation_and_effort_table(results: Results) -> str:
        """ Species by location, elevation, and normalized by effort
        Arguments:
            results: the results to search through
        Return:
            Returns the image analysis text
        """
        result = 'SPECIES BY LOCATION SORTED BY ELEVATION AND NORMALIZED BY EFFORT TABLE' + \
                                                                                        os.linesep
        result += '  One record of each species per location per PERIOD' + os.linesep
        result += '  Table shows frequency of all pictures normalized by effort for each species' +\
                                                                                        os.linesep

        result += os.linesep

        result += 'SUMMARY ALL YEARS' + os.linesep

        if results.get_years():
            result += 'Years ' + str(results.get_first_year()) + ' to ' + \
                                            str(results.get_last_year()) + os.linesep

        result += 'Location                  Elevation '

        for species in results.get_species_by_name():
            result += '{:6s} '.format(species['name'][:6])

        result += os.linesep

        for location in results.get_locations():
            result += '{:<28s} {:5.0f}  '.format(location['nameProperty'],
                                                            float(location['elevationProperty']))

            for species in results.get_species_by_name():
                species_images = results.get_species_images(species['scientificName'])
                species_location_images = results.filter_location(species_images,
                                                                  location['idProperty'])

                by_species_period = 0
                by_species_and_loc_period = 0

                for one_year in results.get_years():
                    species_year_images = results.filter_year(species_images, one_year)
                    for location2 in results.get_locations():
                        species_year_location_images = results.filter_location(species_year_images,
                                                                            location2['idProperty'])
                        by_species_period = by_species_period + \
                            Analysis.period_for_image_list(species_year_location_images,
                                                                            results.get_interval())

                    species_location_year_images = results.filter_year(species_location_images,
                                                                       one_year)
                    by_species_and_loc_period = by_species_and_loc_period + \
                                    Analysis.period_for_image_list(species_location_year_images,
                                                                            results.get_interval())

                result  += '{:6.2f} '.format(0.0 if by_species_period == 0 else \
                                100.0 * float(by_species_and_loc_period) / float(by_species_period))

            result += os.linesep

        result += os.linesep

        return result
