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

import FilterCollections from './FilterCollections';
import FilterDate from './FilterDate';
import FilterDayOfWeek from './FilterDayOfWeek';
import FilterElevation from './FilterElevation';
import FilterHour from './FilterHour';
import FilterLocations from './FilterLocations';
import FilterMonth from './FilterMonth';
import FilterSpecies from './FilterSpecies';
import FilterYear from './FilterYear';

/**
 * Provides the UI for managing filters for queries
 * @function
 * @param {int} workingWidth The working height of the component
 * @param {int} workingHeight The working height of the component
 * @param {object} filters The current list of filters
 * @param {function} filterChange Handler for an updated filter
 * @param {function} filterRemove Handler for removing a filter
 * @param {function} filterAdd Handler for adding a new filter
 * @param {function} onQuery Handler for running the query
 * @returns {object} The UI for generating query filters
 */
export default function QueryFilters({workingWidth, workingHeight, filters, filterChanged, filterRemove, filterAdd, queryInterval, intervalChanged, onQuery}) {
  const [filterSelected, setFilterSelected] = React.useState(false); // Indicates a new filter is selected

  // The names of the available filters
  const filterNames = [
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
   * Adds a new filter to the list of filters
   * @function
   */
  function filterAddSelected() {
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

    filterAdd(filterSelected);
  }

  /**
   * Handles displaying a filter type selection when the user wants to add a new filter
   * @function
   */
  function handleNewFilter() {
    let elFilter = document.getElementById('query-filter-selection-wrapper');
    if (!elFilter) {
      return;
    }
    elFilter.style.visibility = 'visible';
  }

  /**
   * Called when the user decides they don't want a new filter
   * @function
   */
  function cancelNewFilter() {
    let elFilter = document.getElementById('query-filter-selection-wrapper');
    if (!elFilter) {
      return;
    }
    elFilter.style.visibility = 'hidden';
  }

  /**
   * Returns the UI fields for each filter type
   * @function
   * @param {object} filterInfo The information on the filter to return the UI for
   * @returns {object} The filter-specific UI to render
   */
  function generateFilterTile(filterInfo, parentId) {
    switch(filterInfo.type) {
      case 'Collection Filter':
        return (
          <FilterCollections data={filterInfo.data}
                             parentId={parentId}
                             onClose={() => filterRemove(filterInfo.id)} 
                             onChange={(data) => filterChanged(filterInfo.id, data)}/>

        );
      case 'Day of Week Filter':
        return (
          <FilterDayOfWeek data={filterInfo.data}
                           parentId={parentId}
                           onClose={() => filterRemove(filterInfo.id)} 
                           onChange={(data) => filterChanged(filterInfo.id, data)}/>

        );
      case 'Elevation Filter':
        return (
          <FilterElevation data={filterInfo.data}
                           onClose={() => filterRemove(filterInfo.id)} 
                           onChange={(data) => filterChanged(filterInfo.id, data)}/>

        );
      case 'End Date Filter':
        return (
            <FilterDate data={filterInfo.data}
                        title='End Date Filter'
                        onClose={() => filterRemove(filterInfo.id)} 
                        onChange={(data) => filterChanged(filterInfo.id, data)}/>
        );
      case 'Hour Filter':
        return (
            <FilterHour data={filterInfo.data}
                        parentId={parentId}
                        onClose={() => filterRemove(filterInfo.id)} 
                        onChange={(data) => filterChanged(filterInfo.id, data)}/>
        );
      case 'Location Filter':
        return (
            <FilterLocations data={filterInfo.data}
                           parentId={parentId}
                           onClose={() => filterRemove(filterInfo.id)} 
                           onChange={(data) => filterChanged(filterInfo.id, data)}/>
        );
      case 'Month Filter':
        return (
            <FilterMonth data={filterInfo.data}
                         parentId={parentId}
                         onClose={() => filterRemove(filterInfo.id)} 
                         onChange={(data) => filterChanged(filterInfo.id, data)}/>
        );
      case 'Species Filter':
        return (
            <FilterSpecies data={filterInfo.data}
                           parentId={parentId}
                           onClose={() => filterRemove(filterInfo.id)} 
                           onChange={(data) => filterChanged(filterInfo.id, data)}/>
        );
      case 'Start Date Filter':
        return (
            <FilterDate data={filterInfo.data}
                        title='Start Date Filter'
                        onClose={() => filterRemove(filterInfo.id)} 
                        onChange={(data) => filterChanged(filterInfo.id, data)}/>
        );
      case 'Year Filter':
        return (
            <FilterYear data={filterInfo.data}
                        onClose={() => filterRemove(filterInfo.id)} 
                        onChange={(data) => filterChanged(filterInfo.id, data)}/>
        );
    }
  }

  return (
    <React.Fragment>
      <div id="query-filter-wrapper" style={{overflow:'clip'}}>
        <Grid container direction="row" alignItems="start" justifyContent="start" wrap="nowrap"
              spacing={2}
              sx={{minHeight:workingHeight+"px", maxHeight:workingHeight+"px", backgroundColor:'white',
                   margin:0, overflowY:'auto', padding:'5px'}}
        >
          { filters.map((item, idx) => 
              <Grid id={'filter-' + item.type + '-' + idx} key={"filter-" + item.type + "-" + idx} container direction="column" alignItems="center" justifyContent="start"
                    sx={{ minHeight:(workingHeight-40)+'px', maxHeight:(workingHeight-40)+'px', minWidth:'310px', maxWidth:'310px', padding:'5px',
                          border:'solid 1px grey', borderRadius:'10px', backgroundColor:'seashell' }}>
                  {generateFilterTile(item, 'filter-' + item.type + '-' + idx)}
              </Grid>
            ) 
          }
          <Grid>
            <Grid id="queries-actions" container direction="column" alignItems="center" justifyContent="space-between"
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
                    onChange={(ev) => intervalChanged(ev.target.value)}
                    inputProps={{style: {fontSize: 12}}}
                    slotProps={{
                      inputLabel: {
                        shrink: true,
                      },
                    }}
                    />
              <Button disabled={filters.length > 0 ? false:true} onClick={onQuery}>Perform Query</Button>
            </Grid>
          </Grid>
        </Grid>
      </div>
      <Grid id="query-filter-selection-wrapper" container direction="column"  alignItems="center" justifyContent="center"
            sx={{position:'absolute', top:'0px', width:workingWidth, minHeight:workingHeight, maxHeight:workingHeight,
                 background:'rgb(0,0,0,0.75)', overflow:'clip', visibility:'hidden'}}
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
              <List sx={{backgroundColor:'silver', border:'1px solid grey', borderRadius:'7px', maxHeight:'200px', overflow:'scroll'}} >
                { filterNames.map((item) => 
                    <ListItem disablePadding key={"query-filter-sel-" + item}>
                        <ListItemText primary={item} 
                                      sx={{padding:'0 8px', cursor:'pointer', ...(item === filterSelected && {backgroundColor:'#B0B0B0'}),
                                           '&:hover':{backgroundColor:'lightgrey'} }}
                                      onClick={() => setFilterSelected(item)}
                                      onDoubleClick={() => filterAdd(item)}/>
                    </ListItem>
                )}
              </List>
              <Grid id="query-filter-selection-waiting" container direction="column"  alignItems="center" justifyContent="center"
                    sx={{position:'absolute', top:'0px', width:'100%', height:'100%', visibility:'hidden'}}
              >
                <CircularProgress id="query-filter-selection-waiting" />
              </Grid>
            </CardContent>
            <CardActions>
              <Button id="add-filter" sx={{'flex':'1'}} size="small" onClick={filterAddSelected}
                      disabled={filterSelected ? false : true}>Add</Button>
              <Button id="add-filter-cancel" sx={{'flex':'1'}} size="small" onClick={cancelNewFilter}>Cancel</Button>
            </CardActions>
          </React.Fragment>
        </Card>
      </Grid>
    </React.Fragment>
  );
}
