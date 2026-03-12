/** @module components/FilterElevation */

import * as React from 'react';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

import FilterCard from './FilterCard';

// Comparison choices and their logical representation types
const elevationChoices = [
  {name:"Equal To", type:"="},
  {name:"Greater Than", type:">"},
  {name:"Greater Than or Equal To", type:">="},
  {name:"Less Than", type:"<"},
  {name:"Less Than or Equal To",type:"<="}
];

// Supported elevation value units
const elevationUnits = [
  "meters",
  "feet"
];

/**
 * Adds elevation information to form data
 * @function
 * @param {object} data The saved data to add to the form
 * @param {object} formData The FormData to add the fields to
 */
export function FilterElevationsFormData(data, formData) {
  formData.append('elevations', JSON.stringify(data));
}

/**
 * Returns the UI for filtering by elevation
 * @param {object} [data] Saved elevation data
 * @param {function} onClose The handler for closing this filter
 * @param {function} onChange The handler for when the filter data changes
 * @returns {object} The UI specific for filtering by elevation range
 */
export default function FilterElevations({data, onClose, onChange}) {
  const theme = useTheme();
  const cardRef = React.useRef(null);
  const initialElevationRef = React.useRef(data ? data : {type:"=", value:0.0, units:"meters"}); // The user's selections
  const [displayElevation, setDisplayElevation] = React.useState(String(initialElevationRef.current.value));
  const [selectedComparison, setSelectedComparison] = React.useState(initialElevationRef.current.type);
  const [selectedElevation, setSelectedElevation] = React.useState(initialElevationRef.current);
  const [selectedUnits, setSelectedUnits] = React.useState(initialElevationRef.current.units);

  // Set the default values if they're not set yet
  React.useEffect(() => {
    if (!data) {
      onChange(initialElevationRef.current);
    }
  }, [data, onChange]);

  /**
   * Handles the selection of a new type of comparison
   * @function
   * @param {object} event The triggering event data
   */
  const handleChangeComparison = React.useCallback((event) => {
    const curElevation = {...selectedElevation, type:event.target.value};
    setSelectedComparison(event.target.value);
    setSelectedElevation(curElevation);
    onChange(curElevation);
  }, [onChange, selectedElevation]);

  /**
   * Handles a change in the elevation value
   * @function
   * @param {object} event The triggering event data
   */
  const handleElevationChange = React.useCallback((event) => {
    setDisplayElevation(event.target.value);
    const parseElevation = parseFloat(event.target.value);
    if (!isNaN(parseElevation)) {
      const curElevation = {...selectedElevation, value:parseElevation};
      setSelectedElevation(curElevation);
      onChange(curElevation);
    }
  }, [onChange, selectedElevation]);

  /**
   * Handles the selection of a new type of measurement units
   * @function
   * @param {object} event The triggering event data
   */
  const handleChangeUnits = React.useCallback((event) => {
    const curElevation = {...selectedElevation, units:event.target.value};
    setSelectedUnits(event.target.value);
    setSelectedElevation(curElevation);
    onChange(curElevation);
  }, [onChange, selectedElevation]);

  // Return the UI for the elevation filter
  return (
    <FilterCard cardRef={cardRef} title="Elevation Filter" onClose={onClose} >
      <Grid sx={{minHeight:'230px', maxHeight:'230px', height:'230px', minWidth:'250px', overflowY:'auto',
                      paddingLeft:'5px', backgroundColor:'rgb(255,255,255,0.3)'
                    }}>
        <Stack spacing={1}>
          <Typography gutterBottom variant="body2" noWrap>
            Return all elevations which are
          </Typography>
          <TextField id="elevation-compare-types" select value={selectedComparison}
                    onChange={handleChangeComparison}
          >
          { elevationChoices.map((item) => 
                <MenuItem key={'elevation-choice-' + item.type} value={item.type}>
                  {item.name}
                </MenuItem>
            )
          }
          </TextField>
          <Grid container direction="row" alignItems="start" justifyItems="start">
            <Grid>
              <TextField id="elevation-value" value={displayElevation} label="Elevation" variant="standard" 
                         onChange={handleElevationChange}
                         slotProps={{htmlInput: {style: {maxWidth:"130px"}} }}
              />
            </Grid>
            <Grid sx={{marginLeft:'auto'}}>
              <TextField id="elevation-value-units" select label="Units" value={selectedUnits}
                         onChange={handleChangeUnits}
              >
              { elevationUnits.map((item) => 
                    <MenuItem key={'elevation-choice-' + item} value={item}>
                      {item}
                    </MenuItem>
                )
              }
              </TextField>
            </Grid>
          </Grid>
        </Stack>
      </Grid>
    </FilterCard>
  );
}

FilterElevations.propTypes = {
  data:     PropTypes.shape({
    type:   PropTypes.string.isRequired,
    value:  PropTypes.number.isRequired,
    units:  PropTypes.string.isRequired,
  }),
  onClose:  PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
};

FilterElevations.defaultProps = {
  data: null,
};
