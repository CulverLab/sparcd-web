'use client'

/** @module Landing */

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

import FolderUpload from './components/FolderUpload';
import LandingCard from './components/LandingCard';
import LandingCollections from './LandingCollections';
import LandingUpload from './LandingUpload';
import UserActions from './components/userActions';
import { CollectionsInfoContext, MobileDeviceContext, SandboxInfoContext, SizeContext } from './serverInfo';

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
  const [haveNewUpload, setHaveNewUpload] = React.useState(false);
  const [selUploadInfo, setSelUploadInfo] = React.useState(null);
  const [selCollectionInfo, setSelCollectionInfo] = React.useState(null);

  /**
   * Set the flag indicating there's a new upload
   * @function
   */
  function newUpload() {
    setHaveNewUpload(true);
  }

  /**
   * Set the flag indicating the upload has been cancelled
   * @function
   */
  function newUploadCancel() {
    setHaveNewUpload(false);
  }

  /**
   * Sets the selected upload from the sandbox
   * @function
   * @param {object} uploadInfo The selected upload identifier
   */
  function setUploadSelection(uploadInfo) {
    setSelUploadInfo(uploadInfo);
  }

  /**
   * Sets the selected collection
   * @function
   * @param {object} collectionInfo The selected collection identifier
   */
  function setCollectionSelection(collectionInfo) {
    setSelCollectionInfo(collectionInfo);
  }

  /**
   * Handles the user wanting to edit an upload
   * @function
   */
  function handleSandboxEdit() {
    const curCollection = curCollectionInfo.find((item) => item.bucket === selUploadInfo.bucket);
    const curUpload = selUploadInfo.upload;
    onEditUpload(curCollection.id, curUpload.key, "Home");
  }

  // Render the page depending upon user choices
  return (
    <React.Fragment>
      <Box id='landing-page' sx={{flexGrow:1, 'width':'100vw', overflow:'scroll'}} >
        <Grid container rowSpacing={{sm:1}} columnSpacing={{sm:1}} sx={{ 'padding': '2vw 2vh', height:uiSizes.workspace.height + 'px' }}
              alignItems="stretch" justifyContent="space-between" >
            <LandingCard title="Upload Images" subtitle="Add new images to a collection"
                         action={[!mobileDevice ? {'title':'Upload Images', 'onClick':() => newUpload()} : null]}
            >
              <LandingUpload loadingSandbox={loadingSandbox} onChange={setUploadSelection} />
            </LandingCard>
            <LandingCard title="Collections" subtitle="Organize and view collection uploads. View uploaded images and identify species"
                         action={{'title':'Manage', 
                                  'onClick':() => onUserAction(UserActions.Collection, selCollectionInfo, false, 'Home'),
                                  'disabled': curCollectionInfo || loadingCollections ? false : true}}
            >
              <LandingCollections loadingCollections={loadingCollections} onChange={setCollectionSelection} />
            </LandingCard>
            <LandingCard title="Search Images" subtitle="Quickly find species and their images. Filter on timestamp, locations, and more."
                         action={{'title':'Query', 'onClick':() => {onUserAction(UserActions.Query, null, false, 'Home');} }}
            >
            </LandingCard>
            <LandingCard title="Maps" subtitle="View locations images have been captured on a variety of maps"
                         action={{'title':'Maps', 'onClick':() => {onUserAction(UserActions.Maps, null, false, 'Home');} }}
            >
            </LandingCard>
        </Grid>
      </Box>
      { haveNewUpload && <FolderUpload loadingCollections={loadingCollections} onCompleted={() => {setHaveNewUpload(false);onSandboxRefresh();}} onCancel={() => setHaveNewUpload(false)}/>
      }
    </React.Fragment>
  );
}
