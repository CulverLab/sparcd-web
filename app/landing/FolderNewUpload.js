'use client'

/** @module landing/FolderNewUpload */

import * as React from 'react';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

import { SizeContext } from '../serverInfo';

/**
 * Returns the UI for the details of a new upload
 * @function
 * @param {string} stepNumber The step number to display
 * @param {number} stepTotal The total number of steps
 * @param {React.node} content The Card content to display
 * @param {Array<{label: string, onClick: function, disabled: boolean}>} actionInfo An array of button labels, onClick handlers, and disabled boolean values for each button
 * @returns {object} The rendered UI
 */
export default function FolderNewUpload({stepNumber, stepTotal, content, actionInfo}) {
  const theme = useTheme();
  const uiSizes = React.useContext(SizeContext);

  return (
    <Card id='folder-upload-details'  variant="outlined" sx={{ ...theme.palette.folder_upload, minWidth:uiSizes.workspace.width * 0.8 }} >
      <CardHeader sx={{ textAlign: 'center' }}
         title={
          <Typography gutterBottom variant="h6" component="h4">
            New Upload Details
          </Typography>
         }
         subheader={
          <React.Fragment>
            <Typography gutterBottom variant="body1">
              Select Collection and Location to proceed
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
        {actionInfo?.map((item, idx) =>
          <Button key={`${item.label}-${idx}`} sx={{flex:1}} size="small" onClick={item.onClick} disabled={item.disabled}>{item.label}</Button>
          )}
      </CardActions>
    </Card>
  );
}

FolderNewUpload.propTypes = {
  stepNumber: PropTypes.number.isRequired,
  stepTotal: PropTypes.number.isRequired,
  content: PropTypes.node.isRequired,
  actionInfo: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    onClick: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
  })),
};
