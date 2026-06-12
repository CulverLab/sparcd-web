""" CamTrap version 0.1.6 implementation """

from .deployment import Deployment
from .media import Media
from .observation import Observation

# CAMTRAP Deployment definitions:
# https://github.com/tdwg/camtrap-dp/blob/0.1.6/deployments-table-schema.json
CAMTRAP_DEPLOYMENT_ID_IDX = 0
CAMTRAP_DEPLOYMENT_LOCATION_ID_IDX = 1
CAMTRAP_DEPLOYMENT_LOCATION_NAME_IDX = 2
CAMTRAP_DEPLOYMENT_LONGITUDE_IDX = 3
CAMTRAP_DEPLOYMENT_LATITUDE_IDX = 4
CAMTRAP_DEPLOYMENT_COORDINATE_UNCERTAINTY_IDX = 5
CAMTRAP_DEPLOYMENT_START_IDX = 6         # Timestamp
CAMTRAP_DEPLOYMENT_END_IDX = 7            # Timestamp
CAMTRAP_DEPLOYMENT_SETUPBY_IDX = 8
CAMTRAP_DEPLOYMENT_CAMERA_ID_IDX = 9
CAMTRAP_DEPLOYMENT_CAMERA_MODEL_IDX = 10
CAMTRAP_DEPLOYMENT_CAMERA_INTERVAL_IDX = 11
CAMTRAP_DEPLOYMENT_CAMERA_HEIGHT_IDX = 12
CAMTRAP_DEPLOYMENT_CAMERA_TILT_IDX = 13
CAMTRAP_DEPLOYMENT_CAMERA_HEADING_IDX = 14
CAMTRAP_DEPLOYMENT_CAMERA_TIMESTAMP_ISSUES_IDX = 15
CAMTRAP_DEPLOYMENT_BAIT_USE_IDX = 16
CAMTRAP_DEPLOYMENT_SESSION_IDX = 17
CAMTRAP_DEPLOYMENT_ARRAY_IDX = 18
CAMTRAP_DEPLOYMENT_FEATURE_TYPE_IDX = 19
CAMTRAP_DEPLOYMENT_HABITAT_IDX = 20
CAMTRAP_DEPLOYMENT_TAGS_IDX = 21
CAMTRAP_DEPLOYMENT_COMMENTS_IDX = 22
CAMTRAP_DEPLOYMENT_ID_INTERNAL_IDX = 23

# CAMTRAP Media definitions:
# https://github.com/tdwg/camtrap-dp/blob/0.1.6/media-table-schema.json
CAMTRAP_MEDIA_ID_IDX = 0
CAMTRAP_MEDIA_DEPLOYMENT_ID_IDX = 1
CAMTRAP_MEDIA_SEQUENCE_ID_IDX = 2
CAMTRAP_MEDIA_CAPTURE_METHOD_IDX = 3
CAMTRAP_MEDIA_TIMESTAMP_IDX = 4
CAMTRAP_MEDIA_FILE_PATH_IDX = 5
CAMTRAP_MEDIA_FILE_NAME_IDX = 6
CAMTRAP_MEDIA_TYPE_IDX = 7
CAMTRAP_MEDIA_EXIF_DATA_IDX = 8
CAMTRAP_MEDIA_FAVORITE_IDX = 9
CAMTRAP_MEDIA_COMMENTS_IDX = 10
CAMTRAP_MEDIA_ID_INTERNAL_IDX = 11

