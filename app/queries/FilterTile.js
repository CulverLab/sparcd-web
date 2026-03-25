'use client'

/** @module queries/FilterTile */

import * as React from 'react';

import PropTypes from 'prop-types';

import FilterCollections from './FilterCollections';
import FilterDate from './FilterDate';
import FilterDayOfWeek from './FilterDayOfWeek';
import FilterElevation from './FilterElevation';
import FilterHour from './FilterHour';
import FilterLocations from './FilterLocations';
import FilterMonth from './FilterMonth';
import FilterSpecies from './FilterSpecies';
import FilterYear from './FilterYear';

// The names of the available filters
export const filterNames = [
  'Species Filter',
  'Location Filter',
  'Elevation Filter',
  'Year Filter',
  'Month Filter',
  'Hour Filter',
  'Day of Week Filter',
  'Start Date Filter',
  'End Date Filter',
  'Collection Filter'
];

/**
 * Returns the UI fields for each filter type
 * @function
 * @param {object} filterInfo The information on the filter to return the UI for
 * @param {string} parentId The ID of the parent element
 * @param {function} onChanged The function to call when the filter is changed
 * @param {function} onRemove The function to call to remove the filter
 * @returns {object} The filter-specific UI to render
 */
export function FilterTile({filterInfo, parentId, onChanged, onRemove}) {

  /**
   * Function to handle closing the filter
   * @function
   */
  const handleClosed = React.useCallback(() => {
    onRemove(filterInfo.id);
  }, [onRemove, filterInfo.id]);

  /**
   * Function to handle the filter changing
   * @function
   */
  const handleChanged = React.useCallback((data) => {
    onChanged(filterInfo.id, data);
  }, [onChange, filterInfo.id]);


  switch(filterInfo.type) {
    case 'Collection Filter':
      return (
        <FilterCollections data={filterInfo.data}
                           parentId={parentId}
                           onClose={handleClosed} 
                           onChange={handleChanged}/>

      );
    case 'Day of Week Filter':
      return (
        <FilterDayOfWeek data={filterInfo.data}
                         parentId={parentId}
                         onClose={handleClosed} 
                         onChange={handleChanged}/>

      );
    case 'Elevation Filter':
      return (
        <FilterElevation data={filterInfo.data}
                         onClose={handleClosed} 
                         onChange={handleChanged}/>

      );
    case 'End Date Filter':
      return (
          <FilterDate data={filterInfo.data}
                      title='End Date Filter'
                      onClose={handleClosed} 
                      onChange={handleChanged}/>
      );
    case 'Hour Filter':
      return (
          <FilterHour data={filterInfo.data}
                      parentId={parentId}
                      onClose={handleClosed} 
                      onChange={handleChanged}/>
      );
    case 'Location Filter':
      return (
          <FilterLocations data={filterInfo.data}
                         parentId={parentId}
                         onClose={handleClosed} 
                         onChange={handleChanged}/>
      );
    case 'Month Filter':
      return (
          <FilterMonth data={filterInfo.data}
                       parentId={parentId}
                       onClose={handleClosed} 
                       onChange={handleChanged}/>
      );
    case 'Species Filter':
      return (
          <FilterSpecies data={filterInfo.data}
                         parentId={parentId}
                         onClose={handleClosed} 
                         onChange={handleChanged}/>
      );
    case 'Start Date Filter':
      return (
          <FilterDate data={filterInfo.data}
                      title='Start Date Filter'
                      onClose={handleClosed} 
                      onChange={handleChanged}/>
      );
    case 'Year Filter':
      return (
          <FilterYear data={filterInfo.data}
                      onClose={handleClosed} 
                      onChange={handleChanged}/>
      );
    default:
      console.error('ERROR: attempting to use an unknown filter:', filterInfo.type);
      break;
  }

  return null;
}

FilterTile.propTypes = {
  filterInfo: PropTypes.shape({
    id:   PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    data: PropTypes.any,
  }).isRequired,
  parentId:  PropTypes.string.isRequired,
  onChanged: PropTypes.func.isRequired,
  onRemove:  PropTypes.func.isRequired,
};
