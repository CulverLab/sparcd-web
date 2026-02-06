/** @module components/EditCollection */

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Checkbox from '@mui/material/Checkbox';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import { AddMessageContext, DefaultImageIconURL, UserNameContext } from '../serverInfo';
import { Level } from './Messages';

/**
 * Handles editing a collection' entry
 * @function
 * @param {object} {data} The collection data. If falsy a new collection is assumed
 * @param {function} onUpdate Called to update the collection information when changes made
 * @param {function} onClose Called when the editing is completed
 * @return {object} The UI for editing collection
 */
export default function EditCollection({data, onUpdate, onClose}) {
  const theme = useTheme();
  const addMessage = React.useContext(AddMessageContext); // Function adds messages for display
  const userName = React.useContext(UserNameContext);  // User display name
  const [addUserPermissions, setAddUserPermissions] = React.useState(false);
  const [isModified, setIsModified] = React.useState(false);
  const [newPermissions, setNewPermissions] = React.useState(JSON.parse(JSON.stringify(data ? data.allPermissions : [])));
  const [removeUsers, setRemoveUsers] = React.useState(false);
  const [forceRedraw, setForceRedraw] = React.useState(0);

  // Check if need to default a new collection to the user
  React.useEffect(() => {
    if (!data && newPermissions.length === 0) {
      setNewPermissions([{'usernameProperty':userName, 'readProperty': true,
                              'uploadProperty': true, 'ownerProperty': true}]);
    }
  }, [newPermissions, setNewPermissions, userName]);

  /**
   * Handles saving the changes to the user
   * @function
   */
  const onSaveChanges= React.useCallback(() => {
    if (!isModified) {
      return;
    }

    // Save the edited collection data
    let updatedData = data ? JSON.parse(JSON.stringify(data)) : {};

    let el = document.getElementById('edit-collection-name');
    if (el) {
      updatedData.name = el.value;
      if (updatedData.name.length < 3) {
        addMessage(Level.Warning, "Please enter a longer name")
        el.focus();
        return;
      }
    }

    el = document.getElementById('edit-collection-organization');
    if (el) {
      updatedData.organization = el.value;
    }

    el = document.getElementById('edit-collection-description');
    if (el) {
      updatedData.description = el.value;
    }

    el = document.getElementById('edit-collection-email');
    if (el) {
      updatedData.email = el.value;
    }

    if (newPermissions) {
      updatedData.allPermissions = newPermissions;
    }

    onUpdate(updatedData, onClose, (message) => addMessage(Level.Warning, message));
  }, [addMessage, data, isModified, Level, newPermissions, onClose, onUpdate]);

  /**
   * Handles adding a new user with permissions
   * @function
   */
  const handleAddNewUser = React.useCallback(() =>  {
    let el = document.getElementById('edit-collection-add-user-name');
    if (!el) {
      addMessage(Level.Error, 'An internal problem was found with the user\'s name. Please contact the site administrator');
      return;
    }
    const userName = el.value;
    if (!userName || userName.length < 2) {
      addMessage(Level.Warning, "Please enter a valid user name");
      return;
    }
    let found = newPermissions.filter((item) => item.usernameProperty === userName);
    if (!found || found.length > 0) {
      addMessage(Level.Warning, "User already exists. Please cancel this edit to change their permissions");
      return;
    }

    el = document.getElementById('edit-collection-add-user-read');
    if (!el) {
      addMessage(Level.Error, 'An internal problem was found with the read permissions. Please contact the site administrator');
      return;
    }
    const readPermissions = el.checked;

    el = document.getElementById('edit-collection-add-user-upload');
    if (!el) {
      addMessage(Level.Error, 'An internal problem was found with the upload permissions. Please contact the site administrator');
      return;
    }
    const uploadPermissions = el.checked;

    setNewPermissions([...newPermissions, {'usernameProperty':userName, 'readProperty': readPermissions,
                      'uploadProperty': uploadPermissions, 'ownerProperty': false}]);

    setIsModified(true);
    setAddUserPermissions(false);

  }, [addMessage, Level, newPermissions, setIsModified, setNewPermissions]);

  /**
   * Handles the user's permissions checkbox changing
   * @function
   * @param {object} event The triggering event
   * @param {string} username The username affected by the checkbox change
   * @param {string} changeTag The tag identifying the change
   */
  const handleCheckboxUpdate = React.useCallback((event, username, changeTag) => {
    let foundUser = newPermissions.filter((item) => item.usernameProperty === username);
    if (!foundUser || foundUser.length <= 0) {
      addMessage(Level.Information, "User was not found for updating");
      console.log('Error: Unable to find user for updating checkbox permission:', username);
      return;
    }

    switch(changeTag) {
      case 'read': 
        foundUser[0].readProperty = event.target.checked;
        setIsModified(true);
        setForceRedraw(forceRedraw + 1);
        break;

      case 'update':
        foundUser[0].uploadProperty = event.target.checked;
        setIsModified(true);
        setForceRedraw(forceRedraw + 1);
        break;

      default:
        console.log('Error: unknown checkbox tag found:', changeTag);
    }

  }, [addMessage, forceRedraw, Level, newPermissions, setForceRedraw, setIsModified, setNewPermissions]);


  /**
   * Checks if the removal of users is permitted
   * @function
   */
  const canRemoveUsers = React.useCallback(() => {
    let notOwners = newPermissions.filter((item) => item.ownerProperty !== true);
    if (!notOwners || notOwners.length <= 0) {
      addMessage(Level.Information, "You are not allowed to delete the last remaining owner user this account");
      return;
    }

    setRemoveUsers(true);
  }, [addMessage, newPermissions, setNewPermissions, setRemoveUsers]);

  /**
   * Removes users from the list of permitted users
   * @function
   */
  const handleRemoveUsers = React.useCallback(() => {

    // Try removing from the existing list of users
    const keepUsers = newPermissions.filter((item) => {
      if (item.ownerProperty === true) {
        return true;
      }
      const el = document.getElementById("remove-user-" + item.usernameProperty);
      if (!el) {
        return true;
      }
      return !el.checked;
    });

    setNewPermissions(keepUsers);
    setIsModified(keepUsers.length < newPermissions.length);
    setRemoveUsers(false);
  }, [data, newPermissions, setNewPermissions, setRemoveUsers]);

  /**
   * Generates the UI for adding a new user with permissions
   * @function
   * @return {object} The UI for editing permissions
   */
  function generateAddUserPermissions() {
    return (
      <Grid container id="settings-admin-add-user-wrapper" alignItems="center" justifyContent="center"
            sx={{position:'absolute', top:0, right:0, bottom:0, left:0, backgroundColor:'rgb(0,0,0,0.5)'}}
      >
        <Card id="edit-collection-add-user" sx={{backgroundColor:'#EFEFEF', border:"none", boxShadow:"none"}} >
          <CardHeader id='edit-collection-add-user-header' title={
                        <Grid container direction="row" alignItems="start" justifyContent="start" wrap="nowrap">
                          <Grid>
                            <Typography gutterBottom variant="h6" component="h4" noWrap="true">
                              Add User
                            </Typography>
                          </Grid>
                          <Grid sx={{marginLeft:'auto'}} >
                            <div onClick={() => setAddUserPermissions(false)}>
                              <Tooltip title="Close without saving">
                                <Typography gutterBottom variant="body2" noWrap="true"
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
                                    <CloseOutlinedIcon size="small" />
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
                    onChange={() => setIsModified(true)}
                    inputProps={{style: {fontSize: 12}}}
                    slotProps={{
                      inputLabel: {
                        shrink: true,
                      },
                    }}
                    />
              <FormControlLabel sx={{paddingLeft:'10px'}}
                  control={
                      <Checkbox id="edit-collection-add-user-read"/>
                  }
                  label="Read Permissions"
              />
              <FormControlLabel sx={{paddingLeft:'10px'}}
                  control={
                      <Checkbox id="edit-collection-add-user-upload"/>
                  }
                  label="Upload Permissions"
              />
            </Grid>
          </CardContent>
          <CardActions id='edit-collection-add-user-actions'>
            <Button sx={{flex:'1', disabled:isModified === false }} onClick={handleAddNewUser}>Save</Button>
            <Button sx={{flex:'1'}} onClick={() => setAddUserPermissions(false)} >Cancel</Button>
          </CardActions>
        </Card>
      </Grid>
    );
  }

  /**
   * Generates the UI for removing user
   * @function
   * @return {object} The UI for removing users
   */
  function generateRemoveUsers() {
    return (
      <Grid container id="settings-admin-remove-users-wrapper" alignItems="center" justifyContent="center"
            sx={{position:'absolute', top:0, right:0, bottom:0, left:0, backgroundColor:'rgb(0,0,0,0.5)'}}
      >
        <Card id="edit-collection-remove-users" sx={{backgroundColor:'#EFEFEF', border:"none", boxShadow:"none"}} >
          <CardHeader id='edit-collection-remove-users-header' title={
                        <Grid container direction="row" alignItems="start" justifyContent="start" wrap="nowrap">
                          <Grid>
                            <Typography gutterBottom variant="h6" component="h4" noWrap="true">
                              Remove Users
                            </Typography>
                          </Grid>
                          <Grid sx={{marginLeft:'auto'}} >
                            <div onClick={() => setRemoveUsers(false)}>
                              <Tooltip title="Close without saving">
                                <Typography gutterBottom variant="body2" noWrap="true"
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
                                    <CloseOutlinedIcon size="small" />
                                </Typography>
                              </Tooltip>
                            </div>
                          </Grid>
                        </Grid>
                        }
                    style={{paddingTop:'0px', paddingBottom:'0px'}}
          />
          <CardContent id='edit-collection-remove-user-details' sx={{paddingRight:'0px', paddingLeft:'0px'}}>
            <Grid container direction="column" justifyContent="start" alignItems="stretch"
                  sx={{minWidth:'300px', backgroundColor:'rgb(255,255,255,0.3)' }}>
              { newPermissions.map((item) => item.ownerProperty !== true &&
                <Grid key={"edit-collection-remove-wrapper-" + item.usernameProperty} container direction="row" justifyContent="start" alignItems="center" >
                  <Typography variant="body2" align="center" sx={{paddingRight:'5px'}} >
                    <Checkbox size="small" id={"remove-user-" + item.usernameProperty} />
                  </Typography>
                  <Typography variant="body2" nowrap="true" align="center" component="div">
                    {item.usernameProperty}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </CardContent>
          <CardActions id='edit-collection-remove-user-actions'>
            <Button sx={{flex:'1', disabled:isModified === false }} onClick={handleRemoveUsers}>Remove Users</Button>
            <Button sx={{flex:'1'}} onClick={() => setRemoveUsers(false)} >Cancel</Button>
          </CardActions>
        </Card>
      </Grid>
    );
  }

  /**
   * Generates the permissions UI
   * @function
   * @return {object} The UI for editing permissions
   */
  function generatePermissions() {
    let allPermissions = newPermissions ? newPermissions : [data.permissions];

    if (!allPermissions || (allPermissions.length === 1 && allPermissions[0] === null)) {
      return (
        <Typography gutterBottom variant="body3" noWrap="true" sx={{paddingLeft:'10px'}} >
          No permissions available to edit
        </Typography>
      );
    }

    return (
      <Grid id="edit-collection-permissions-wrapper" container direction="column" alignItems="stretch" justifyContent="start" >
        <Grid container key={'user-edit-coll-titles'} direction="row" justifyContent="space-between" alignItems="center"
              sx={{backgroundColor:'lightgrey', height:'1.5em'}} >
          <Grid size={{sm:9}} >
            <Typography variant="body2" nowrap="true" align="start" component="div">
              <Box sx={{ fontWeight: 'bold', paddingLeft:'10px' }}>
              User Name
              </Box>
            </Typography>
          </Grid>
          <Grid size={{sm:1}} >
            <Typography variant="body2" nowrap="true" align="center" component="div">
              <Box sx={{ fontWeight: 'bold' }}>
              R
              </Box>
            </Typography>
          </Grid>
          <Grid size={{sm:1}} >
            <Typography variant="body2" nowrap="true" align="center" component="div">
              <Box sx={{ fontWeight: 'bold' }}>
              W
              </Box>
            </Typography>
          </Grid>
          <Grid size={{sm:1}}  >
            <Typography variant="body2" nowrap="true" align="center" component="div" sx={{paddingRight:'5px'}}>
              <Box sx={{ fontWeight: 'bold' }}>
              O
              </Box>
            </Typography>
          </Grid>
        </Grid>
        { newPermissions.map((item, idx) =>
          <Grid id={"edit-collection-permission-" + item.usernameProperty} key={"collection-"+item.usernameProperty} container direction="row">
            <Grid size={{sm:9}} sx={{paddingLeft:'10px'}} >
              <Typography variant="body2">
              {item.usernameProperty}
              </Typography>
            </Grid>
            <Grid size={{sm:1}}  >
              <Typography variant="body2" align="center">
              <Checkbox size="small" checked={!!item.readProperty} onChange={(event) => handleCheckboxUpdate(event, item.usernameProperty, 'read')}/>
              </Typography>
            </Grid>
            <Grid size={{sm:1}}  >
              <Typography variant="body2" align="center">
              <Checkbox size="small" checked={!!item.uploadProperty} onChange={(event) => handleCheckboxUpdate(event, item.usernameProperty, 'update')}/>
              </Typography>
            </Grid>
            <Grid size={{sm:1}}  >
              <Typography variant="body2" align="center" sx={{paddingRight:'5px'}}>
              <Checkbox disabled={true} size="small" checked={!!item.ownerProperty}/>
              </Typography>
            </Grid>
          </Grid>
        )}
      </Grid>
    );
  }

  // Return the UI
  return (
   <Grid sx={{minWidth:'50vw'}} > 
    <Card id="edit-collection" sx={{backgroundColor:'#EFEFEF', border:"none", boxShadow:"none"}} >
      <CardHeader id='edit-collection-header' title={
                    <Grid container direction="row" alignItems="start" justifyContent="start" wrap="nowrap">
                      <Grid>
                        <Typography gutterBottom variant="h6" component="h4" noWrap="true">
                          Edit Collection
                        </Typography>
                      </Grid>
                      <Grid sx={{marginLeft:'auto'}} >
                        <div onClick={onClose}>
                          <Tooltip title="Close without saving">
                            <Typography gutterBottom variant="body2" noWrap="true"
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
                                <CloseOutlinedIcon size="small" />
                            </Typography>
                          </Tooltip>
                        </div>
                      </Grid>
                    </Grid>
                    }
                style={{paddingTop:'0px', paddingBottom:'0px'}}
      />
      <CardContent id='edit-collection-details' sx={{paddingTop:'0px', paddingBottom:'0px'}}>
        <Grid container direction="column" justifyContent="start" alignItems="stretch"
              sx={{minWidth:'400px', border:'1px solid black', borderRadius:'5px', backgroundColor:'rgb(255,255,255,0.3)' }}>
          <TextField disabled={true}
                id='edit-collection-id'
                label="ID"
                defaultValue={data ? data.id : "<automatically generated>"}
                size='small'
                disabled={true}
                sx={{margin:'10px'}}
                onChange={() => setIsModified(true)}
                inputProps={{style: {fontSize: 12}}}
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                }}
                />
          <TextField required
                id='edit-collection-name'
                label="Name"
                defaultValue={data ? data.name : null}
                size='small'
                sx={{margin:'10px'}}
                onChange={() => setIsModified(true)}
                inputProps={{style: {fontSize: 12}}}
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                }}
                />
          <TextField 
                id='edit-collection-organization'
                label="Organization"
                defaultValue={data ? data.organization : null}
                size='small'
                sx={{margin:'10px'}}
                onChange={() => setIsModified(true)}
                inputProps={{style: {fontSize: 12}}}
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                }}
                />
          <TextField 
                id='edit-collection-description'
                label="Description"
                type='url'
                defaultValue={data ? data.description : null}
                size='small'
                sx={{margin:'10px'}}
                multiline
                rows={3}
                onChange={() => setIsModified(true)}
                inputProps={{style: {fontSize: 12}}}
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                }}
                />
          <TextField 
                id='edit-collection-email'
                label="Email"
                defaultValue={data ? data.email : null}
                size='small'
                type="email"
                sx={{margin:'10px'}}
                onChange={() => setIsModified(true)}
                inputProps={{style: {fontSize: 12}}}
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                }}
                />
          <Grid id="edit-collections-permissions-wrapper" container direction="row" alignItems="start" justifyContent="start"
                sx={{marginTop:'5px', borderTop:'1px solid grey', borderRadius:'3px', paddingTop:'5px'}}>
            <Typography gutterBottom variant="body" noWrap="true" sx={{fontWeight:'bold', paddingLeft:'10px'}} >
              Permissions
            </Typography>
            <Grid container direction="row" alignItems="start" justifyContent="start" sx={{marginLeft:'auto'}} >
              <PersonAddAltIcon onClick={() => setAddUserPermissions(true)} sx={{margin:'0px 5px 0px 0px', cursor:"pointer"}} />
              <RemoveCircleOutlineIcon onClick={canRemoveUsers} sx={{margin:'0px 10px 0px 5px', cursor:"pointer"}} />
            </Grid>
          </Grid>
          { generatePermissions() }
        </Grid>          
      </CardContent>
      <CardActions id='edit-collection-permissions-actions'>
        <Button sx={{flex:'1', disabled:isModified === false }} onClick={onSaveChanges}>Save</Button>
        <Button sx={{flex:'1'}} onClick={onClose} >Cancel</Button>
      </CardActions>
    </Card>
    { addUserPermissions && generateAddUserPermissions()}
    { removeUsers && generateRemoveUsers()}
  </Grid>
  );
}