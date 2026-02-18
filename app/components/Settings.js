/** @module components/Settings */

import * as React from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import BorderColorOutlinedIcon from '@mui/icons-material/BorderColorOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Checkbox from '@mui/material/Checkbox';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import LoginIcon from '@mui/icons-material/Login';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useTheme } from '@mui/material/styles';

import { Level } from './Messages';
import { AddMessageContext, CollectionsInfoContext, TokenExpiredFuncContext, geographicCoordinates, 
         TokenContext, UserAdminContext, UserNameContext } from '../serverInfo';
import * as utils from '../utils';

// Default settings if we never received them
const defaultSettings = { dateFormat:'MDY', 
                          timeFormat:'24',
                          measurementFormat:'meters',
                          sandersonDirectory:false,
                          sandersonOutput:false,
                          autonext:true,
                          settingsChanged:false,
                          coordinatesDisplay:'LATLON'
                        };

/**
 * Ensures the settings have the same fields as the default
 * @function
 * @param {object} settings The settings to check
 * @return {object} The original or updated settings
 */
function ensure_settings(settings) {
  if (!settings) {
    return defaultSettings;
  }

  for (let one_key of Object.keys(defaultSettings)) {
    if (settings[one_key] === undefined || settings[one_key] === "undefined") {
      settings[one_key] = defaultSettings[one_key]
    }
  }

  return settings;
}

/**
 * Returns the UI for the user's settings
 * @function
 * @param {object} curSettings The working settings
 * @param {function} onChange Handler for when a setting is changed
 * @param {function} onClose Handler for when the settings are to be closed
 * @param {function} onLogout Handler for the user wants to log out
 * @param {function} onAdminSettings Handler for an admin user wanting to make changes
 * @param {function} onOwnerSettings Handler for an user wanting to make collection changes
 * @returns {object} Returns the UI to render
 */
