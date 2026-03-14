'use client'

/** @module settings/RemoveUser */

import * as React from 'react';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Checkbox from '@mui/material/Checkbox';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import Grid from '@mui/material/Grid';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

/**
 * Returns the UI for removing users from collections
 * @function
 * @param {Array} permissions The current list of permissions
 * @param {function} onKeep The function to call with the users to keep
 * @param {function} onClose The function to call when the user wants to close the window
 * @return {object} The UI for removing a user
 */
export default function RemoveUsers({permissions, onKeep, onClose}) {
  const theme = useTheme();
  const [markedForRemoval, setMarkedForRemoval] = React.useState(Object.fromEntries(permissions.map((item) => [item.usernameProperty, false])));

  /**
   * Removes users from the list of permitted users
   * @function
   */
  const handleRemoveUsers = React.useCallback(() => {

    // Try removing from the existing list of users
    const keepUsers = permissions.filter((item) => 
      item.ownerProperty === true || !markedForRemoval[item.usernameProperty]
    );

    onKeep(keepUsers);

  }, [markedForRemoval, onKeep, permissions]);

  // Return the UI
  return (
    <Grid container id="settings-admin-remove-users-wrapper" alignItems="center" justifyContent="center"
          sx={{position:'absolute', top:0, right:0, bottom:0, left:0, backgroundColor:'rgb(0,0,0,0.5)'}}
    >
      <Card id="edit-collection-remove-users" sx={{backgroundColor:'#EFEFEF', border:"none", boxShadow:"none"}} >
        <CardHeader id='edit-collection-remove-users-header' title={
                      <Grid container direction="row" alignItems="start" justifyContent="start" sx={{flexWrap:'nowrap'}}>
                        <Grid>
                          <Typography gutterBottom variant="h6" component="h4" noWrap>
                            Remove Users
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
        <CardContent id='edit-collection-remove-user-details' sx={{paddingRight:'0px', paddingLeft:'0px'}}>
          <Grid container direction="column" justifyContent="start" alignItems="stretch"
                sx={{minWidth:'300px', backgroundColor:'rgb(255,255,255,0.3)' }}>
            { permissions.filter((item) => item.ownerProperty !== true).map((item) => 
              <Grid key={"edit-collection-remove-wrapper-" + item.usernameProperty} container direction="row" justifyContent="start" alignItems="center" >
                <Checkbox size="small"
                          id={"remove-user-" + item.usernameProperty}
                          checked={!!markedForRemoval[item.usernameProperty]}
                          onChange={(event) => setMarkedForRemoval(prev => ({...prev, [item.usernameProperty]: event.target.checked})) }
                />
                <Typography variant="body2" noWrap align="center" component="div">
                  {item.usernameProperty}
                </Typography>
              </Grid>
            )}
          </Grid>
        </CardContent>
        <CardActions id='edit-collection-remove-user-actions'>
          <Button sx={{flex:1}} onClick={handleRemoveUsers}>Remove Users</Button>
          <Button sx={{flex:1}} onClick={onClose} >Cancel</Button>
        </CardActions>
      </Card>
    </Grid>
  );
}

RemoveUsers.propTypes = {
  permissions: PropTypes.arrayOf(PropTypes.shape({
    usernameProperty: PropTypes.string.isRequired,
    ownerProperty:    PropTypes.bool.isRequired,
  })).isRequired,
  onKeep:  PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
