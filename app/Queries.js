/** @module Queries */

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { DataGrid, useGridApiRef } from '@mui/x-data-grid';
import DownloadForOfflineOutlinedIcon from '@mui/icons-material/DownloadForOfflineOutlined';
import ExpandLessOutlinedIcon from '@mui/icons-material/ExpandLessOutlined';
import ExpandMoreOutlinedIcon from '@mui/icons-material/ExpandMoreOutlined';
import Grid from '@mui/material/Grid';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Tooltip from '@mui/material/Tooltip';
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
import * as utils from './utils';

import { Level } from './components/Messages';
import { AddMessageContext, TokenExpiredFuncContext, LocationsInfoContext, SizeContext, SpeciesInfoContext, 
         SpeciesOtherNamesContext, TokenContext, UserSettingsContext } from './serverInfo';

/**
 * Provides the UI for queries
 * @function
 * @param {boolean} loadingCollections Indicates if collections are being loaded
 * @returns {object} The UI for generating queries
 */
export default function Queries({loadingCollections}) {
  const QUERY_RESULTS_SHOW_DELAY_SEC = 5
  const theme = useTheme();
  const apiRef = useGridApiRef(); // TODO: Auto size columns of grids using this api
  const dividerRef = React.useRef();   // Used for sizeing
  const expandCollapseRef = React.useRef();   // Used for sizeing
  const queryInterval = React.useRef(60);   // The current interval value
  const addMessage = React.useContext(AddMessageContext); // Function adds messages for display
  const locationItems = React.useContext(LocationsInfoContext); // Locations
  const queryToken = React.useContext(TokenContext);  // Login token
  const setTokenExpired = React.useContext(TokenExpiredFuncContext);
  const speciesItems = React.useContext(SpeciesInfoContext);  // Species
  const speciesOtherItems = React.useContext(SpeciesOtherNamesContext); // Unofficial species
  const uiSizes = React.useContext(SizeContext);  // UI Dimensions
  const userSettings = React.useContext(UserSettingsContext);  // User display settings
  const [activeTab, setActiveTab] = React.useState(0);
  const [dividerHeight, setDividerHeight] = React.useState(20); // Used to size controls
  const [expandCollapseWidth, setExpandCollapseWidth] = React.useState(24);
  const [filters, setFilters] = React.useState([]); // Stores filter information
  const [filterHeight, setFilterHeight] = React.useState(240); // Used to force redraw when new filter added
  const [isExpanded, setIsExpanded] = React.useState(false); // Used to indicate the filters are expanded
  const [queryCancelled, setQueryCancelled] = React.useState(false); // Used to indicate the user cancelled the query
  const [queryRedraw, setQueryRedraw] = React.useState(null); // Used to force redraw when new filter added
  const [queryResults, setQueryResults] = React.useState(null); // Used to store query results
  const [serverURL, setServerURL] = React.useState(utils.getServer());  // The server URL to use
  const [totalHeight, setTotalHeight] = React.useState(null);  // Default value is recalculated at display time
  const [waitingOnQuery, setWaitingOnQuery] = React.useState(null);  // Used for managing queries and the UI
  const [windowSize, setWindowSize] = React.useState({width: 640, height: 480});  // Default values are recalculated at display time
  const [workingTop, setWorkingTop] = React.useState(null);    // Default value is recalculated at display time
  const [workspaceWidth, setWorkspaceWidth] = React.useState(640);  // Default value is recalculated at display time

  let activeQuery = null;

  let mergedSpecies = React.useMemo(() => [].concat(speciesItems).concat(speciesOtherItems ? speciesOtherItems : []), [speciesItems,speciesOtherItems]);

  /**
   * Updates fields when a new tab is selected for display
   * @function
   * @param {object} event The triggering event object
   * @param {object} newValue The new tab value
   */
  function handleTabChange(event, newValue) {
    setActiveTab(newValue);
  }

  // Recalcuate available space in the window
  React.useLayoutEffect(() => {
    setWindowSize(uiSizes.window);
    setWorkspaceWidth(uiSizes.workspace.width);
    setTotalHeight(uiSizes.workspace.height);
    setWorkingTop(uiSizes.workspace.top);

    if (expandCollapseRef && expandCollapseRef.current) {
      const curRect = expandCollapseRef.current.getBoundingClientRect();
      setExpandCollapseWidth(curRect.width);
    }

    if (dividerRef && dividerRef.current) {
      const curRect = dividerRef.current.getBoundingClientRect();
      setDividerHeight(curRect.height);
    }
  }, [uiSizes, expandCollapseRef, dividerRef]);

  /**
   * Adds a new filter to the list of filters
   * @function
   */
  function addFilter(filterChoice) {
    // Get the filter elements we need to access
    let elFilter = document.getElementById('query-filter-selection-wrapper');
    if (!elFilter) {
      return;
    }
    // Show the spinner until the new filter is added
    let elFilterWait = document.getElementById("query-filter-selection-waiting");
    if (elFilterWait) {
      if (elFilter.style.visibility === 'visible') {
        elFilterWait.style.visibility = 'visible';
      }
    }

    // Add the new filter to the array of filters
    const newFilter = {type:filterChoice, id:uuidv4(), data:null}
    const allFilters = filters;
    allFilters.push(newFilter);

    // Set the timeout to remove the spinner and update the UI
    window.setTimeout(() => {
                  elFilter.style.visibility = 'hidden';
                  if (elFilterWait) {
                    elFilterWait.style.visibility = 'hidden';
                  }

                  setFilters(allFilters);
                  setQueryRedraw(newFilter.id);
                });
  }

  /**
   * Removes a filter from the list
   * @function
   * @param {string} filterId The unique ID of the filter to remove
   */
  const removeFilter = React.useCallback((filterId) => {
    const remainingFilters = filters.filter((item) => item.id != filterId);
    setFilters(remainingFilters);

    setQueryRedraw(uuidv4());
  }, [filters, setFilters, setQueryRedraw]);

  /**
   * Called when the data for a filter is changed
   * @function
   * @param {string} filterId The ID of the filter to update
   * @param {object} filterData The new filter data to save
   */
  const handleFilterChange = React.useCallback((filterId, filterData) => {
    const filterIdx = filters.findIndex((item) => item.id === filterId);
    if (filterIdx > -1) {
      const curFilters = filters;
      curFilters[filterIdx].data = filterData;
      setFilters(curFilters);
    }
  }, [filters, setFilters]);

  /**
   * Handles adding a new filter when a filter is double-clicked
   * @function
   * @param {string} filterChoice The filter name that is to be added
   */
  const handleFilterAccepted = React.useCallback((filterChoice) => {
    let elFilter = document.getElementById('query-filter-selection-wrapper');
    // Show the wait spinner
    let elFilterWait = document.getElementById("query-filter-selection-waiting");
    if (elFilter && elFilterWait) {
      if (elFilter.style.visibility === 'visible') {
        elFilterWait.style.visibility = 'visible';
      }
    }
    // Set the timeout to add the filter and update the UI
    window.setTimeout(() => { addFilter(filterChoice);
                              if (elFilterWait) {
                                elFilterWait.style.visibility = 'hidden';
                              }
                            }, 100);
  }, [addFilter]);

  /**
   * Handles the expansion and collapse of the filter and results areas
   * @function
   */
  function handleExpandCollapse() {
    setIsExpanded(!isExpanded);
  }

  /**
   * Fills in the form data for all of the user's filters
   * @function
   * @param {array} queryFilters The array of filter information to use to fill in the FormData
   * @returns {object} Returns a new FormData with the filters added
   */
  function getQueryFormData(queryFilters) {
    let formData = new FormData();

    for (const filterIdx in queryFilters) {
      const filter = queryFilters[filterIdx];
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
  }

  /**
   * Makes the call to get the query data and saves the results
   * @function
   */
  const handleQuery = React.useCallback(() => {
    const queryUrl = serverURL + '/query?t=' + encodeURIComponent(queryToken) + "&i=" + "60";
    const formData = getQueryFormData(filters);
    const queryId = Date.now();

    console.log('QUERY');

    // Setup the UI for the query 
    setWaitingOnQuery(queryId);
    setQueryRedraw(queryId);
    activeQuery = queryId;

    // Make the query
    try {
      const resp = fetch(queryUrl, {
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
            throw new Error(`Failed to complete query: ${resp.status}`, {cause:resp});
          }
      })
      .then((respData) => {
        // TODO: handle no results
        console.log('QUERY:',respData);
        if (activeQuery === queryId && Object.keys(respData).length > 0) {
          const time_diff_sec = (waitingOnQuery - Date.now()) / 1000.0;
          if (Math.round(time_diff_sec) < QUERY_RESULTS_SHOW_DELAY_SEC) {
            setQueryResults(respData);
            setIsExpanded(false);
          } else  {
            window.setTimeout(() => setQueryResults(respData), time_diff_sec * 1000);
          }
          activeQuery = null;
          setWaitingOnQuery(null);
        } else {
          if (Object.keys(respData).length <= 0) {
            addMessage(Level.Information, 'The query returned no results. Please adjust your query and try again');
          }
          activeQuery = null;
          setWaitingOnQuery(null);
        }
      })
      .catch(function(err) {
        console.log('CATCH ERROR: ',err);
        if (activeQuery === queryId) {
          activeQuery = null;
          setWaitingOnQuery(null);
          addMessage(Level.Error, 'An error was detected while executing the query', 'Query Error Detected');
        }
      });
    } catch (error) {
      console.log('HAVE ERROR:', error);
      if (activeQuery === queryId) {
        activeQuery = null;
        setWaitingOnQuery(null);
        addMessage(Level.Error, 'An error ocurred while executing the query', 'Query Error');
      }
    }
  }, [activeQuery, addMessage, getQueryFormData, queryToken, serverURL, setIsExpanded, setQueryRedraw, setQueryResults,
                                                                    setWaitingOnQuery, waitingOnQuery, QUERY_RESULTS_SHOW_DELAY_SEC]);

  /**
   * Handles cancelling a query
   * @function
   */
  const cancelQuery = React.useCallback(() => {
    setWaitingOnQuery(null);
    setQueryCancelled(true);
  }, [setQueryCancelled, setWaitingOnQuery]);

  /**
   * Internal TabPanel element type
   * @function
   * @param {object} props The properties of the TabPanel element
   * @returns {object} Returns the UI for the TabPanel
   */
  function TabPanel(props) {
    const { children, value, index, ...other } = props;

    return (
      <div
        role="tabpanel"
        hidden={value !== index}
        id={`query-results-tabpanel-${index}`}
        aria-labelledby={`query-results-${index}`}
        {...other}
      >
      {value === index && (
        <Box id='tabpanel-box'>
          {children}
        </Box>
      )}
      </div>
    );
  }

  // Define the types of the properties accepted by the TabPanel
  TabPanel.propTypes = {
    children: PropTypes.node,
    index: PropTypes.number.isRequired,
    value: PropTypes.number.isRequired,
  };

  /**
   * Returns the a11y properties for a tab control
   * @function
   * @param {integer} index The index of the tab
   * @returns {object} The properties to use for the tab
   */
  function a11yPropsTabPanel(index) {
    return {
      id: `query-results-${index}`,
      'aria-controls': `query-results-${index}`,
    };
  }

  /**
   * Handles the user downloading information
   * @function
   * @param {string} tabId The tab name to download
   */
  const handleDownload = React.useCallback((tabId) => {
    const downloadUrl =  serverURL + '/query_dl?t=' + encodeURIComponent(queryToken) + '&q=' + encodeURIComponent(tabId) + 
                                                                '&d=' + encodeURIComponent(queryResults['downloads'][tabId]);
    var element = document.createElement('a');
    element.setAttribute('href', downloadUrl);
    element.setAttribute('download', queryResults['downloads'][tabId]);
    element.setAttribute('rel','noopener');
    //element.setAttribute('target','_blank');

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
  }, [queryResults, queryToken, serverURL]);

  /**
   * Generates a panel for displaying the query results based upon different tabs
   * @function
   * @param {object} queryResults The results of the performed query
   * @param {string} tabName The unique identifier of the tab to generate the panel for
   * @param {integer} tabIndex The relative index of the tab
   * @returns {object} The panel UI to render
   */ 
  function generateResultPanel(queryResults, tabName, tabIndex) {

      // Generate a textarea to display the results if we aren't generating a data grid
    if (queryResults.columns[tabName] == undefined) {
      return (
          <textarea id={'query-results-'+tabName} readOnly wrap="off"
            style={{resize:"none", fontFamily:'monospace', fontSize:'small', fontWeight:'lighter', 
                    position:'absolute', left:0, top:0, right:0, bottom:0, padding:'5px 5px 10px 5px'}}
            value={queryResults[tabName]}
          />
      );
    }

    // Generate a DataGrid to display the results
    let colTitles = queryResults.columns[tabName];
    let colData = queryResults[tabName];
    let curData = colData;
    let columnGroupings = undefined;

    // Check for column modifications
    if (queryResults.columsMods[tabName] !== undefined) {
      const colModInfo = queryResults.columsMods[tabName];

      // Create a copy so that the original is unmodified
      colTitles = JSON.parse(JSON.stringify(colTitles));

      // First level of processing modifiers
      for (const oneMod of colModInfo) {
        // Location information display specifics.
        switch (oneMod['type']) {
          case 'hasLocations':
              {
                let displayCoordSystem = 'LATLON';
                if (userSettings['coordinatesDisplay']) {
                  displayCoordSystem = userSettings['coordinatesDisplay'];
                }
                const sourceKey = oneMod[displayCoordSystem];
                const targetKey = oneMod['target'];

                // Remove all other possible column targets from the tiles
                for (const oneKey of Object.keys(oneMod)) {
                  const unwanted = oneMod[oneKey]
                  if (colTitles[unwanted] !== undefined && unwanted !== sourceKey) {
                    delete colTitles[unwanted];
                  }
                }

                // Get the information from the source and rename it to the target
                const oldInfo = colTitles[sourceKey];
                delete colTitles[sourceKey];
                if (targetKey !== null) {
                  colTitles[targetKey] = oldInfo;
                } else {
                  for (const oneKey of Object.keys(oldInfo)) {
                    colTitles[oneKey] = oldInfo[oneKey];
                  }
                }
              }
              break;
        }
      }

      // Second level of processing modifiers
      for (const oneMod of colModInfo) {
        switch (oneMod['type']) {
          case 'hasElevation':
              {
                let displayMeasure = 'meters';
                if (userSettings['measurementFormat']) {
                  displayMeasure = userSettings['measurementFormat'];
                }
                const newKey = oneMod[displayMeasure];
                const targetKey = oneMod['target'];
                const parentKey = oneMod['parent'];

                let modData = colTitles;
                if (parentKey) {
                  modData = colTitles[parentKey];
                }

                // Get the information from the source and rename it to the target
                if (newKey !== targetKey) {
                  const oldInfo = modData[targetKey];
                  delete modData[targetKey];
                  modData[newKey] = oldInfo;
                }
              }
              break;

            case 'date':
              {
                let dateFormat = 'ISO';
                let timeFormat = '24s'
                if (userSettings['dateFormat']) {
                  dateFormat = userSettings['dateFormat'];
                }
                if (userSettings['timeFormat']) {
                  timeFormat = userSettings['timeFormat'];
                }

                // If the date format is ISO we don't have anything to do
                if (dateFormat === 'ISO') {
                  break;
                }

                // Update the titles
                const sourceKey = oneMod['source'];
                const targetKey = oneMod['target'];
                const parentKey = oneMod['parent'];

                let modData = colTitles;
                if (parentKey) {
                  modData = colTitles[parentKey];
                }

                // If the time and date haven't changed from when the query was generated,
                // use what was returned
                if (dateFormat === oneMod['settingsDate'] && timeFormat === oneMod['settingsTime']) {
                  const oldInfo = modData[sourceKey];
                  delete modData[sourceKey];
                  modData['dateDefault'] = oldInfo;
                } else {
                  // We need to synthesize the date and time
                  if (sourceKey !== targetKey) {
                    const oldInfo = modData[sourceKey];
                    delete modData[sourceKey];
                    modData[targetKey] = oldInfo;
                  }

                  const dateKey = 'date' + dateFormat;
                  const timeKey = 'time' + timeFormat;

                  curData = curData.map((row, rowIdx) => {let rowAdd = {}; rowAdd[targetKey] = row[dateKey] + ' ' + row[timeKey];return {...rowAdd, ...row};});
                }
              }
              break;
        }
      }
    }

    let keys = Object.keys(colTitles);
    let curTitles = keys.map((name, idx) => {return {field:name, headerName:colTitles[name]}});

    if (keys.find((item) => item === 'id') == undefined) {
      curData = curData.map((row, rowIdx) => {return {id:rowIdx, ...row}});
    }

    // Check if we have column groupings and regenerate/update variables if we do
    if (keys.find((item) => typeof(colTitles[item]) === 'object' && !Array.isArray(colTitles[item])) != undefined) {
      let newKeys = [];
      let newTitles = [];
      columnGroupings = [];
      for (const curKey in colTitles) {
        if (typeof(colTitles[curKey]) === 'object' && !Array.isArray(colTitles[curKey])) {
          const curGroup = colTitles[curKey];
          const curKeys = Object.keys(curGroup);
          columnGroupings.push({groupId:curGroup['title'],
                                children:curKeys.map((curKey) => curKey !== 'title' && {field:curKey})
                                          .filter((child) => child !== false)
                               });
          newKeys = [...newKeys, ...(curKeys.map((curKey) => curKey !== 'title' && curGroup[curKey])
                                            .filter((item) => item !== false))
                    ];
          newTitles = [...newTitles, ...(curKeys.map((curKey) => curKey !== 'title' && {field:curKey, headerName:curGroup[curKey]})
                                                .filter((item) => item !== false))
                      ];
        } else {
          // Don't add to groupings
          //columnGroupings.push({groupId:colTitles[curKey],children:[{field:curKey}]});
          newKeys.push(curKey);
          newTitles.push({field:curKey, headerName:colTitles[curKey]});
        }
      }

      keys = newKeys;
      curTitles = newTitles;
    }

    return (
      <DataGrid columns={curTitles} rows={curData} disableRowSelectionOnClick 
                autosizeOptions={{
                    columns: keys,
                    includeOutliers: true,
                    includeHeaders: true,
                    outliersFactor: 1,
                    expand: true,
                  }}
                columnGroupingModel={columnGroupings}
      />
    );
  }

  /**
   * Generates the UI for displaying query results
   * @param {object} queryResults The results of a query to display
   * @returns {object} The UI of the query results
   */
  function generateQueryResults(queryResults, maxHeight) {
    const tabsOrder = userSettings.sandersonOutput ? queryResults.tabs.order : queryResults.tabs.order.filter((item) => !item.includes('DrSanderson'));
    return (
      <Grid container size="grow" alignItems="start" justifyContent="start">
        <Grid size={2}  sx={{backgroundColor:"#EAEAEA", height:maxHeight+'px'}}>
          <Tabs id='query-results-tabs' value={activeTab} onChange={handleTabChange} aria-label="Query results" orientation="vertical" variant="scrollable"
                scrollButtons={false} style={{overflow:'scroll', maxHeight:'100%'}}>
          { tabsOrder.map((item, idx) => {
              return (
                <Tab label={
                          <Grid container direction="row" alignItems="center" justifyContent="center">
                            <Grid>
                              <Typography gutterBottom variant="body2">
                                {queryResults.tabs[item]}
                              </Typography>
                            </Grid>
                            <Tooltip title={'Download CSV of '+queryResults.tabs[item]}>
                              <div onClick={() => handleDownload(item)} style={{marginLeft:'auto'}}>
                                <Grid sx={{borderRadius:'5px','&:hover':{backgroundColor:'rgba(0,0,255,0.05)'} }}>
                                  <DownloadForOfflineOutlinedIcon sx={{padding:'5px'}} />
                                </Grid>
                              </div>
                            </Tooltip>
                          </Grid>
                         }
                   key={item} {...a11yPropsTabPanel(idx)} sx={{'&:hover':{backgroundColor:'rgba(0,0,0,0.05)'} }}
                />
                )
            })
          }
          </Tabs>
        </Grid>
        <Grid size={10} sx={{overflowX:'scroll',display:'flex'}}>
          { tabsOrder.map((item, idx) => {
              return (
                <TabPanel id={'query-result-panel-'+item} value={activeTab} index={idx} key={item+'-'+idx} 
                          style={{overflow:'scroll', width:'100%', position:'relative',margin:'0 16px auto 8px', height:(maxHeight-20)+'px'}}>
                  {generateResultPanel(queryResults, item, idx)}
                </TabPanel>
              )}
            )
          }
        </Grid>
      </Grid>
    );
  }

  // Set a time to have new panels scroll into view
  const elActions = document.getElementById('queries-actions');
  if (elActions && filters) {
    window.setTimeout(() => elActions.scrollIntoView({ behavior:'smooth', inline:'nearest'}), 10);
  }

  // Return the UI
  const curHeight = queryResults && isExpanded === false ? 100 : Math.max(320, uiSizes.workspace.height * 0.80);//((totalHeight || 480) / 2.0) + 'px';
  return (
    <Box id='queries-workspace-wrapper' sx={{ flexGrow: 1, 'width': '100vw', position:'relative'}} >
      <QueryFilters workingWidth={workspaceWidth} workingHeight={curHeight} filters={filters}
                    filterChanged={handleFilterChange} filterRemove={removeFilter} filterAdd={handleFilterAccepted}
                    queryInterval={queryInterval.current} intervalChanged={(val) => queryInterval.current = val}
                    onQuery={handleQuery} />
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
            sx={{minHeight:(uiSizes.workspace.height-curHeight-dividerHeight-10)+"px", maxHeight:(uiSizes.workspace.height-curHeight-dividerHeight-10)+"px",
                 backgroundColor:'white', margin:0, overflow:'clip', padding:'5px'}}
      >
      { queryResults ? generateQueryResults(queryResults, uiSizes.workspace.height-curHeight-dividerHeight-10)  : null }
      </Grid>
      { loadingCollections && 
          <Grid id="query-loading-collections-wrapper" container direction="row" alignItems="center" justifyContent="center" 
                sx={{position:'absolute', top:0, left:0, width:'100vw', height:'100vh', backgroundColor:'rgb(0,0,0,0.5)', zIndex:11111}}
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
                sx={{position:'absolute', top:0, left:0, width:'100vw', height:uiSizes.workspace.height+'px', backgroundColor:'rgb(0,0,0,0.5)', zIndex:11111}}
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