""" Formats image downloads from query results """

from s3_access import S3Connection

from text_formatters.results import Results

def get_image_downloads(results: Results) -> str:
    """ Returns the image downloads from the results
    Arguments:
        results: the query results
    Return:
        The JSON representing the image downloads
    """
    image_urls = S3Connection.get_object_urls(results.s3_info,
                    [(one_image['bucket'], one_image['s3_path']) for \
                                                                one_image in results.get_images()])

    return [{'name':one_image['bucket'] + ':' + one_image['s3_path'],
             'url': image_urls[index]
            } for index, one_image in enumerate(results.get_images())]
