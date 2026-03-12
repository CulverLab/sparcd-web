'use client'

/** @module landing/LandingInfoTile */

import * as React from 'react';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

/**
 * Returns the UI for information tiles for the landing page
 * @function
 * @param {string} title The title to display
 * @param {string} details The details to display
 * @returns {object} The rendered UI
 */
export default function LandingInfoTile({title, details}) {
  const theme = useTheme();

  return (
    <Grid  container direction="column" alignItems="center" justifyContent="center" columnSpacing={1}
            sx={{background:'rgb(155, 189, 217, 0.3)', border:'2px solid rgb(122, 155, 196, 0.25)', borderRadius:'13px', padding:'7px 12px', minWidth:'30%'}} >
      <Typography variant="h4" sx={{color:'#3b5a7d'}} >
        {title}
      </Typography>
      <Typography variant="body3" sx={{paddingTop:'7px', textTransform:'uppercase', color:'#3b5a7d'}} >
        {details}
      </Typography>
    </Grid>
  );
}

LandingInfoTile.propTypes = {
  title: PropTypes.string.isRequired,
  details: PropTypes.string.isRequired,
};
