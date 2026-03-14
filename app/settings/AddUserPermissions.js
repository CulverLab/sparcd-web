'use client'

/** @module settings/AddUserPermissions */

import * as React from 'react';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Checkbox from '@mui/material/Checkbox';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

import { AddMessageContext } from '../serverInfo';
import { Level } from '../components/Messages';

/**
 * Returns the UI for adding a user and their permissions
 * @function
 * @param {Array} permissions The current list of permissions
 * @param {function} onAddNewUser Function to call to add the new user with their permissions
 * @param {function} onClose Function to call to cancel any changes
 * @return {object} The UI for adding a user and their permissions
 */
export default function AddUserPermissions({permissions, onAddNewUser, onClose}) {
  const theme = useTheme();
  const addMessage = React.useContext(AddMessageContext); // Function adds messages for display
  const userNameRef = React.useRef(null);
  const userReadRef = React.useRef(null);
  const userUploadRef = React.useRef(null);

  /**
   * Handles adding a new user with permissions
   * @function
   */
  const handleAddNewUser = React.useCallback(() =>  {
    if (!userNameRef.current) {
      addMessage(Level.Error, 'An internal problem was found with the user\'s name. Please contact the site administrator');
      return;
    }
    const userName = userNameRef.current.value;
    if (!userName || userName.length < 2) {
      addMessage(Level.Warning, "Please enter a valid user name");
      return;
    }
    let found = permissions.filter((item) => item.usernameProperty === userName);
    if (found.length > 0) {
      addMessage(Level.Warning, "User already exists. Please cancel this edit to change their permissions");
      return;
    }

    if (!userReadRef.current) {
      addMessage(Level.Error, 'An internal problem was found with the read permissions. Please contact the site administrator');
      return;
    }
    const readPermissions = userReadRef.current.checked;

    if (!userUploadRef.current) {
      addMessage(Level.Error, 'An internal problem was found with the upload permissions. Please contact the site administrator');
      return;
    }
    const uploadPermissions = userUploadRef.current.checked;

    onAddNewUser(userName, readPermissions, uploadPermissions);

  }, [permissions, onAddNewUser]);

  // Return the UI
  return (
    <Grid container id="settings-admin-add-user-wrapper" alignItems="center" justifyContent="center"
          sx={{position:'absolute', top:0, right:0, bottom:0, left:0, backgroundColor:'rgb(0,0,0,0.5)'}}
    >
      <Card id="edit-collection-add-user" sx={{backgroundColor:'#EFEFEF', border:"none", boxShadow:"none"}} >
        <CardHeader id='edit-collection-add-user-header' title={
                      <Grid container direction="row" alignItems="start" justifyContent="start" sx={{flexWrap:'nowrap'}} >
                        <Grid>
                          <Typography gutterBottom variant="h6" component="h4" noWrap>
                            Add User
                          </Typography>
                        </Grid>
                        <Grid sx={{marginLeft:'auto'}} >
                          <div onClick={onClose}>
                            <Tooltip title="Close without saving">
                              <Typography gutterBottom variant="body2" noWrap
                                          sx={{textTransform:'uppercase',
                                          color:'grey',
                                          cursor:'pointer',
                                          fontWeight:'500',
                                          backgroundColor:'rgba(0,0,0,0.03)',
                                          padding:'3px 3px 3px 3px',
                                          borderRadius:'3px',
                                          '&:hover':{backgroundColor:'rgba(255,255,255,0.7)', color:'black'}
                                       }}
                              >
                                  <CloseOutlinedIcon fontSize="small" />
                              </Typography>
                            </Tooltip>
                          </div>
                        </Grid>
                      </Grid>
                      }
                  style={{paddingTop:'0px', paddingBottom:'0px'}}
        />
        <CardContent id='edit-collection-add-user-details' sx={{paddingRight:'0px', paddingLeft:'0px'}}>
          <Grid container direction="column" justifyContent="start" alignItems="stretch"
                sx={{minWidth:'300px', backgroundColor:'rgb(255,255,255,0.3)' }}>
            <TextField required
                  id='edit-collection-add-user-name'
                  label="Name"
                  size='small'
                  sx={{margin:'10px'}}
                  slotProps={{
                    input: {inputRef: userNameRef},
                    htmlInput: {style: {fontSize: 12}},
                    inputLabel: {shrink: true},
                  }}
                  />
            <FormControlLabel sx={{paddingLeft:'10px'}}
                control={
                    <Checkbox inputRef={userReadRef} />
                }
                label="Read Permissions"
            />
            <FormControlLabel sx={{paddingLeft:'10px'}}
                control={
                    <Checkbox inputRef={userUploadRef} />
                }
                label="Upload Permissions"
            />
          </Grid>
        </CardContent>
        <CardActions id='edit-collection-add-user-actions'>
          <Button sx={{flex:1}} onClick={handleAddNewUser}>Save</Button>
          <Button sx={{flex:1}} onClick={onClose} >Done</Button>
        </CardActions>
      </Card>
    </Grid>
  );
}

AddUserPermissions.propTypes = {
  permissions:  PropTypes.arrayOf(PropTypes.shape({
    usernameProperty: PropTypes.string.isRequired,
  })).isRequired,
  onAddNewUser: PropTypes.func.isRequired,
  onClose:      PropTypes.func.isRequired,
};
