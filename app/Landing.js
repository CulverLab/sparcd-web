'use client'

/** @module Landing */

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

import FolderUpload from './landing/FolderUpload';
import LandingCard from './landing/LandingCard';
import LandingCollections from './landing/LandingCollections';
import LandingMaps from './landing/LandingMaps';
import LandingQuery from './landing/LandingQuery';
import LandingUpload from './landing/LandingUpload';
import UserActions from './components/userActions';
import { CollectionsInfoContext, MobileDeviceContext, SandboxInfoContext, SizeContext } from './serverInfo';

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
 * @param {function} onEditUpload Called when the user wants to edit the selected upload
 * @param {function} onSandboxRefresh Called to have the sandbox refreshed from the server
 * @returns {object} The rendered UI
 */
export default function Landing({loadingCollections, loadingSandbox, onUserAction, onEditUpload, onSandboxRefresh}) {
  const theme = useTheme();
  const curCollectionInfo = React.useContext(CollectionsInfoContext);
  const curSandboxInfo = React.useContext(SandboxInfoContext);
  const mobileDevice = React.useContext(MobileDeviceContext);
  const uiSizes = React.useContext(SizeContext);
  const [haveNewUpload, setHaveNewUpload] = React.useState(uploadTypes.uploadNone);
  const [mapImageSize, setMapImageSize] = React.useState({width:722,height:396})
  const [selUploadInfo, setSelUploadInfo] = React.useState(null);
  const [selCollectionInfo, setSelCollectionInfo] = React.useState(null);

  // Handle the image size
  React.useLayoutEffect(() => {
    const el = document.getElementById('landing-page-map-image');
    if (el) {
      el.style.width='100%';
    }
  }, [uiSizes, mapImageSize]);

  /**
   * Set the flag indicating there's a new upload
   * @function
   * @param {number} uploadType The type of upload
   */
  const newUpload = React.useCallback((uploadType) => {
    if (Object.values(uploadTypes).includes(uploadType)) {
      setHaveNewUpload(uploadType);
    }
  }, [setHaveNewUpload]);

  /**
   * Set the flag indicating the upload has been cancelled
   * @function
   */
  const newUploadCancel = React.useCallback(() => {
    setHaveNewUpload(uploadTypes.uploadNone);
  }, [setHaveNewUpload]);

  /**
   * Sets the selected upload from the sandbox
   * @function
   * @param {object} uploadInfo The selected upload identifier
   */
  const setUploadSelection = React.useCallback((uploadInfo) => {
    setSelUploadInfo(uploadInfo);
  }, [setSelUploadInfo]);

  /**
   * Sets the selected collection
   * @function
   * @param {object} collectionInfo The selected collection identifier
   */
  const setCollectionSelection = React.useCallback((collectionInfo) => {
    setSelCollectionInfo(collectionInfo);
  }, [setSelCollectionInfo]);

  /**
   * Handles the user wanting to see maps
   * @function
   */
  const handleMapImageLoad = React.useCallback(() => {
    let el = document.getElementById('landing-page-map-image');
    if (el) {
      setMapImageSize({width:el.width, height:el.height});
    }
  }, [setMapImageSize]);

  // Render the page depending upon user choices
  return (
    <React.Fragment>
      <Box id='landing-page' sx={{flexGrow:1, width:'100vw', overflow:'scroll'}} >
        <Grid container rowSpacing={{xs:1, md:2}} columnSpacing={{xs:1, md:2}} sx={{ 'padding': '2vw 2vh', height:uiSizes.workspace.height + 'px' }}
              alignItems="stretch" justifyContent="space-between" >
          <Grid size={{xs:12, sm: 12, md:6 }}>
            <LandingCard title="Upload Images" subtitle="Add new images to a collection"
                         action={[!mobileDevice ? {title:'Upload Images', onClick:() => newUpload(uploadTypes.uploadImages)}
                                                : null,
                                  {title:'Upload Movies', onClick:() => newUpload(uploadTypes.uploadMovies)},
                                ]}
            >
              <LandingUpload loadingSandbox={loadingSandbox} onChange={setUploadSelection} />
            </LandingCard>
          </Grid>
          <Grid size={{xs:12, sm: 12, md:6 }}>
            <LandingCard title="Collections" subtitle="Organize and view collection uploads. View uploaded images and identify species"
                         action={{'title':'Manage', 
                                  'onClick':() => onUserAction(UserActions.Collection, selCollectionInfo, false, 'Home'),
                                  'disabled': curCollectionInfo || loadingCollections ? false : true}}
            >
              <LandingCollections loadingCollections={loadingCollections} onChange={setCollectionSelection} />
            </LandingCard>
          </Grid>
          <Grid size={{xs:12, sm: 12, md:6 }}>
            <LandingCard title="Search Images" subtitle="Quickly find species and their images. Filter on timestamp, locations, and more."
                         action={{'title':'Query', 'onClick':() => {onUserAction(UserActions.Query, null, false, 'Home');} }}
            >
              <LandingQuery />
            </LandingCard>
          </Grid>
          <Grid size={{xs:12, sm: 12, md:6 }}>
            <LandingCard title="Maps" subtitle="View locations images have been captured on a variety of maps"
                         action={{'title':'Maps', 'onClick':() => {onUserAction(UserActions.Maps, null, false, 'Home');} }}
            >
              <LandingMaps onMapImageLoad={handleMapImageLoad} />
            </LandingCard>
          </Grid>
        </Grid>
      </Box>
      { haveNewUpload !== uploadTypes.uploadNone && 
              <FolderUpload loadingCollections={loadingCollections} onCompleted={() => {newUploadCancel();onSandboxRefresh();}} onCancel={() => newUploadCancel()}
                            type={haveNewUpload}
              />
      }
    </React.Fragment>
  );
}
