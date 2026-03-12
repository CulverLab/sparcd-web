/** @module components/FilterCollections */

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

import { CollectionsInfoContext } from '../serverInfo';
import FilterCard from './FilterCard';

/**
 * Adds collection information to form data
 * @function
 * @param {object} data The saved data to add to the form
 * @param {object} formData The FormData to add the fields to
 */
export function FilterCollectionsFormData(data, formData) {
  formData.append('collections', JSON.stringify(data));
}

/**
 * Returns the UI for filtering by date
 * @function
 * @param {object} [data] Any stored collections data
 * @param {string} parentId The ID of the parent of this filter
 * @param {function} onClose The handler for closing this filter
 * @param {function} onChange The handler for when the filter data changes
 * @returns {object} The UI specific for filtering by collection
 */
export default function FilterCollections({data, parentId, onClose, onChange}) {
  const theme = useTheme();
  const collectionItems = React.useContext(CollectionsInfoContext);
  const cardRef = React.useRef(null);   // Used for sizing
  const searchRef = React.useRef(null); // Reference to search text box
  const initialCollectionsRef = React.useRef(data ?? collectionItems.map(item => item.bucket));
  const [displayedCollections, setDisplayedCollections] = React.useState(collectionItems); // The visible collections
  const [listHeight, setListHeight] = React.useState(200);
  const [selectedCollections, setSelectedCollections] = React.useState(initialCollectionsRef.current); // The user's selections

  // Set the initial data if we don't have any
  React.useEffect(() => {
    if (!data) {
      onChange(initialCollectionsRef.current);
    }
  }, [data, onChange]);

  // Calculate how large the list can be
  React.useLayoutEffect(() => {
    if (parentId && cardRef.current) {
      const parentEl = document.getElementById(parentId);
      if (parentEl) {
        const parentRect = parentEl.getBoundingClientRect();
        let usedHeight = 0;
        const childrenQueryIds = ['#filter-content-header', '#filter-content-actions', '#filter-collection-search-wrapper'];
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
   * Handles resetting the search field
   * @function
   */
  const handleClearSearch = React.useCallback(() => {
    if (searchRef.current) {
      searchRef.current.value = '';
      setDisplayedCollections(collectionItems);
    }
  }, [collectionItems, setDisplayedCollections]);

  /**
   * Handles selecting all collections to the filter
   * @function
   */
  const handleSelectAll = React.useCallback(() => {
    const existingSet = new Set(selectedCollections);
    const updatedSelections = [...selectedCollections,
                                ...displayedCollections.map(item => item.bucket).filter(prevItem => !existingSet.has(prevItem))
                              ];
    setSelectedCollections(updatedSelections);
    onChange(updatedSelections);
    handleClearSearch();
  }, [displayedCollections, handleClearSearch, onChange, selectedCollections, setSelectedCollections])

  /**
   * Clears all selected collections
   * @function
   */
  const handleSelectNone = React.useCallback(() => {
    setSelectedCollections([]);
    onChange([]);
    handleClearSearch();
  }, [handleClearSearch, onChange, setSelectedCollections]);

  /**
   * Handles when the user selects or deselects a collection
   * @function
   * @param {object} event The triggering event object
   * @param {string} collectionName The name of the collection to add or remove
   */
  const handleCheckboxChange = React.useCallback((event, collectionName) => {

    if (event.target.checked) {
      // Add the collections in if we don't have it already
      if (!selectedCollections.includes(collectionName)) {
        const curCollections = [...selectedCollections, collectionName];
        setSelectedCollections(curCollections);
        onChange(curCollections);
      }
    } else {
      // Remove the collections if we have it
      const curCollections = selectedCollections.filter((item) => item !== collectionName);
      if (curCollections.length < selectedCollections.length) {
        setSelectedCollections(curCollections);
        onChange(curCollections);
      }
    }
  }, [onChange, selectedCollections, setSelectedCollections]);

  /**
   * Handles the user changing the search criteria
   * @function
   * @param {object} event The triggering event
   */
  const handleSearchChange = React.useCallback((event) => {
    if (event.target.value) {
      const ucSearch = event.target.value.toUpperCase();
      setDisplayedCollections(collectionItems.filter((item) => item.bucket.toUpperCase().includes(ucSearch) ||
                                                                item.name.toUpperCase().includes(ucSearch)));
    } else {
      setDisplayedCollections(collectionItems);
    }
  }, [collectionItems, setDisplayedCollections]);

  // Return the collection filter UI
  return (
    <FilterCard cardRef={cardRef} title="Collections Filter" onClose={onClose}
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
          { displayedCollections.map((item) => 
              <FormControlLabel key={'filter-collections-' + item.name}
                                control={<Checkbox size="small" 
                                                   checked={selectedCollections.includes(item.bucket)}
                                                   onChange={(event) => handleCheckboxChange(event,item.bucket)}
                                          />} 
                                label={<Typography variant="body2">{item.name}</Typography>} />
            )
          }
        </FormGroup>
      </Grid>
      <FormControl id='filter-collection-search-wrapper' fullWidth variant="standard">
        <TextField
          variant="standard"
          id="file-collections-search"
          label="Search"
          slotProps={{
            input: {
              inputRef:searchRef,
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

FilterCollections.propTypes = {
  /** Any stored collections data - array of bucket name strings */
  data:      PropTypes.arrayOf(PropTypes.string),
  /** The ID of the parent element, used for height calculations */
  parentId:  PropTypes.string.isRequired,
  /** Called when the filter is closed */
  onClose:   PropTypes.func.isRequired,
  /** Called with the updated array of selected bucket strings when selections change */
  onChange:  PropTypes.func.isRequired,
};

FilterCollections.defaultProps = {
  data: null,
};
