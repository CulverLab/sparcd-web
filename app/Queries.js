/** @module Queries */

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import { v4 as uuidv4 } from 'uuid';

import PropTypes from 'prop-types';

import QueryFilters from './queries/QueryFilters';
import { FilterCollectionsFormData } from './queries/FilterCollections';
import { FilterDateFormData } from './queries/FilterDate';
import { FilterDayOfWeekFormData } from './queries/FilterDayOfWeek';
import { FilterElevationsFormData } from './queries/FilterElevation';
import { FilterHourFormData } from './queries/FilterHour';
import { FilterLocationsFormData } from './queries/FilterLocations';
import { FilterMonthFormData } from './queries/FilterMonth';
import { FilterSpeciesFormData } from './queries/FilterSpecies';
import { FilterYearFormData } from './queries/FilterYear';
import QueryResults from './queries/QueryResults';
import * as utils from './utils';

import { Level } from './components/Messages';
import { AddMessageContext, TokenExpiredFuncContext, LocationsInfoContext, SizeContext, SpeciesInfoContext, 
         SpeciesOtherNamesContext, TokenContext } from './serverInfo';

const QUERY_RESULTS_SHOW_DELAY_SEC = 5;   // Minimum delay before showing the results

/**
 * Provides the UI for queries
 * @function
 * @param {boolean} loadingCollections Indicates if collections are being loaded
 * @returns {object} The UI for generating queries
 */
