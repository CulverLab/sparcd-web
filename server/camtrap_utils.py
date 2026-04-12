""" Utilities to help working with CamTrap data """

import datetime
import os
import tempfile
from typing import Callable, Optional

from camtrap.v016 import camtrap
from spd_types.s3info import S3Info
from s3_access import S3Connection, make_s3_path, DEPLOYMENT_CSV_FILE_NAME, MEDIA_CSV_FILE_NAME, \
                      OBSERVATIONS_CSV_FILE_NAME
#from sparcd_file_utils import load_timed_info, save_timed_info

def load_camtrap_info(s3_info: S3Info, bucket: str, \
                        s3_path: str, filename: str, temp_to_disk: bool=False) -> Optional[tuple]:
    """ Returns the contents of the CAMTRAP CSV file as a tuple containing row tuples
    Arguments:
        s3_info: the information on the S3 instance
        bucket: the bucket downloaded from
        s3_path: the S3 path of the CAMTRAP CSV file
        filename: the name of the file to load
        temp_to_disk: When set to True and downloaded from the server, a temporary copy is saved
                    to disk for faster retrieval
    Return:
        A tuple containing the rows of the file as tuples
    Notes:
        Looks on the local file system to see if the contents are available. If not found there,
        the file is downloaded from S3
    """
   ## First try the local file system
   #load_path = os.path.join(tempfile.gettempdir(),
   #                bucket+'_'+os.path.basename(s3_path)+'_'+filename)
   #if os.path.exists(load_path):
   #    camtrap_data = load_timed_info(load_path)
   #    if camtrap_data is not None:
   #        return camtrap_data

    # Try S3 since we don't have the data
    camtrap_data = S3Connection.get_camtrap_file(s3_info, bucket, make_s3_path((s3_path, filename)))

    # Check if we need to save it to disk
    #if temp_to_disk is True:
    #    save_timed_info(load_path, camtrap_data)

    return camtrap_data


def load_camtrap_deployments(s3_info: S3Info, bucket: str, \
                                    s3_path: str, temp_to_disk: bool=False) -> Optional[tuple]:
    """ Returns the deployment camtrap information
    Arguments:
        s3_info: the information on the S3 instance
        bucket: the bucket downloaded from
        s3_path: the S3 path of the CAMTRAP CSV file
        temp_to_disk: If the data needs to be downloaded and this is set to True, a timed-out copy
                    of the data is saved to disk for faster retrieval
    Return:
        A tuple containing the deployment data
    """
    loaded_deployments = load_camtrap_info(s3_info, bucket, s3_path,
                                                        DEPLOYMENT_CSV_FILE_NAME, temp_to_disk)
    if loaded_deployments:
        return loaded_deployments

    return None


def load_camtrap_media(s3_info: S3Info, bucket: str, \
                        s3_path: str, temp_to_disk: bool=False,
                        key_field: int=camtrap.CAMTRAP_MEDIA_ID_IDX) -> Optional[dict]:
    """ Returns the media camtrap information with the file names as the keys (the filenames are the
        portion of media path after the S3 path)
    Arguments:
        s3_info: the information on the S3 instance
        bucket: the bucket downloaded from
        s3_path: the S3 path of the CAMTRAP CSV file
        temp_to_disk: If the data needs to be downloaded and this is set to True, a timed-out copy
                    of the data is saved to disk for faster retrieval
        key_field: the field to use as the key when returning the data (defaults to the ID)
    Return:
        A dict with file names as the keys and its row as the value
    Notes:
        e.g.: assuming the S3 path is "/my/s3/path" and the media path is
        "/my/s3/path/to/media.jpg", the key would be "to/media.jpg"
    """
    loaded_media = load_camtrap_info(s3_info, bucket, s3_path, MEDIA_CSV_FILE_NAME, temp_to_disk)
    if loaded_media:
        s3_path_len = len(s3_path)
        if not s3_path.endswith('/'):
            s3_path_len += 1
        if key_field == camtrap.CAMTRAP_MEDIA_ID_IDX:
            return {one_row[key_field][s3_path_len:]: one_row for one_row in loaded_media}
        else:
            return {one_row[key_field]: one_row for one_row in loaded_media}

    return None

def load_camtrap_observations(s3_info: S3Info, bucket: str,\
                                        s3_path: str, temp_to_disk: bool=False) -> Optional[dict]:
    """ Returns the observations camtrap information with the file names as the keys (the filenames
        are the portion of observations path after the S3 path)
    Arguments:
        s3_info: the information on the S3 instance
        bucket: the bucket downloaded from
        s3_path: the S3 path of the CAMTRAP CSV file
        temp_to_disk: If the data needs to be downloaded and this is set to True, a timed-out copy
                    of the data is saved to disk for faster retrieval
    Return:
        A dict with file names as the keys and its rows as the value
    Notes:
        e.g.: assuming the S3 path is "/my/s3/path" and the media path is
        "/my/s3/path/to/media.jpg", the key would be "to/media.jpg"
    """
    loaded_obs = load_camtrap_info(s3_info, bucket, s3_path,
                                                        OBSERVATIONS_CSV_FILE_NAME, temp_to_disk)

    return_obs = None
    if loaded_obs:
        return_obs = {}
        s3_path_len = len(s3_path)
        if not s3_path.endswith('/'):
            s3_path_len += 1
        for one_row in loaded_obs:
            filename = one_row[camtrap.CAMTRAP_OBSERVATION_MEDIA_ID_IDX][s3_path_len:]
            if filename not in return_obs:
                return_obs[filename] = []
            return_obs[filename].append(one_row)

    return return_obs


