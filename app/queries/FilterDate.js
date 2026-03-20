'use client'

/** @module components/FilterDate */

import * as React from 'react';
import dayjs from 'dayjs';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import Grid from '@mui/material/Grid';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

import FilterCard from './FilterCard';

/**
 * Adds date and time information to form data
 * @function
 * @param {string} fieldName The name of the form field
 * @param {object} data The saved data to add to the form
 * @param {object} formData The FormData to add the fields to
 */
export function FilterDateFormData(fieldName, data, formData) {
  formData.append(fieldName, dayjs(data).toDate().toISOString());
}

/**
 * Returns the UI for filtering by date
 * @function
 * @param {string} title The title of this filter
 * @param {object} [data] Any stored data
 * @param {function} onClose The handler for closing this filter
 * @param {function} onChange The handler for when the filter data changes
 * @returns {object} The UI specific for filtering by date
 */
export default function FilterDate({title, data, onClose, onChange}) {
  const theme = useTheme();
  const cardRef = React.useRef(null);   // Used for sizing
  const initialDateRef = React.useRef(data ? data.end : dayjs());
  const [selectedDateTime, setSelectedDateTime] = React.useState(initialDateRef.current); // The user's starting timestamp

  // Handle setting an initial value
  React.useEffect(() => {
    if (!data) {
      onChange(initialDateRef.current);
    }
  }, [data, onChange]);

  /**
   * Handles when the date or time is changed
   * @function
   * @param {object} event The triggering event object
   */
  const handleDateTimeChange = React.useCallback((event) => {
    setSelectedDateTime(event);
    onChange(event);
  }, [onChange]);

  // Return the rendered UI
  return (
    <FilterCard cardRef={cardRef} title={title} onClose={onClose} >
      <Grid sx={{minHeight:'230px', maxHeight:'230px', height:'230px', minWidth:'250px', maxWidth:'250px',
                      overflowX:'clip', overflowY:'auto', paddingLeft:'5px', backgroundColor:'rgb(255,255,255,0.3)'
                    }}>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DateTimePicker ampm={false} value={selectedDateTime} timeSteps={{minutes: 1}} onChange={handleDateTimeChange} />
        </LocalizationProvider>
      </Grid>
    </FilterCard>
  );
}

FilterDate.propTypes = {
  title:    PropTypes.string.isRequired,
  data:     PropTypes.object,
  onClose:  PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
};

FilterDate.defaultProps = {
  data: null,
};
