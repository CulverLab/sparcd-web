/** @module components/FilterHour */

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

// The names of the hours to use (numeric values as strings)
const hoursNames = Array.from({length: 24}, (_, i) => String(i));

/**
 * Adds hour information to form data
 * @function
 * @param {object} data The saved data to add to the form
 * @param {object} formData The FormData to add the fields to
 */
export function FilterHourFormData(data, formData) {
  formData.append('hour', JSON.stringify(data.map((item) => parseInt(item))));
}

/**
 * Returns the UI for filtering by hours
 * @param {object} [data] Saved hour data
 * @param {string} parentId The ID of the parent of this filter
 * @param {function} onClose The handler for closing this filter
 * @param {function} onChange The handler for when the filter data changes
 * @returns {object} The UI specific for filtering by hour
 */
export default function FilterHour({data, parentId, onClose, onChange}) {
  const theme = useTheme();
  const cardRef = React.useRef(null);   // Used for sizing
  const initialHoursRef = React.useRef(data ? data : hoursNames); // The user's selections
  const [listHeight, setListHeight] = React.useState(200);
  const [selectedHours, setSelectedHours] = React.useState(initialHoursRef.current); // The user's selections

  // Set the default data if we don't have any yet
  React.useEffect(() => {
    if (!data) {
      onChange(initialHoursRef.current);
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
   * Handles selecting all the filter choices
   * @function
   */
  const handleSelectAll = React.useCallback(() => {
    setSelectedHours(hoursNames);
    onChange(hoursNames);
  }, [onChange]);

  /**
   * Handles clearing all of the filter choices
   * @function
   */
  const handleSelectNone = React.useCallback(() => {
    setSelectedHours([]);
    onChange([]);
  }, [onChange]);


  /**
   * Handles the user selecting or deselecting an hour
   * @function
   * @param {object} event The triggering event data
   * @param {string} hourName The name of the hour to add or remove from the filter
   */
  const handleCheckboxChange = React.useCallback((event, hourName) => {

    if (event.target.checked) {
      // Add the hour in if we don't have it already
      if (!selectedHours.includes(hourName)) {
        const curHours = [...selectedHours, hourName];
        setSelectedHours(curHours);
        onChange(curHours);
      }
    } else {
      // Remove the hour if we have it
      const curHours = selectedHours.filter((item) => item !== hourName);
      if (curHours.length < selectedHours.length) {
        setSelectedHours(curHours);
        onChange(curHours);
      }
    }
  }, [onChange, selectedHours]);

  // Return the UI for filtering by the hour
  return (
    <FilterCard cardRef={cardRef} title="Hour Filter" onClose={onClose}
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
          { hoursNames.map((item) => 
              <FormControlLabel key={'filter-hours-' + item}
                                control={<Checkbox size="small" 
                                                   checked={selectedHours.includes(item)}
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

FilterHour.propTypes = {
  data:     PropTypes.arrayOf(PropTypes.string),
  parentId: PropTypes.string.isRequired,
  onClose:  PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
};

FilterHour.defaultProps = {
  data: null,
};
