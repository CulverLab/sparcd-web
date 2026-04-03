'use client'

/** @module components/ActionsRouter */

import * as React from 'react';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

import CollectionsManage from './CollectionsManage';
import Landing from './Landing';
import Maps from './Maps';
import Queries from './Queries';
import UploadEdit from './UploadEdit';
import UploadManage from './UploadManage';
import UserActions from './components/userActions';
import { UploadEditContext } from './serverInfo';

/**
 * Returns the UI components for the specified action
 * @function
 * @param {string} action The current user action to render (one of UserActions)
 * @param {object} curActionData The data associated with the current action
 * @param {string} curActionData.collectionId The ID of the collection the upload resides in
 * @param {Array}  curActionData.images The images associated with the upload
 * @param {string} curActionData.location The location associated with the upload
 * @param {string} curActionData.name The display name of the current item
 * @param {string} curActionData.uploadId The ID of the upload being edited
 * @param {string} curActionData.uploadName The key/filename of the upload being edited
 * @param {boolean} loadingCollections Whether collections are currently being fetched
 * @param {boolean} loadingSandbox Whether sandbox data is currently being fetched
 * @param {function} onSetAction Callback to change the current action and associated data
 * @param {function} onEditUpload Callback to load upload image data for editing
 * @param {function} onSandboxRefresh Callback to reload sandbox and collection data
 * @param {function} setupSearch Callback to register a search handler with the title bar
 * @param {function} uploadReload Callback to reload the images for the current upload
 * @param {function} uploadUpdate Callback to reload collections after upload metadata changes
 * @return {React.ReactNode} The rendered action UI
 */
export default function ActionsRouter({action, curActionData, loadingCollections, loadingSandbox, onSetAction, onEditUpload, onSandboxRefresh,
                                        setupSearch, uploadReload, uploadUpdate}) {
  const theme = useTheme();

  /**
   * Function to handle editing an upload
   * @function
   * @param {string} collectionId The ID of the collection the upload resides in
   * @param {string} uploadId The ID of the upload to edit
   * @param {string} breadcrumbName The name of the breadcrumb for this item
   * @param {function} onSuccess Function to call upon success
   * @param {function} onFailure Function to call upon failure
   */
  const handleEditUpload = React.useCallback((collectionId, uploadId, breadcrumbName, onSuccess, onFailure) => {
    onEditUpload(collectionId, uploadId, 
        (curUpload, curImages) => { // Success callback
            onSetAction(UserActions.UploadEdit, 
                             {collectionId, name:curUpload.name, uploadName:curUpload.key, uploadId:uploadId, location:curUpload.location, images:curImages},
                             true,
                             breadcrumbName);
            onSuccess?.();
          },
          () => {   // Failure callback
            onFailure?.();
          }
        )
  }, [onEditUpload, onSetAction]);

  switch(action) {
    case UserActions.None:
      return (
        <Landing loadingCollections={loadingCollections} loadingSandbox={loadingSandbox} onUserAction={onSetAction} 
                 onSandboxRefresh={onSandboxRefresh}
        />
      );
    case UserActions.Upload:
      return (
        <UploadManage selectedUpload={curActionData} 
                onEditUpload={handleEditUpload}
        />
      );
    case UserActions.UploadEdit:
      return (
        <UploadEditContext.Provider value={curActionData}>      {/* Specific context for UploadEdit */}
          <UploadEdit selectedUpload={curActionData?.uploadName}
                  onCancel={() => onSetAction(UserActions.Upload, curActionData, false)} 
                  searchSetup={setupSearch}
                  uploadReload={uploadReload}
                  uploadUpdateMetadata={uploadUpdate}
          />
        </UploadEditContext.Provider>
      );
    case UserActions.Collection:
      return (
        <CollectionsManage loadingCollections={loadingCollections}
                            selectedCollection={curActionData} 
                            searchSetup={setupSearch}
                            onEditUpload={handleEditUpload}
        />
    );
    case UserActions.Query:
      return (
        <Queries loadingCollections={loadingCollections}  />
      );
    case UserActions.Maps:
      return (
        <Maps />
      );
    default:
      console.warn('ActionsRouter: unrecognized action', action);
      return null;
  }
}

ActionsRouter.propTypes = {
  action: PropTypes.oneOf(Object.values(UserActions)).isRequired,
  curActionData: PropTypes.shape({
    collectionId: PropTypes.string,
    images: PropTypes.array,
    location: PropTypes.string,
    name: PropTypes.string,
    uploadId: PropTypes.string,
    uploadName: PropTypes.string,
  }),
  loadingCollections: PropTypes.bool,
  loadingSandbox: PropTypes.bool,
  onEditUpload: PropTypes.func.isRequired,
  onSandboxRefresh: PropTypes.func.isRequired,
  onSetAction: PropTypes.func.isRequired,
  setupSearch: PropTypes.func.isRequired,
  uploadReload: PropTypes.func.isRequired,
  uploadUpdate: PropTypes.func.isRequired,
};
