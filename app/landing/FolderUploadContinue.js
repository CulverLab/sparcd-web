'use client'

/** @module components/FolderUploadContinue */

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

import { SizeContext } from '../serverInfo';

/**
 * Renders the UI for continuing a previous upload
 * @function
 * @param {string} uploadPath The path of the upload
 * @param {number} totalFileCount Total number of files in the upload
 * @param {number} remainingFileCount Number of files remaining to be uploaded
 * @param {number} elapsedSeconds The number of elapsed seconds from the initial upload attempt
 * @param {function} onContinue Handles the user wanting to continue the upload
 * @param {function} onRestart Handles the user wanting to restart the upload
 * @param {function} onCreateNew Handles the user wanting to start a new upload
 * @param {function} onAbandon Handles the user wanting to abandon the upload
 * @param {function} onCancel Handles the user chooses the cancel option
 * @returns {object} The rendered UI
 */
export default function FolderUploadContinue({uploadPath, totalFileCount, remainingFileCount, elapsedSeconds,
                                              onContinue, onRestart, onCreateNew, onAbandon, onCancel}) {
  const theme = useTheme();
  const uiSizes = React.useContext(SizeContext);

  /**
   * Generates elapsed time string based upon the number of seconds specified
   * @function
   * @param {number} seconds The number of seconds to format
   * @return {string} The formatted string
   */
  function generateSecondsElapsedText(seconds) {
    let results = '';
    let remain_seconds = seconds;

    // Days
    let cur_num = Math.floor(remain_seconds / (24 * 60 * 60));
    if (cur_num > 0) {
      results += `${cur_num} days `;
      remain_seconds -= cur_num * (24 * 60 * 60);
    }

    // Hours
    cur_num = Math.floor(remain_seconds / (60 * 60));
    if (results.length > 0 || cur_num > 0) {
      results += `${cur_num} hours `;
      remain_seconds -= cur_num * (60 * 60);
    }

    // Minutes
    cur_num = Math.floor(remain_seconds / 60);
    if (results.length > 0 || cur_num > 0) {
      results += `${cur_num} minutes `;
      remain_seconds -= cur_num * 60;
    }

    // Seconds
    if (results.length > 0 || remain_seconds > 0) {
      results += `${remain_seconds} seconds `;
    }

    return results;
  }

  return (
    <Box id='landing-page-upload-continue-wrapper' sx={{ ...theme.palette.screen_overlay }} >
      <Grid
        container
        spacing={0}
        direction="column"
        alignItems="center"
        justifyContent="center"
        sx={{ minHeight: uiSizes.workspace.height + 'px' }}
      >
      <Card id='folder-upload-continue' variant="outlined" sx={{ ...theme.palette.folder_upload, minWidth:(uiSizes.workspace.width * 0.8) + 'px' }} >
        <CardHeader sx={{ textAlign: 'center' }}
           title={
            <Typography gutterBottom variant="h6" component="h4">
              Upload Already Started
            </Typography>
           }
          />
        <CardContent>
          <Typography gutterBottom variant="body1">
            An incomplete upload from '{uploadPath}' has been detected. How would you like to proceed?
          </Typography>
          <Typography gutterBottom variant="body2">
            {remainingFileCount} out of {totalFileCount} files have been uploaded
          </Typography>
          <Typography gutterBottom variant="body2">
            Upload created {generateSecondsElapsedText(elapsedSeconds)} ago
          </Typography>
          <Grid id="landing-page-upload-continue-options-wrapper" container direction="row" rowSpacing={1} alignItems="center" justifyContent="flex-start"
                sx={{paddingTop:'10px'}}>
            <Grid id="landing-page-upload-continue-options-continue" container direction="row" alignItems="start" justifyContent="flex-start"
                sx={{border:'1px solid #c3c3d2', borderRadius:'5px', width:'100%', backgroundColor:'#eaeaf9', padding:'50px 0px'}}>
              <Button id="sandbox-upload-continue-continue" size="small" onClick={onContinue}>Resume Upload</Button>
              <Typography gutterBottom variant="body2" component='div' sx={{width:'70%', marginLeft:'auto'}}>
                The upload continues from where it left off and will upload the remaining files. This is helpful when the files to upload haven't changed
              </Typography>
            </Grid>
            <Grid id="landing-page-upload-continue-options-restart" container direction="row" alignItems="start" justifyContent="flex-start"
                sx={{border:'1px solid #c3c3d2', borderRadius:'5px', width:'100%', backgroundColor:'#eaeaf9', padding:'50px 0px'}}>
              <Button id="sandbox-upload-continue-restart" size="small" onClick={onRestart}>Restart Upload</Button>
              <Typography gutterBottom variant="body2" component='div' sx={{width:'70%', marginLeft:'auto'}} >
                Restart the entire upload starting from the first image until the last. This is helpful if previously loaded images were changed, replaced, 
                or added to
              </Typography>
            </Grid>
            <Grid id="landing-page-upload-continue-options-create" container direction="row" alignItems="start" justifyContent="flex-start"
                sx={{border:'1px solid #c3c3d2', borderRadius:'5px', width:'100%', backgroundColor:'#eaeaf9', padding:'50px 0px'}}>
              <Button id="sandbox-upload-continue-create" size="small" onClick={onCreateNew}>Create New Upload</Button>
              <Typography gutterBottom variant="body2" component='div' sx={{width:'70%', marginLeft:'auto'}} >
                Remove the previous upload attempt and create a new upload. This is helpful if the previous upload was incomplete or incorrect
                and you want to restart the whole process
              </Typography>
            </Grid>
            <Grid id="landing-page-upload-continue-options-abandon" container direction="row" alignItems="start" justifyContent="flex-start"
                sx={{border:'1px solid #c3c3d2', borderRadius:'5px', width:'100%', backgroundColor:'#eaeaf9', padding:'50px 0px'}}>
              <Button id="sandbox-upload-continue-abandon" size="small" onClick={onAbandon}>Abandon Upload</Button>
              <Typography gutterBottom variant="body2" component='div' sx={{width:'70%', marginLeft:'auto'}} >
                Will abandon the previous upload attempt and not try to upload anything else. This is helpful if the upload is no longer needed or
                wanted
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
        <CardActions>
          <Button id="sandbox-upload-continue-cancel" sx={{flex:1}} size="small" onClick={onCancel}>Cancel</Button>
        </CardActions>
      </Card>
      </Grid>
    </Box>
  );
}

FolderUploadContinue.propTypes = {
  uploadPath: PropTypes.string.isRequired,
  totalFileCount: PropTypes.number.isRequired,
  remainingFileCount: PropTypes.number.isRequired,
  elapsedSeconds: PropTypes.number.isRequired,
  onContinue: PropTypes.func.isRequired,
  onRestart: PropTypes.func.isRequired,
  onCreateNew: PropTypes.func.isRequired,
  onAbandon: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
