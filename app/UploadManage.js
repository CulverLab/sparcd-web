'use client'

/** @module UploadManage */

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

import { SandboxInfoContext, SizeContext } from './serverInfo';
import UploadSidebarItem from './components/UploadSidebarItem';

/**
 * Renders the UI for managing the list of uploaded folders
 * @function
 * @param {object} selectedUpload The currently selected upload
 * @param {function} onEditUpload Called when the user wants to edit the selected upload
 * @returns {object} The rendered UI
 */
export default function UploadManage({selectedUpload, onEditUpload}) {
  const theme = useTheme();
  const sandboxItems = React.useContext(SandboxInfoContext);
  const uiSizes = React.useContext(SizeContext);
  const [sidebarWidth, setSidebarWidth] = React.useState(150);  // Default value is recalculated at display time
  const [totalHeight, setTotalHeight] = React.useState(null);  // Default value is recalculated at display time
  const [workingTop, setWorkingTop] = React.useState(null);  // Default value is recalculated at display time
  const [workspaceWidth, setWorkspaceWidth] = React.useState(640);  // Default value is recalculated at display time
  const [selectionIndex, setSelectionIndex] = React.useState(sandboxItems.findIndex((item) => item.name === selectedUpload));

  // Keep selection index up to date
  React.useEffect(() => {
    setSelectionIndex(sandboxItems.findIndex((item) => item.name === selectedUpload));
  }, [sandboxItems, selectedUpload]);

  /**
   * Handler for when the user's selection changes and prevents default behavior
   * @function
   * @param {object} event The event
   * @param {string} name The name of the new selected upload
   */
  const onSandboxChange = React.useCallback((event, name) => {
    event.preventDefault();
    setSelectionIndex(sandboxItems.findIndex((item) => item.name === name));
  }, [sandboxItems]);

  /**
   * Handles the user not wanting to edit an upload and prevents default behavior
   * @function
   * @param {object} event The event
   */
  const onCancelEditUpload = React.useCallback((event) => {
    event.preventDefault();
    setSelectionIndex(-1);
  }, []);

  /**
   * Handle the user wanting to edit an upload and prevents default behavior
   * @function
   * @param {object} event The event
   */
  const handleEditUpload = React.useCallback((event) => {
    event.preventDefault();
    onEditUpload(sandboxItems[selectionIndex].collectionId, sandboxItems[selectionIndex].key, "Uploads");
  }, [onEditUpload, sandboxItems, selectionIndex]);

  /**
   * Calculates the total UI size available for the workarea
   * @function
   * @param {object} curSize The total width and height of the window layout items
   */
  const calcTotalSize = React.useCallback((curSize) => {

    setWorkspaceWidth(curSize.window.width - 150);
    setTotalHeight(curSize.workspace.height);
    setWorkingTop(curSize.workspace.top);

    const elLeftSidebar = document.getElementById('left-sidebar');
    if (elLeftSidebar) {
      const elLeftSidebarSize = elLeftSidebar.getBoundingClientRect();
      setSidebarWidth(elLeftSidebarSize.width);
      setWorkspaceWidth(curSize.window.width - elLeftSidebarSize.width);
    }
  }, []);

  // Recalculate available space in the window
  React.useLayoutEffect(() => {
    calcTotalSize(uiSizes);
  }, [calcTotalSize, uiSizes]);

  // Render the UI
  const curHeight = (totalHeight || 480);
  const curStart = (workingTop || 25);
  const workplaceStartX = sidebarWidth;
  return (
    <Box sx={{ flexGrow: 1, 'width': '100vw' }} >
      <Grid id='left-sidebar' container direction='column' alignItems='stretch' columns='1' 
          style={{ 'minHeight':curHeight, 'maxHeight':curHeight, 'height':curHeight, 'top':curStart, 
                   'position':'absolute', ...theme.palette.left_sidebar }} >
        { sandboxItems.map((item, idx) => <UploadSidebarItem uploadItem={item.name} key={item.name} selected={idx === selectionIndex}
                                                             onClick={(ev) => onSandboxChange(ev, item.name)} />) }
      </Grid>
      <Grid id='upload-workspace' container spacing={0} direction="column" alignItems="center" justifyContent="center"
            style={{ 'minHeight':curHeight, 'maxHeight':curHeight, 'height':curHeight, 'top':curStart, 'left':workplaceStartX,
                     'minWidth':workspaceWidth, 'maxWidth':workspaceWidth, 'width':workspaceWidth, 'position':'absolute' }}>
        { selectionIndex <= -1 ?
            <Grid size={{ xs: 12, sm: 12, md:12 }}>
              <Container sx={{border:'1px solid grey', borderRadius:'5px', color:'darkslategrey', background:'#E0F0E0'}}>
                <Typography variant="body" sx={{ color: 'text.secondary' }}>
                  Please select an upload to work with
                </Typography>
              </Container>
            </Grid>
          :
            <Grid size={{ xs: 12, sm: 12, md:12 }}>
              <Card variant='outlined' sx={{backgroundColor: 'action.selected', maxWidth:'50vw'}}>
                <CardContent>
                  <Typography variant="body" sx={{ color: 'text.secondary' }}>
                    Do you want to edit <span style={{fontWeight:'bold'}}>{sandboxItems[selectionIndex].name}</span>?
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button sx={{flex:1}} size="small" onClick={handleEditUpload} >Edit</Button>
                  <Button sx={{flex:1}} size="small" onClick={onCancelEditUpload} >Cancel</Button>
                </CardActions>
              </Card>
            </Grid>
        }
      </Grid>
    </Box>
  );
}

UploadManage.propTypes = {
  selectedUpload: PropTypes.string.isRequired,
  onEditUpload:   PropTypes.func.isRequired,
};
