'use client'

/** @module Landing */

import * as React from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

import FolderUpload from './landing/FolderUpload';
import LandingCard from './landing/LandingCard';
import LandingCollections from './landing/LandingCollections';
import LandingMaps from './landing/LandingMaps';
import LandingQuery from './landing/LandingQuery';
import LandingUpload from './landing/LandingUpload';
import UploadRepair from './landing/UploadRepair';
import UserActions from './components/userActions';
import { CollectionsInfoContext, MobileDeviceContext, SizeContext } from './serverInfo';

// Use to declare the type of upload wanted
const uploadTypes = {
  uploadNone:   null,
  uploadImages: 'image',
  uploadMovies: 'movie',
};

/**
 * Returns the UI for the Landing page
 * @function
 * @param {boolean} loadingCollections Set to true when collections are being loaded
 * @param {boolean} loadingSandbox Set to true when sandbox items are being loaded
 * @param {function} onUserAction Function to call when the user clicks an action element
 * @param {function} onSandboxRefresh Called to have the sandbox refreshed from the server
 * @returns {object} The rendered UI
 */
export default function Landing({loadingCollections, loadingSandbox, onUserAction, onSandboxRefresh}) {
  const theme = useTheme();
  const curCollectionInfo = React.useContext(CollectionsInfoContext);
  const mobileDevice = React.useContext(MobileDeviceContext);
  const uiSizes = React.useContext(SizeContext);
  const [haveNewUpload, setHaveNewUpload] = React.useState(uploadTypes.uploadNone);
  const [recoveryInfo, setRecoveryInfo] = React.useState(null); // Used when recovering an upload
  const [selUploadInfo, setSelUploadInfo] = React.useState(null);
  const [selCollectionInfo, setSelCollectionInfo] = React.useState(null);

  // Handle the image size
  React.useLayoutEffect(() => {
    const el = document.getElementById('landing-page-map-image');
    if (el) {
      el.style.width='100%';
    }
  }, [uiSizes]);

  /**
   * Set the flag indicating there's a new upload
   * @function
   * @param {number} uploadType The type of upload
   */
  const newUpload = React.useCallback((uploadType) => {
    if (Object.values(uploadTypes).includes(uploadType)) {
      setHaveNewUpload(uploadType);
    }
  }, []);

  /**
   * Set the flag indicating the upload has been cancelled
   * @function
   */
  const newUploadCancel = React.useCallback(() => {
    setHaveNewUpload(uploadTypes.uploadNone);
  }, []);

  /**
   * Sets the selected upload from the sandbox
   * @function
   * @param {object} uploadInfo The selected upload identifier
   */
  const setUploadSelection = React.useCallback((collectionInfo, uploadInfo) => {
    setSelUploadInfo({collectionInfo, uploadInfo});
  }, []);

  /**
   * Sets the selected collection
   * @function
   * @param {object} collectionInfo The selected collection identifier
   */
  const setCollectionSelection = React.useCallback((collectionInfo) => {
    setSelCollectionInfo(collectionInfo);
  }, []);

  /**
   * Handler for uploading images
   * @function
   */
  const handleUploadImages = React.useCallback(() => {
    setRecoveryInfo({collInfo:selUploadInfo.collectionInfo, uploadInfo:selUploadInfo.uploadInfo});
    setHaveNewUpload(uploadTypes.uploadImages);
  }, [selUploadInfo]);

  /**
   * Handler for uploading movies
   * @function
   */
  const handleUploadMovies = React.useCallback(() => {
    setRecoveryInfo({collInfo:selUploadInfo.collectionInfo, uploadInfo:selUploadInfo.uploadInfo});
    setHaveNewUpload(uploadTypes.uploadMovies);
  }, [selUploadInfo]);

  /**
   * Function to handle the upload completing
   * @function
   */
  const handleUploadCompleted = React.useCallback(() => {
    newUploadCancel();
    onSandboxRefresh();
  }, [newUploadCancel, onSandboxRefresh]);

  /**
   * Handle closing the repair window
   * @function
   */
  const handleRepairClose = React.useCallback(() => {
    setSelUploadInfo(null);
    onSandboxRefresh();
  }, [onSandboxRefresh]);

  // Render the page depending upon user choices
  return (
    <React.Fragment>
      <Box id='landing-page' sx={{flexGrow:1, width:'100vw', overflow:'scroll'}} >
        <Grid container rowSpacing={{xs:1, md:2}} columnSpacing={{xs:1, md:2}} sx={{ padding: '2vw 2vh', height:uiSizes.workspace.height + 'px' }}
              alignItems="stretch" justifyContent="space-between" >
          <Grid size={{xs:12, sm: 12, md:6 }}>
            <LandingCard title="Upload Images" subtitle="Add new images to a collection"
                         action={mobileDevice ? [] :
                                  [ 
                                    {title:'Upload Images', onClick:() => newUpload(uploadTypes.uploadImages)},
                                    {title:'Upload Movies', onClick:() => newUpload(uploadTypes.uploadMovies)},
                                ]}
            >
              <LandingUpload loadingSandbox={loadingSandbox} onChange={setUploadSelection} />
            </LandingCard>
          </Grid>
          <Grid size={{xs:12, sm: 12, md:6 }}>
            <LandingCard title="Collections" subtitle="Organize and view collection uploads. View uploaded images and identify species"
                         action={{title:'Manage', 
                                  onClick:() => onUserAction(UserActions.Collection, selCollectionInfo, false, 'Home'),
                                  disabled: !curCollectionInfo && !loadingCollections}}
            >
              <LandingCollections loadingCollections={loadingCollections} onChange={setCollectionSelection} />
            </LandingCard>
          </Grid>
          <Grid size={{xs:12, sm: 12, md:6 }}>
            <LandingCard title="Search Images" subtitle="Quickly find species and their images. Filter on timestamp, locations, and more."
                         action={{title:'Query', onClick:() => {onUserAction(UserActions.Query, null, false, 'Home');} }}
            >
              <LandingQuery />
            </LandingCard>
          </Grid>
          <Grid size={{xs:12, sm: 12, md:6 }}>
            <LandingCard title="Maps" subtitle="View locations images have been captured on a variety of maps"
                         action={{title:'Maps', onClick:() => {onUserAction(UserActions.Maps, null, false, 'Home');} }}
            >
              <LandingMaps />
            </LandingCard>
          </Grid>
        </Grid>
      </Box>
      { haveNewUpload !== uploadTypes.uploadNone && 
              <FolderUpload loadingCollections={loadingCollections} onCompleted={handleUploadCompleted} onCancel={newUploadCancel}
                            type={haveNewUpload} recovery={recoveryInfo}
              />
      }
      { selUploadInfo !== null && 
          <UploadRepair collectionInfo={selUploadInfo.collectionInfo} uploadInfo={selUploadInfo.uploadInfo}
                        onUploadImages={handleUploadImages}
                        onUploadMovies={handleUploadMovies}
                        onClose={handleRepairClose} />
      }
    </React.Fragment>
  );
}

Landing.propTypes = {
  loadingCollections: PropTypes.bool.isRequired,
  loadingSandbox: PropTypes.bool.isRequired,
  onUserAction: PropTypes.func.isRequired,
  onSandboxRefresh: PropTypes.func.isRequired,
};