export default function Queries({loadingCollections}) {
  const theme = useTheme();
  const dividerRef = React.useRef();   // Used for sizeing
  const expandCollapseRef = React.useRef();   // Used for sizeing
  const queryActionsRef = React.useRef(null);         // For access to the query actions element
  const queryCancelledRef = React.useRef(false);        // Indicates the user want to cancel the query
  const queryIntervalRef = React.useRef(60);   // The current interval value
  const serverURLRef = React.useRef(utils.getServer());
  const addMessage = React.useContext(AddMessageContext); // Function adds messages for display
  const locationItems = React.useContext(LocationsInfoContext); // Locations
  const queryToken = React.useContext(TokenContext);  // Login token
  const setTokenExpired = React.useContext(TokenExpiredFuncContext);
  const speciesItems = React.useContext(SpeciesInfoContext);  // Species
  const speciesOtherItems = React.useContext(SpeciesOtherNamesContext); // Unofficial species
  const uiSizes = React.useContext(SizeContext);  // UI Dimensions
  const actionScrollTimeoutRef = React.useRef(null);    // Used to make sure the add filter is alawys in view
  const [dividerHeight, setDividerHeight] = React.useState(20); // Used to size controls
  const [expandCollapseWidth, setExpandCollapseWidth] = React.useState(24);
  const [filters, setFilters] = React.useState([]); // Stores filter information
  const [isExpanded, setIsExpanded] = React.useState(false); // Used to indicate the filters are expanded
  const [queryResults, setQueryResults] = React.useState(null); // Used to store query results
  const [waitingOnQuery, setWaitingOnQuery] = React.useState(null);  // Used for managing queries and the UI
  const [workspaceWidth, setWorkspaceWidth] = React.useState(640);  // Default value is recalculated at display time

  const activeQueryRef = React.useRef(null);

  let mergedSpecies = React.useMemo(() => [].concat(speciesItems).concat(speciesOtherItems ? speciesOtherItems : []), [speciesItems,speciesOtherItems]);

  // Recalcuate available space in the window
  React.useLayoutEffect(() => {
    setWorkspaceWidth(uiSizes.workspace.width);

    if (expandCollapseRef && expandCollapseRef.current) {
      const curRect = expandCollapseRef.current.getBoundingClientRect();
      setExpandCollapseWidth(curRect.width);
    }

    if (dividerRef && dividerRef.current) {
      const curRect = dividerRef.current.getBoundingClientRect();
      setDividerHeight(curRect.height);
    }
  }, [uiSizes]);

  /**
   * Adds a new filter to the list of filters
   * @function
   * @param {string} filterChoice The choice of filter to add
   * @param {function} [onComplete] Function to call upon completions of the filter add
   */
  const addFilter = React.useCallback((filterChoice, onComplete) => {

    window.setTimeout(() => {
      // Add the new filter to the array of filters
      const newFilter = {type:filterChoice, id:uuidv4(), data:null}

      // Set the timeout to remove the spinner and update the UI
      setFilters(prev => [...prev, newFilter]);
      onComplete?.();
    });
}, []);

  /**
   * Removes a filter from the list
   * @function
   * @param {string} filterId The unique ID of the filter to remove
   */
  const removeFilter = React.useCallback((filterId) => {
    setFilters(prev => prev.filter((item) => item.id !== filterId));

  }, []);

  /**
   * Called when the data for a filter is changed
   * @function
   * @param {string} filterId The ID of the filter to update
   * @param {object} filterData The new filter data to save
   */
  const handleFilterChange = React.useCallback((filterId, filterData) => {
    setFilters(prev => {
      const filterIdx = prev.findIndex((item) => item.id === filterId);
      return filterIdx > -1 ? prev.map((item, idx) => idx === filterIdx ? {...item, data:filterData} : item) : prev;
    });
  }, []);

  /**
   * Handles adding a new filter when a filter is double-clicked
   * @function
   * @param {string} filterChoice The filter name that is to be added
   * @param {function} [onAccepted] Function to call once the filter is accepted
   * @param {function} [onComplete] Function to call upon completions of the filter add
   */
  const handleFilterAccepted = React.useCallback((filterChoice, onAccepted, onComplete) => {

    // Set the timeout to add the filter and update the UI
    window.setTimeout(() => { addFilter(filterChoice, onComplete);
                              onAccepted?.();
                            }, 100);
  }, [addFilter]);

  /**
   * Handles the expansion and collapse of the filter and results areas
   * @function
   */
  const handleExpandCollapse = React.useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  /**
   * Fills in the form data for all of the user's filters
   * @function
   * @param {array} queryFilters The array of filter information to use to fill in the FormData
   * @returns {object} Returns a new FormData with the filters added
   */
  const getQueryFormData = React.useCallback((queryFilters) => {
    let formData = new FormData();

    for (const filter of queryFilters) {
      switch(filter.type) {
        case 'Species Filter':
          FilterSpeciesFormData(filter.data, formData, mergedSpecies);
          break;
        case 'Location Filter':
          FilterLocationsFormData(filter.data, formData, locationItems);
          break;
        case 'Elevation Filter':
          FilterElevationsFormData(filter.data, formData);
          break;
        case 'Year Filter':
          FilterYearFormData(filter.data, formData);
          break;
        case 'Month Filter':
          FilterMonthFormData(filter.data, formData);
          break;
        case 'Hour Filter':
          FilterHourFormData(filter.data, formData);
          break;
        case 'Day of Week Filter':
          FilterDayOfWeekFormData(filter.data, formData);
          break;
        case 'Start Date Filter':
          FilterDateFormData('startDate', filter.data, formData);
          break;
        case 'End Date Filter':
          FilterDateFormData('endDate', filter.data, formData);
          break;
        case 'Collection Filter':
          FilterCollectionsFormData(filter.data, formData);
        break;
      }
    }

    return formData;
  }, [mergedSpecies, locationItems]);

  /**
   * Makes the call to get the query data and saves the results
   * @function
   */
  const handleQuery = React.useCallback(() => {
    const queryUrl = serverURLRef.current + '/query?t=' + encodeURIComponent(queryToken) + "&i=" + "60";
    const formData = getQueryFormData(filters);
    const queryId = Date.now();

    console.log('QUERY');

    // Setup the UI for the query 
    setWaitingOnQuery(queryId);
    queryCancelledRef.current = false;
    activeQueryRef.current = queryId;

    // Make the query
    try {
      fetch(queryUrl, {
        credentials: 'include',
        method: 'POST',
        body: formData
      })
      .then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401) {
              // User needs to log in again
              setTokenExpired();
            }
            throw new Error(`Failed to complete query: ${resp.status}: ${await resp.text()}`);
          }
      })
      .then((respData) => {
        // Check if this has been cancelled
        if (queryCancelledRef.current === true) {
          queryCancelledRef.current = false;
          return;
        }
        // TODO: handle no results
        console.log('QUERY:',respData);
        if (activeQueryRef.current === queryId && Object.keys(respData).length > 0) {
          const time_diff_sec = (Date.now() - queryId) / 1000.0;
          if (Math.round(time_diff_sec) >= QUERY_RESULTS_SHOW_DELAY_SEC) {
            setQueryResults(respData);
            setIsExpanded(false);
            setWaitingOnQuery(null);
          } else  {
            const remaining = QUERY_RESULTS_SHOW_DELAY_SEC - time_diff_sec;
            window.setTimeout(() => {setQueryResults(respData);setIsExpanded(false);setWaitingOnQuery(null);}, remaining * 1000);
          }
          activeQueryRef.current = null;
        } else {
          if (Object.keys(respData).length <= 0) {
            addMessage(Level.Information, 'The query returned no results. Please adjust your query and try again');
          }
          activeQueryRef.current = null;
          setWaitingOnQuery(null);
        }
      })
      .catch(function(err) {
        console.log('CATCH ERROR: ',err);
        if (activeQueryRef.current === queryId) {
          activeQueryRef.current = null;
          setWaitingOnQuery(null);
          addMessage(Level.Error, 'An error was detected while executing the query', 'Query Error Detected');
        }
      });
    } catch (error) {
      console.log('HAVE ERROR:', error);
      if (activeQueryRef.current === queryId) {
        activeQueryRef.current = null;
        setWaitingOnQuery(null);
        addMessage(Level.Error, 'An error occurred while executing the query', 'Query Error');
      }
    }
  }, [addMessage, filters, getQueryFormData, queryToken]);

  /**
   * Handles cancelling a query
   * @function
   */
  const cancelQuery = React.useCallback(() => {
    setWaitingOnQuery(null);
    queryCancelledRef.current = true;
  }, []);

  /**
   * Function to handle the change to the query interval
   * @function
   * @param {string} val The updated value
   */
  const handleIntervalChanged = React.useCallback((val) => {
    queryIntervalRef.current = val;
  }, []);

  /**
   * Handles the user downloading information
   * @function
   * @param {string} tabId The tab name to download
   */
  const handleDownload = React.useCallback((tabId) => {
    const downloadUrl =  serverURLRef.current + '/query_dl?t=' + encodeURIComponent(queryToken) + '&q=' + encodeURIComponent(tabId) + 
                                                                '&d=' + encodeURIComponent(queryResults['downloads'][tabId]);
    const element = document.createElement('a');
    element.setAttribute('href', downloadUrl);
    element.setAttribute('download', queryResults['downloads'][tabId]);
    element.setAttribute('rel','noopener');
    //element.setAttribute('target','_blank');

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
  }, [queryResults, queryToken]);

  // Set a timer to have new panels scroll into view
  React.useLayoutEffect(() => {
    if (queryActionsRef.current && actionScrollTimeoutRef.current === null) {
      actionScrollTimeoutRef.current = window.setTimeout(() => {
                                          actionScrollTimeoutRef.current = null;
                                          queryActionsRef.current.scrollIntoView({ behavior:'smooth', inline:'nearest'})
                                        }, 10);
    }
  }, [filters]);

  // Return the UI
  const curHeight = queryResults && isExpanded === false ? 100 : Math.max(320, uiSizes.workspace.height * 0.80);
  return (
    <Box id='queries-workspace-wrapper' sx={{ flexGrow: 1, 'width': '100vw', position:'relative'}} >
      <QueryFilters actionsRef={queryActionsRef}
                    workingWidth={workspaceWidth}
                    workingHeight={curHeight}
                    filters={filters}
                    filterChanged={handleFilterChange}
                    filterRemove={removeFilter} 
                    filterAdd={handleFilterAccepted}
                    queryInterval={queryIntervalRef.current}
                    intervalChanged={handleIntervalChanged}
                    onQuery={handleQuery}
      />
      <Grid id="queries-workspace-divider" ref={dividerRef} container direction="row" sx={{justifyContent:'start', alignItems:'center', spacing:2, paddingLeft:'10px'}} >
        <span style={{border:'1px solid lightgrey',height:'0px',minWidth:'40px',width:((workspaceWidth - expandCollapseWidth) / 2.0) - 10 + 'px'}} />
        <Typography ref={expandCollapseRef} variant="body" onClick={handleExpandCollapse} sx={{ color:queryResults ? 'grey' : 'lightgrey', fontSize:'1.5em', 
                    transform:isExpanded ? 'rotate(-90deg)' : 'rotate(90deg)', margin:'0px 2px 0px 5px', cursor:queryResults ? 'pointer' : 'default' }}>
          &raquo;
        </Typography>
        <span style={{border:'1px solid lightgrey',height:'0px',minWidth:'40px',width:((workspaceWidth - expandCollapseWidth) / 2.0) - 10 + 'px'}} />
      </Grid>
      <Grid container id="query-results-wrapper" direction="row" alignItems="start" justifyContent="start" wrap="nowrap"
            spacing={2}
            sx={{minHeight:(uiSizes.workspace.height-curHeight-dividerHeight-10), maxHeight:(uiSizes.workspace.height-curHeight-dividerHeight-10),
                 backgroundColor:'white', margin:0, overflow:'clip', padding:'5px'}}
      >
      { queryResults && 
        <QueryResults results={queryResults}
                      maxHeight={uiSizes.workspace.height-curHeight-dividerHeight-10}
                      onDownload={handleDownload}
        />
      }
      </Grid>
      { loadingCollections && 
          <Grid id="query-loading-collections-wrapper" container direction="row" alignItems="center" justifyContent="center" 
                sx={{position:'absolute', top:0, left:0, width:'100vw', height:uiSizes.workspace.height, backgroundColor:'rgb(0,0,0,0.5)', zIndex:11111}}
          >
            <div style={{backgroundColor:'rgb(0,0,0,0.8)', border:'1px solid grey', borderRadius:'15px', padding:'25px 10px'}}>
              <Grid container direction="column" alignItems="center" justifyContent="center" >
                  <Typography gutterBottom variant="body2" color="lightgrey">
                    Loading collections, please wait...
                  </Typography>
                  <CircularProgress variant="indeterminate" />
                  <Typography gutterBottom variant="body2" color="lightgrey">
                    This may take a while
                  </Typography>
              </Grid>
            </div>
          </Grid>
      }
      { waitingOnQuery && 
          <Grid id="query-running-query-wrapper" container direction="row" alignItems="center" justifyContent="center" 
                sx={{position:'absolute', top:0, left:0, width:'100vw', height:uiSizes.workspace.height, backgroundColor:'rgb(0,0,0,0.5)', zIndex:11111}}
          >
            <div style={{backgroundColor:'rgb(0,0,0,0.8)', border:'1px solid grey', borderRadius:'15px', padding:'25px 10px'}}>
              <Grid container direction="column" alignItems="center" justifyContent="center" >
                  <Typography gutterBottom variant="body2" color="lightgrey">
                    Working on your query, please wait...
                  </Typography>
                  <CircularProgress variant="indeterminate" />
                  <Box>
                    <Button sx={{'flex':'1'}} size="small" onClick={cancelQuery} >Cancel</Button>
                  </Box>
              </Grid>
            </div>
          </Grid>
      }
    </Box>
  );
}

Queries.propTypes = {
  loadingCollections: PropTypes.bool.isRequired,
};
