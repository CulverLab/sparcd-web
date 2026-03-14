'use client'

/** @module settings/UserCollections */

import * as React from 'react';
import Checkbox from '@mui/material/Checkbox';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

/**
 * Returns the UI for changing collections
 * @function
 * @param {Array} collections The array of collections to display
 * @return {object} The UI for changing collections
 */
export default function UserCollections({collections}) {
  const theme = useTheme();

  // Return the UI
    return (
      <Grid container direction="column" justifyContent="start" alignItems="stretch" sx={{borderTop:'1px solid black'}} >
          <Grid container key={'user-edit-coll-titles'} direction="row" justifyContent="space-between" alignItems="center"
                sx={{backgroundColor:'lightgrey', height:'1.5em'}} >
            <Grid size={{sm:9}} >
              <Typography noWrap align="start" component="div" sx={{ fontWeight: 'bold', paddingLeft:'5px' }}>
                Collection
              </Typography>
            </Grid>
            <Grid size={{sm:1}} >
              <Typography noWrap align="center" component="div" sx={{ fontWeight: 'bold' }}>
                R
              </Typography>
            </Grid>
            <Grid size={{sm:1}} >
              <Typography noWrap align="center" component="div" sx={{ fontWeight: 'bold' }}>
                W
              </Typography>
            </Grid>
            <Grid size={{sm:1}}  >
              <Typography noWrap align="center" component="div" sx={{paddingRight:'5px', fontWeight:'bold'}}>
                O
              </Typography>
            </Grid>
          </Grid>
        <div style={{maxHeight:'30vh', overflow:"auto"}}>
        { collections && collections.map((item) =>
          <Grid container key={'user-edit-coll-'+item.id} direction="row" justifyContent="space-between" alignItems="center" sx={{height:'2em'}}>
            <Grid size={{sm:9}} sx={{paddingLeft:'5px'}} >
              <Typography variant="body2">
              {item.name}
              </Typography>
            </Grid>
            <Grid size={{sm:1}}  >
              <Checkbox disabled size="small" checked={!!item.read}/>
            </Grid>
            <Grid size={{sm:1}}  >
              <Checkbox disabled size="small" checked={!!item.write}/>
            </Grid>
            <Grid size={{sm:1}}  >
              <Checkbox disabled size="small" checked={!!item.owner}/>
            </Grid>
          </Grid>
        )}
        </div>
      </Grid>
    );
}

UserCollections.propTypes = {
  collections: PropTypes.arrayOf(PropTypes.shape({
    id:    PropTypes.string.isRequired,
    name:  PropTypes.string.isRequired,
    read:  PropTypes.bool,
    write: PropTypes.bool,
    owner: PropTypes.bool,
  })),
};

UserCollections.defaultProps = {
  collections: [],
};
