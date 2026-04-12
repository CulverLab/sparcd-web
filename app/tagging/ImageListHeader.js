'use client'

/** @module tagging/ImageListHeader */

import * as React from 'react';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

// Sort direction constants
export const SORT_DIR = {
  ASC: 'asc',
  DESC: 'desc',
};

/**
 * A column header button that shows sort direction and triggers sort changes
 * @function
 * @param {string}   label      Display label for the column
 * @param {string}   field      The SORT_FIELDS value this header controls
 * @param {string}   sortField  Currently active sort field
 * @param {string}   sortDir    Currently active sort direction
 * @param {function} onSort     Called with (field) when clicked
 * @param {object}   [sx]       Optional additional MUI sx styles
 * @returns {object} The rendered header cell
 */
export default function ImageListHeader({ label, field, sortField, sortDir, onSort, sx }) {
  const isActive = sortField === field;
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={0.25}
      onClick={() => onSort(field)}
      sx={{
        cursor: 'pointer',
        userSelect: 'none',
        color: isActive ? 'black' : 'text.secondary',
        fontWeight: isActive ? 700 : 400,
        fontSize: '0.72rem',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        '&:hover': { color: 'primary.main' },
        transition: 'color 0.15s ease',
        ...sx,
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 'inherit', fontSize: 'inherit', letterSpacing: 'inherit' }}>
        {label}
      </Typography>
      {isActive
        ? (sortDir === SORT_DIR.ASC
            ? <ArrowUpwardIcon sx={{ fontSize: '0.75rem' }} />
            : <ArrowDownwardIcon sx={{ fontSize: '0.75rem' }} />)
        : <ArrowUpwardIcon sx={{ fontSize: '0.75rem', opacity: 0.2 }} />
      }
    </Stack>
  );
}

ImageListHeader.propTypes = {
  label:     PropTypes.string.isRequired,
  field:     PropTypes.string.isRequired,
  sortField: PropTypes.string.isRequired,
  sortDir:   PropTypes.string.isRequired,
  onSort:    PropTypes.func.isRequired,
  sx:        PropTypes.object,
};
