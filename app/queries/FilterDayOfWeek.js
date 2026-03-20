'use client'

/** @module components/FilterDayOfWeek */

import * as React from 'react';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Grid from '@mui/material/Grid';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

import FilterCard from './FilterCard';

// The names of the days to use
const dayNames = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY'
];

// Values associated with the day
const dayValues = [
  1,    // MONDAY
  2,    // TUESDAY
  3,    // WEDNESDAY
  4,    // THURSDAY
  5,    // FRIDAY
  6,    // SATURDAY
  0     // SUNDAY
]

/**
 * Adds day of the week information to form data
 * @function
 * @param {object} data The saved data to add to the form
 * @param {object} formData The FormData to add the fields to
 */
export function FilterDayOfWeekFormData(data, formData) {
  formData.append('dayofweek', JSON.stringify(data.map((item) => dayValues[dayNames.findIndex((name) => name === item)])));
}

/**
 * Returns the UI for filtering by day of the week
 * @param {object} [data] Saved day of the week data
 * @param {string} parentId The ID of the parent of this filter
 * @param {function} onClose The handler for closing this filter
 * @param {function} onChange The handler for when the filter data changes
 * @returns {object} The UI specific for filtering by day of the week
 */
export default function FilterDayOfWeek({data, parentId, onClose, onChange}) {
  const theme = useTheme();
  const cardRef = React.useRef(null);   // Used for sizing
  const initialDaysRef = React.useRef(data ?? dayNames);
  const [listHeight, setListHeight] = React.useState(200);
  const [selectedDays, setSelectedDays] = React.useState(initialDaysRef.current); // The user's selections

  // Set default data if we don't have any
  React.useEffect(() => {
    if (!data) {
      onChange(initialDaysRef.current);
    }
  }, [data, onChange]);

  // Calculate how large the list can be
  React.useLayoutEffect(() => {
    if (parentId && cardRef.current) {
      const parentEl = document.getElementById(parentId);
      if (parentEl) {
        const parentRect = parentEl.getBoundingClientRect();
        let usedHeight = 0;
        const childrenQueryIds = ['#filter-content-header', '#filter-content-actions'];
        for (let curId of childrenQueryIds) {
          let childEl = cardRef.current.querySelector(curId);
          if (childEl) {
            let childRect = childEl.getBoundingClientRect();
            usedHeight += childRect.height;
          }
        }
        setListHeight(parentRect.height - usedHeight);
      }
    }
  }, [parentId]);

  /**
   * Handles selecting all the day of the week choices
   * @function
   */
  const handleSelectAll = React.useCallback(() => {
    setSelectedDays(dayNames);
    onChange(dayNames);
  }, [onChange]);

  /**
   * Clears all chosen selections
   * @function
   */
  const handleSelectNone = React.useCallback(() => {
    setSelectedDays([]);
    onChange([]);
  }, [onChange]);

  /**
   * Handles the user selecting or deselecting a day of the week
   * @function
   * @param {object} event The triggering event data
   * @param {string} dayName The name of the day to add or remove from the filter
   */
  const handleCheckboxChange = React.useCallback((event, dayName) => {

    if (event.target.checked) {
      // Add the day in if we don't have it already
      if (!selectedDays.includes(dayName)) {
        const curDay = [...selectedDays, dayName];
        setSelectedDays(curDay);
        onChange(curDay);
      }
    } else {
      // Remove the day if we have it
      const curDay = selectedDays.filter((item) => item !== dayName);
      if (curDay.length < selectedDays.length) {
        setSelectedDays(curDay);
        onChange(curDay);
      }
    }
  }, [onChange, selectedDays]);

  // Return the UI for choosing the day of the week
  return (
    <FilterCard cardRef={cardRef} title="Day of Week Filter" onClose={onClose} 
                actions={
                  <React.Fragment>
                    <Button sx={{flex:1}} size="small" onClick={handleSelectAll}>Select All</Button>
                    <Button sx={{flex:1}} size="small" onClick={handleSelectNone}>Select None</Button>
                  </React.Fragment>
                }
    >
      <Grid sx={{minHeight:listHeight, maxHeight:listHeight, height:listHeight, minWidth:'250px', overflowY:'auto',
                      border:'1px solid black', borderRadius:'5px', paddingLeft:'5px',
                      backgroundColor:'rgb(255,255,255,0.3)'
                    }}>
        <FormGroup>
          { dayNames.map((item) => 
              <FormControlLabel key={'filter-day-' + item}
                                control={<Checkbox size="small" 
                                                   checked={selectedDays.includes(item)}
                                                   onChange={(event) => handleCheckboxChange(event,item)}
                                          />} 
                                label={<Typography variant="body2">{item}</Typography>} />
            )
          }
        </FormGroup>
      </Grid>
    </FilterCard>
  );
}

FilterDayOfWeek.propTypes = {
  data:     PropTypes.arrayOf(PropTypes.string),
  parentId: PropTypes.string.isRequired,
  onClose:  PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
};

FilterDayOfWeek.defaultProps = {
  data: null,
};
