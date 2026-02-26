'use client';

/** @module components/MessagesToolbar */

import * as React from 'react';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import DraftsOutlinedIcon from '@mui/icons-material/DraftsOutlined';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import ReplayOutlinedIcon from '@mui/icons-material/ReplayOutlined';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';


/**
 * Provides the UI for the message's toolbar
 * @function
 * @param {boolean} haveSelectedMessages Set to true when there are selected messages, and false otherwise
 * @param {function} onAllSelected The function to call when the all selected checkbox changes value
 * @param {function} onDeleteSelected The function to call to delete selected messages
 * @param {function} onNewMessage The function to call to create a new message
 * @param {function} onReadSelected The function to call when the user wants to read the selected messages
 * @param {function} onRefresh The function to call to refresh the messages
 * @returns {object} The UI for the toolbar
 */
export default function MessagesToolbar({haveSelectedMessages, onAllSelected, onDeleteSelected, onNewMessage, onReadSelected, onRefresh}) {
  const theme = useTheme();
  const [allSelected, setAllSelected] = React.useState(false);  // When all messages are selected

  // Return the UI
  return (
      <Grid id='messages-details-toolbar' container direction="row" justifyContent="start" alignItems="center" sx={{width:'100%'}}>
        <Tooltip title='Select'>
          <Checkbox id='messages-check-all' size="small" checked={allSelected}
                    onChange={(event) => {setAllSelected(event.target.checked);onAllSelected(event.target.checked)}}
          />
        </Tooltip>
        <Tooltip title='Reload messages'>
          <IconButton aria-label="Reload messages" onClick={onRefresh} >
            <ReplayOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title='Read'>
          <span>
            <IconButton aria-label="Read messages" disabled={!haveSelectedMessages} onClick={onReadSelected} >
              <DraftsOutlinedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title='Delete'>
          <span>
            <IconButton aria-label="Delete messages" onClick={() => {setAllSelected(false);onDeleteSelected();}} disabled={!haveSelectedMessages} >
              <DeleteOutlinedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Button size="small" onClick={onNewMessage} sx={{marginLeft:'auto'}}>Compose</Button>
      </Grid>
  );
}
