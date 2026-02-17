'use client'

/** @module landing/FolderUpload */

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Grid from '@mui/material/Grid';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

import { Level } from '../components/Messages';
import { AddMessageContext, TokenExpiredFuncContext, TokenContext } from '../serverInfo';
import * as utils from '../utils';

/**
 * Returns the UI for the Landing page
 * @function
 * @param {object} collection The collection associatd with the upload to repair
 * @param {object} upload The upload to be repaired
 * @param {function} onUploadImages Function to call when the user wants to try repairing by loading images
 * @param {function} onUploadMovies Function to call when the user wants to try repairing by loading movies
 * @param {function} onClose Function to call the use is finished
 * @returns {object} The rendered UI
 */
export default function UploadRepair({collectionInfo, uploadInfo, onUploadImages, onUploadMovies, onClose}) {
  const theme = useTheme();
  const addMessage = React.useContext(AddMessageContext); // Function adds messages for display
  const setTokenExpired = React.useContext(TokenExpiredFuncContext);
  const uploadToken = React.useContext(TokenContext);  // Login token
  const [failureMessage, setFailureMessage] = React.useState(null);     // Holds messages upon failure
  const [serverURL, setServerURL] = React.useState(utils.getServer());  // The server URL to use

  /**
   * Function to mark the currently selected upload as completed
   * @function
   */
  const handleSelUploadComplete = React.useCallback(() => {
    const uploadCompleteUrl = serverURL + '/setUploadComplete?t=' + encodeURIComponent(uploadToken);

    const formData = new FormData();
    formData.append('collectionId', collectionInfo.id);
    formData.append('uploadKey', uploadInfo.key);

    try {
      const resp = fetch(uploadCompleteUrl, {
        method: 'POST',
        body: formData,
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              if (resp.status === 401) {
                // User needs to log in again
                setTokenExpired();
              }
              throw new Error(`Failed to mark upload complete: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
            // Handle the result
            if (respData.success) {
              addMessage(Level.Information, "Successfully marked upload as complete");
              window.setTimeout(onClose, 1000);
            } else {
              addMessage(Level.Warning, respData.message);
              setFailureMessage(respData.message);
            }
        })
        .catch(function(err) {
          console.log('Mark Upload Complete Error: ',err);
          const message = "An error occured while trying to mark upload as complete";
          addMessage(Level.Error, message);
          setFailureMessage(message)
      });
    } catch (error) {
      console.log('Mark Upload Complete Unknown Error: ',err);
      const message = "An unknown error occured while trying to mark upload as complete";
      addMessage(Level.Error, message);
      setFailureMessage(message)
    }
  }, [addMessage, serverURL, setTokenExpired, uploadToken]);

  /**
   * Function to continue the image upload
   * @function
   */
  const handleSelUploadContinue = React.useCallback((type) => {
    if (type === 'images') {
      onUploadImages(collectionInfo, uploadInfo);
      onClose();
    } else if (type === 'movies') {
      onUploadMovies(collectionInfo, uploadInfo);
      onClose();
    }
  }, []);

  // Return the UI
  return (
    <Grid id="landing-page-fix-upload-wrapper" container direction="row" alignItems="center" justifyContent="center" 
          sx={{...theme.palette.screen_overlay, backgroundColor:'rgb(0,0,0,0.5)', zIndex:11111}}
    >
      <Card id='anding-page-fix-upload' variant="outlined" sx={{ ...theme.palette.folder_upload }} >
        <CardHeader sx={{ textAlign: 'center' }} title="Repair an incomplete upload" />
        <CardContent>
          <Typography gutterBottom variant="body2" sx={{fontWeight:'bold'}}>
            {failureMessage ? failureMessage : " "}
          </Typography>
          <Typography gutterBottom variant="body2">
            Upload: <span style={{fontWeight:"bold"}}>{uploadInfo.key}</span>
          </Typography>
          <Typography gutterBottom variant="body2">
            Collection: <span style={{fontWeight:"bold"}}>{collectionInfo.name}</span>
          </Typography>
        </CardContent>
        <CardActions>
          <Button size="small" onClick={() => {handleSelUploadComplete()} } >
            Mark As Completed
          </Button>
          <Button size="small" onClick={() => {handleSelUploadContinue('images')} } >
            Upload images
          </Button>
          <Button size="small" onClick={() => {handleSelUploadContinue('movies')} } >
            Upload movies
          </Button>
          <Button size="small" onClick={onClose} >
            Cancel
          </Button>
        </CardActions>
      </Card>
    </Grid>
  );
}
