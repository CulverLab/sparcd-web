""" Species routes for SPARCd server """

import os

from flask import Blueprint, jsonify
from flask_cors import cross_origin

import handlers.base as hbase
import handlers.species as hspecies
from sparcd_config import TEMP_OTHER_SPECIES_FILE_NAME_POSTFIX, \
                          SPECIES_STATS_EXCLUDE, TEMP_DIR, authenticated_route, \
                          temp_species_filename
from sparcd_constants import TEMP_SPECIES_STATS_FILE_NAME_POSTFIX, \
                                TEMP_SPECIES_STATS_FILE_TIMEOUT_SEC
from sparcd_env import ALLOWED_ORIGINS
import sparcd_stats_utils as sdstu

species_bp = Blueprint('species', __name__)


@species_bp.route('/species', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def species(*, db, user_info, s3_info, **_):
    """ Returns the list of species for the authenticated user
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON list of species, either as a cached JSON response or a newly
             constructed list
        401: if the session token is invalid or expired
        404: if the request is malformed or the user cannot be found
    Notes:
        If the handler returns a pre-built JSON response it is returned directly
        without wrapping in jsonify
    """
    print(f'SPECIES user={user_info.name}', flush=True)

    ret_species, is_json = hbase.handle_species(db, user_info, s3_info,
                                                temp_species_filename(s3_info.id))
    if is_json:
        return ret_species

    return jsonify(ret_species)


@species_bp.route('/speciesStats', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route(eager_password=True)
def species_stats(*, db, user_info, s3_info, **_):
    """ Returns upload statistics broken down by species
    Arguments:
        db: the database instance (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON list of species and their counts, excluding unofficial species
        401: if the session token is invalid or expired
        404: if the species statistics cannot be found or generated
    Notes:
        Removes the cached other-species file after loading stats so it will
        be regenerated with current data on the next request
    """
    print('SPECIES STATS', flush=True)

    stats = sdstu.load_species_stats(db, bool(user_info.admin), s3_info)
    if stats is None:
        return 'Not Found', 404

    other_species_path = os.path.join(TEMP_DIR,
                                      s3_info.id + TEMP_OTHER_SPECIES_FILE_NAME_POSTFIX)
    if os.path.exists(other_species_path):
        os.unlink(other_species_path)

    return jsonify([[key, value['count']] for key, value in stats.items()
                    if key not in SPECIES_STATS_EXCLUDE])


@species_bp.route('/speciesOther', methods=['GET'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route()
def species_other(*, s3_info, **_):
    """ Returns species that are not part of the official species list
    Arguments:
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON list of unofficial species found in uploads
        401: if the session token is invalid or expired
        404: if the request is malformed or the user cannot be found
    """
    print('SPECIES OTHER', flush=True)

    other_species = hspecies.handle_species_other(
        s3_info,
        hspecies.OtherSpeciesParams(
            other_filename=s3_info.id + TEMP_OTHER_SPECIES_FILE_NAME_POSTFIX,
            stat_filename=s3_info.id + TEMP_SPECIES_STATS_FILE_NAME_POSTFIX,
            stat_timeout_sec=TEMP_SPECIES_STATS_FILE_TIMEOUT_SEC,
            temp_species_filename=temp_species_filename(s3_info.id)
        )
    )
    return jsonify(other_species)
