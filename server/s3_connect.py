""" This script contains the code to create an S3 connection instance
"""

from minio import Minio
from minio.error import MinioException

from spd_types.s3info import S3Info

def s3_connect(conn_info: S3Info) -> Minio:
    """ Creates an instance of the S3 connection
    Arguments:
        conn_info: the information needed to connect to the S3 endpoint
    Return:
        The S3 connection instance
    """
    minio = None

    try:
        minio = Minio(conn_info.uri,
                      access_key=conn_info.access_key,
                      secret_key=conn_info.secret_key,
                      secure=conn_info.secure)
    except MinioException as ex:
        print('S3 exception caught:', ex, flush=True)

    return minio
