'use client'

/** @module landing/IncompleteUploadItem */

import * as React from 'react';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import Grid from '@mui/material/Grid';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PriorityHighOutlinedIcon from '@mui/icons-material/PriorityHighOutlined';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

/**
 * Returns the UI for uploads on the Landing page
 * @function
 * @param {object} upload The upload item to display
 * @param {object} collection The collection associated with the upload
 * @param {boolean} highlight When set to true the row is highlighted
 * @param {function} onRepair The function to call to repair the upload
 * @returns {object} The rendered UI
 */
export default function IncompleteUploadItem({upload, collection, highlight, onRepair}) {
  const theme = useTheme();

  return (
    <Grid container direction="row" alignItems="center" justifyContent="start"
          sx={{padding:'3px 0px', width:'100%', backgroundColor: highlight ? "rgb(0,0,0,0.05)" : "transparent"}}
    >
      <Tooltip title="Incomplete upload" placement="left" sx={{paddingLeft:'5px'}}>
        <PriorityHighOutlinedIcon fontSize="small" sx={{color:"sandybrown"}} />
      </Tooltip>
      <Typography variant="body1" >
        {upload.name}
      </Typography>
      <Tooltip placement="left"
                title={
                  <React.Fragment>
                    <p>Source folder: {upload.path ? upload.path : "<unknown>"}</p>
                    <p>User: {upload.uploadUser}</p>
                    <p>Images: {upload.imagesCount}</p>
                    <p>Location: {upload.location}</p>
                    <p>Folders: {upload.folders && upload.folders.length > 0 ? upload.folders.join(', ') : "<none>"}</p>
                  </React.Fragment>
                }
      >
        <InfoOutlinedIcon fontSize="small" sx={{color:"black", paddingTop:"3px", marginLeft:'auto'}} />
      </Tooltip>
      <Tooltip placement="left" title="Repair this upload" style={{marginLeft:"3px"}} >
        <CloudUploadOutlinedIcon
              onClick={() => onRepair(collection, upload)}
              sx={{color:"black", backgroundColor:'rgb(224, 224, 224, 0.7)', border:'1px solid black', borderRadius:'7px', padding:'2px', marginRight:'15px'}} />
      </Tooltip>
    </Grid>
  );
}

IncompleteUploadItem.propTypes = {
  upload: PropTypes.shape({
    name: PropTypes.string.isRequired,
    path: PropTypes.string,
    uploadUser: PropTypes.string,
    imagesCount: PropTypes.number,
    location: PropTypes.string,
    folders: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  collection: PropTypes.object.isRequired,
  highlight: PropTypes.bool,
  onRepair: PropTypes.func.isRequired,
};
