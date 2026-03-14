'use client'

/** @module components/UploadSidebarItem */

import * as React from 'react';
import Grid from '@mui/material/Grid';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

/**
 * Renders an single uploaded folder item in the upload sidebar
 * @function
 * @param {string} name The name of the upload to display
 * @param {boolean} selected Whether this item is selected
 * @param {function} onClick The parent handler when a new upload is selected
 * @returns {object} The rendered UI
 */
export default function UploadSidebarItem({name, selected, onClick}) {
  const theme = useTheme();

  // Setup the elements appearance
  let curTheme = {...theme.palette.left_sidebar_item, ...{cursor:'pointer'}};
  if (selected) {
    curTheme = {...curTheme, ...theme.palette.left_sidebar_item_selected}
  }

  // Returns the upload item UI
  return (
    <Grid display='flex' justifyContent='flex-start' size='grow' sx={{...curTheme}} onClick={onClick} >
      {name ? name : "<unknown>"}
    </Grid>
  );
}

UploadSidebarItem.propTypes = {
  name: PropTypes.string.isRequired,
  selected: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
};
