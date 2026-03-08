'use client'

/** @module components/FolderUpload */

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
 
import { SizeContext } from '../serverInfo';

/**
 * Renders the UI for uploading a folder of images
 * @function
 * @param {string} title The title to display
 * @param {function} onConfirm THe user confirms the action
 * @param {function} onCancelThe user cancels the action
 * @param {object} children The children to display
 * @returns {object} The rendered UI
 */
export default function FolderUploadConfirm({title, onConfirm, onCancel, children}) {
  const theme = useTheme();
  const uiSizes = React.useContext(SizeContext);

  return (
     <Box id='landing-page-upload-confirm-wrapper' sx={{ ...theme.palette.screen_overlay }} >
      <Grid
        container
        spacing={0}
        direction="column"
        alignItems="center"
        justifyContent="center"
        sx={{ minHeight: uiSizes.workspace.height + 'px' }}
      >
        <Card id='folder-upload-confirm' variant="outlined" sx={{ ...theme.palette.folder_upload, minWidth:(uiSizes.workspace.width * 0.8) + 'px' }} >
          <CardHeader sx={{ textAlign: 'center' }}
             title={
                      <Typography gutterBottom variant="h6" component="h4">
                        {title}
                      </Typography>
                    }
          />
          <CardContent>
              {children}
          </CardContent>
          <CardActions>
            <Button id="sandbox-upload-continue-confirm-yes" sx={{'flex':'1'}} size="small" onClick={onConfirm}>Yes</Button>
            <Button id="sandbox-upload-continue-confirm-no" sx={{'flex':'1'}} size="small" onClick={onCancel}>No</Button>
          </CardActions>
          </Card>
      </Grid>
    </Box>
  );
}