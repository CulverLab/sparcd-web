""" Formats for detection rates of species at locations """

import dataclasses
import datetime
import os

from .analysis import Analysis
from .results import Results

def last_day_of_month(year: int, month: int) -> int:
    """ Return the last day of the month for the datetime passed in
    Arguments:
        year: the year to find the last day of the month for
        month: the month to find the last day for
    Result:
        Returns the last day of the month
    """
    cur_date = datetime.datetime(year=year, month=month, day=1)
    # The day 28 exists in every month. 4 days later, it's always next month
    next_month = cur_date.replace(day=28) + datetime.timedelta(days=4)
    # subtracting the number of the current day brings us back one month
    return (next_month - datetime.timedelta(days=next_month.day)).day


# pylint: disable=consider-using-f-string
@dataclasses.dataclass
class DetectionRateFormatter:
    """ Formats for detection rates of species at locations
    """

    @staticmethod
    def print_detection_rate_species_year(results: Results) -> str:
        """ 
        Arguments:
            results: the results to search through
        Return:
            Returns the image analysis text
        """
        result = 'DETECTION RATE FOR EACH SPECIES PER YEAR' + os.linesep
        result += '  One record of each species per location per PERIOD' + os.linesep
        result += '  Number of pictures/prd multiplied by 100' + os.linesep

        for one_year in results.get_years():
            result += 'Year ' + str(one_year) + os.linesep
            result += '                            Total   Total       Pics          Species' + \
                                                                                        os.linesep
            result += 'Location                     days    pics       /prd    '

            for species in results.get_species_by_name():
                result += '{:5s} '.format(species['name'][:5])

            result += os.linesep

            year_images = results.get_year_images(one_year)

            total_pics = 0
            total_days = 0
            average_rate = [0.0] * len(results.get_species())
            for location in results.get_locations():
                year_location_images = results.filter_location(year_images, location['idProperty'])
                if year_location_images:

                    result += '{:<28s}'.format(location['nameProperty'])

                    total_days_for_loc = 0
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
                        total_days_for_loc = total_days_for_loc + last_day - first_day + 1
                    else:
                        total_days_for_loc = total_days_for_loc + first_days_in_month - \
                                                                                    (first_day - 1)
                        first_month += 1
                        while first_month < last_month:
                            total_days_for_loc = total_days_for_loc + \
                                                            last_day_of_month(one_year, first_month)
                            first_month += 1

                        total_days_for_loc = total_days_for_loc + last_day

                    total_days = total_days + total_days_for_loc

                    period_total = 0

                    for species in results.get_species_by_name():
                        year_location_species_images = results.filter_species(year_location_images,\
                                                                        species['scientificName'])
                        period_total = period_total + \
                                Analysis.period_for_image_list(year_location_species_images, \
                                                                            results.get_interval())

                    total_pics = total_pics + period_total

                    result += '  {:3d} {:7d}    {:7.2f}   '.format(total_days_for_loc, \
                                    period_total, \
                                    (0.0 if total_days_for_loc == 0 else \
                                        100.0 * (float(period_total) / float(total_days_for_loc))))

                    for species_index, species in enumerate(results.get_species_by_name()):
                        year_location_species_images = results.filter_species(year_location_images,\
                                                                        species['scientificName'])
                        period = Analysis.period_for_image_list(year_location_species_images, \
                                                                            results.get_interval())
                        result += ' {:5.2f}'.format(100.0 * \
                                                    (float(period) / float(total_days_for_loc)))
                        average_rate[species_index] = average_rate[species_index] + float(period)

                    result += os.linesep

            result += 'Total days pics Avg rate    '

            result += '  {:3d} {:7d}    {:7.2f}   '.format(total_days, total_pics, \
                        0.0 if total_days == 0 else 100.0 * (float(total_pics) / float(total_days)))

            for species_index in range(0, len(results.get_species_by_name())):
                result += ' {:5.2f}'.format(0.0 if total_days == 0 else \
                                        100.0 * (average_rate[species_index] / float(total_days)))

            result += os.linesep + os.linesep

        return result

    @staticmethod
    def print_detection_rate_summary(results: Results) -> str:
        """ 
        Arguments:
            results: the results to search through
        Return:
            Returns the image analysis text
        """
        result = 'DETECTION RATE SUMMARY FOR EACH SPECIES' + os.linesep
        result += '  One record of each species per location per PERIOD' + os.linesep
        result += '  Number of pictures/PERIOD multiplied by 100' + os.linesep

        if results.get_years():
            result += 'Years ' + str(results.get_first_year()) + ' to ' + \
                                            str(results.get_last_year()) + os.linesep

        result += '                            Total   Total     Pics          Species' + \
                                                                                        os.linesep
        result += 'Location                     days    pics     /prd   '

        for species in results.get_species_by_name():
            result += '{:5s} '.format(species['name'][:5])

        result += os.linesep

        total_days = 0
        total_pics = 0

        average_rate = [0.0] * len(results.get_species())

        for location in results.get_locations():
            result += '{:<28s}'.format(location['nameProperty'])
            location_images = results.get_location_images(location['idProperty'])

            total_days_loc = 0
            for one_year in results.get_years():
                location_year_images = results.filter_year(location_images, one_year)

                if location_year_images:
                    first = location_year_images[0]
                    last = location_year_images[len(location_year_images) - 1]
                    first_cal = first['image_dt']
                    last_cal = last['image_dt']
                    first_days_in_month = 31
                    first_day = first_cal.day
                    last_day = last_cal.day
                    first_month = first_cal.month
                    last_month = last_cal.month
                    if first_month == last_month:
                        total_days_loc += (last_day - first_day + 1)
                    else:
                        total_days_loc += (first_days_in_month - (first_day - 1))
                        first_month += 1
                        while first_month < last_month:
                            total_days_loc += 31
                            first_month += 1

                        total_days_loc = total_days_loc + last_day

            total_days = total_days + total_days_loc

            period_total = 0

            for species in results.get_species_by_name():
                for one_year in results.get_years():
                    location_species_year_images = results.filter_year(results.filter_species( \
                                                                        location_images, \
                                                                        species['scientificName']),\
                                                                    one_year)
                    period_total = period_total + \
                                    Analysis.period_for_image_list(location_species_year_images, \
                                                                            results.get_interval())

            total_pics += period_total

            result += '  {:3d} {:7d}  {:7.2f}  '.format(total_days_loc, period_total, \
                            0.0 if total_days_loc == 0 else \
                                        100.0 * (float(period_total) / float(total_days_loc)))

            for species_index, species in enumerate(results.get_species_by_name()):
                period = 0
                for one_year in results.get_years():
                    location_species_year_images = results.filter_year(results.filter_species( \
                                                                        location_images, \
                                                                        species['scientificName']),\
                                                                    one_year)

                    period += Analysis.period_for_image_list(location_species_year_images, \
                                                                            results.get_interval())

                result += ' {:5.2f}'.format(float(period) / float(total_days_loc))
                average_rate[species_index] += float(period)

            result += os.linesep

        result += 'Total days pics Avg rate   '

        result += '  {:3d} {:7d}  {:7.2f}  '.format(total_days, total_pics, \
                                                    100.0 * (float(total_pics) / float(total_days)))

        for species_index in range(0, len(results.get_species())):
            result += ' {:5.2f}'.format(0.0 if total_days == 0 else \
                                    100.0 * float(average_rate[species_index]) / float(total_days))

        result += os.linesep + os.linesep

        return result

    @staticmethod
    def print_detection_rate_location_month(results: Results) -> str:
        """ 
        Arguments:
            results: the results to search through
        Return:
            Returns the image analysis text
        """
        result = 'DETECTION RATE FOR EACH LOCATION BY MONTH' + os.linesep
        result += '  One record of each species per location per PERIOD' + os.linesep

        for one_year in results.get_years():
            result += 'Year ' + str(one_year) + os.linesep
            result += '                            Total   Total       Pics          Months ' + \
                                                                                        os.linesep
            result += 'Location                     days    pics       /prd       Jan     ' \
                      'Feb     Mar     Apr     May     Jun     Jul     Aug     Sep     Oct     ' \
                      'Nov     Dec' + os.linesep

            year_images = results.get_year_images(one_year)

            total_pics = 0
            total_days = 0
            average_rate = [0.0] * 12

            for location in results.get_locations():
                year_location_images = results.filter_location(year_images, location['idProperty'])

                if year_location_images:
                    total_days_for_loc = 0
                    result += '{:<28s}'.format(location['nameProperty'])

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
                        total_days_for_loc += last_day - first_day + 1
                    else:
                        total_days_for_loc += first_days_in_month - \
                                                                                    (first_day - 1)
                        first_month += 1
                        while first_month < last_month:
                            total_days_for_loc += 31
                            first_month += 1

                        total_days_for_loc += last_day

                    total_days += total_days_for_loc

                    period_total = 0

                    for species in results.get_species():
                        year_location_species = results.filter_species(year_location_images, \
                                                                       species['scientificName'])
                        period_total = period_total + \
                            Analysis.period_for_image_list(year_location_species, \
                                                                            results.get_interval())

                    total_pics = total_pics + period_total

                    result += '  {:3d} {:7d}    {:7.2f}    '.format(total_days_for_loc, \
                                    period_total, float(period_total) / float(total_days_for_loc))

                    for one_month in range(0, 12):
                        # Go through species here?
                        period = 0
                        for species in results.get_species():
                            yl_month_species_images = results.filter_month( \
                                                    results.filter_species(year_location_images, \
                                                                    species['scientificName']), \
                                                    one_month)
                            period = period + \
                                        Analysis.period_for_image_list(yl_month_species_images, \
                                                                            results.get_interval())
                        result += ' {:5.2f}  '.format(float(period) / float(total_days_for_loc))

                        average_rate[one_month] = average_rate[one_month] + float(period)

                    result += os.linesep

            result += 'Total days pics Avg rate    '

            result += '  {:3d} {:7d}    {:7.2f}    '.format(total_days, total_pics, \
                                0.0 if total_days == 0 else float(total_pics) / float(total_days))

            for one_month in range(0, 12):
                result += ' {:5.2f}  '.format(0.0 if total_days == 0 else \
                                                            average_rate[one_month] / total_days)

            result += os.linesep + os.linesep

        return result

    @staticmethod
    def print_detection_rate_location_month_summary(results: Results) -> str:
        """ 
        Arguments:
            results: the results to search through
        Return:
            Returns the image analysis text
        """
        result = 'DETECTION RATE SUMMARY FOR EACH LOCATION BY MONTH' + os.linesep
        result += '  One record of each species per location per PERIOD' + os.linesep

        if results.get_years():
            result += 'Years ' + str(results.get_first_year()) + ' to ' + \
                                            str(results.get_last_year()) + os.linesep

        result += '                            Total   Total       Pics          Months ' + \
                                                                                        os.linesep
        result += 'Location                     days    pics       /prd       Jan     Feb     ' \
                  'Mar     Apr     May     Jun     Jul     Aug     Sep     Oct     Nov     Dec' + \
                                                                                        os.linesep

        total_pics = 0
        total_days = 0
        average_rate = [0.0] * 12

        for location in results.get_locations():
            result += '{:<28s}'.format(location['nameProperty'])

            location_images = results.get_location_images(location['idProperty'])

            total_days_loc = 0
            for one_year in results.get_years():
                location_year_images = results.filter_year(location_images, one_year)

                if location_year_images:
                    first = location_year_images[0]
                    last = location_year_images[len(location_year_images) - 1]
                    first_cal = first['image_dt']
                    last_cal = last['image_dt']
                    first_days_in_month = 31
                    first_day = first_cal.day
                    last_day = last_cal.day
                    first_month = first_cal.month
                    last_month = last_cal.month
                    if first_month == last_month:
                        total_days_loc += (last_day - first_day + 1)
                    else:
                        total_days_loc += (first_days_in_month - (first_day - 1))
                        first_month += 1
                        while first_month < last_month:
                            total_days_loc += 31
                            first_month += 1

                        total_days_loc = total_days_loc + last_day

            total_days += total_days_loc

            period_total = 0

            for species in results.get_species():
                for one_year in results.get_years():
                    location_species_year_images = results.filter_year( \
                                                                results.filter_species( \
                                                                    location_images, \
                                                                    species['scientificName']), \
                                                                one_year)
                    period_total = period_total + Analysis.period_for_image_list( \
                                                    location_species_year_images, \
                                                                            results.get_interval())

            total_pics = total_pics + period_total

            result += '  {:3d} {:7d}    {:7.2f}    '.format(total_days_loc, period_total, \
                                                        float(period_total) / float(total_days_loc))

            for one_month in range(0, 12):
                period = 0
                for species in results.get_species():
                    for one_year in results.get_years():
                        loc_month_species_year_images = results.filter_year( \
                                                            results.filter_species( \
                                                                results.filter_month(\
                                                                                location_images, \
                                                                                one_month), \
                                                                species['scientificName']), \
                                                            one_year)
                        period = period + \
                                    Analysis.period_for_image_list(loc_month_species_year_images,\
                                                                            results.get_interval())
                result += ' {:5.2f}  '.format(float(period) / float(total_days_loc))

                average_rate[one_month] = average_rate[one_month] + float(period)

            result += os.linesep

        result += 'Total days pics Avg rate    '

        result += '  {:3d} {:7d}    {:7.2f}    '.format(total_days, total_pics, \
                                                            float(total_pics) / float(total_days))

        for one_month in range(0, 12):
            result += ' {:5.2f}  '.format(0.0 if total_days == 0 else \
                                                        average_rate[one_month] / float(total_days))

        result += os.linesep + os.linesep

        return result

    @staticmethod
    # pylint: disable=unused-argument
    def print_detection_rate_trend(results: Results) -> str:
        """ 
        Arguments:
            results: the results to search through
        Return:
            Returns the image analysis text
        """
        result = 'MONTHLY DETECTION RATE TREND' + os.linesep
        result += '   Use independent records from only those locations that ever recorded ' \
                  'species' + os.linesep

        #      for (Integer year : analysis.getAllImageYears())
        #      {
        #          toReturn = toReturn + "  " + year + " "
        #
        #          for (Species species : analysis.getAllImageSpecies())
        #              toReturn = toReturn + String.format("%5s ", \
        #                                   StringUtils.left(species.getName(), 5))
        #
        #          toReturn = toReturn + "\n"
        #
        #          for (int month = 0 month < 12 month++)
        #          {
        #              Integer monthTotal = 0
        #
        #              String forMonth = ""
        #
        #              forMonth = forMonth + year + "-" + String.format("%02d", month) + " "
        #
        #              for (Species species : analysis.getAllImageSpecies())
        #              {
        #                  toReturn = toReturn + String.format("%4.2f ")
        #              }
        #
        #              if (monthTotal != 0)
        #                  toReturn = toReturn + forMonth
        #          }
        #      }

        result += 'No idea what these numbers are' + os.linesep + os.linesep

        return result