def create_deployment_data(ct: camtrap.CamTrap, deployment_id: str, location: dict) -> tuple:
    """ Returns the tuple containing the deployment data
    Arguments:
        ct: the camtrap instance to use
        deployment_id: the ID of this deployment
        location: the information of the location to use
    Return:
        A tuple containing the deployment data
    """
    dep = ct.new_deployment(deployment_id)
    dep.location_id = location['idProperty']
    dep.location_name = location['nameProperty']
    dep.latitude = location['latProperty']
    dep.longitude = location['lngProperty']
    dep.camera_height = location['elevationProperty']

    return ct.from_deployment(dep)


def create_media_data(ct: camtrap.CamTrap, deployment_id: str, s3_base_path: str, \
																		all_files: tuple) -> tuple:
    """ Returns the tuple containing the media data
    Arguments:
        ct: the camtrap instance to use
        deployment_id: the ID of this deployment
        s3_base_path: the base server path of the files
        all_files: the list of files
    Return:
        A tuple containing tuples of the the media data
    """
    result = []
    for one_file in all_files:
        media_id = make_s3_path((s3_base_path, one_file))

        med = ct.media(media_id)
        med.deployment_id = deployment_id
        med.sequence_id = media_id
        med.file_path = media_id
        med.file_name = os.path.basename(one_file)

        result.append(ct.from_media(med))

    return result


def create_observation_data(ct: camtrap.CamTrap, deployment_id: str, s3_base_path: str, \
																		all_files: tuple) -> tuple:
    """ Returns the tuple containing the observation data
    Arguments:
        ct: the camtrap instance to use
        deployment_id: the ID of this deployment
        s3_base_path: the base server path of the files
        all_files: the list of files
    Return:
        A tuple containing tuples of the the observation data
    """
    result = []

    for one_file in all_files:
        media_id = make_s3_path((s3_base_path, one_file))

        obs = ct.observation(os.path.basename(one_file))
        obs.deployment_id = deployment_id
        obs.media_id = media_id
        obs.timestamp = datetime.datetime.now(datetime.UTC).isoformat()
        obs.camera_setup = 'FALSE'

        result.append(ct.from_observation(obs))

    return result


def update_observations(s3_path: str, observations: dict, \
                                                file_species: tuple, deployment_id: str) -> tuple:
    """ Updates the observation information with that's found in the file species parameter
    Arguments:
        bucket: the S3 bucket of interest
        s3_path: the path on S3 to the upload folder
        observations: the current set of CamTrap Observations with the filename as key
        file_species: a tuple of dict containing file information and their species changes
        deployment_id: the ID of the deployment when a new observation is added
    Return:
        Returns the updated observations
    """
    if observations is None:
        return None

    for one_species in file_species:
        added = False
        if one_species['filename'] in observations:
            for one_row in observations[one_species['filename']]:
                # See if we have an the entry or we have an open entry
                if one_row[camtrap.CAMTRAP_OBSERVATION_SCIENTIFIC_NAME_IDX] == \
                                                                one_species['scientific'] or \
                   not one_row[camtrap.CAMTRAP_OBSERVATION_SCIENTIFIC_NAME_IDX]:
                    one_row[camtrap.CAMTRAP_OBSERVATION_TIMESTAMP_IDX] = one_species['timestamp']
                    one_row[camtrap.CAMTRAP_OBSERVATION_SCIENTIFIC_NAME_IDX] = \
                                                                        one_species['scientific']
                    one_row[camtrap.CAMTRAP_OBSERVATION_COUNT_IDX] = str(one_species['count'])
                    one_row[camtrap.CAMTRAP_OBSERVATION_COUNT_NEW_IDX] = '0'
                    one_row[camtrap.CAMTRAP_OBSERVATION_COMMENT_IDX] = \
                                                        f'[COMMONNAME:{one_species["common"]}]'

                    if not one_row[camtrap.CAMTRAP_OBSERVATION_CAMERA_SETUP_IDX]:
                        one_row[camtrap.CAMTRAP_OBSERVATION_CAMERA_SETUP_IDX] = 'FALSE'
                    if not one_row[camtrap.CAMTRAP_OBSERVATION_CLASSIFICATION_CONFIDENCE_IDX]:
                        one_row[camtrap.CAMTRAP_OBSERVATION_CLASSIFICATION_CONFIDENCE_IDX] ='1.0000'

                    added = True
                    break
        else:
            # Missing file entry
            observations[one_species['filename']] = []

        # Add a new entry if needed
        if not added:
            observations[one_species['filename']].append((
                os.path.basename(one_species['filename']),           # Observation ID
                deployment_id,                                       # Deployment ID
                '',                                                  # Sequence ID
                make_s3_path((s3_path,one_species['filename'])),     # Media ID
                one_species['timestamp'],                            # Timestamp
                '',                                                  # Observation type
                'FALSE',                                             # Camera setup
                '',                                                  # Taxon ID
                one_species['scientific'],                           # Scientific name
                str(one_species['count']),                           # Count
                '0',                                                 # Count new
                '',                                                  # Life stage
                '',                                                  # Sex
                '',                                                  # Behavior
                '',                                                  # Individual ID
                '',                                                  # Classification method
                '',                                                  # Classified by
                '',                                                  # Classification timestamp
                '1.0000',                                            # Classification confidence
                f'[COMMONNAME:{one_species["common"]}]'              # Comment
                ))

    # Filter out species with a zero count
    for one_filename in observations.keys():
        observations[one_filename] = [one_row for one_row in observations[one_filename] \
                                        if int(one_row[camtrap.CAMTRAP_OBSERVATION_COUNT_IDX]) > 0]

    return observations