export default function Settings({curSettings, onChange, onClose, onLogout, onAdminSettings, onOwnerSettings}) {
  const theme = useTheme();
  const addMessage = React.useContext(AddMessageContext); // Function adds messages for display
  const collectionsItems = React.useContext(CollectionsInfoContext);
  const setTokenExpired = React.useContext(TokenExpiredFuncContext);
  const settingsToken = React.useContext(TokenContext);  // Login token
  const userName = React.useContext(UserNameContext);
  const passwordRef = React.useRef();
  const email1Ref = React.useRef();
  const email2Ref = React.useRef();
  const [changeEmail, setChangeEmail] = React.useState(false); // Used to signal changing the user's email
  const [changedValue, setChangedValue] = React.useState(null); // Use to force redraw when settings change
  const [emailMessage, setEmailMessage] = React.useState(null); // The working email message
  const [isAdmin, setIsAdmin] = React.useState(false); // Used in case the user is an admin
  const [isOwner, setIsOwner] = React.useState(false); // Used in case the user has owner permissions on a collection
  const [getPassword, setGetPassword] = React.useState(false); // Used to signal that we need the user's password
  const [serverURL, setServerURL] = React.useState(utils.getServer());  // The server URL to use
  const [showPassword, setShowPassword] = React.useState(false);  // Show the password?
  const [titlebarRect, setTitlebarRect] = React.useState(null); // Set when the UI displays
  const [userSettings, setUserSettings] = React.useState(curSettings ? ensure_settings(curSettings) : defaultSettings);

  // Built-in date formats
  const dateFormats = [
                        {label:'Month Day, Year -- January 3, 2025', value:'MDY', hint:'Full month name, day of month, four digit year'},
                        {label:'Short Month Day, Year -- Jan. 3, 2025', value:'SMDY', hint:'Abbreviated month name, day of month, four digit year'},
                        {label:'Numeric Month/Day/Year -- 1/3/2025', value:'NMDY', hint:'Month as a number, day of month, four digit year'},
                        {label:'Day Month, Year -- 3 January 2025', value:'DMY', hint:'Day of month, full month name, four digit year'},
                        {label:'Day Short Month, Year -- 3 Jan. 2025', value:'DSMY', hint:'Day of month, abbreviated month name, four digit year'},
                        {label:'Numeric Day/Month/Year -- 3/1/2025', value:'DNMY', hint:'Day of month, month as a number, four digit year'},
                        {label:'ISO Local Date -- 2025-1-3', value:'ISO', hint:'Four digit year, numeric month, day of month'},
                      ];
  // Built-in time formats
  const timeFormats = [
                        {label:'24 hour -- 14:36', value:'24', hint:'24 Hour day with minutes'},
                        {label:'24 hour with seconds -- 14:36:52', value:'24s', hint:'24 Hour day with minutes and seconds'},
                        {label:'12 hour with AM/PM-- 2:36 pm', value:'12', hint:'12 Hour day with minutes and AM or PM'},
                        {label:'12 hour with seconds and AM/PM-- 2:36:52 pm', value:'14', hint:'12 Hour day with minutes and seconds and AM or PM'},
                      ];
  // Build-in measurement formats
  const measurementFormats = [
                        {label:'Feet', value:'feet', hint:'Display measurements in feet'},
                        {label:'Meters', value:'meters', hint:'Display measurements in meters'},
                      ];

  // Recalcuate where to place ourselves
  React.useLayoutEffect(() => {
    calculateSizes();
  }, []);

  // Adds a resize handler to the window, and automatically removes it
  React.useEffect(() => {
      function onResize () {
        calculateSizes();
      }

      window.addEventListener("resize", onResize);
  
      return () => {
          window.removeEventListener("resize", onResize);
      }
  }, []);

  // Adds a mouse click handler to the document, and automatically removes it
  React.useEffect(() => {
      function onMouseClick (event) {
        const el = document.getElementById('settings-wrapper');
        const elRect = el.getBoundingClientRect();
        if (event.clientX < elRect.x || event.clientX > elRect.x + elRect.width ||
            event.clientY < elRect.y || event.clientY > elRect.y + elRect.height) {
          onClose();
        }
      }

      document.addEventListener("click", onMouseClick);
  
      return () => {
          document.removeEventListener("click", onMouseClick);
      }
  });

  // Automatically select the password edit field
  React.useEffect(() => {
    if (getPassword && passwordRef.current) {
      passwordRef.current.focus();
    }
  }, [getPassword, passwordRef]);

  /**
   * Handler that toggles the show password state
   * @function
   */
  const handleClickShowPassword = () => setShowPassword((show) => !show);

  /**
   * Supresses the default handling of a mouse down event on the password field
   * @function
   * @param {object} event The event object
   */
  const handleMouseDownPassword = (event) => {
    event.preventDefault();
  };

  /**
   * Supresses the default handliong of a mouse up event on the password field
   * @function
   * @param {object} event The event object
   */
  const handleMouseUpPassword = (event) => {
    event.preventDefault();
  };

  /**
   * Checks if the user is an admin
   * @function
   */
  const checkIfAdmin = React.useCallback(() => {
    try {
      const isAdminUrl = serverURL + '/adminCheck?t=' + encodeURIComponent(settingsToken)
      const resp = fetch(isAdminUrl, {
        method: 'GET'
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              if (resp.status === 401) {
                // User needs to log in again
                setTokenExpired();
              }
              throw new Error(`Failed checked to see if user is an admin: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
            // Process the results
            if (respData.value === true) {
              setIsAdmin(true);
            }
        })
        .catch(function(err) {
          console.log('Check For Admin Error: ', err);
          addMessage(Level.Warning, "An error ocurred while logging in for administration purposes");
      });
    } catch (error) {
      console.log('Check For Admin Unknown Error: ',err);
      addMessage(Level.Warning, "An unknown error ocurred while logging in for administration purposes");
    }
  }, [addMessage, settingsToken, setIsAdmin])

  /**
   * Determines if the user has owner permissions on any collections
   * @function
   */
  function checkIfOwner() {
    if (!collectionsItems) {
      return;
    }

    // We just need to find one owner permissions
    let isOwner = false;
    for (let coll of collectionsItems) {
      if (coll.permissions) {
        if (coll.permissions.ownerProperty && coll.permissions.ownerProperty === true) {
          isOwner = true;
        }
      }

      if (isOwner) {
        break;
      }
    }

    setIsOwner(isOwner);
  }

  /**
   * Calculate our sizes and positions
   * @function
   */
  function calculateSizes() {
    const titleEl = document.getElementsByTagName('header');
    if (titleEl) {
      const curRect = titleEl[0].getBoundingClientRect();
      setTitlebarRect(curRect);
      return curRect;
    }

    return null;
  }

  /**
   * Called when the user changes a value
   * @function
   * @param {string} valueKey The key of the value to change
   * @param {object} value The new value to store
   */
  function handleValueChange(valueKey, value) {
    const curSettings = userSettings;
    curSettings[valueKey] = value;
    setUserSettings(curSettings);
    setChangedValue(valueKey + value + '');
    onChange(curSettings);
  }

  /**
   * Handler for Admin editing request
   * @function
   */
  function handleAdmin() {
    setGetPassword(true);
  }

  /**
   * Handler for Owner manage request
   * @function
   */
  function handleOwner() {
    setGetPassword(true);
  }

  /**
   * Handles the user logging in for admin
   * @function
   */
  function handleLoginConfirmation() {
    const el = document.getElementById('password-entry');
    if (el && typeof(onAdminSettings) === 'function') {
      const newPw = el.value;
      if (isAdmin) {
        onAdminSettings(newPw);
      } else if (isOwner) {
        onOwnerSettings(newPw);
      }
      setGetPassword(false);
    }
  }

  /**
   * Handles the user wanting to change their email
   * @function
   */
  const handleChangeEmail = React.useCallback(() => {
    setChangeEmail(true);
  }, [setChangeEmail]);

  /**
   * Handles when the user wants to save update email
   * @function
   */
  const handleSaveEmail = React.useCallback(() => {
    let email1 = null;
    let email2 = null;

    if (email1Ref && email1Ref.current) {
      email1 = email1Ref.current.value;
    }
    if (email2Ref && email2Ref.current) {
      email2 = email2Ref.current.value;
    }

    // Make sure we have something to work with
    if (email1 === null && email2 === null){
      return;
    }

    // Make the comparisons and help the user 
    if (email1 === email2) {
      const curSettings = userSettings;
      curSettings.email = email1;
      setUserSettings(curSettings);
      setChangedValue(email1);
      onChange(curSettings);
      setChangeEmail(false);
    } else {
      setEmailMessage("Your emails don't match. Please correct and try again")
      email1Ref.current.focus();
      email1Ref.current.select();
    }

  }, [email1Ref, email2Ref, setChangeEmail, setEmailMessage, userSettings]);

  /**
   * Handles clearing an error message once the user starts changing email addresses
   * @function
   */
  const handleEmailChange = React.useCallback(() => {
    if (emailMessage != null) {
      setEmailMessage(null);
    }
  }, [emailMessage, setEmailMessage]);


  // Default the titlebar dimensions if it's not rendered yet
  let workingRect = titlebarRect;
  if (workingRect == null) {
    workingRect = calculateSizes();
    if (workingRect == null) {
      workingRect = {x:20,y:40,width:640};
    }
  }

  // Admin check
  React.useLayoutEffect(() => {
    checkIfAdmin();
    checkIfOwner();
  }, []);

  // Return the UI
  return (
    <Grid id='settings-wrapper'
         sx={{position:'absolute', top:(workingRect.y+20)+'px', right:'20px', zIndex:2000,
             border:'1px solid grey', backgroundColor:'silver', boxShadow:'2px 3px 3px #bbbbbb'}}
    >
      <Card id="settings-content">
        <CardHeader title="Settings"
                    subheader={<span style={{fontSize:"smaller"}}><span>Customize settings for </span><span style={{fontWeight:'bold'}}>{userName}</span></span>} />
        <CardContent sx={{paddingTop:'0px', paddingBottom:'0px'}}>
          <Grid container direction="column" alignItems="start" justifyContent="start" wrap="nowrap"
                  spacing={1}
                  sx={{overflowY:'scroll', paddingTop:'5px'}}
          >
            <Grid id="setting-dates" >
              <Autocomplete
                disablePortal
                disableClearable
                options={dateFormats}
                value={dateFormats.find((item) => item.value === userSettings.dateFormat).label}
                onChange={(event, newValue) => handleValueChange('dateFormat', newValue.value)}
                sx={{ width: 300 }}
                renderInput={(params) => <TextField {...params} label="Dates" />}
              />
            </Grid>
            <Grid id="setting-time" >
              <Autocomplete
                disablePortal
                disableClearable
                options={timeFormats}
                value={timeFormats.find((item) => item.value === userSettings.timeFormat).label}
                onChange={(event, newValue) => handleValueChange('timeFormat', newValue.value)}
                sx={{ width: 300 }}
                renderInput={(params) => <TextField {...params} label="Times" />}
              />
            </Grid>
            <Grid id="setting-measurements" >
              <Autocomplete
                disablePortal
                disableClearable
                options={measurementFormats}
                value={measurementFormats.find((item) => item.value === userSettings.measurementFormat).label}
                onChange={(event, newValue) => handleValueChange('measurementFormat', newValue.value)}
                sx={{ width: 300 }}
                renderInput={(params) => <TextField {...params} label="Measurements" />}
              />
            </Grid>
            <Grid id="setting-coordinates" >
              <Autocomplete
                disablePortal
                disableClearable
                options={geographicCoordinates}
                value={geographicCoordinates.find((item) => item.value === userSettings.coordinatesDisplay).label}
                onChange={(event, newValue) => handleValueChange('coordinatesDisplay', newValue.value)}
                sx={{ width: 300 }}
                renderInput={(params) => <TextField {...params} label="Coordinates" />}
              />
            </Grid>
            <Grid id="setting-options" >
              <FormGroup>
                <FormControlLabel
                    control={
                        <Checkbox checked={userSettings.sandersonDirectory}
                                  onChange={(event) => handleValueChange('sandersonDirectory', event.target.checked)}
                        />
                    }
                    label="Dr. Sanderson's Directory Compatibility"
                />
                <FormControlLabel 
                    control={
                        <Checkbox checked={userSettings.sandersonOutput} 
                                  onChange={(event) => handleValueChange('sandersonOutput', event.target.checked)}
                        />
                    }
                    label="Show Dr. Sanderson's Output Replicas"
                />
                <FormControlLabel 
                    control={
                        <Checkbox checked={userSettings.autonext} 
                                  onChange={(event) => handleValueChange('autonext', event.target.checked)}
                        />
                    }
                    label="Automatically Select Next Image"
                />
              </FormGroup>
            </Grid>
            <Grid id="setting-email-wrapper" sx={{width:'100%'}} >
              <TextField id='setting-email' disabled hiddenLabel value={curSettings.email || ''} variant='outlined' type='email' placeholder='email address'
                          sx={{width:'100%', '&:invalid':{backgroundColor:'rgba(255,0,0.1)'}}}
                          slotProps={{
                            input: {
                              endAdornment: (
                                <IconButton onClick={handleChangeEmail} 
                                            onMouseDown={(event) => event.preventDefault()}
                                            onMouseUp={(event) => event.preventDefault()}>
                                <InputAdornment
                                    position="end"
                                    sx={{
                                      alignSelf: 'flex-end',
                                    }}
                                  >
                                    <BorderColorOutlinedIcon />
                                  </InputAdornment>
                                </IconButton>
                              ),
                            },
                          }}
              />
            </Grid>
          </Grid>
        </CardContent>
        <CardActions>
          <Grid container id="settings-actions-wrapper" direction="row" sx={{justifyContent:'space-between', alignItems:'center', width:'100%'}}
          >
            <Button variant="contained" onClick={() => onClose()}>Close</Button>
            {isAdmin && <Button variant="contained" onClick={() => handleAdmin()} disabled={getPassword}>Admin</Button>}
            {isOwner && !isAdmin && <Button variant="contained" onClick={() => handleOwner()} disabled={getPassword}>Manage</Button>}
            <Button variant="contained" onClick={() => onLogout()}>Logout</Button>
          </Grid>
        </CardActions>
      </Card>
      { getPassword &&
        <Grid id="settings-get-password-wrapper" justifyContent="center" alignItems="center" 
              sx={{position:'absolute', top:0, right:0, bottom:'50px', left:0, background:"rgb(0, 0, 0, 0.7)", zIndex:500}} >
          <Grid container direction="column" justifyContent="center" alignItems="center"
                sx={{backgroundColor:'rgb(230,230,230)', padding:'15px 0', marginTop:'30%'}} spacing={2}>
            <div id="admin-settings-login-close" sx={{height:'20px', flex:'1'}} onClick={() => setGetPassword(false)} style={{marginLeft:'auto', marginRight:'10px', cursor:'pointer'}} >
                <Typography variant="body3" sx={{textTransform:'uppercase',color:'black',backgroundColor:'rgba(255,255,255,0.3)',
                                                 padding:'3px 3px 3px 3px',borderRadius:'3px','&:hover':{backgroundColor:'rgba(255,255,255,0.7)',fontWeight:'bold'}
                                               }}>
                  X
                </Typography>

            </div>
            <div>
              <Typography gutterBottom variant="h6" component="h6">
                Please log in again
              </Typography>
              <Typography gutterBottom variant="body2">
                to access adminstration pages
              </Typography>
            </div>
              <TextField required 
                    autoFocus
                    id='password-entry'
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    size='small'
                    sx={{width:'95%', margin:'0px'}}
                    inputProps={{style: {fontSize: 12}}}
                    inputRef={passwordRef}
                    slotProps={{
                      inputLabel: {
                        shrink: true,
                      },
                      input: {
                        endAdornment: 
                          <InputAdornment position='end'>
                            <IconButton
                              aria-label={
                                showPassword ? 'hide the password' : 'display the password'
                              }
                              onClick={handleClickShowPassword}
                              onMouseDown={handleMouseDownPassword}
                              onMouseUp={handleMouseUpPassword}
                              edge='end'
                            >
                              {showPassword ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>,
                      },
                    }}
                    />
               <Button size='small' color='login_button'
                      sx={{bgcolor: 'background.default', '&:hover':{backgroundColor:'#AEAEAE'}}} endIcon={<LoginIcon />} 
                      onClick={handleLoginConfirmation}
              >
                Login
              </Button>
          </Grid>
        </Grid>
      }
      { changeEmail &&
         <Grid id="settings-change-email-wrapper" justifyContent="center" alignItems="center" 
              sx={{position:'absolute', top:0, right:0, bottom:'50px', left:0, background:"rgb(0, 0, 0, 0.7)", zIndex:500}} >
          <Grid container direction="column" justifyContent="center" alignItems="center"
                sx={{backgroundColor:'silver', padding:'15px 0', marginTop:'30%'}} spacing={2}>
            <div id="admin-settings-change-password-close" sx={{height:'20px', flex:'1'}} onClick={() => setChangeEmail(false)}
                  style={{marginLeft:'auto', marginRight:'10px', cursor:'pointer'}} >
                <Typography variant="body3" sx={{textTransform:'uppercase',color:'black',backgroundColor:'rgba(255,255,255,0.3)',
                                                 padding:'3px 3px 3px 3px',borderRadius:'3px','&:hover':{backgroundColor:'rgba(255,255,255,0.7)',fontWeight:'bold'}
                                               }}>
                  X
                </Typography>

            </div>
            <div>
              <Typography gutterBottom variant="h6" component="h6">
                Change your email
              </Typography>
            </div>
            <TextField required 
                  id='email1-entry'
                  label="Email"
                  type='email'
                  sx={{width:'95%', margin:'0px'}}
                  inputProps={{style: {fontSize: 12}}}
                  onChange={handleEmailChange}
                  inputRef={email1Ref}
                  slotProps={{
                    inputLabel: {
                      shrink: true,
                    },
                  }}
                  />
            <TextField required 
                  id='emai2-entry'
                  label="Confirm Email"
                  type='email'
                  sx={{width:'95%', margin:'0px'}}
                  inputProps={{style: {fontSize: 12}}}
                  onChange={handleEmailChange}
                  inputRef={email2Ref}
                  slotProps={{
                    inputLabel: {
                      shrink: true,
                    },
                  }}
                  />
            { emailMessage !== null &&
              <Typography gutterBottom color="#C23232" variant="body2">
                {emailMessage}
              </Typography>
            }
            <Grid container direction="row" justifyContent="space-between" alignItems="center">
              <Button size='small'
                    onClick={handleSaveEmail}
              >
                Save
              </Button>
              <Button size='small'
                    onClick={() => setChangeEmail(false)}
              >
              Cancel
              </Button>
            </Grid>
          </Grid>
        </Grid>
      }
    </Grid>
  );
}