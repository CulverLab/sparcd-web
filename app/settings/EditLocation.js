/** @module components/EditLocation */

import * as React from 'react';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Checkbox from '@mui/material/Checkbox';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import HttpsIcon from '@mui/icons-material/Https';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

import { AddMessageContext, geographicCoordinates, LocationsInfoContext, UserSettingsContext } from '../serverInfo';
import { Level } from '../components/Messages';
import { meters2feet } from '../utils';

/**
 * Handles editing a location's entry
 * @function
 * @param {object} [data] The location data. If falsy a new location is assumed
 * @param {function} onUpdate Called to update the location information when changes made
 * @param {function} onClose Called when the editing is completed
 * @return {object} The UI for editing locations
 */
export default function EditLocation({data, onUpdate, onClose}) {
  const theme = useTheme();
  const addMessage = React.useContext(AddMessageContext); // Function adds messages for display
  const locationItems = React.useContext(LocationsInfoContext);
  const userSettings = React.useContext(UserSettingsContext);  // User display settings
  const locationActiveRef = React.useRef(null);
  const locationDescRef = React.useRef(null);
  const locationEleRef = React.useRef(null);
  const locationIdRef = React.useRef(null);
  const locationLatRef = React.useRef(null);
  const locationLonRef = React.useRef(null);
  const locationNameRef = React.useRef(null);
  const locationUTMZoneRef = React.useRef(null);
  const locationUTMLetterRef = React.useRef(null);
  const locationUTMXRef = React.useRef(null);
  const locationUTMYRef = React.useRef(null);
  const [canEditId, setCanEditId] = React.useState(false);        // Used to allow editing of location ID
  const [isModified, setIsModified] = React.useState(false);
  const [selectedCoordinate, setSelectedCoordinate] = React.useState(userSettings['coordinatesDisplay'] ?? 'LATLON');
  const [selectedMeasure, setSelectedMeasure] = React.useState(userSettings['measurementFormat'] ?? 'meters');
  const [curData, setCurData] = React.useState(data || {
                                                        elevationProperty: 0,
                                                        idProperty: '',
                                                        latProperty: 0.0,
                                                        lngProperty: 0.0,
                                                        nameProperty: '',
                                                        utm_code: '',
                                                        utm_x: 0,
                                                        utm_y: 0
                                                      });
  const [displayElevation, setDisplayElevation] = React.useState(selectedMeasure === 'feet' ? meters2feet(curData.elevationProperty) : curData.elevationProperty);

  /**
   * Handles a change in the user's measurement selection
   * @function
   * @param {object} event The event object
   */
  function handleMeasureChange(event) {
    setSelectedMeasure(event.target.value);
    setDisplayElevation(event.target.value === 'feet' ? Math.round(meters2feet(curData.elevationProperty)) : curData.elevationProperty);
  }

  /**
   * Handles a change in the user's coordinate selection
   * @function
   * @param {object} event The event object
   */
  function handleCoordinateChange(event) {
    setSelectedCoordinate(event.target.value);
  }

  /**
   * Handles saving the changes to the user
   * @function
   */
  function onSaveChanges() {
    if (!isModified) {
      return;
    }

    // Save the edited location data
    let updatedData = JSON.parse(JSON.stringify(curData));

    if (locationNameRef.current) {
      updatedData.nameProperty = locationNameRef.current.value;
      if (updatedData.nameProperty.length <= 2) {
        addMessage(Level.Warning, "Please enter a longer name for the location");
        locationNameRef.current.focus();
        return;
      }
    }

    if (locationIdRef.current) {
      updatedData.idProperty = locationIdRef.current.value;
      if (updatedData.idProperty.length <= 2) {
        addMessage(Level.Warning, "Please enter a longer location identifier");
        locationIdRef.current.focus();
        return;
      }
      const foundId = locationItems.filter((item) => item.idProperty === updatedData.idProperty);
      if (foundId.length > 0 && !data) {
        addMessage(Level.Warning, "The ID is already taken. Please enter an unused ID")
        locationIdRef.current.focus();
        return;
      }
    }

    if (locationDescRef.current) {
      updatedData.descriptionProperty = locationDescRef.current.value;
      if (updatedData.descriptionProperty.length > 0 && updatedData.descriptionProperty.length <= 4) {
        addMessage(Level.Warning, "Please enter a longer geographic area identifier");
        locationDescRef.current.focus();
        return;
      }
    }


    if (locationActiveRef.current) {
      updatedData.activeProperty = locationActiveRef.current.checked;
    }

    updatedData.measure = selectedMeasure;

    if (locationEleRef.current) {
      updatedData.elevationProperty = locationEleRef.current.value;
      if (updatedData.elevationProperty.length <= 0) {
        addMessage(Level.Warning, "Please enter an elevation");
        locationEleRef.current.focus();
        return;
      } else if (isNaN(parseFloat(updatedData.elevationProperty))) {
        addMessage(Level.Warning, "Please enter a valid elevation");
        locationEleRef.current.focus();
        return;
      }
    }

    updatedData.coordinate = selectedCoordinate;

    if (selectedCoordinate === 'LATLON') {
      if (locationLatRef.current) {
        updatedData.latProperty = locationLatRef.current.value;
        if (updatedData.latProperty.length <= 1) {
          addMessage(Level.Warning, "Please enter a latitude");
          locationLatRef.current.focus();
          return;
        } else if (isNaN(parseFloat(updatedData.latProperty))) {
          addMessage(Level.Warning, "Please enter a valid latitude");
          locationLatRef.current.focus();
          return;
        }
      }

      if (locationLonRef.current) {
        updatedData.lngProperty = locationLonRef.current.value;
        if (updatedData.lngProperty.length <= 1) {
          addMessage(Level.Warning, "Please enter a valid longitude");
          locationLonRef.current.focus();
          return;
        } else if (isNaN(parseFloat(updatedData.lngProperty))) {
          addMessage(Level.Warning, "Please enter a valid longitude");
          locationLonRef.current.focus();
          return;
        }
      }
    } else {
      if (locationUTMZoneRef.current) {
        updatedData.utm_zone = locationUTMZoneRef.current.value;
        if (updatedData.utm_zone.length <= 0) {
          addMessage(Level.Warning, "Please enter a UTM zone");
          locationUTMZoneRef.current.focus();
          return;
        } else if (isNaN(parseInt(updatedData.utm_zone))) {
          addMessage(Level.Warning, "Please enter a valid UTM zone");
          locationUTMZoneRef.current.focus();
          return;
        }
      }

      if (locationUTMLetterRef.current) {
        updatedData.utm_letter = locationUTMLetterRef.current.value;
        if (updatedData.utm_letter.length <= 0) {
          addMessage(Level.Warning, "Please enter a UTM letter");
          locationUTMLetterRef.current.focus();
          return;
        }
      }

      if (locationUTMXRef.current) {
        updatedData.utm_x = locationUTMXRef.current.value;
        if (updatedData.utm_x.length <= 0) {
          addMessage(Level.Warning, "Please enter a UTM X value");
          locationUTMXRef.current.focus();
          return;
        } else if (isNaN(parseFloat(updatedData.utm_x))) {
          addMessage(Level.Warning, "Please enter a valid UTM X value");
          locationUTMXRef.current.focus();
          return;
        }
      }

      if (locationUTMYRef.current) {
        updatedData.utm_y = locationUTMYRef.current.value;
        if (updatedData.utm_y.length <= 0) {
          addMessage(Level.Warning, "Please enter a UTM Y value");
          locationUTMYRef.current.focus();
          return;
        } else if (isNaN(parseFloat(updatedData.utm_y))) {
          addMessage(Level.Warning, "Please enter a valid UTM Y value");
          locationUTMYRef.current.focus();
          return;
        }
      }
    }

    onUpdate(updatedData, onClose, (message) => addMessage(Level.Warning, message));
  }

  /**
   * Allows the user to edit the location ID
   * @function
   */
  const handleUnlockEditingId = React.useCallback(() => {
    setCanEditId(prev => !prev);
  }, []);

  /**
   * Supresses the default handling of a mouse down event on the ID field icon
   * @function
   * @param {object} event The event object
   */
  const handleMouseDownId = (event) => {
    event.preventDefault();
  };

  /**
   * Supresses the default handliong of a mouse up event on the ID field icon
   * @function
   * @param {object} event The event object
   */
  const handleMouseUpId = (event) => {
    event.preventDefault();
  };

  /*
   * Check if we need to break the UTM code into zone and letter
   */
  React.useEffect(() => {
    if (curData && curData.utm_code && (!curData.utm_zone || !curData.utm_letter)) {
      setCurData({...curData, 
                    utm_zone:parseInt(curData.utm_code), 
                    utm_letter:curData.utm_code[curData.utm_code.length - 1]
                });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
   <Grid sx={{minWidth:'50vw'}} > 
    <Card id="edit-species" sx={{backgroundColor:'#EFEFEF', border:"none", boxShadow:"none"}} >
      <CardHeader id='edit-species-header' title={
                    <Grid container direction="row" alignItems="start" justifyContent="start" sx={{flexWrap:'nowrap'}}>
                      <Grid>
                        <Typography gutterBottom variant="h6" component="h4" noWrap>
                          Edit Location
                        </Typography>
                      </Grid>
                      <Grid sx={{marginLeft:'auto'}} >
                        <div onClick={onClose}>
                          <Tooltip title="Close without saving">
                            <Typography gutterBottom variant="body2" noWrap
                                        sx={{textTransform:'uppercase',
                                        color:'grey',
                                        cursor:'pointer',
                                        fontWeight:'500',
                                        backgroundColor:'rgba(0,0,0,0.03)',
                                        padding:'3px 3px 3px 3px',
                                        borderRadius:'3px',
                                        '&:hover':{backgroundColor:'rgba(255,255,255,0.7)', color:'black'}
                                     }}
                            >
                              <CloseOutlinedIcon fontSize="small" />
                            </Typography>
                          </Tooltip>
                        </div>
                      </Grid>
                    </Grid>
                    }
                style={{paddingTop:'0px', paddingBottom:'0px'}}
      />
      <CardContent id='edit-location-details' sx={{paddingTop:'0px', paddingBottom:'0px'}}>
        <Grid container direction="column" justifyContent="start" alignItems="stretch"
              sx={{minWidth:'400px', border:'1px solid black', borderRadius:'5px', backgroundColor:'rgb(255,255,255,0.3)' }}>
          <TextField required
                id='edit-location-name'
                label="Name"
                defaultValue={curData.nameProperty}
                size='small'
                sx={{margin:'10px'}}
                onChange={() => setIsModified(true)}
                slotProps={{
                  input: {inputRef:locationNameRef},
                  htmlInput: {style:{fontSize:12}},
                  inputLabel: {shrink: true},
                }}
                />
          <TextField disabled={curData && curData.idProperty && !canEditId}
                id='edit-location-id'
                label="ID"
                defaultValue={curData && curData.idProperty ? curData.idProperty : null}
                size='small'
                sx={{margin:'10px'}}
                onChange={() => setIsModified(true)}
                slotProps={{
                  htmlInput: {style:{fontSize:12}},
                  inputLabel: {shrink: true},
                  input: {
                    inputRef:locationIdRef,
                    endAdornment: 
                      <InputAdornment position='end'>
                        <IconButton
                          aria-label={'Unlock editing location ID'}
                          onClick={handleUnlockEditingId}
                          onMouseDown={handleMouseDownId}
                          onMouseUp={handleMouseUpId}
                          edge='end'
                        >
                          {canEditId ? <LockOpenIcon style={{color:"RosyBrown"}} /> : <HttpsIcon style={{color:"RosyBrown"}} />}
                        </IconButton>
                      </InputAdornment>,
                  },
                }}
                />
          <TextField
                id='edit-location-description'
                label="Geographic Area"
                placeholder="e.g. Mountain range"
                defaultValue={curData.descriptionProperty}
                size='small'
                sx={{margin:'10px'}}
                onChange={() => setIsModified(true)}
                slotProps={{
                  input:{inputRef:locationDescRef},
                  htmlInput: {style:{fontSize:12}},
                  inputLabel: {shrink: true},
                }}
                />
          <RadioGroup
            id='edit-location-measure1'
            value={selectedMeasure}
            onChange={handleMeasureChange}              
          >
            <Grid container direction="row" spacing={2} justifyContent="stretch" alignItems="center">
              <FormControlLabel value="feet" control={<Radio size="small"/>} label=<Typography gutterBottom variant="body2" noWrap>Feet</Typography>
                                                 sx={{paddingLeft:'10px'}}/>
              <FormControlLabel value="meters" control={<Radio size="small"/>} label=<Typography gutterBottom variant="body2" noWrap>Meters</Typography>
                                                 />
            </Grid>
          </RadioGroup>
          <TextField 
                id='edit-location-elevation'
                label={"Elevation" + (selectedMeasure === 'feet' ? ' (feet)' : ' (meters)')}
                value={displayElevation}
                size='small'
                sx={{margin:'10px'}}
                onChange={() => setIsModified(true)}
                slotProps={{
                  input: {inputRef:locationEleRef},
                  htmlInput: {style:{fontSize:12}, minLength:1},
                  inputLabel: {shrink: true},
                }}
                />
          <RadioGroup
            id='edit-location-measure2'
            value={selectedCoordinate}
            onChange={handleCoordinateChange}              
          >
            <Grid container direction="row" spacing={2} justifyContent="stretch" alignItems="center">
            { geographicCoordinates.map((item, idx) => 
                <FormControlLabel value={item.value} key={item.value} 
                                  control={<Radio size="small"/>}
                                                label=<Typography gutterBottom variant="body2" noWrap>{item.label}</Typography>
                                                sx={{paddingLeft:idx === 0 ? '10px' : 'revert'}}/>
              )
            }
            </Grid>
          </RadioGroup>
          { selectedCoordinate === 'LATLON' &&
            <React.Fragment>
            <TextField 
                  id='edit-location-lat'
                  label="Latitude"
                  defaultValue={curData.latProperty}
                  size='small'
                  sx={{margin:'10px'}}
                  onChange={() => setIsModified(true)}
                  slotProps={{
                    input:{inputRef:locationLatRef},
                    htmlInput: {style:{fontSize:12}},
                    inputLabel: {shrink: true},
                  }}
                  />
            <TextField 
                  id='edit-location-lon'
                  label="Longitude"
                  defaultValue={curData.lngProperty}
                  size='small'
                  sx={{margin:'10px'}}
                  onChange={() => setIsModified(true)}
                  slotProps={{
                    input:{inputRef:locationLonRef},
                    htmlInput: {style:{fontSize:12}},
                    inputLabel: {shrink: true},
                  }}
                  />
            </React.Fragment>
          }
          { selectedCoordinate === 'UTM' && 
            <React.Fragment>
            <TextField 
                  id='edit-location-utm-zone'
                  label="UTM Zone"
                  defaultValue={curData && curData.utm_zone ? curData.utm_zone : null}
                  size='small'
                  sx={{margin:'10px'}}
                  onChange={() => setIsModified(true)}
                  slotProps={{
                    input:{inputRef:locationUTMZoneRef},
                    htmlInput: {style:{fontSize:12}},
                    inputLabel: {shrink: true},
                  }}
                  />
            <TextField 
                  id='edit-location-utm-letter'
                  label="Letter"
                  defaultValue={curData && curData.utm_letter ? curData.utm_letter : null}
                  size='small'
                  sx={{margin:'10px'}}
                  onChange={() => setIsModified(true)}
                  slotProps={{
                    input:{inputRef:locationUTMLetterRef},
                    htmlInput: {style:{fontSize:12}},
                    inputLabel: {shrink: true},
                  }}
                  />
            <TextField 
                  id='edit-location-utm-x'
                  label="X"
                  defaultValue={curData.utm_x}
                  size='small'
                  sx={{margin:'10px'}}
                  onChange={() => setIsModified(true)}
                  slotProps={{
                    input:{inputRef:locationUTMXRef},
                    htmlInput: {style:{fontSize:12}},
                    inputLabel: {shrink: true},
                  }}
                  />
            <TextField 
                  id='edit-location-utm-y'
                  label="Y"
                  defaultValue={curData.utm_y}
                  size='small'
                  sx={{margin:'10px'}}
                  onChange={() => setIsModified(true)}
                  slotProps={{
                    input:{inputRef:locationUTMYRef},
                    htmlInput: {style:{fontSize:12}},
                    inputLabel: {shrink: true},
                  }}
                  />
            </React.Fragment>
          }
          <FormControlLabel sx={{paddingLeft:'10px'}}
                            control={<Checkbox id="edit-location-active"
                                               size="small" 
                                               defaultChecked={curData.activeProperty}
                                               onChange={() => setIsModified(true)}
                                               inputRef={locationActiveRef}
                                      />} 
                            label={<Typography variant="body2">Active location entry</Typography>} />
        </Grid>          
        </CardContent>
        <CardActions id='filter-content-actions'>
          <Button sx={{flex:1}} disabled={!isModified} onClick={onSaveChanges}>Save</Button>
          <Button sx={{flex:1}} onClick={onClose} >Cancel</Button>
        </CardActions>
    </Card>
  </Grid>
  );
}

EditLocation.propTypes = {
  data:     PropTypes.shape({
    nameProperty:        PropTypes.string,
    idProperty:          PropTypes.string,
    descriptionProperty: PropTypes.string,
    elevationProperty:   PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    latProperty:         PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    lngProperty:         PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    activeProperty:      PropTypes.bool,
    utm_code:            PropTypes.string,
    utm_zone:            PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    utm_letter:          PropTypes.string,
    utm_x:               PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    utm_y:               PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }),
  onUpdate: PropTypes.func.isRequired,
  onClose:  PropTypes.func.isRequired,
};

EditLocation.defaultProps = {
  data: null,
};
