'use client'

/** @module settings/LocationList */

import * as React from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

/**
 * Returns the UI listing locations
 * @function
 * @param {Array} locations The list of location information to display
 * @param {number} sortColumn The current column that's being sorted on
 * @param {number} sortDirection The direction of the sort
 * @param {number} maxHeight The maximum height of the listing (not headers)
 * @param {function} getSettingsHeader The function to call to generate a standard header
 * @param {function} onSort The function to call to sort by one header column
 * @param {function} onDblClick The function to call when a user gets double clicked
 * @returns {object} The rendered UI
 */
export default function LocationList({locations, sortColumn, sortDirection, maxHeight, getSettingsHeader, onSort, onDblClick}) {
  const theme = useTheme();

  onDblClick ||= () => {};

  // Return the UI
  return (
    <Box id='admin-settings-locations-details-wrapper' sx={{width:'100%', padding:'0px 5px 0 5px'}} >
      <Grid id="admin-settings-locations-header" container direction="row" justifyContent="space-between" alignItems="start"
            sx={{width:'100%', backgroundColor:'lightgrey', borderBottom:'1px solid black'}} >
        { getSettingsHeader(1, sortColumn === 1, sortDirection, 5, 'Name', {marginRight:"auto"}, (dir)=>onSort('name', dir) )}
        { getSettingsHeader(2, sortColumn === 2, sortDirection, 3, 'ID', {marginRight:"auto"}, (dir)=>onSort('id', dir) )}
        { getSettingsHeader(3, sortColumn === 3, sortDirection, 2, 'Active', {marginRight:"auto"}, (dir)=>onSort('active', dir) )}
        { getSettingsHeader(4, false,            sortDirection, 2, 'Location', {marginLeft:"auto", paddingRight:"5px"} )}
      </Grid>
      <Grid id='admin-settings-details' sx={{overflowX:'auto',width:'100%', maxHeight:maxHeight }}>
      { locations.map((item, idx) => {
          const extraAttribs = item.activeProperty ? {} : {color:'grey'};
          return (<Grid container direction="row" id={"admin-locations-"+idx} key={item.name+'-'+idx} justifyContent="space-between" alignItems="start"
                  sx={{width:'100%', '&:hover':{backgroundColor:'rgba(0,0,0,0.05)'}, ...extraAttribs }} onDoubleClick={(event) => onDblClick(event,item)} >
              <Grid size={5}>
                <Typography noWrap variant="body2" >
                  {item.nameProperty}
                </Typography>
              </Grid>
              <Grid size={3} sx={{marginRight:'auto'}}>
                <Typography noWrap variant="body2">
                  {item.idProperty}
                </Typography>
              </Grid>
              <Grid size={2} sx={{marginRight:'auto'}}>
                <Typography noWrap variant="body2" align="center">
                  {item.activeProperty ? 'Y' : ' '}
                </Typography>
              </Grid>
              <Grid size={2} sx={{marginLeft:'auto'}} >
                <Typography noWrap variant="body2" align="right">
                  {item.latProperty + ', ' + item.lngProperty}
                </Typography>
              </Grid>
            </Grid>
          );}
      )}
      </Grid>
    </Box>
  );
}

LocationList.propTypes = {
  locations:        PropTypes.arrayOf(PropTypes.shape({
                      nameProperty:      PropTypes.string.isRequired,
                      idProperty:        PropTypes.string.isRequired,
                      activeProperty:    PropTypes.bool,
                      latProperty:       PropTypes.number,
                      lngProperty:       PropTypes.number,
                    })).isRequired,
  sortColumn:       PropTypes.number.isRequired,
  sortDirection:    PropTypes.number.isRequired,
  maxHeight:        PropTypes.number.isRequired,
  getSettingsHeader: PropTypes.func.isRequired,
  onSort:           PropTypes.func.isRequired,
  onDblClick:       PropTypes.func,
};

LocationList.defaultProps = {
  onDblClick: () => {},
};
