'use client'

/** @module settings/UserList */

import * as React from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

/**
 * Returns the UI listing users
 * @function
 * @param {Array} users The list of user information to display
 * @param {number} sortColumn The current column that's being sorted on
 * @param {number} sortDirection The direction of the sort
 * @param {number} maxHeight The maximum height of the listing (not headers)
 * @param {function} getSettingsHeader The function to call to generate a standard header
 * @param {function} onSort The function to call to sort by one header column
 * @param {function} onDblClick The function to call when a user gets double clicked
 * @returns {object} The rendered UI
 */
export default function UserList({users, sortColumn, sortDirection, maxHeight, getSettingsHeader, onSort, onDblClick}) {
  const theme = useTheme();

  onDblClick ||= () => {};

  // Return the UI
  return (
    <Box id='admin-settings-users-details-wrapper' sx={{width:'100%', padding:'0px 5px 0 5px'}} >
      <Grid id="admin-settings-collection-header" container direction="row" justifyContent="space-between" alignItems="start"
            sx={{width:'100%', backgroundColor:'lightgrey', borderBottom:'1px solid black'}} >
        { getSettingsHeader(1, sortColumn === 1, sortDirection, 2, 'Name', {marginRight:"auto"}, (dir)=>onSort('name', dir) )}
        { getSettingsHeader(2, sortColumn === 2, sortDirection, 3, 'Email', {marginRight:"auto"}, (dir)=>onSort('email', dir) )}
        { getSettingsHeader(3, false,            sortDirection, 5, 'Collections', {marginRight:"auto"})}
        { getSettingsHeader(4, sortColumn === 4, sortDirection, 1, 'Admin', {marginLeft:"auto"}, (dir)=>onSort('admin', dir) )}
        { getSettingsHeader(5, sortColumn === 5, sortDirection, 1, 'Auto', {marginLeft:"auto", paddingRight:"5px"}, (dir)=>onSort('auto', dir) )}
      </Grid>
      <Grid id='admin-settings-details' sx={{overflowX:'auto',width:'100%', maxHeight:maxHeight }}>
      { users.map((item,idx) => 
          <Grid container direction="row" id={"admin-user-"+idx} key={item.name+'-'+idx} justifyContent="space-between" alignItems="start"
                sx={{width:'100%', '&:hover':{backgroundColor:'rgba(0,0,0,0.05)'} }} onDoubleClick={(event) => onDblClick(event,item)} >
            <Grid size={2}>
              <Typography noWrap variant="body2">
                {item.name}
              </Typography>
            </Grid>
            <Grid size={3}>
              <Typography noWrap variant="body2">
                {item.email}
              </Typography>
            </Grid>
            <Grid size={5}>
              <Typography noWrap variant="body2">
                { item.collections.map((colItem, colIdx) => 
                    <React.Fragment key={colItem.name+'-'+colIdx}>
                      {colIdx > 0 && ', '}
                      {colItem.name}
                      <span style={{fontWeight:'bold', fontSize:'small'}}>
                        &nbsp;(
                        {colItem.owner && 'O'}
                        {colItem.read && 'R'}
                        {colItem.write && 'W'}
                        )
                      </span>
                    </React.Fragment>
                )}
              </Typography>
            </Grid>
            <Grid size={1}>
              <Typography noWrap variant="body2" align="center">
                {item.admin ? 'Y' : ' '}
              </Typography>
            </Grid>
            <Grid size={1} sx={{paddingRight:"5px"}} >
              <Typography noWrap variant="body2" align="right">
                {item.autoAdded ? 'Y' : 'N'}
              </Typography>
            </Grid>
          </Grid>
      )}
        </Grid>
    </Box>
  );
}

UserList.propTypes = {
  users:            PropTypes.arrayOf(PropTypes.shape({
                      name:       PropTypes.string.isRequired,
                      email:      PropTypes.string.isRequired,
                      admin:      PropTypes.bool,
                      autoAdded:  PropTypes.bool,
                      collections: PropTypes.arrayOf(PropTypes.shape({
                        name:  PropTypes.string.isRequired,
                        owner: PropTypes.bool,
                        read:  PropTypes.bool,
                        write: PropTypes.bool,
                      })).isRequired,
                    })).isRequired,
  getSettingsHeader: PropTypes.func.isRequired,
  onSort:           PropTypes.func.isRequired,
  onDblClick:       PropTypes.func,
  sortColumn:       PropTypes.number.isRequired,
  sortDirection:    PropTypes.number.isRequired,
  maxHeight:        PropTypes.number.isRequired,
};

UserList.defaultProps = {
  onDblClick: () => {},
};
