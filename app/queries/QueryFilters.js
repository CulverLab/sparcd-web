'use client'

/** @module QueryFilters */

import * as React from 'react';
import AddCircleOutlineOutlinedIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import PropTypes from 'prop-types';

import { filterNames, FilterTile } from './FilterTile';

/**
 * Provides the UI for managing filters for queries
 * @function
 * @param {object} actionsRef The reference to use with the actions element 
 * @param {number} workingWidth The working height of the component
 * @param {number} workingHeight The working height of the component
 * @param {object} filters The current list of filters
 * @param {function} filterChanged Handler for an updated filter
 * @param {function} filterRemove Handler for removing a filter
 * @param {function} filterAdd Handler for adding a new filter
 * @param {function} onQuery Handler for running the query
 * @returns {object} The UI for generating query filters
 */
export default function QueryFilters({actionsRef, workingWidth, workingHeight, filters, filterChanged, filterRemove, filterAdd,
                                      queryInterval, intervalChanged, onQuery}) {
  const [filterSelected, setFilterSelected] = React.useState(null); // Indicates a new filter is selected
  const [showSelections, setShowSelections] = React.useState(false);
  const [showFilterWaiting, setShowFilterWaiting] = React.useState(false);

  /**
   * Handles addings a new filter
   * @function
   * @param {string} filter The filter to add
   */
  const handleFilterAdd = React.useCallback((filter) => {
    // Show the spinner
    setShowFilterWaiting(true);

    filterAdd(filter,
                    () => setShowFilterWaiting(false),  // On accepted
                    () => {           // On completed
                      setShowFilterWaiting(false);
                      setShowSelections(false);
                    }
    );
  }, [filterAdd]);

  /**
   * Adds the selected filter to the list of filters
   * @function
   */
  const filterAddSelected = React.useCallback(() => {
    handleFilterAdd(filterSelected);
  }, [handleFilterAdd, filterSelected]);

  /**
   * Called when the interval is changed
   * @function
   * @param {object} event The triggering event
   */
  const handleIntervalChanged = React.useCallback((event) => {
    intervalChanged(event.target.value);
  }, [intervalChanged]);

  /**
   * Handles displaying a filter type selection when the user wants to add a new filter
   * @function
   */
  const handleNewFilter = React.useCallback(() => {
    setShowSelections(true);
  }, []);

  /**
   * Called when the user decides they don't want a new filter
   * @function
   */
  const cancelNewFilter = React.useCallback(() => {
    setShowSelections(false);
  }, []);

  /**
   * Called when a new filter is selected
   * @function
   * @param {object} event The triggering event
   */
  const handleFilterSelected = React.useCallback((event) => {
    setFilterSelected(event.currentTarget.dataset.filter);
  }, []);

  /**
   * Called when a new filter is double clicked
   * @function
   * @param {object} event The triggering event
   */
  const handleFilterDoubleClicked = React.useCallback((event) => {
    handleFilterAdd(event.currentTarget.dataset.filter);
  }, [handleFilterAdd]);

  return (
    <React.Fragment>
      <div id="query-filter-wrapper" style={{overflow:'clip'}}>
        <Grid container direction="row" alignItems="start" justifyContent="start"
              spacing={2}
              sx={{minHeight:workingHeight, maxHeight:workingHeight, backgroundColor:'white',
                   margin:0, overflowY:'auto', padding:'5px', flexWrap:'nowrap'}}
        >
          { filters.map((item, idx) => 
              <Grid id={'filter-' + item.type + '-' + idx} key={"filter-" + item.type + "-" + idx} container direction="column" alignItems="center" justifyContent="start"
                    sx={{ minHeight:(workingHeight-40), maxHeight:(workingHeight-40), minWidth:'310px', maxWidth:'310px', padding:'5px',
                          border:'solid 1px grey', borderRadius:'10px', backgroundColor:'seashell' }}>
                  <FilterTile filterInfo={item} parentId={'filter-' + item.type + '-' + idx} onChanged={filterChanged} onRemove={filterRemove} />
              </Grid>
            ) 
          }
          <Grid>
            <Grid id="queries-actions" ref={actionsRef} container direction="column" alignItems="center" justifyContent="space-between"
                  sx={{ position:'relative', minHeight:'310px',minWidth:'250px', border:'solid 1px grey', borderRadius:'10px',
                        padding: '15px 0', backgroundColor:'seashell' }}>
              <Tooltip title="Click to add a new filter">
                <IconButton onClick={handleNewFilter}>
                  <AddCircleOutlineOutlinedIcon sx={{fontSize: 55, color:'grey'}} />
                </IconButton>
              </Tooltip>
              <TextField
                    id='query-interval'
                    label="Query Interval (minutes)"
                    defaultValue={queryInterval}
                    size='small'
                    sx={{padding:'10px', width:'100%'}}
                    onChange={handleIntervalChanged}
                    slotProps={{
                      inputLabel: {shrink:true},
                      htmlInput: {style: {fontSize:12}},
                    }}
                    />
              <Button disabled={filters.length === 0} onClick={onQuery}>Perform Query</Button>
            </Grid>
          </Grid>
        </Grid>
      </div>
      { showSelections &&
        <Grid id="query-filter-selection-wrapper" container direction="column"  alignItems="center" justifyContent="center"
              sx={{position:'absolute', top:'0px', width:workingWidth, minHeight:workingHeight, maxHeight:workingHeight,
                   background:'rgb(0,0,0,0.75)', overflow:'clip'}}
        >
          <Card variant="outlined" >
            <React.Fragment>
              <CardHeader sx={{ textAlign:'center', paddingBottom:'0' }} title={
                  <Typography gutterBottom variant="h6" component="h4">
                    Choose Filter
                  </Typography>
                 }
               />
              <CardContent sx={{position:'relative'}}>
                <List sx={{backgroundColor:'silver', border:'1px solid grey', borderRadius:'7px', maxHeight:'200px', overflow:'auto'}} >
                  { filterNames.map((item) => 
                      <ListItem disablePadding key={"query-filter-sel-" + item}>
                          <ListItemButton data-filter={item}
                                          selected={item === filterSelected}
                                          sx={{padding:'0 8px'}}
                                          onClick={handleFilterSelected}
                                          onDoubleClick={handleFilterDoubleClicked}
                          >
                            <ListItemText primary={item} />
                          </ListItemButton>
                      </ListItem>
                  )}
                </List>
                { showFilterWaiting &&
                  <Grid id="query-filter-selection-waiting-wrapper" container direction="column"  alignItems="center" justifyContent="center"
                        sx={{position:'absolute', top:'0px', width:'100%', height:'100%'}}
                  >
                    <CircularProgress id="query-filter-selection-waiting" />
                  </Grid>
                }
              </CardContent>
              <CardActions>
                <Button id="add-filter" sx={{flex:1}} size="small" onClick={filterAddSelected}
                        disabled={!filterSelected}>Add</Button>
                <Button id="add-filter-cancel" sx={{flex:1}} size="small" onClick={cancelNewFilter}>Cancel</Button>
              </CardActions>
            </React.Fragment>
          </Card>
        </Grid>
      }
    </React.Fragment>
  );
}

QueryFilters.propTypes = {
  actionsRef:      PropTypes.shape({ current: PropTypes.object }),
  workingWidth:    PropTypes.number.isRequired,
  workingHeight:   PropTypes.number.isRequired,
  filters:         PropTypes.arrayOf(PropTypes.shape({
    id:            PropTypes.string.isRequired,
    type:          PropTypes.string.isRequired,
    data:          PropTypes.any,
  })).isRequired,
  filterChanged:   PropTypes.func.isRequired,
  filterRemove:    PropTypes.func.isRequired,
  filterAdd:       PropTypes.func.isRequired,
  queryInterval:   PropTypes.number.isRequired,
  intervalChanged: PropTypes.func.isRequired,
  onQuery:         PropTypes.func.isRequired,
};
