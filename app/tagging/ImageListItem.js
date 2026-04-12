'use client'

/** @module tagging/ImageListItem */

import * as React from 'react';
import Checkbox from '@mui/material/Checkbox';
import CheckBoxOutlineBlankOutlinedIcon from '@mui/icons-material/CheckBoxOutlineBlankOutlined';
import CheckBoxOutlinedIcon from '@mui/icons-material/CheckBoxOutlined';
import Grid from '@mui/material/Grid';
import IndeterminateCheckBoxOutlinedIcon from '@mui/icons-material/IndeterminateCheckBoxOutlined';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

/**
 * Renders a single image row for the list view
 * @function
 * @param {string}   name       Image file name
 * @param {string}   type       'image' | 'movie'
 * @param {object}   timestamp  The timestamp of the image
 * @param {Array}    species    Array of species objects tagged to this image
 * @param {bool}     checked    Whether this row is currently selected
 * @param {function} onCheck    Called when the checkbox changes: (name, checked) => void
 * @param {function} onClick    Called when the row body is clicked (opens edit view)
 * @returns {object} The rendered row
 */
export default function ImageListItem({ name, type, timestamp, species, checked, onCheck, onClick }) {
  const speciesSummary = species && species.length > 0
    ? species.map(s => `${s.name} - ${s.count}`).join(', ')
    : 'No species tagged';

  const handleCheckChange = React.useCallback((event) => {
    // Stop propagation so clicking the checkbox doesn't also open the image editor
    event.stopPropagation();
    onCheck(name, event.target.checked);
  }, [name, onCheck]);

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      onClick={onClick}
      sx={{
        padding: '4px 8px',
        cursor: 'pointer',
        borderColor: checked ? 'primary.light' : '#ddd',
        backgroundColor: checked ? 'rgb(200, 200, 200, 0.15)' : 'transparent',
        '&:hover': { backgroundColor: 'action.selected' },
        transition: 'background-color 0.15s ease, border-color 0.15s ease',
        userSelect: 'none',
      }}
    >
      {/* Checkbox — click intercepted so it doesn't trigger row onClick */}
      <Checkbox
        size="small"
        checked={checked}
        onChange={handleCheckChange}
        onClick={(e) => e.stopPropagation()}
        checkedIcon=<CheckBoxOutlinedIcon sx={{color:'black'}}/>
        icon=<CheckBoxOutlineBlankOutlinedIcon sx={{color:'black'}}/>
        sx={{ padding:'2px' }}
      />

      {/* Type badge */}
      <Typography
        variant="caption"
        sx={{
          minWidth: 32,
          textAlign: 'center',
          fontSize: '1rem',
          lineHeight: 1,
        }}
        title={type}
      >
        {type === 'movie' ?
           <Typography variant="body3" sx={{backgroundColor:'rgb(200,200,200,0.2)', border:'1px solid #909090', borderRadius:'5px', padding:'3px 2px'}} >Movie</Typography>
         : <Typography variant="body3" sx={{backgroundColor:'rgb(200,200,200,0.2)', border:'1px solid #909090', borderRadius:'5px', padding:'3px 2px'}} >Image</Typography>
        }
      </Typography>

      {/* Image name */}
      <Typography
        variant="body2"
        sx={{
          flexGrow: 1,
          fontFamily: 'monospace',
          fontSize: '0.78rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={name}
      >
        {name}
      </Typography>

      {/* Timestamp */}
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          textAlign: 'right',
          minWidth: '160px',
          maxWidth: '160px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {timestamp ? timestamp.toLocaleString() : ''}
      </Typography>

      {/* Species summary */}
      <Tooltip title={speciesSummary} placement="left" arrow>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            textAlign: 'right',
            minWidth: '130px',
            maxWidth: '130px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {speciesSummary}
        </Typography>
      </Tooltip>
    </Stack>
  );
}

ImageListItem.propTypes = {
  name:       PropTypes.string.isRequired,
  type:       PropTypes.string.isRequired,
  timestamp:  PropTypes.object.isRequired,
  species:    PropTypes.array,
  checked:    PropTypes.bool.isRequired,
  onCheck:    PropTypes.func.isRequired,
  onClick:    PropTypes.func.isRequired,
};