# CAMTRAP Observation definitions:
# https://github.com/tdwg/camtrap-dp/blob/0.1.6/observations-table-schema.json
CAMTRAP_OBSERVATION_ID_IDX = 0
CAMTRAP_OBSERVATION_DEPLOYMENT_ID_IDX = 1
CAMTRAP_OBSERVATION_SEQUENCE_ID_IDX = 2
CAMTRAP_OBSERVATION_MEDIA_ID_IDX = 3
CAMTRAP_OBSERVATION_TIMESTAMP_IDX = 4
CAMTRAP_OBSERVATION_OBSERVATION_TYPE_IDX = 5
CAMTRAP_OBSERVATION_CAMERA_SETUP_IDX = 6
CAMTRAP_OBSERVATION_TAXON_ID_IDX = 7
CAMTRAP_OBSERVATION_SCIENTIFIC_NAME_IDX = 8
CAMTRAP_OBSERVATION_COUNT_IDX = 9
CAMTRAP_OBSERVATION_COUNT_NEW_IDX = 10
CAMTRAP_OBSERVATION_LIFE_STAGE_IDX = 11
CAMTRAP_OBSERVATION_SEX_IDX = 12
CAMTRAP_OBSERVATION_BEHAVIOUR_IDX = 13
CAMTRAP_OBSERVATION_INDIVIDUAL_ID_IDX = 14
CAMTRAP_OBSERVATION_CLASSIFICATION_METHOD_IDX = 15
CAMTRAP_OBSERVATION_CLASSIFIED_BY_IDX = 16
CAMTRAP_OBSERVATION_CLASSIFICATION_TIMESTAMP_IDX = 17
CAMTRAP_OBSERVATION_CLASSIFICATION_CONFIDENCE_IDX = 18
CAMTRAP_OBSERVATION_COMMENT_IDX = 19
CAMTRAP_OBSERVATION_ID_INTERNAL_IDX = 20

def _to_bool(value) -> bool:
    """ Converts the parameter to a boolean value
    Arguments:
        value: The value to convert
    Return:
        Returns the boolean equivalent of the value
    Notes:
        Boolean values are returned as is. Strings that are "true" or "false" are converted
        to their boolean equivalent and returned, regardless of case.  Otherwise, the 
        truthy-ness of the value is returned as defined by Python
    """
    if isinstance(value, bool):
        return value

    if isinstance(value, str):
        if value.lower() == 'true':
            return True
        if value.lower() == 'false':
            return False

    # Default to the truthy-ness of the value
    if value:
        return True

    # Default to a False boolean value
    return False

def _not_none(val):
    """ Makes sure a value is not None, else returns an empty string
    Arguments:
        val: the value to check
    Return:
        Returns an empty string if the value is None, otherwise the value
    """
    return val if val is not None else ""

def _not_none_int(val):
    """ Makes sure a value is not None, else returns integer zero
    Arguments:
        val: the value to check
    Return:
        Returns an integer zero if the value is None, otherwise the value
    """
    return val if val is not None else 0

def _not_none_float(val):
    """ Makes sure a value is not None, else returns a float zero
    Arguments:
        val: the value to check
    Return:
        Returns a float zero if the value is None, otherwise the value
    """
    return val if val is not None else 0.0

def _bool_str(val):
    """ Converts a boolean True to string "true", otherwise "false"
    Arguments:
        val: the value to check
    Return:
        Returns "true" if the value is True, otherwise "false" is returned
    """
    return "true" if val is True else "false"

