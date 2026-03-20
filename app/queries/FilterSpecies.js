'use client'

/** @module components/FilterSpecies */

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

import FilterCard from './FilterCard';
import { SpeciesOtherNamesContext, SpeciesInfoContext } from '../serverInfo';

/**
 * Adds species information to form data
 * @function
 * @param {object} data The saved data to add to the form
 * @param {object} formData The FormData to add the fields to
 * @param {array} speciesItems The complete list of species for mapping
 */
export function FilterSpeciesFormData(data, formData, speciesItems) {
  const foundSpecies = data.map((item) => speciesItems.find((species) => species.name === item)?.scientificName);
  formData.append('species', JSON.stringify(foundSpecies));
}

/**
 * Returns the UI for filtering by species
 * @param {object} [data] Saved species data
 * @param {string} parentId The ID of the parent of this filter
 * @param {function} onClose The handler for closing this filter
 * @param {function} onChange The handler for when the filter data changes
 * @returns {object} The UI specific for filtering by species range
 */
export default function FilterSpecies({data, parentId, onClose, onChange}) {
  const theme = useTheme();
  const speciesItems = React.useContext(SpeciesInfoContext);
  const speciesOtherNames = React.useContext(SpeciesOtherNamesContext);
  const mergedSpecies = React.useMemo(() => speciesItems.map((item) => { return {...item, defaultChecked:true};}).concat(
                                                        (speciesOtherNames ?? []).map((item) => {return {...item, defaultChecked:false};}) ), 
                                        [speciesItems, speciesOtherNames]); // Consistent view of data
  const cardRef = React.useRef(null);   // Used for sizing
  const initialSpeciesRef = React.useRef(data ? data : mergedSpecies.filter(item => item.defaultChecked).map(item => item.name)); // The user's selections
  const searchInputRef = React.useRef(null);    // Reference the search text box
  const [displayedSpecies, setDisplayedSpecies] = React.useState(mergedSpecies); // The visible species
  const [listHeight, setListHeight] = React.useState(200);
  const [selectedSpecies, setSelectedSpecies] = React.useState(initialSpeciesRef.current);

  // Set the default data if not set yet
  React.useEffect(() => {
    if (!data) {
      onChange(initialSpeciesRef.current);
    }
  }, [data, onChange]);

  // Calculate how large the list can be
  React.useLayoutEffect(() => {
    if (parentId && cardRef.current) {
      const parentEl = document.getElementById(parentId);
      if (parentEl) {
        const parentRect = parentEl.getBoundingClientRect();
        let usedHeight = 0;
        const childrenQueryIds = ['#filter-content-header', '#filter-content-actions', '#filter-species-search-wrapper'];
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
   * Handles a change in the species search
   * @function
   * @param {object} event The triggering event data
   */
  const handleSearchChange= React.useCallback((event) => {
    if (event.target.value) {
      const ucSearch = event.target.value.toUpperCase();
      setDisplayedSpecies(mergedSpecies.filter((item) => item.name.toUpperCase().includes(ucSearch)));
    } else {
      setDisplayedSpecies(mergedSpecies);
    }
  }, [mergedSpecies]);

  /**
   * Handles clearing the species search
   */
  const handleClearSearch = React.useCallback(() => {
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
      setDisplayedSpecies(mergedSpecies);
    }
  }, [mergedSpecies]);

  /**
   * Handles selecting all the species choices from the visible list
   * @function
   */
  const handleSelectAll = React.useCallback(() => {
    const existingSet = new Set(selectedSpecies);
    const updatedSelections = [...selectedSpecies,
                              ...displayedSpecies.map(item => item.name).filter(newItem => !existingSet.has(newItem))];    
    setSelectedSpecies(updatedSelections);
    onChange(updatedSelections);
    handleClearSearch();
  }, [displayedSpecies, handleClearSearch, onChange, selectedSpecies]);

  /**
   * Handles clearing all selected species choices
   * @function
   */
  const handleSelectNone = React.useCallback(() => {
    setSelectedSpecies([]);
    onChange([]);
    handleClearSearch();
  }, [handleClearSearch, onChange]);

  /**
   * Handles the user selecting or deselecting a species
   * @function
   * @param {object} event The triggering event data
   * @param {string} speciesName The name of the species to add or remove from the filter
   */
  const handleCheckboxChange = React.useCallback((event, speciesName) => {

    if (event.target.checked) {
      // Add the species in if we don't have it already
      if (!selectedSpecies.includes(speciesName)) {
        const curSpecies = [...selectedSpecies, speciesName];
        setSelectedSpecies(curSpecies);
        onChange(curSpecies);
      }
    } else {
      // Remove the species if we have it
      const curSpecies = selectedSpecies.filter((item) => item !== speciesName);
      if (curSpecies.length < selectedSpecies.length) {
        setSelectedSpecies(curSpecies);
        onChange(curSpecies);
      }
    }
  }, [onChange, selectedSpecies]);

  // Return the UI for filtering by species
  return (
    <FilterCard cardRef={cardRef} title="Species Filter" onClose={onClose} actions={
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
          { displayedSpecies.map((item) => 
              <FormControlLabel key={'filter-species-' + item.name}
                                control={<Checkbox size="small" 
                                                   checked={selectedSpecies.includes(item.name)}
                                                   onChange={(event) => handleCheckboxChange(event,item.name)}
                                          />} 
                                label={<Typography variant="body2">{item.name}</Typography>} />
            )
          }
        </FormGroup>
      </Grid>
      <FormControl id='filter-species-search-wrapper' fullWidth variant="standard">
        <TextField
          variant="standard"
          id="file-species-search"
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

FilterSpecies.propTypes = {
  data:     PropTypes.arrayOf(PropTypes.string),
  parentId: PropTypes.string.isRequired,
  onClose:  PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
};

FilterSpecies.defaultProps = {
  data: null,
};
