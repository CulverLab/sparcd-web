'use client'

/** @module settings/UserPermissions */

import * as React from 'react';
import Checkbox from '@mui/material/Checkbox';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

/**
 * Returns the UI for changing users permissions
 * @function
 * @param {Array} permissions The current list of permissions
 * @param {function} onReadChange The function to call when a read permission changes
 * @param {function} onUpdateChange The function to call when a update permission changes
 * @return {object} The UI for removing a user
 */
export default function UserPermissions({permissions, onReadChange, onUpdateChange}) {
  const theme = useTheme();

  // Return the UI
  return (
    <Grid id="edit-collection-permissions-wrapper" container direction="column" alignItems="stretch" justifyContent="start" >
      <Grid container key={'user-edit-coll-titles'} direction="row" justifyContent="space-between" alignItems="center"
            sx={{backgroundColor:'lightgrey', height:'1.5em'}} >
        <Grid size={{sm:9}} >
          <Typography variant="body2" noWrap align="start" component="div" sx={{ fontWeight: 'bold', paddingLeft:'10px' }}>
            User Name
          </Typography>
        </Grid>
        <Grid size={{sm:1}} >
          <Typography variant="body2" noWrap align="center" component="div" sx={{ fontWeight: 'bold' }} >
            R
          </Typography>
        </Grid>
        <Grid size={{sm:1}} >
          <Typography variant="body2" noWrap align="center" component="div" sx={{ fontWeight: 'bold' }}>
            W
          </Typography>
        </Grid>
        <Grid size={{sm:1}}  >
          <Typography variant="body2" noWrap align="center" component="div" sx={{paddingRight:'5px', fontWeight: 'bold'}}>
            O
          </Typography>
        </Grid>
      </Grid>
      { permissions.map((item) =>
        <Grid id={"edit-collection-permission-" + item.usernameProperty} key={"collection-"+item.usernameProperty} container direction="row">
          <Grid size={{sm:9}} sx={{paddingLeft:'10px'}} >
            <Typography variant="body2">
            {item.usernameProperty}
            </Typography>
          </Grid>
          <Grid size={{sm:1}}  >
            <Checkbox size="small" checked={!!item.readProperty} onChange={(event) => onReadChange(event, item.usernameProperty)}/>
          </Grid>
          <Grid size={{sm:1}}  >
            <Checkbox size="small" checked={!!item.uploadProperty} onChange={(event) => onUpdateChange(event, item.usernameProperty)}/>
          </Grid>
          <Grid size={{sm:1}}  >
            <Checkbox disabled={true} size="small" checked={!!item.ownerProperty} sx={{paddingRight:'5px'}} />
          </Grid>
        </Grid>
      )}
    </Grid>
  );
}

UserPermissions.propTypes = {
  permissions: PropTypes.arrayOf(PropTypes.shape({
    usernameProperty: PropTypes.string.isRequired,
    readProperty:     PropTypes.bool.isRequired,
    uploadProperty:   PropTypes.bool.isRequired,
    ownerProperty:    PropTypes.bool.isRequired,
  })).isRequired,
  onReadChange:   PropTypes.func.isRequired,
  onUpdateChange: PropTypes.func.isRequired,
};