class CamTrap:
    """ Implementation of the CamTrap specification
    """

    @staticmethod
    def new_deployment(deployment_id: str) -> Deployment:
        """ Returns a Deployment instance
        Argument:
            deployment_id: the ID of the deployment
        Return:
            A deployment instance
        """
        return CamTrap.deployment(deployment_id)

    @staticmethod
    def new_media(media_id: str, dep: Deployment) -> Media:
        """ Returns a new Media instance based upon the deployment
        Arguments:
            media_id: the ID of the new media
            dep: the deployment the media belongs to
        Return:
            A new Media instance
        """
        med = CamTrap.media(media_id)
        med.deployment_id = dep.deployment_id

        return med

    @staticmethod
    def new_observation(observation_id: str, med: Media) -> Observation:
        """ Returns a new observation based upon the deployment
        Arguments:
            observation_id: the ID of the new observation
            med: the media instance the observation belongs to
        Return:
            A new Observation instance
        """
        obs = CamTrap.observation(observation_id)
        obs.media_id = med.media_id
        obs.deployment_id = med.deployment_id

        return obs

    @staticmethod
    def deployment(deployment_id: str) -> Deployment:
        """ Returns a Deployment instance
        Argument:
            deployment_id: the ID of the deployment
        Return:
            A deployment instance
        """
        if not deployment_id:
            raise ValueError("Missing deployment ID for new Deployment")

        return Deployment(deployment_id)

    @staticmethod
    def to_deployment(dep_data: tuple) -> Deployment:
        """ Converts a deployment tuple to a Deployment class instance
        Arguments:
            dep_data: the deployment data tuple
        Return:
            A Deployment instance
        """
        if len(dep_data) < CAMTRAP_DEPLOYMENT_COMMENTS_IDX:
            raise ValueError("Not enough parameters for creating a Deployment")
        if not dep_data[CAMTRAP_DEPLOYMENT_ID_IDX]:
            raise ValueError("Missing Deployment ID when creating a Deployment")

        dep = Deployment(dep_data[CAMTRAP_DEPLOYMENT_ID_IDX])
        dep.location_id = dep_data[CAMTRAP_DEPLOYMENT_LOCATION_ID_IDX]
        dep.location_name = dep_data[CAMTRAP_DEPLOYMENT_LOCATION_NAME_IDX]
        try:
            dep.longitude = float(dep_data[CAMTRAP_DEPLOYMENT_LONGITUDE_IDX])
        except ValueError:
            dep.longitude = 0.0
        try:
            dep.latitude = float(dep_data[CAMTRAP_DEPLOYMENT_LATITUDE_IDX])
        except ValueError:
            dep.latitude = 0.0
        try:
            dep.coordinate_uncertainty = \
                                        int(dep_data[CAMTRAP_DEPLOYMENT_COORDINATE_UNCERTAINTY_IDX])
        except ValueError:
            dep.coordinate_uncertainty = 0
        dep.start_timstamp =dep_data[CAMTRAP_DEPLOYMENT_START_IDX]
        dep.end_timestamp = dep_data[CAMTRAP_DEPLOYMENT_END_IDX]
        dep.setup_by = dep_data[CAMTRAP_DEPLOYMENT_SETUPBY_IDX]
        dep.camera_id = dep_data[CAMTRAP_DEPLOYMENT_CAMERA_ID_IDX]
        dep.camera_model = dep_data[CAMTRAP_DEPLOYMENT_CAMERA_MODEL_IDX]
        try:
            dep.camera_interval = int(dep_data[CAMTRAP_DEPLOYMENT_CAMERA_INTERVAL_IDX])
        except ValueError:
            dep.camera_interval = 0
        try:
            dep.camera_height = float(dep_data[CAMTRAP_DEPLOYMENT_CAMERA_HEIGHT_IDX])
        except ValueError:
            dep.camera_height = 0.0
        try:
            dep.camera_tilt = float(dep_data[CAMTRAP_DEPLOYMENT_CAMERA_TILT_IDX])
        except ValueError:
            dep.camera_tile = 0.0
        try:
            dep.camera_heading = int(dep_data[CAMTRAP_DEPLOYMENT_CAMERA_HEADING_IDX])
        except ValueError:
            dep.camera_heading = 0
        dep.timestamp_issues = _to_bool(dep_data[CAMTRAP_DEPLOYMENT_CAMERA_TIMESTAMP_ISSUES_IDX])
        dep.bait_use = dep_data[CAMTRAP_DEPLOYMENT_BAIT_USE_IDX]
        dep.session = dep_data[CAMTRAP_DEPLOYMENT_SESSION_IDX]
        dep.array = dep_data[CAMTRAP_DEPLOYMENT_ARRAY_IDX]
        dep.feature_type = dep_data[CAMTRAP_DEPLOYMENT_FEATURE_TYPE_IDX]
        dep.habitat = dep_data[CAMTRAP_DEPLOYMENT_HABITAT_IDX]
        dep.tags = dep_data[CAMTRAP_DEPLOYMENT_TAGS_IDX]
        dep.comments = dep_data[CAMTRAP_DEPLOYMENT_COMMENTS_IDX]

        return dep

    @staticmethod
    def from_deployment(dep: Deployment) -> tuple:
        """ Converts the deployment data to its tuple equivalent
        Arguments:
            dep: the deployment to convert
        Return:
            A tuple representing the deployment
        """
        if not dep.deployment_id:
            raise ValueError("Missing required deployment ID")

        return (
            _not_none(dep.deployment_id),
            _not_none(dep.location_id),
            _not_none(dep.location_name),
            str(_not_none_float(dep.longitude)),
            str(_not_none_float(dep.latitude)),
            str(_not_none_int(dep.coordinate_uncertainty)),
            _not_none(dep.start_timstamp),
            _not_none(dep.end_timestamp),
            _not_none(dep.setup_by),
            _not_none(dep.camera_id),
            _not_none(dep.camera_model),
            str(_not_none_int(dep.camera_interval)),
            str(_not_none_float(dep.camera_height)),
            str(_not_none_float(dep.camera_tilt)),
            str(_not_none_int(dep.camera_heading)),
            _bool_str(_to_bool(dep.timestamp_issues)),
            _not_none(dep.bait_use),
            _not_none(dep.session),
            _not_none(dep.array),
            _not_none(dep.feature_type),
            _not_none(dep.habitat),
            _not_none(dep.tags),
            _not_none(dep.comments),
            )

    @staticmethod
    def media(media_id: str) -> Media:
        """ Returns a Media instance
        Arguments:
            media_id: the ID of the media
        Return:
            A Media instance
        """
        if not media_id:
            raise ValueError("Missing media ID for new Media")

        return Media(media_id)

    @staticmethod
    def to_media(med_data: tuple) -> Media:
        """ Converts a media tuple to a Media class instance
        Arguments:
            med_data: the tuple containing the media data
        Return:
            A Media instance
        """
        if len(med_data) < CAMTRAP_MEDIA_COMMENTS_IDX:
            raise ValueError("Not enough parameters for creating a Media")
        if not med_data[CAMTRAP_MEDIA_ID_IDX]:
            raise ValueError("Missing Media ID when creating a Media")

        med = Media(med_data[CAMTRAP_MEDIA_ID_IDX])
        med.deployment_id = med_data[CAMTRAP_MEDIA_DEPLOYMENT_ID_IDX]
        med.sequence_id = med_data[CAMTRAP_MEDIA_SEQUENCE_ID_IDX]
        med.capture_method = med_data[CAMTRAP_MEDIA_CAPTURE_METHOD_IDX]
        med.timestamp = med_data[CAMTRAP_MEDIA_TIMESTAMP_IDX]
        med.file_path = med_data[CAMTRAP_MEDIA_FILE_PATH_IDX]
        med.file_name = med_data[CAMTRAP_MEDIA_FILE_NAME_IDX]
        med.file_media_type = med_data[CAMTRAP_MEDIA_TYPE_IDX]
        med.exif_data = med_data[CAMTRAP_MEDIA_EXIF_DATA_IDX]
        med.favorite = _to_bool(med_data[CAMTRAP_MEDIA_FAVORITE_IDX])
        med.comments = med_data[CAMTRAP_MEDIA_COMMENTS_IDX]

        return med

    @staticmethod
    def from_media(med: Media) -> tuple:
        """ Returns a tuple representing the Media data
        Arguments:
            med: the Media to convert to a tuple
        Return:
            Returns the tuple equivalent of the Media
        """
        if not all((med.media_id, med.deployment_id)):
            raise ValueError("Missing required media or deployment ID")

        return (
                _not_none(med.media_id),
                _not_none(med.deployment_id),
                _not_none(med.sequence_id),
                _not_none(med.capture_method),
                _not_none(med.timestamp),
                _not_none(med.file_path),
                _not_none(med.file_name),
                _not_none(med.file_media_type),
                _not_none(med.exif_data),
                _bool_str(_to_bool(med.favorite)),
                _not_none(med.comments),
            )

    @staticmethod
    def observation(observation_id: str) -> Observation:
        """ Returns an Observation instance
        Arguments:
            observation_id: the ID of the observation
        Return:
            An Observation instance
        """
        if not observation_id:
            raise ValueError("Missing observation ID for new Observation")

        return Observation(observation_id)

    @staticmethod
    def to_observation(obs_data: tuple) -> Observation:
        """ Converts an observation tuple to an Observation class instance
        Arguments:
            obs_data: a tuple containing the observation data
        Return:
            An instance of Observation
        """
        if len(obs_data) < CAMTRAP_OBSERVATION_COMMENT_IDX:
            raise ValueError("Not enough parameters for creating an Observation")
        if not obs_data[CAMTRAP_OBSERVATION_ID_IDX]:
            raise ValueError("Missing Observation ID when creating an Observation")

        obs = Observation(obs_data[CAMTRAP_OBSERVATION_ID_IDX])
        obs.deployment_id = obs_data[CAMTRAP_OBSERVATION_DEPLOYMENT_ID_IDX]
        obs.sequence_id = obs_data[CAMTRAP_OBSERVATION_SEQUENCE_ID_IDX]
        obs.media_id = obs_data[CAMTRAP_OBSERVATION_MEDIA_ID_IDX]
        obs.timestamp = obs_data[CAMTRAP_OBSERVATION_TIMESTAMP_IDX]
        obs.observation_type = obs_data[CAMTRAP_OBSERVATION_OBSERVATION_TYPE_IDX]
        obs.camera_setup = obs_data[CAMTRAP_OBSERVATION_CAMERA_SETUP_IDX]
        obs.taxon_id = obs_data[CAMTRAP_OBSERVATION_TAXON_ID_IDX]
        obs.scientific_name = obs_data[CAMTRAP_OBSERVATION_SCIENTIFIC_NAME_IDX]
        try:
            obs.count = int(obs_data[CAMTRAP_OBSERVATION_COUNT_IDX])
        except ValueError:
            obs.count = 0
        try:
            obs.count_new = int(obs_data[CAMTRAP_OBSERVATION_COUNT_NEW_IDX])
        except ValueError:
            obs.count_new = 0
        obs.life_stage = obs_data[CAMTRAP_OBSERVATION_LIFE_STAGE_IDX]
        obs.sex = obs_data[CAMTRAP_OBSERVATION_SEX_IDX]
        obs.behaviour = obs_data[CAMTRAP_OBSERVATION_BEHAVIOUR_IDX]
        obs.individual_id = obs_data[CAMTRAP_OBSERVATION_INDIVIDUAL_ID_IDX]
        obs.classification_method = obs_data[CAMTRAP_OBSERVATION_CLASSIFICATION_METHOD_IDX]
        obs.classified_by = obs_data[CAMTRAP_OBSERVATION_CLASSIFIED_BY_IDX]
        obs.classification_timestamp = obs_data[CAMTRAP_OBSERVATION_CLASSIFICATION_TIMESTAMP_IDX]
        try:
            obs.classification_confidence = \
                                float(obs_data[CAMTRAP_OBSERVATION_CLASSIFICATION_CONFIDENCE_IDX])
        except ValueError:
            obs.classification_confidence = 0.0
        obs.comments = obs_data[CAMTRAP_OBSERVATION_COMMENT_IDX]

        return obs

    @staticmethod
    def from_observation(obs: Observation) -> tuple:
        """ Converts an observation into its tuple eqivalent
        Arguments:
            obs: the observation instance
        Return:
            A tuple containing the data from the observation
        """
        # Make sure we have the minimal number of fields filled in
        if not all((obs.observation_id, obs.deployment_id, obs.media_id)):
            raise ValueError("Missing required observation, deployment, or media ID")

        return (
                _not_none(obs.observation_id),
                _not_none(obs.deployment_id),
                _not_none(obs.sequence_id),
                _not_none(obs.media_id),
                _not_none(obs.timestamp),
                _not_none(obs.observation_type),
                _not_none(obs.camera_setup),
                _not_none(obs.taxon_id),
                _not_none(obs.scientific_name),
                str(_not_none_int(obs.count)),
                str(_not_none_int(obs.count_new)),
                _not_none(obs.life_stage),
                _not_none(obs.sex),
                _not_none(obs.behaviour),
                _not_none(obs.individual_id),
                _not_none(obs.classification_method),
                _not_none(obs.classified_by),
                _not_none(obs.classification_timestamp),
                str(_not_none_float(obs.classification_confidence)),
                _not_none(obs.comments)
               )
