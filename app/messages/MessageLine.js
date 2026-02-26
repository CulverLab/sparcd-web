'use client';

/** @module components/MessageLine */

import * as React from 'react';
import Checkbox from '@mui/material/Checkbox';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import DraftsOutlinedIcon from '@mui/icons-material/DraftsOutlined';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import MailOutlinedIcon from '@mui/icons-material/MailOutlined';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';


/**
 * Provides the UI for the message's toolbar
 * @function
 * @param {string} messageId The ID of the message itself
 * @param {object} message The message itself
 * @param {boolean} isSelected The message is selected
 * @param {object} menuItems The list of menu item names with their handling functions
 * @param {function} onReadMessage The function to call for reading the message
 * @param {function} onSelChange The function to call when the selected state of the message changes
 * @returns {object} The UI for the toolbar
 */
export default function MessageLine({message, isSelected, menuItems, onDelete, onRead, onSelChange}) {
  const theme = useTheme();
  const [menuAnchor, setMenuAnchor] = React.useState(null);

  // Format the date
  const formattedDate = React.useMemo(() => {
    console.log('HACK: ',message.created_sec);
    return message.created_sec == null ? '': formatTimestamp(-(message.created_sec));
  }, [message.created_sec]);

  /**
   * Handle closing the more menu
   * @function
   */
  const handleMoreClose = React.useCallback(() => {
    setMenuAnchor(null);
  }, [setMenuAnchor]);

  /**
   * Returns the function for handling menu clicks
   * @function
   * @param {function} onClick The function to call when clicked
   * @param {string} msgId The ID of the message
   */
  const handleMenuClick = React.useCallback((event, onClick, msgId) => {
    event.stopPropagation();
    onClick(msgId);
    handleMoreClose();
  }, [handleMoreClose]);

  /**
   * Formats the timestamp for a message
   * @function
   * @param {number} elapsedSec The number of seconds from now to apply to the timestamp
   */
  function formatTimestamp(elapsedSec) {
    let curTs = new Date();
    let createTs = new Date(curTs.getTime() + (elapsedSec * 1000));

    if (curTs.getFullYear() === createTs.getFullYear()) {
      return createTs.toLocaleDateString(navigator.language ? navigator.language : 'en-US', {month:'short', day:'numeric'}) 
    }
    return createTs.toLocaleDateString(navigator.language ? navigator.language : 'en-US', {month:'short', day:'numeric', year:'numeric'}) 
  }

  // Return the UI
  const wasRead = message.read_sec != null;
  return (
          <React.Fragment>
              <Checkbox id={`message-check-${message.id}`} size="small" checked={isSelected} aria-label={`Select message ${message.subject ?? '<no subject>'}`}
                        onChange={(event) => {event.stopPropagation();onSelChange(event);}} />
              <Grid container direction="row" wrap="nowrap" alignItems="center" justifyContent="start" 
                  sx={{padding:"0px", width:"100%", color:wasRead ? 'grey' : 'black'}}
                  onClick={(event) => {event.stopPropagation();onRead();}}
              >
                <Typography variant="body2" sx={{paddingRight:'10px', color:'grey', fontStyle:'italic', fontSize:'x-small', minWidth:'80px'}}>
                  {'[to: ' +message.receiver+ ']'}
                </Typography>
                <Typography variant="body2" sx={{paddingRight:'10px', minWidth:'100px'}} >
                  {message?.sender ?? '<no sender>'}
                </Typography>
                <Typography variant="body2">
                  {message?.subject ?? '<no subject>'}
                </Typography>
                <Typography variant="body2" sx={{marginLeft:'auto', paddingRight:'10px'}}>
                  {formattedDate}
                  </Typography>
              </Grid>
              { wasRead ? 
                    <Tooltip title='Read'>
                      <DraftsOutlinedIcon fontSize="small" sx={{marginLeft:'auto', color:'grey'}} />
                    </Tooltip>
                    : 
                    <Tooltip title='Unread'>
                      <MailOutlinedIcon fontSize="small" sx={{marginLeft:'auto', color:'grey'}} />
                    </Tooltip>
              }
              <Tooltip title='Delete this message'>
                <IconButton aria-label="delete this message" onClick={(event) => {event.stopPropagation();onDelete();}} >
                  <DeleteOutlinedIcon fontSize="small" />
                </IconButton >
              </Tooltip>
              <div>
                <Tooltip title='More options'>
                  <IconButton id={`message-more-button-${message.id}`}
                            aria-label="More options"
                            aria-controls={menuAnchor ? `message-menu-${message.id}` : undefined}
                            aria-haspopup="true"
                            aria-expanded={Boolean(menuAnchor)}
                            onClick={(event) => {
                              event.stopPropagation();
                              setMenuAnchor(event.currentTarget);
                            }}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Menu id={"message-menu-"+message.id} 
                      MenuListProps={{'aria-labelledby': `message-more-button-${message.id}`}}
                      anchorEl={menuAnchor}
                      open={Boolean(menuAnchor)}
                      onClose={handleMoreClose}
                >
                {menuItems.map((item) => {
                  return (
                    <MenuItem id={"message-more-menu-" + item.label + '-' + message.id}
                              key={"message-more-menu-" + item.label + '-' + message.id}
                              onClick={(event) => handleMenuClick(event, item.action, message.id)}
                    >
                      {item.label}
                    </MenuItem>
                  )})
                }
                </Menu>
              </div>
    </React.Fragment>
  );
}
