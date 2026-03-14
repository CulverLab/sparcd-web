/** @module components/FilterMonth */

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

// The names of the month to use
const monthNames = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER'
];

/**
 * Adds month information to form data
 * @function
 * @param {object} data The saved data to add to the form
 * @param {object} formData The FormData to add the fields to
 */
export function FilterMonthFormData(data, formData) {
  formData.append('month', JSON.stringify(data.map((item) => monthNames.findIndex((name) => name === item) + 1)));
}

/**
 * Returns the UI for filtering by month
 * @param {object} [data] Saved month data
 * @param {string} parentId The ID of the parent of this filter
 * @param {function} onClose The handler for closing this filter
 * @param {function} onChange The handler for when the filter data changes
 * @returns {object} The UI specific for filtering by month
 */
export default function FilterMonth({data, parentId, onClose, onChange}) {
  const theme = useTheme();
  const cardRef = React.useRef(null);   // Used for sizing
  const initialMonthRef = React.useRef(data ? data : monthNames); // The user's selections
  const [listHeight, setListHeight] = React.useState(200);
  const [selectedMonths, setSelectedMonths] = React.useState(initialMonthRef.current);

  // Set the default data if we don't have any
  React.useEffect(() => {
    if (!data) {
      onChange(initialMonthRef.current);
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
   * Handle selecting all the filter choices
   * @function
   */
  const handleSelectAll = React.useCallback(() => {
    setSelectedMonths(monthNames);
    onChange(monthNames);
  }, [onChange]);

  /**
   * Handles clearing all the filter choices
   * @function
   */
  const handleSelectNone = React.useCallback(() => {
    setSelectedMonths([]);
    onChange([]);
  }, [onChange]);

  /**
   * Handles the user selecting or deselecting an month
   * @function
   * @param {object} event The triggering event data
   * @param {string} monthName The name of the month to add or remove from the filter
   */
  const handleCheckboxChange = React.useCallback((event, monthName) => {

    if (event.target.checked) {
      // Add the month in if we don't have it already
      if (!selectedMonths.includes(monthName)) {
        const curMonths = [...selectedMonths, monthName];
        setSelectedMonths(curMonths);
        onChange(curMonths);
      }
    } else {
      // Remove the month if we have it
      const curMonths = selectedMonths.filter((item) => item !== monthName);
      if (curMonths.length < selectedMonths.length) {
        setSelectedMonths(curMonths);
        onChange(curMonths);
      }
    }
  }, [onChange, selectedMonths]);

  // Return the UI for the month filter
  return (
    <FilterCard cardRef={cardRef} title="Month Filter" onClose={onClose} 
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
          { monthNames.map((item) => 
              <FormControlLabel key={'filter-months-' + item}
                                control={<Checkbox size="small" 
                                                   checked={selectedMonths.includes(item)}
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

FilterMonth.propTypes = {
  data:     PropTypes.arrayOf(PropTypes.string),
  parentId: PropTypes.string.isRequired,
  onClose:  PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
};

FilterMonth.defaultProps = {
  data: null,
};
