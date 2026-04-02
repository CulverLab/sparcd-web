'use client'

/** @module settings/SpeciesList */

import * as React from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

/**
 * Returns the UI listing species
 * @function
 * @param {Array} species The list of species information to display
 * @param {number} sortColumn The current column that's being sorted on
 * @param {number} sortDirection The direction of the sort
 * @param {number} maxHeight The maximum height of the listing (not headers)
 * @param {function} getSettingsHeader The function to call to generate a standard header
 * @param {function} onSort The function to call to sort by one header column
 * @param {function} onDblClick The function to call when a user gets double clicked
 * @returns {object} The rendered UI
 */
export default function SpeciesList({species, sortColumn, sortDirection, maxHeight, getSettingsHeader, onSort, onDblClick}) {
  const theme = useTheme();

  onDblClick ||= () => {};

  // Return the UI
  return (
    <Box id='admin-settings-species-details-wrapper' sx={{width:'100%', padding:'0px 5px 0 5px'}} >
      <Grid id="admin-settings-species-header" container direction="row" justifyContent="space-between" alignItems="start"
            sx={{width:'100%', backgroundColor:'lightgrey', borderBottom:'1px solid black'}} >
        { getSettingsHeader(1, sortColumn === 1, sortDirection, 5, 'Name', {marginRight:"auto"}, (dir)=>onSort('name', dir) )}
        { getSettingsHeader(2, sortColumn === 2, sortDirection, 5, 'Scientific Name', {marginRight:"auto"}, (dir)=>onSort('sciName', dir) )}
        { getSettingsHeader(3, sortColumn === 3, sortDirection, 2, 'Key Binding', {marginLeft:"auto", paddingRight:"5px"}, (dir)=>onSort('key', dir) )}
      </Grid>
      <Grid id='admin-settings-details' sx={{overflowX:'auto',width:'100%', maxHeight:maxHeight }}>
      { species.map((item, idx) => 
            <Grid container direction="row" id={"admin-species-"+idx} key={item.name+'-'+idx} justifyContent="space-between" alignItems="start"
                  sx={{width:'100%', '&:hover':{backgroundColor:'rgba(0,0,0,0.05)'}}} onDoubleClick={(event) => onDblClick(event,item)} >
              <Grid size={5}  sx={{marginRight:'auto'}}>
                <Typography noWrap variant="body2">
                  {item.name}
                </Typography>
              </Grid>
              <Grid size={5} sx={{marginRight:'auto'}}>
                <Typography noWrap variant="body2">
                  {item.scientificName}
                </Typography>
              </Grid>
              <Grid size={2} sx={{marginLeft:'auto', paddingRight:'5px'}}>
                <Typography noWrap variant="body2">
                  {item.keyBinding}
                </Typography>
              </Grid>
            </Grid>
      )}
      </Grid>
    </Box>
  );
}

SpeciesList.propTypes = {
  species:          PropTypes.arrayOf(PropTypes.shape({
                      name:           PropTypes.string.isRequired,
                      scientificName: PropTypes.string.isRequired,
                      keyBinding:     PropTypes.string,
                    })).isRequired,
  sortColumn:       PropTypes.number.isRequired,
  sortDirection:    PropTypes.number.isRequired,
  maxHeight:        PropTypes.number.isRequired,
  getSettingsHeader: PropTypes.func.isRequired,
  onSort:           PropTypes.func.isRequired,
  onDblClick:       PropTypes.func,
};

SpeciesList.defaultProps = {
  onDblClick: () => {},
};
