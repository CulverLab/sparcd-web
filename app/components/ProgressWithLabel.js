'use client'

/** @module components/ProgressWithLabel */

import * as React from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';

import PropTypes from 'prop-types';

/**
 * Renders a progress element with a label
 * @function
 * @param {number} percentValue The percentage value to display
 * @param {...*} props Any props for the CircularProgress
 * @returns {object} The rendered progress bar with a label
 */
export default function ProgressWithLabel({percentValue, ...props}) {
  return (
    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
      <CircularProgress variant="determinate" {...props}/>
      <Box
        sx={{
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography
          variant="caption"
          component="div"
          sx={{ color: 'text.secondary' }}
        >
          {`${Math.round(percentValue ?? 0)}%`}
        </Typography>
      </Box>
    </Box>
  );
}

ProgressWithLabel.propTypes = {
  percentValue: PropTypes.number.isRequired,
};