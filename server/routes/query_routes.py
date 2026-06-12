""" Query routes for SPARCd server """

from flask import Blueprint, jsonify, request
from flask_cors import cross_origin

import handlers.query as hquery
from sparcd_config import QUERY_RESULTS_TIMEOUT_SEC, authenticated_route, \
                          temp_species_filename
from sparcd_env import ALLOWED_ORIGINS

query_bp = Blueprint('query', __name__)


@query_bp.route('/query', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@authenticated_route(eager_password=True)
def query(*, db, token, user_info, s3_info):
    """ Runs a query against the collection data and stores the results
    Arguments:
        db: the database instance (injected by authenticated_route)
        token: the session token (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Returns:
        200: JSON object containing the query results
        401: if the session token is invalid or expired
        404: if the request is malformed or the user cannot be found
        406: if the query parameters are invalid or the query cannot be completed
    Notes:
        The token is passed to the handler so it can be used as a key for
        storing and retrieving query results on disk
    """
    print(f'QUERY user={user_info.name} token={token}', flush=True)

    return_info = hquery.handle_query(db,
                                      user_info,
                                      s3_info,
                                      token,
                                      temp_species_filename(s3_info.id))
    if return_info is None:
        return 'Not Found', 406

    return jsonify(return_info)


@query_bp.route('/query_dl', methods=['GET'])
@cross_origin(origins='*', supports_credentials=True)
@authenticated_route(eager_password=True)
def query_dl(*, db, token, user_info, s3_info):
    """ Returns the results of a previously run query as a downloadable file
    Arguments:
        db: the database instance (injected by authenticated_route)
        token: the session token (injected by authenticated_route)
        user_info: the authenticated user's information (injected by authenticated_route)
        s3_info: the S3 endpoint information (injected by authenticated_route)
    Query parameters:
        q - the tab name identifying which result format to download
        d - the optional target filename for the download
    Returns:
        200: the query results as a downloadable file in the requested format
        401: if the session token is invalid or expired
        404: if the query results cannot be found
        406: if the tab parameter is missing
        422: if the query results have expired or cannot be loaded
    Notes:
        Uses wildcard CORS origins since query downloads may be triggered
        from any origin. The token is passed to QueryDownloadParams so the
        handler can locate the stored query results on disk.
    """
    tab = request.args.get('q')
    target = request.args.get('d')
    print(f'QUERY DOWNLOAD user={user_info.name} tab={tab} target={target}', flush=True)

    if not tab:
        return 'Not Found', 406

    have_results, response = hquery.handle_query_download(
                                    db,
                                    user_info,
                                    s3_info,
                                    hquery.QueryDownloadParams(token=token,
                                                               tab_name=tab,
                                                               target=target,
                                                               timeout_sec=QUERY_RESULTS_TIMEOUT_SEC
                                                               ))
    if not have_results:
        return 'Not Found', 422
    if not response:
        return 'Not Found', 404

    return response
