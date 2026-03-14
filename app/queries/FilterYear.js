/** @module components/FilterYear */

import * as React from 'react';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

import FilterCard from './FilterCard';

/**
 * Adds year range information to form data
 * @function
 * @param {object} data The saved data to add to the form
 * @param {object} formData The FormData to add the fields to
 */
export function FilterYearFormData(data, formData) {
  formData.append('years', JSON.stringify({'yearStart':String(data.start),
                                          'yearEnd':String(data.end)}));
}

/**
 * Returns the UI for filtering by year range
 * @param {object} [data] Saved year data
 * @param {function} onClose The handler for closing this filter
 * @param {function} onChange The handler for when the filter data changes
 * @returns {object} The UI specific for filtering by year range
 */
export default function FilterYear({data, onClose, onChange}) {
  const theme = useTheme();
  const curYear = new Date().getFullYear();
  const cardRef = React.useRef(null); // The card reference
  const initialYearEndRef = React.useRef(data ? data.end : curYear); // The user's end year
  const initialYearStartRef = React.useRef(data ? data.start : curYear); // The user's start year
  const [selectedYearEnd, setSelectedYearEnd] = React.useState(initialYearEndRef.current);
  const [selectedYearStart, setSelectedYearStart] = React.useState(initialYearStartRef.current);
  const [yearEndError, setYearEndError] = React.useState(false); // The user's end year is in error
  const [yearStartError, setYearStartError] = React.useState(false); // The user's start year is in error

  // Set the default data if it's not set yet
  React.useEffect(() => {
    if (!data) {
      onChange({start:initialYearEndRef.current, end:initialYearStartRef.current});
    }
  }, [data, onChange]);

  /**
   * Handles the starting year changing
   * @function
   * @param {object} event The triggering event data
   */
  const handleYearStartChange = React.useCallback((event) => {
    const newYear = parseInt(event.target.value);
    setSelectedYearStart(newYear);
    if (newYear <= selectedYearEnd || String(newYear).length > 4) {
      setYearStartError(false);
      onChange({start:newYear, end:selectedYearEnd});
    } else {
      setYearStartError(true);
    }
  }, [onChange, selectedYearEnd]);

  /**
   * Handles the ending year changing
   * @function
   * @param {object} event The triggering event data
   */
  const handleYearEndChange = React.useCallback((event) => {
    const newYear = parseInt(event.target.value);
    setSelectedYearEnd(newYear);
    if (newYear >= selectedYearStart || String(newYear).length > 4) {
      setYearEndError(false);
      onChange({start:selectedYearStart, end:newYear});
    } else {
      setYearEndError(true);
    }
  }, [onChange, selectedYearStart]);

  // Return the UI for filtering by year
  return (
    <FilterCard cardRef={cardRef} title="Year Filter" onClose={onClose} >
      <Grid sx={{minHeight:'230px', maxHeight:'230px', height:'230px', minWidth:'250px', maxWidth:'250px',
                      overflowX:'clip', overflowY:'auto', paddingLeft:'5px', backgroundColor:'rgb(255,255,255,0.3)'
                    }}>
        <Stack spacing={1}>
          <TextField id="start-year-value" error={yearStartError} value={selectedYearStart} type="number" label="Start Year" variant="standard" 
                     onChange={handleYearStartChange}
          />
          <Typography gutterBottom variant="body2" noWrap sx={{textAlign:'center'}}>
            Up to, and including
          </Typography>
          <TextField id="end-year-value" error={yearEndError} value={selectedYearEnd} type="number" label="End Year" variant="standard" 
                     onChange={handleYearEndChange}
          />
          <Typography gutterBottom variant='body2' color='error' sx={{textAlign:'start'}}>
            { yearStartError || yearEndError ? 'End year must be equal or greater than start year' : ''}
          </Typography>
        </Stack>
      </Grid>
    </FilterCard>
  );
}

FilterYear.propTypes = {
  data: PropTypes.shape({
    start: PropTypes.number.isRequired,
    end:   PropTypes.number.isRequired,
  }),
  onClose:  PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
};

FilterYear.defaultProps = {
  data: null,
};
