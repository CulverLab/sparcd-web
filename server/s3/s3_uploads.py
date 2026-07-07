""" S3 upload management operations for SPARCd """

import csv
import dataclasses
import datetime
from io import BytesIO, StringIO
import json
from typing import Optional

from spd_types.s3info import S3Info
from s3.s3_connect import s3_connect
from s3.s3_access_helpers import (SPARCD_PREFIX, S3_UPLOADS_PATH_PART, COLLECTIONS_FOLDER,
                                S3_UPLOAD_META_JSON_FILE_NAME, temp_s3_file,
                                load_upload_meta, put_s3_json, make_s3_path,
                                get_image_counts, get_s3_file)


@dataclasses.dataclass
class S3UploadConnection:
    """ Contains functions for upload management on an S3 instance """

    @staticmethod
    def create_upload(conn_info: S3Info, collection_id: str,
                      comment: str, timestamp: datetime.datetime, file_count: int) -> tuple:
        """ Creates an upload folder on the server and returns the path
        Arguments:
            conn_info: the connection information for the S3 endpoint
            collection_id: the ID of the collection to create the upload in
            comment: user comment on this upload
            timestamp: the timestamp to use when creating the path
            file_count: the number of files to be uploaded
        Return:
            The bucket name and the path of the upload folder on the S3 instance
        """
        minio = s3_connect(conn_info)

        bucket = SPARCD_PREFIX + collection_id
        upload_folder = timestamp.strftime('%Y.%m.%d.%H.%M.%S') + '_' + conn_info.access_key
        new_path = make_s3_path((COLLECTIONS_FOLDER, collection_id, S3_UPLOADS_PATH_PART,
                                                                                    upload_folder))

        with temp_s3_file() as temp_path:
            with open(temp_path, 'w', encoding='utf-8') as o_file:
                json.dump({'uploadUser': conn_info.access_key,
                           'uploadDate': {
                               'date': {'year': timestamp.year, 'month': timestamp.month,
                                        'day': timestamp.day},
                               'time': {'hour': timestamp.hour, 'minute': timestamp.minute,
                                        'second': timestamp.second, 'nano': timestamp.microsecond}
                           },
                           'imagesWithSpecies': 0,
                           'imageCount': file_count,
                           'editComments': [],
                           'bucket': bucket,
                           'uploadPath': new_path,
                           'description': comment
                           }, o_file, indent=2)

            minio.fput_object(bucket, new_path + '/' + S3_UPLOAD_META_JSON_FILE_NAME, temp_path,
                              content_type='application/json')

        return bucket, new_path

    @staticmethod
    def upload_file(conn_info: S3Info, bucket: str, path: str, localname: str) -> None:
        """ Uploads the data from the file to the specified bucket in the specified object path
        Arguments:
            conn_info: the connection information for the S3 endpoint
            bucket: the bucket to upload to
            path: path under the bucket to the object data
            localname: the local filename of the file to upload
        """
        minio = s3_connect(conn_info)
        minio.fput_object(bucket, path, localname)

    @staticmethod
    def upload_file_data(conn_info: S3Info, bucket: str, path: str,
                         data: str, content_type: str = 'text/plain') -> None:
        """ Uploads the data to the specified bucket in the specified object path
        Arguments:
            conn_info: the connection information for the S3 endpoint
            bucket: the bucket to upload to
            path: path under the bucket to the object data
            data: the data to upload
            content_type: the content type of the upload
        """
        minio = s3_connect(conn_info)
        minio.put_object(bucket, path, BytesIO(data.encode()), len(data),
                         content_type=content_type)

    @staticmethod
    def upload_camtrap_data(conn_info: S3Info, bucket: str, path: str, data: tuple) -> None:
        """ Uploads camtrap data as a CSV file to the specified path
        Arguments:
            conn_info: the connection information for the S3 endpoint
            bucket: the bucket to upload to
            path: path under the bucket to the camtrap data
            data: a tuple of camtrap data containing tuples of each row's data
        """
        with temp_s3_file(suffix='.csv') as temp_path:
            with open(temp_path, 'w', newline='', encoding='utf-8') as ofile:
                csv_writer = csv.writer(ofile, quoting=csv.QUOTE_NONNUMERIC)
                for one_row in data:
                    csv_writer.writerow(one_row)

            S3UploadConnection.upload_file(conn_info, bucket, path, temp_path)

    @staticmethod
    def get_camtrap_file(conn_info: S3Info, bucket: str, path: str) -> Optional[tuple]:
        """ Loads the CAMTRAP CSV and returns a tuple containing the row data as tuples
        Arguments:
            conn_info: the connection information for the S3 endpoint
            bucket: the bucket to load from
            path: path under the bucket to the camtrap data
        Return:
            Returns the loaded data or None
        """
        minio = s3_connect(conn_info)

        with temp_s3_file() as temp_path:
            csv_data = get_s3_file(minio, bucket, path, temp_path)

        camtrap_data = []
        if csv_data is not None:
            reader = csv.reader(StringIO(csv_data))
            for csv_row in reader:
                if csv_row and len(csv_row) >= 5:
                    camtrap_data.append(list(csv_row))

        return camtrap_data

    @staticmethod
    def update_upload_metadata_image_species(conn_info: S3Info, bucket: str,
                                             upload_path: str, new_count: int) -> bool:
        """ Update the upload's metadata on the S3 instance with a new species count
        Arguments:
            conn_info: the connection information for the S3 endpoint
            bucket: the bucket to upload to
            upload_path: path under the bucket to the metadata
            new_count: the new count of images with species
        Return:
            Returns True if no problem was found and False otherwise
        """
        minio = s3_connect(conn_info)

        meta_info = load_upload_meta(minio, bucket, upload_path,
                                       'update_upload_metadata_image_species')
        if not meta_info:
            return False

        meta_info['imagesWithSpecies'] = new_count
        put_s3_json(minio, bucket,
                      make_s3_path((upload_path, S3_UPLOAD_META_JSON_FILE_NAME)), meta_info)

        return True

    @staticmethod
    def update_upload_metadata_description(conn_info: S3Info, bucket: str,
                                             upload_path: str, description: str) -> bool:
        """ Update the upload's metadata on the S3 instance with a description
        Arguments:
            conn_info: the connection information for the S3 endpoint
            bucket: the bucket to upload to
            upload_path: path under the bucket to the metadata
            description: the updated description
        Return:
            Returns True if no problem was found and False otherwise
        """
        minio = s3_connect(conn_info)

        meta_info = load_upload_meta(minio, bucket, upload_path,
                                       'update_upload_metadata_description')
        if not meta_info:
            return False

        meta_info['description'] = description
        put_s3_json(minio, bucket,
                      make_s3_path((upload_path, S3_UPLOAD_META_JSON_FILE_NAME)), meta_info)

        return True

    @staticmethod
    def upload_recalculate_image_count(conn_info: S3Info, bucket: str,
                                       upload_name: str) -> bool:
        """ Update the upload's metadata on the S3 instance with the actual image count
        Arguments:
            conn_info: the connection information for the S3 endpoint
            bucket: the bucket to upload to
            upload_name: the name of the upload path
        Return:
            Returns True if no problem was found and False otherwise
        """
        minio = s3_connect(conn_info)

        coll_id = bucket[len(SPARCD_PREFIX):]
        upload_path = make_s3_path((COLLECTIONS_FOLDER, coll_id,
                                    S3_UPLOADS_PATH_PART, upload_name))

        sub_paths = [one_obj.object_name
                     for one_obj in minio.list_objects(bucket, prefix=upload_path + '/')
                     if one_obj.is_dir and one_obj.object_name != upload_path]
        new_count = get_image_counts(minio, bucket, sub_paths)

        up_info = load_upload_meta(minio, bucket, upload_path,
                                     'upload_recalculate_image_count')
        if not up_info:
            return False

        up_info['imageCount'] = new_count
        put_s3_json(minio, bucket,
                      make_s3_path((upload_path, S3_UPLOAD_META_JSON_FILE_NAME)), up_info)

        return True

    @staticmethod
    def update_upload_metadata(conn_info: S3Info, bucket: str, upload_path: str,
                               new_comment: str = None,
                               images_species_count: int = None) -> tuple:
        """ Update the upload's metadata on the S3 instance with a new count
        Arguments:
            conn_info: the connection information for the S3 endpoint
            bucket: the bucket to upload to
            upload_path: path under the bucket to the metadata
            new_comment: the comment to add to the metadata
            images_species_count: The count of images that have species
        Return:
            Returns a tuple of: True if no problem was found and False otherwise, and the updated
            upload information if True is the first element
        """
        minio = s3_connect(conn_info)

        coll_info = load_upload_meta(minio, bucket, upload_path, 'update_upload_metadata')
        if not coll_info:
            return False, None

        if new_comment is not None:
            coll_info['editComments'].append(new_comment)
        if images_species_count is not None:
            coll_info['imagesWithSpecies'] = images_species_count

        data = put_s3_json(minio, bucket,
                             make_s3_path((upload_path, S3_UPLOAD_META_JSON_FILE_NAME)), coll_info)

        return True, data
