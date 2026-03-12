'use client'

/** @module LandingMaps */

import * as React from 'react';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

/**
 * Returns the UI for maps on the Landing page
 * @function
 * @param {function} onMapImageLoad Function to call when when the image loads
 * @returns {object} The rendered UI
 */
export default function LandingMaps({onMapImageLoad}) {
  const theme = useTheme();

  // Render the UI
  return (
      <div id='landing-page-map-image-wrapper' style={{...theme.palette.landing_page_map_image_wrapper}} >
        <img id='landing-page-map-image' 
              alt='Portion of a map for display purposes only'
              src='mapImage.png' 
              onLoad={onMapImageLoad} 
              onError={(e) => { e.target.style.display = 'none'; }}
        />
      </div>
  );
}

LandingMaps.propTypes = {
  onMapImageLoad: PropTypes.func.isRequired,
};
