'use client'

/** @module landing/FolderSelectionProgress */

import * as React from 'react';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

/**
 * Returns the UI for starting an upload and when uploading files
 * @function
 * @param {string} type The type of upload for display expected to be one of "image" or "movie"
 * @param {string} subTitle The subtitle to display
 * @param {string} stepNumber The step number to display
 * @param {string} stepTotal The total number of steps
 * @param {React.node} content The Card content to display
 * @param {React.node} actions The Card Actions to render
 * @returns {object} The rendered UI
 */
export default function FolderSelectionProgress({type, subTitle, stepNumber, stepTotal, content, actions}) {
  const theme = useTheme();

  return (
    <Card id='folder-upload-select' variant="outlined" sx={{ ...theme.palette.folder_upload }} >
      <CardHeader sx={{ textAlign: 'center' }}
         title={
          <Typography gutterBottom variant="h6" component="h4">
            Upload {type.charAt(0).toUpperCase() + String(type).slice(1)} Folder
          </Typography>
         }
         subheader={
          <React.Fragment>
            <Typography gutterBottom variant="body1">
              {subTitle}
            </Typography>
            <br />
            <Typography gutterBottom variant="body2">
              Step {stepNumber} of {stepTotal}
            </Typography>
          </React.Fragment>
          }
       />
      <CardContent>
        {content}
      </CardContent>
      <CardActions>
        {actions}
      </CardActions>
    </Card>

  );
}

FolderSelectionProgress.propTypes = {
  type: PropTypes.string.isRequired,
  subTitle: PropTypes.string.isRequired,
  stepNumber: PropTypes.number.isRequired,
  stepTotal: PropTypes.number.isRequired,
  content: PropTypes.node.isRequired,
  actions: PropTypes.node.isRequired,
};
