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
  formData.append('species', JSON.stringify(data.map((item) => speciesItems[speciesItems.findIndex((species) => species.name == item)].scientificName)));
}

/**
 * Returns the UI for filtering by species
 * @param {object} {data} Saved species data
 * @param {string} parentId The ID of the parent of this filter
 * @param {function} onClose The handler for closing this filter
 * @param {function} onChange The handler for when the filter data changes
 * @returns {object} The UI specific for filtering by species range
 */
export default function FilterSpecies({data, parentId, onClose, onChange}) {
  const theme = useTheme();
  const cardRef = React.useRef();   // Used for sizeing
  const speciesItems = React.useContext(SpeciesInfoContext);
  const speciesOtherNames = React.useContext(SpeciesOtherNamesContext);
  const mergedSpecies = React.useMemo(() => speciesItems.map((item) => { return {...item, ...{defaultChecked:true}};}).concat(
                                                        speciesOtherNames.map((item) => {return {...item, ...{defaultChecked:false}};}) ), 
                                        [speciesItems, speciesOtherNames]); // Consistant view of data
  const [displayedSpecies, setDisplayedSpecies] = React.useState(mergedSpecies); // The visible species
  const [listHeight, setListHeight] = React.useState(200);
  const [selectedSpecies, setSelectedSpecies] = React.useState(data ? data : mergedSpecies.map((item)=>item.defaultChecked ? item.name : null)); // The user's selections
  const [selectionRedraw, setSelectionRedraw] = React.useState(0); // Used to redraw the UI

  // Set the default data if not set yet
  React.useEffect(() => {
    if (!data) {
      onChange(selectedSpecies);
    }
  }, [data, onChange, selectedSpecies]);

  // Calculate how large the list can be
  React.useLayoutEffect(() => {
    if (parentId && cardRef && cardRef.current) {
      const parentEl = document.getElementById(parentId);
      if (parentEl) {
        const parentRect = parentEl.getBoundingClientRect();
        let usedHeight = 0;
        const childrenQueryIds = ['#filter-conent-header', '#filter-content-actions', '#filter-species-search-wrapper'];
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
  }, [parentId, cardRef]);

  /**
   * Handles selecting all the species choices from the visible list
   * @function
   */
  function handleSelectAll() {
    const curSpecies = displayedSpecies.map((item) => item.name);
    const newSpecies = curSpecies.filter((item) => selectedSpecies.findIndex((selItem) => selItem === item) < 0);
    const updatedSelections = [...selectedSpecies, ...newSpecies];
    setSelectedSpecies(updatedSelections);
    onChange(updatedSelections);
    handleClearSearch();
  }

  /**
   * Handles clearing all selected species choices
   * @function
   */
  function handleSelectNone() {
    setSelectedSpecies([]);
    onChange([]);
    handleClearSearch();
  }

  /**
   * Handles the user selecting or deselecting a species
   * @function
   * @param {object} event The triggering event data
   * @param {string} speciesName The name of the species to add or remove from the filter
   */
  function handleCheckboxChange(event, speciesName) {

    if (event.target.checked) {
      const speciesIdx = selectedSpecies.findIndex((item) => speciesName === item);
      // Add the species in if we don't have it already
      if (speciesIdx < 0) {
        const curSpecies = selectedSpecies;
        curSpecies.push(speciesName);
        setSelectedSpecies(curSpecies);
        onChange(curSpecies);
        setSelectionRedraw(selectionRedraw + 1);
      }
    } else {
      // Remove the species if we have it
      const curSpecies = selectedSpecies.filter((item) => item !== speciesName);
      if (curSpecies.length < selectedSpecies.length) {
        setSelectedSpecies(curSpecies);
        onChange(curSpecies);
        setSelectionRedraw(selectionRedraw + 1);
      }
    }
  }

  /**
   * Handles a change in the species search
   * @function
   * @param {object} event The triggering event data
   */
  function handleSearchChange(event) {
    if (event.target.value) {
      const ucSearch = event.target.value.toUpperCase();
      setDisplayedSpecies(mergedSpecies.filter((item) => item.name.toUpperCase().includes(ucSearch)));
    } else {
      setDisplayedSpecies(mergedSpecies);
    }
  }

  /**
   * Handles clearing the species search
   */
  function handleClearSearch() {
    const searchEl = document.getElementById('file-species-search');
    if (searchEl) {
      searchEl.value = '';
      setDisplayedSpecies(mergedSpecies);
    }
  }

  // Return the UI for filtering by species
  return (
    <FilterCard cardRef={cardRef} title="Species Filter" onClose={onClose} actions={
                <React.Fragment>
                    <Button sx={{'flex':'1'}} size="small" onClick={handleSelectAll}>Select All</Button>
                    <Button sx={{'flex':'1'}} size="small" onClick={handleSelectNone}>Select None</Button>
                </React.Fragment>
              }
    >
      <Grid sx={{minHeight:listHeight+'px', maxHeight:listHeight+'px', height:listHeight+'px', minWidth:'250px', overflow:'scroll',
                      border:'1px solid black', borderRadius:'5px', paddingLeft:'5px',
                      backgroundColor:'rgb(255,255,255,0.3)'
                    }}>
        <FormGroup>
          { displayedSpecies.map((item) => 
              <FormControlLabel key={'filter-species-' + item.name}
                                control={<Checkbox size="small" 
                                                   checked={selectedSpecies.findIndex((curSpecies) => curSpecies===item.name) > -1 ? true : false}
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
