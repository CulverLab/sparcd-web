/** @module components/EditCollection */

import * as React from 'react';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import Grid from '@mui/material/Grid';
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

import AddUserPermissions from './AddUserPermissions';
import RemoveUsers from './RemoveUsers';
import UserPermissions from './UserPermissions';
import { AddMessageContext, UserNameContext } from '../serverInfo';
import { Level } from '../components/Messages';

/**
 * Handles editing a collection' entry
 * @function
 * @param {object} [data] The collection data. If falsy a new collection is assumed
 * @param {function} onUpdate Called to update the collection information when changes made
 * @param {function} onClose Called when the editing is completed
 * @return {object} The UI for editing collection
 */
export default function EditCollection({data, onUpdate, onClose}) {
  const theme = useTheme();
  const addMessage = React.useContext(AddMessageContext); // Function adds messages for display
  const userName = React.useContext(UserNameContext);  // User display name
  const collectionDescRef = React.useRef(null); // The collection description control
  const collectionEmailRef = React.useRef(null); // The collection email control
  const collectionNameRef = React.useRef(null); // The collection name control
  const collectionOrgRef = React.useRef(null); // The collection organization control
  const [addUserPermissions, setAddUserPermissions] = React.useState(false);
  const [isModified, setIsModified] = React.useState(false);
  const [newPermissions, setNewPermissions] = React.useState(JSON.parse(JSON.stringify(data ? data.allPermissions : [])));
  const [removeUsers, setRemoveUsers] = React.useState(false);

  // Check if need to default a new collection to the user
  React.useEffect(() => {
    if (!data && newPermissions.length === 0) {
      setNewPermissions([{'usernameProperty':userName, 'readProperty': true,
                              'uploadProperty': true, 'ownerProperty': true}]);
    }
  }, [data, userName]);

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

    if (collectionNameRef.current) {
      updatedData.name = collectionNameRef.current.value;
      if (updatedData.name.length < 3) {
        addMessage(Level.Warning, "Please enter a longer name")
        collectionNameRef.current.focus();
        return;
      }
    }

    if (collectionOrgRef.current) {
      updatedData.organization = collectionOrgRef.current.value;
    }

    if (collectionDescRef.current) {
      updatedData.description = collectionDescRef.current.value;
    }

    if (collectionEmailRef.current) {
      updatedData.email = collectionEmailRef.current.value;
    }

    if (newPermissions) {
      updatedData.allPermissions = newPermissions;
    }

    onUpdate(updatedData, onClose, (message) => addMessage(Level.Warning, message));
  }, [addMessage, data, isModified, newPermissions, onClose, onUpdate]);

  /**
   * Handles adding a new user with permissions
   * @function
   */
  const handleAddNewUser = React.useCallback((name, canRead, canUpload) =>  {

    let found = newPermissions.filter((item) => item.usernameProperty === name);
    if (found.length > 0) {
      addMessage(Level.Warning, "User already exists. Unable to add as a new user");
      return;
    }

    setNewPermissions(prev => [...prev, {'usernameProperty':name, 'readProperty': canRead,
                                          'uploadProperty': canUpload, 'ownerProperty': false}]);

    setIsModified(true);
    setAddUserPermissions(false);

  }, [addMessage, newPermissions, setIsModified]);

  /**
   * Handles the user's permissions checkbox changing
   * @function
   * @param {object} event The triggering event
   * @param {string} username The username affected by the checkbox change
   * @param {string} changeTag The tag identifying the change
   */
  const handleCheckboxUpdate = React.useCallback((event, username, changeTag) => {
    let foundUser = newPermissions.filter((item) => item.usernameProperty === username);
    if (foundUser.length <= 0) {
      addMessage(Level.Information, "User was not found for updating");
      console.log('Error: Unable to find user for updating checkbox permission:', username);
      return;
    }

    switch(changeTag) {
      case 'read': 
        setNewPermissions(prev => prev.map(item => item.usernameProperty !== username ? 
                                            item :
                                            {...item, readProperty:event.target.checked})
                          );
        setIsModified(true);
        break;

      case 'update':
        setNewPermissions(prev => prev.map(item => item.usernameProperty !== username ? 
                                            item :
                                            {...item, uploadProperty:event.target.checked})
                          );
        setIsModified(true);
        break;

      default:
        console.log('Error: unknown checkbox tag found:', changeTag);
    }

  }, [addMessage, newPermissions, setIsModified]);


  /**
   * Checks if the removal of users is permitted
   * @function
   */
  const canRemoveUsers = React.useCallback(() => {
    let notOwners = newPermissions.filter((item) => item.ownerProperty !== true);
    if (notOwners.length <= 0) {
      addMessage(Level.Information, "You are not allowed to delete the last remaining owner user this account");
      return;
    }

    setRemoveUsers(true);
  }, [addMessage, newPermissions]);

  /**
   * Removes users from the list of permitted users
   * @function
   */
  const handleKeepUsers = React.useCallback((keepUsers) => {
    setNewPermissions(keepUsers);
    setIsModified(keepUsers.length < newPermissions.length);
    setRemoveUsers(false);
  }, [newPermissions]);


  /**
   * Generates the permissions UI
   * @function
   * @return {object} The UI for editing permissions
   */
  function generatePermissions() {
    if (newPermissions.length === 0) {
      return (
        <Typography gutterBottom variant="body3" noWrap sx={{paddingLeft:'10px'}} >
          No permissions available to edit
        </Typography>
      );
    }

    return (
      <UserPermissions permissions={newPermissions} 
                        onReadChange={(event, userName) => handleCheckboxUpdate(event, userName, 'read')}
                        onUpdateChange={(event, userName) => handleCheckboxUpdate(event, userName, 'update')}
      />
    );
  }

  // Return the UI
  return (
   <Grid sx={{minWidth:'50vw'}} > 
    <Card id="edit-collection" sx={{backgroundColor:'#EFEFEF', border:"none", boxShadow:"none"}} >
      <CardHeader id='edit-collection-header' title={
                    <Grid container direction="row" alignItems="start" justifyContent="start" sx={{flexWrap:'nowrap'}}>
                      <Grid>
                        <Typography gutterBottom variant="h6" component="h4" noWrap>
                          Edit Collection
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
      <CardContent id='edit-collection-details' sx={{paddingTop:'0px', paddingBottom:'0px'}}>
        <Grid container direction="column" justifyContent="start" alignItems="stretch"
              sx={{minWidth:'400px', border:'1px solid black', borderRadius:'5px', backgroundColor:'rgb(255,255,255,0.3)' }}>
          <TextField disabled={true}
                id='edit-collection-id'
                label="ID"
                defaultValue={data ? data.id : "<automatically generated>"}
                size='small'
                sx={{margin:'10px'}}
                onChange={() => setIsModified(true)}
                slotProps={{
                  htmlInput: {style:{fontSize:12}},
                  inputLabel: {shrink:true},
                }}
                />
          <TextField required
                id='edit-collection-name'
                label="Name"
                defaultValue={data ? data.name : null}
                size='small'
                sx={{margin:'10px'}}
                onChange={() => setIsModified(true)}
                slotProps={{
                  input: {inputRef:collectionNameRef},
                  htmlInput: {style:{fontSize:12}},
                  inputLabel: {shrink:true},
                }}
                />
          <TextField 
                id='edit-collection-organization'
                label="Organization"
                defaultValue={data ? data.organization : null}
                size='small'
                sx={{margin:'10px'}}
                onChange={() => setIsModified(true)}
                slotProps={{
                  input: {inputRef:collectionOrgRef},
                  htmlInput: {style:{fontSize:12}},
                  inputLabel: {shrink:true},
                }}
                />
          <TextField 
                id='edit-collection-description'
                label="Description"
                defaultValue={data ? data.description : null}
                size='small'
                sx={{margin:'10px'}}
                multiline
                rows={3}
                onChange={() => setIsModified(true)}
                slotProps={{
                  input: {inputRef:collectionDescRef},
                  htmlInput: {style:{fontSize:12}},
                  inputLabel: {shrink:true},
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
                slotProps={{
                  input: {inputRef:collectionEmailRef},
                  htmlInput: {style:{fontSize:12}},
                  inputLabel: {shrink:true},
                }}
                />
          <Grid id="edit-collections-permissions-wrapper" container direction="row" alignItems="start" justifyContent="start"
                sx={{marginTop:'5px', borderTop:'1px solid grey', borderRadius:'3px', paddingTop:'5px'}}>
            <Typography gutterBottom variant="body1" noWrap sx={{fontWeight:'bold', paddingLeft:'10px'}} >
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
        <Button disabled={!isModified} sx={{flex:1}} onClick={onSaveChanges}>Save</Button>
        <Button sx={{flex:1}} onClick={onClose} >Cancel</Button>
      </CardActions>
    </Card>
    { addUserPermissions && 
        <AddUserPermissions permissions={newPermissions}
                            onAddNewUser={handleAddNewUser}
                            onClose={() => setAddUserPermissions(false)}
        />
    }
    { removeUsers && 
        <RemoveUsers permissions={newPermissions}
                      onKeep={handleKeepUsers}
                      onClose={() => setRemoveUsers(false)}
        />
    }
  </Grid>
  );
}

EditCollection.propTypes = {
  data: PropTypes.shape({
    id:             PropTypes.string,
    name:           PropTypes.string,
    organization:   PropTypes.string,
    description:    PropTypes.string,
    email:          PropTypes.string,
    allPermissions: PropTypes.arrayOf(PropTypes.shape({
      usernameProperty: PropTypes.string.isRequired,
      readProperty:     PropTypes.bool.isRequired,
      uploadProperty:   PropTypes.bool.isRequired,
      ownerProperty:    PropTypes.bool.isRequired,
    })),
  }),
  onUpdate: PropTypes.func.isRequired,
  onClose:  PropTypes.func.isRequired,
};

EditCollection.defaultProps = {
  data: null,
};
