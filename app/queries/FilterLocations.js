'use client'

/** @module components/FilterLocations */

import * as React from 'react';
import BackspaceOutlined from '@mui/icons-material/BackspaceOutlined';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Grid from '@mui/material/Grid';
import FormGroup from '@mui/material/FormGroup';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

import { LocationsInfoContext } from '../serverInfo';
import FilterCard from './FilterCard';

/**
 * Adds location information to form data
 * @function
 * @param {object} data The saved data to add to the form
 * @param {object} formData The FormData to add the fields to
 * @param {array} locationsItems The complete list of locations used for mapping
 */
export function FilterLocationsFormData(data, formData, locationItems) {
  const idData = locationItems.filter((item) => data.includes(item.nameProperty))
  formData.append('locations', JSON.stringify(idData.map((item) => item.idProperty)));
}

/**
 * Returns the UI for filtering by location
 * @param {object} [data] Saved location data
 * @param {string} parentId The ID of the parent of this filter
 * @param {function} onClose The handler for closing this filter
 * @param {function} onChange The handler for when the filter data changes
 * @returns {object} The UI specific for filtering by location range
 */
export default function FilterLocations({data, parentId, onClose, onChange}) {
  const theme = useTheme();
  const cardRef = React.useRef(null);   // Used for sizing
  const locationItems = React.useContext(LocationsInfoContext);
  const initialLocationRef = React.useRef(data ? data : locationItems.map((item)=>item.nameProperty)); // The user's selections
  const searchInputRef = React.useRef(null); // The search textbox reference
  const [displayedLocations, setDisplayedLocations] = React.useState(locationItems); // The visible locations
  const [listHeight, setListHeight] = React.useState(200);
  const [selectedLocations, setSelectedLocations] = React.useState(initialLocationRef.current); // The user's selections

  // Set the default data if it's not set yet
  React.useEffect(() => {
    if (!data) {
      onChange(initialLocationRef.current);
    }
  }, [data, onChange]);

  // Calculate how large the list can be
  React.useLayoutEffect(() => {
    if (parentId && cardRef.current) {
      const parentEl = document.getElementById(parentId);
      if (parentEl) {
        const parentRect = parentEl.getBoundingClientRect();
        let usedHeight = 0;
        const childrenQueryIds = ['#filter-content-header', '#filter-content-actions', '#filter-location-search-wrapper'];
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
   * Handles clearing the locations search
   */
  const handleClearSearch = React.useCallback(() => {
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
      setDisplayedLocations(locationItems);
    }
  }, [locationItems]);

  /**
   * Handles selecting all the location choices
   * @function
   */
  const handleSelectAll = React.useCallback(() => {
    const existingSet = new Set(selectedLocations);
    const updatedSelections = [...selectedLocations,
                                ...displayedLocations.map(item => item.nameProperty).filter(newItem => !existingSet.has(newItem))];
    setSelectedLocations(updatedSelections);
    onChange(updatedSelections);
    handleClearSearch();
  }, [displayedLocations, handleClearSearch, onChange, selectedLocations]);

  /**
   * Handles clearing all selected location choices
   * @function
   */
  const handleSelectNone = React.useCallback(() => {
    setSelectedLocations([]);
    onChange([]);
    handleClearSearch();
  }, [handleClearSearch, onChange]);

  /**
   * Handles the user selecting or deselecting a location
   * @function
   * @param {object} event The triggering event data
   * @param {object} location The location to add or remove from the filter
   */
  const handleCheckboxChange = React.useCallback((event, location) => {

    if (event.target.checked) {
      // Add the location in if we don't have it already
      if (!selectedLocations.includes(location.nameProperty)) {
        const curlocations = [...selectedLocations, location.nameProperty];
        setSelectedLocations(curlocations);
        onChange(curlocations);
      }
    } else {
      // Remove the location if we have it
      const curlocations = selectedLocations.filter((item) => item !== location.nameProperty);
      if (curlocations.length < selectedLocations.length) {
        setSelectedLocations(curlocations);
        onChange(curlocations);
      }
    }
  }, [onChange, selectedLocations]);

  /**
   * Handles a change in the locations search
   * @function
   * @param {object} event The triggering event data
   */
  const handleSearchChange = React.useCallback((event) => {
    if (event.target.value) {
      const ucSearch = event.target.value.toUpperCase();
      const filtered = locationItems.filter((item) => item.nameProperty.toUpperCase().includes(ucSearch) || 
                                                      item.idProperty.toUpperCase().includes(ucSearch));
      setDisplayedLocations(filtered);
    } else {
      setDisplayedLocations(locationItems);
    }
  }, [locationItems]);

  // Return the UI for filtering on locations
  return (
    <FilterCard cardRef={cardRef} title="Locations Filter" onClose={onClose}
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
          { displayedLocations.map((item, idx) => 
              <FormControlLabel key={'filter-locations-' + item.nameProperty + item.latProperty + item.lngProperty + '-' + idx}
                                control={<Checkbox size="small" 
                                                   checked={selectedLocations.includes(item.nameProperty)}
                                                   onChange={(event) => handleCheckboxChange(event,item)}
                                          />} 
                                label={
                                  <Grid container direction="row" alignItems="center" justifyContent="start" sx={{width:"220px", flexWrap:'nowrap'}}>
                                    <Typography variant="body2" sx={{fontWeight:'bold'}}>
                                      {item.idProperty}
                                    </Typography>
                                    <Typography variant="body2" align="center" sx={{color:'darkgrey', marginLeft:"auto"}}>
                                      {item.nameProperty}
                                    </Typography>
                                  </Grid>
                                }
              />
            )
          }
        </FormGroup>
      </Grid>
      <FormControl id='filter-location-search-wrapper' fullWidth variant="standard">
        <TextField
          variant="standard"
          id="file-location-search"
          label="Search"
          slotProps={{
            input: {
              inputRef:searchInputRef,
              endAdornment:(
                <InputAdornment position="end">
                  <IconButton onClick={handleClearSearch}>
                    <BackspaceOutlined/>
                  </IconButton>
                </InputAdornment>
              )
            },
          }}
          onChange={handleSearchChange}
        />
      </FormControl>
    </FilterCard>
  );
}

FilterLocations.propTypes = {
  data:     PropTypes.arrayOf(PropTypes.string),
  parentId: PropTypes.string.isRequired,
  onClose:  PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
};

FilterLocations.defaultProps = {
  data: null,
};
