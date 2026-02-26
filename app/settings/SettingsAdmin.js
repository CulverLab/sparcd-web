/** @module components/SettingsAdmin */

import * as React from 'react';
import ArrowDropDownOutlinedIcon from '@mui/icons-material/ArrowDropDownOutlined';
import ArrowDropUpOutlinedIcon from '@mui/icons-material/ArrowDropUpOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import ExitToAppOutlinedIcon from '@mui/icons-material/ExitToAppOutlined';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

import CheckIncompleteUploads from './CheckIncompleteUploads';
import EditCollection from './EditCollection';
import EditLocation from './EditLocation';
import EditSpecies from './EditSpecies';
import EditUser from './EditUser';
import { Level } from '../components/Messages';
import { AddMessageContext, CollectionsInfoContext, TokenExpiredFuncContext, LocationsInfoContext, 
         SizeContext, SpeciesInfoContext, TokenContext } from '../serverInfo';
import * as utils from '../utils';

const EditingStates = {
  None: 0,
  User: 1,
  Collection: 2,
  Species: 3,
  Location: 4,
};

/**
 * The direction of a sort
 */
const SortDirection = {
  Ascending: 0,
  Descending: 1,
};

/**
 * Returns the UI for administrator tasks
 * @function
 * @param {boolean} loadingCollections Flag indicating collections are being loaded
 * @param {boolean} loadingLocations Flag indicating locations are being loaded
 * @param {function} onConfirmPassword Function for confirming a password re-entry
 * @param {function} onSandboxRefresh Function for refreshing the sandbox entries
 * @param {function} onClose Function for when the user wants to close this
 * @return {object} The UI to render
 */
export default function SettingsAdmin({loadingCollections, loadingLocations, onConfirmPassword, onSandboxRefresh, onClose}) {
  const theme = useTheme();
  const addMessage = React.useContext(AddMessageContext); // Function adds messages for display
  const collectionInfo = React.useContext(CollectionsInfoContext);
  const locationItems = React.useContext(LocationsInfoContext);
  const setTokenExpired = React.useContext(TokenExpiredFuncContext);
  const settingsToken = React.useContext(TokenContext);  // Login token
  const uiSizes = React.useContext(SizeContext);  // UI Dimensions
  const panelsWrapperRef = React.useRef(null);  // Used for sizeing
  const [activeTab, setActiveTab] = React.useState(0);
  const [checkIncompleteUploads, setCheckIncompleteUploads] = React.useState(false);  // Indicated desire to check for incomplete uploads
  const [detailsHeight, setDetailsHeight] = React.useState(500); // Height for displaying details
  const [editingState, setEditingState] = React.useState({type:EditingStates.None, data:null})
  const [masterSpecies, setMasterSpecies] = React.useState(null); // Contains information on species
  const [serverURL, setServerURL] = React.useState(utils.getServer());  // The server URL to use
  const [locationsModified, setLocationsModified] = React.useState(false); // Indicates the location was modified and needs to be updated on S3
  const [serverModificationsChecked, setServerModificationsChecked] = React.useState(false); // Did we check the server for stored changes?
  const [speciesModified, setSpeciesModified] = React.useState(false); // Indicates the species was modified and needs to be updated on S3
  const [userInfo, setUserInfo] = React.useState(null); // Contains information on users

  const [selectedCollections, setSelectedCollections] = React.useState(loadingCollections ? [] : collectionInfo); // Used for searches
  const [selectedLocations, setSelectedLocations] = React.useState(loadingLocations ? [] : locationItems); // Used for searches
  const [selectedSpecies, setSelectedSpecies] = React.useState(masterSpecies || []); // Used for searches
  const [selectedUsers, setSelectedUsers] = React.useState(userInfo || []); // Used for searches
  const [sortColumn, setSortColumn] = React.useState(1);  // Used to indicate which column is sorted (1 represents the first column)
  const [sortDirection, setSortDirection] = React.useState(SortDirection.Ascending);  // Used to indicate which way a column is sorted

  // Check if we have stored changes on the server
  React.useEffect(() => {
    if (!serverModificationsChecked) {
      const adminCheckUrl = serverURL + '/adminCheckChanges?t=' + encodeURIComponent(settingsToken);

      try {
        const resp = fetch(adminCheckUrl, {
          credentials: 'include',
          method: 'GET',
        }).then(async (resp) => {
              if (resp.ok) {
                return resp.json();
              } else {
                if (resp.status === 401) {
                  // User needs to log in again
                  setTokenExpired();
                }
                throw new Error(`Failed to update changed settings information: ${resp.status}`, {cause:resp});
              }
            })
          .then((respData) => {
              // Handle the result
              if (respData.success) {
                setServerModificationsChecked(true);
                if (respData.locationsChanged) {
                  setLocationsModified(true);
                }
                if (respData.speciesChanged) {
                  setSpeciesModified(true);
                }
                if (respData.locationsChanged || respData.speciesChanged) {
                  addMessage(Level.Information, "Previous unsaved edits were found. These can be applied when you're done");
                }
              }
          })
          .catch(function(err) {
            console.log('Admin Location/Species Check Error: ',err);
        });
      } catch (error) {
        console.log('Admin Location/Species Check Unknown Error: ',err);
      }
    }
  }, [addMessage, locationsModified, serverModificationsChecked, serverURL, setServerModificationsChecked, settingsToken, speciesModified])

  // Recalcuate available space in the window
  React.useLayoutEffect(() => {
    if (panelsWrapperRef && panelsWrapperRef.current) {
      let footerHeight = 40;
      let headingsHeight = 77;

      let el = document.getElementById('admin-settings-footer');
      if (el) {
        const elRect = el.getBoundingClientRect();
        footerHeight = elRect.height;
      }

      el = document.getElementById('admin-settings-details');
      let el2 = document.getElementById('admin-settings-panel-wrapepr');
      if (el && el2) {
        let elRect = el.getBoundingClientRect();
        let elRect2 = el2.getBoundingClientRect();
        headingsHeight = elRect.top - elRect2.top;
      }

      setDetailsHeight(panelsWrapperRef.current.offsetHeight - footerHeight - headingsHeight);
    }
  }, [activeTab,panelsWrapperRef,setDetailsHeight]);

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
      id: `admin-settings-${index}`,
      'aria-controls': `admin-settings-${index}`,
    };
  }

  /**
   * Gets the user information from the server
   * @function
   */
  const getUserInfo = React.useCallback(() => {
    const adminUsersUrl = serverURL + '/adminUsers?t=' + encodeURIComponent(settingsToken);

    try {
      const resp = fetch(adminUsersUrl, {
        credentials: 'include',
        method: 'GET',
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              if (resp.status === 401) {
                // User needs to log in again
                setTokenExpired();
              }
              throw new Error(`Failed to get admin users: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
            // Set the user data
            setUserInfo(respData);
            setSelectedUsers(respData);
        })
        .catch(function(err) {
          console.log('Admin Users Error: ',err);
          addMessage(Level.Warning, 'An error ocurred when attempting to load user information');
      });
    } catch (error) {
      console.log('Admin Users Unknown Error: ',err);
      addMessage(Level.Warning, 'An unknown error ocurred when attempting to load user information');
    }    
  }, [addMessage, serverURL, settingsToken, setSelectedUsers, setTokenExpired, setUserInfo]);

  /**
   * Gets the master species information from the server (not the per-user species)
   * @function
   */
  const getMasterSpecies = React.useCallback(() => {
    const adminSpeciesUrl = serverURL + '/adminSpecies?t=' + encodeURIComponent(settingsToken);

    try {
      const resp = fetch(adminSpeciesUrl, {
        credentials: 'include',
        method: 'GET',
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              if (resp.status === 401) {
                // User needs to log in again
                setTokenExpired();
              }
              throw new Error(`Failed to get admin species: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
            // Set the species data
            setMasterSpecies(respData);
            setSelectedSpecies(respData);
        })
        .catch(function(err) {
          console.log('Admin Species Error: ',err);
          addMessage(Level.Warning, 'An error ocurred when attempting to load species information');
      });
    } catch (error) {
      console.log('Admin Species Unknown Error: ',err);
      addMessage(Level.Warning, 'An unknown error ocurred when attempting to load species information');
    }
  }, [addMessage, serverURL, settingsToken, setMasterSpecies, setSelectedSpecies, setTokenExpired]);

  /**
   * Updates the collection information on the server
   * @function
   * @param {object} collectionNewInfo The updated collection information to save
   * @param {function} onSuccess The callable upon success
   * @param {function} onError The callable upon an issue ocurring
   */
  const updateCollection = React.useCallback((collectionNewInfo, onSuccess, onError) => {
    const userUpdateCollUrl = serverURL + '/adminCollectionUpdate?t=' + encodeURIComponent(settingsToken);

    const formData = new FormData();

    formData.append('id', editingState.data && editingState.data.id ? editingState.data.id : null);
    formData.append('name', collectionNewInfo.name);
    formData.append('description', collectionNewInfo.description);
    formData.append('email', collectionNewInfo.email);
    formData.append('organization', collectionNewInfo.organization);
    formData.append('allPermissions', JSON.stringify(collectionNewInfo.allPermissions));

    try {
      const resp = fetch(userUpdateCollUrl, {
        credentials: 'include',
        method: 'POST',
        body: formData
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              if (resp.status === 401) {
                // User needs to log in again
                setTokenExpired();
              }
              throw new Error(`Failed to update collection information: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
            // Set the species data
            if (respData.success) {
              setEditingState({...editingState, data:{...editingState.data,...respData.data}});
              for (let idx = 0; idx < collectionInfo.length; idx++) {
                if (collectionInfo[idx].bucket === respData.data.bucket) {
                  collectionInfo[idx] = respData.data;
                  break;
                }
              }
              if (typeof(onSuccess) === 'function') {
                onSuccess();
              }
            } else if (typeof(onError) === 'function') {
              onError(respData.message);
            }
        })
        .catch(function(err) {
          console.log('Admin Update Collection Error: ',err);
          addMessage(Level.Warning, 'An error ocurred when attempting to update collection information');
      });
    } catch (error) {
      console.log('Admin Update Collection Unknown Error: ',err);
      addMessage(Level.Warning, 'An unknown error ocurred when attempting to update collection information');
    }
  }, [addMessage, collectionInfo, editingState, serverURL, setEditingState, settingsToken]);

  /**
   * Creates a new collection on the server
   * @function
   * @param {object} collectionNewInfo The new collection information to save
   * @param {function} onSuccess The callable upon success
   * @param {function} onError The callable upon an issue ocurring
   */
  const newCollection = React.useCallback((collectionNewInfo, onSuccess, onError) => {
    const userUpdateCollUrl = serverURL + '/adminCollectionAdd?t=' + encodeURIComponent(settingsToken);

    const formData = new FormData();

    formData.append('name', collectionNewInfo.name);
    formData.append('description', collectionNewInfo.description);
    formData.append('email', collectionNewInfo.email);
    formData.append('organization', collectionNewInfo.organization);
    formData.append('allPermissions', JSON.stringify(collectionNewInfo.allPermissions));

    try {
      const resp = fetch(userUpdateCollUrl, {
        credentials: 'include',
        method: 'POST',
        body: formData
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              if (resp.status === 401) {
                // User needs to log in again
                setTokenExpired();
              }
              throw new Error(`Failed to update collection information: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
            // Set the collection data
            if (respData.success) {
              setEditingState({...editingState, data:{...editingState.data,...respData.data}});
              collectionInfo.push(respData.data);

              if (typeof(onSuccess) === 'function') {
                onSuccess();
              }
            } else if (typeof(onError) === 'function') {
              onError(respData.message);
            }
        })
        .catch(function(err) {
          console.log('Admin Update Collection Error: ',err);
          addMessage(Level.Warning, 'An error ocurred when attempting to update collection information');
      });
    } catch (error) {
      console.log('Admin Update Collection Unknown Error: ',err);
      addMessage(Level.Warning, 'An unknown error ocurred when attempting to update collection information');
    }
  }, [addMessage, collectionInfo, editingState, serverURL, setEditingState, settingsToken]);

  /**
   * Handles adding new/updating the collection information
   * @function
   * @param {object} collectionNewInfo The updated collection information to save
   * @param {function} onSuccess The callable upon success
   * @param {function} onError The callable upon an issue ocurring
   */
  const handleUpdateCollection = React.useCallback((collectionNewInfo, onSuccess, onError) => {
    if (editingState.data && editingState.data.id) {
      updateCollection(collectionNewInfo, onSuccess, onError);
    } else {
      newCollection(collectionNewInfo, onSuccess, onError);
    }
  }, [newCollection, updateCollection]);

  /**
   * Handles updating the user information
   * @function
   * @param {object} userNewInfo The updated user information to save
   * @param {function} onSuccess The callable upon success
   * @param {function} onError The callable upon an issue ocurring
   */
  const updateUser = React.useCallback((userNewInfo, onSuccess, onError) => {
    const userUpdateUrl = serverURL + '/adminUserUpdate?t=' + encodeURIComponent(settingsToken);

    const formData = new FormData();

    formData.append('oldName', editingState.data.name);
    formData.append('newEmail', userNewInfo.email);
    formData.append('admin', userNewInfo.admin);

    try {
      const resp = fetch(userUpdateUrl, {
        credentials: 'include',
        method: 'POST',
        body: formData
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              if (resp.status === 401) {
                // User needs to log in again
                setTokenExpired();
              }
              throw new Error(`Failed to update user information: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
            // Set the species data
            if (respData.success) {
              setEditingState({...editingState, data:{...editingState.data, email:respData.email}});
              let curUser = userInfo.filter((item) => item.name === editingState.data.name);
              if (curUser && curUser.length > 0) {
                curUser[0]['email'] = respData.email;
              }
              if (typeof(onSuccess) === 'function') {
                onSuccess();
              }
            } else if (typeof(onError) === 'function') {
              onError(respData.message);
            }
        })
        .catch(function(err) {
          console.log('Admin Update User Error: ',err);
          addMessage(Level.Warning, 'An error ocurred when attempting to update user information');
      });
    } catch (error) {
      console.log('Admin Update User Unknown Error: ',err);
      addMessage(Level.Warning, 'An unknown error ocurred when attempting to update user information');
    }
  }, [addMessage, editingState, serverURL, setEditingState, settingsToken, userInfo]);

  /**
   * Handles updating the species information
   * @function
   * @param {object} newInfo The updated species information to save
   * @param {function} onSuccess The callable upon success
   * @param {function} onError The callable upon an issue ocurring
   */
  const updateSpecies = React.useCallback((newInfo, onSuccess, onError) => {
    const speciesUpdateUrl = serverURL + '/adminSpeciesUpdate?t=' + encodeURIComponent(settingsToken);

    const formData = new FormData();

    formData.append('newName', newInfo.name);
    if (editingState.data) {
      formData.append('oldScientific', editingState.data.scientificName);
    }
    formData.append('newScientific', newInfo.scientificName);
    formData.append('keyBinding', newInfo.keyBinding);
    formData.append('iconURL', newInfo.speciesIconURL);

    try {
      const resp = fetch(speciesUpdateUrl, {
        credentials: 'include',
        method: 'POST',
        body: formData
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              if (resp.status === 401) {
                // User needs to log in again
                setTokenExpired();
              }
              throw new Error(`Failed to update species information: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
            // Set the species data
            if (respData.success) {
              const oldEditingState = editingState;
              const newEditingState = {...editingState, data:{...editingState.data,...newInfo}};
              let curSpecies = masterSpecies.filter((item) => item.scientificName === newEditingState.data.scientificName);

              if (curSpecies && curSpecies.length > 0) {
                curSpecies[0]['name'] = newInfo.name;
                curSpecies[0]['keyBinding'] = newInfo.keyBinding;
                curSpecies[0]['speciesIconURL'] = newInfo.speciesIconURL;

                setSpeciesModified(true);
                if (typeof(onSuccess) === 'function') {
                  onSuccess();
                }
              } else if (!oldEditingState.data) {
                let newMasterSpecies = masterSpecies;
                newMasterSpecies.push({name:newInfo.name,
                                       scientificName:newInfo.scientificName,
                                       keyBinding:newInfo.keyBinding ? newInfo.keyBinding : null,
                                       speciesIconUrl:newInfo.speciesIconURL});
                setMasterSpecies(newMasterSpecies);
                setSpeciesModified(true);
                if (typeof(onSuccess) === 'function') {
                  onSuccess();
                }
              } else {
                console.log('Error: unable to find species locally to update');
                if (typeof(onError) === 'function') {
                  onError("A problem ocurred updating the UI with these changes. Please refresh to see the updates");
                }
              }
            } else if (typeof(onError) === 'function') {
              onError(respData.message);
            }
        })
        .catch(function(err) {
          console.log('Admin Update Species Error: ',err);
          addMessage(Level.Warning, 'An error ocurred when attempting to update species information');
      });
    } catch (error) {
      console.log('Admin Update Species Unknown Error: ',err);
      addMessage(Level.Warning, 'An unknown error ocurred when attempting to update species information');
    }
  }, [addMessage, editingState, masterSpecies, serverURL, setMasterSpecies, setSpeciesModified, settingsToken,]);

  /**
   * Handles updating the location information
   * @function
   * @param {object} newInfo The updated location information to save
   * @param {function} onSuccess The callable upon success
   * @param {function} onError The callable upon an issue ocurring
   */
  const updateLocation = React.useCallback((newInfo, onSuccess, onError) => {
    const locationsUpdateUrl = serverURL + '/adminLocationUpdate?t=' + encodeURIComponent(settingsToken);

    const formData = new FormData();

    formData.append('name', newInfo.nameProperty);
    formData.append('id', editingState.data ? editingState.data.idProperty : newInfo.idProperty);
    formData.append('active', newInfo.activeProperty);
    formData.append('measure', newInfo.measure);
    formData.append('elevation', newInfo.elevationProperty);
    formData.append('coordinate', newInfo.coordinate);
    formData.append('new_lat', newInfo.latProperty);
    formData.append('new_lon', newInfo.lngProperty);
    formData.append('old_lat', editingState.data !== null ? editingState.data.latProperty : null);
    formData.append('old_lon', editingState.data !== null ? editingState.data.lngProperty : null)
    formData.append('utm_zone', newInfo.utm_zone);
    formData.append('utm_letter', newInfo.utm_letter);
    formData.append('utm_x', newInfo.utm_x);
    formData.append('utm_y', newInfo.utm_y);
    formData.append('description', newInfo.descriptionProperty);

    try {
      const resp = fetch(locationsUpdateUrl, {
        credentials: 'include',
        method: 'POST',
        body: formData
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              if (resp.status === 401) {
                // User needs to log in again
                setTokenExpired();
              }
              throw new Error(`Failed to update location information: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
            // Set the species data
            if (respData.success) {
              const oldEditingState = editingState;
              const newEditingState = {...editingState, data:{...editingState.data,...respData.data}};
              let curLocation = locationItems.filter((item) => item.idProperty === newEditingState.data.idProperty && 
                                                                  (!oldEditingState.data || 
                                                                      (item.nameProperty === oldEditingState.data.nameProperty)
                                                                  ));

              if (curLocation && curLocation.length > 0) {
                // Update old location
                curLocation[0]['nameProperty'] = respData.data.nameProperty;
                curLocation[0]['idProperty'] = respData.data.idProperty;
                curLocation[0]['activeProperty'] = respData.data.activeProperty;
                curLocation[0]['latProperty'] = respData.data.latProperty;
                curLocation[0]['lngProperty'] = respData.data.lngProperty;
                curLocation[0]['elevationProperty'] = respData.data.elevationProperty;
                curLocation[0]['utm_code'] = respData.data.utm_code;
                curLocation[0]['utm_x'] = respData.data.utm_x;
                curLocation[0]['utm_y'] = respData.data.utm_y;

                setLocationsModified(true);
                if (typeof(onSuccess) === 'function') {
                  onSuccess();
                }
              } else if (!oldEditingState.data) {
                // We have a new location
                let newLocationItems = locationItems;
                newLocationItems.push(respData.data);
                locationItems.push(curLocation);
                setLocationsModified(true);
                if (typeof(onSuccess) === 'function') {
                  onSuccess();
                }
              } else {
                console.log('Error: unable to find location locally to update');
                if (typeof(onError) === 'function') {
                  onError("A problem ocurred updating the UI with these changes. Please refresh to see the updates");
                }
              }
            } else if (typeof(onError) === 'function') {
              onError(respData.message);
            }
        })
        .catch(function(err) {
          console.log('Admin Update Location Error: ',err);
          addMessage(Level.Warning, 'An error ocurred when attempting to update location information');
      });
    } catch (error) {
      console.log('Admin Update Location Unknown Error: ',err);
      addMessage(Level.Warning, 'An unknown error ocurred when attempting to update location information');
    }
  }, [addMessage, editingState, locationItems, serverURL, setLocationsModified, settingsToken]);

  /**
   * Handles the commit of any species or location changes
   * @function
   */
  const handleSaveChanges = React.useCallback(() => {
    const adminCompleteUrl = serverURL + '/adminCompleteChanges?t=' + encodeURIComponent(settingsToken);

    try {
      const resp = fetch(adminCompleteUrl, {
        credentials: 'include',
        method: 'PUT',
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              if (resp.status === 401) {
                // User needs to log in again
                setTokenExpired();
              }
              throw new Error(`Failed to update changed settings information: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
            // Handle the result
            addMessage(Level.Information, 'Changes were successfully saved');
            onClose();
        })
        .catch(function(err) {
          console.log('Admin Save Location/Species Error: ',err);
          addMessage(Level.Warning, 'An error ocurred when attempting to complete saving the changed settings information');
      });
    } catch (error) {
      console.log('Admin Save Location/Species Unknown Error: ',err);
      addMessage(Level.Warning, 'An unknown error ocurred when attempting to complete saving the changed settings information');
    }
  }, [addMessage, serverURL, settingsToken])

  /**
   * Handles the abandonment of any species or location changes
   * @function
   */
  const handleAbandonChanges = React.useCallback(() => {
    const adminCompleteUrl = serverURL + '/adminAbandonChanges?t=' + encodeURIComponent(settingsToken);

    try {
      const resp = fetch(adminCompleteUrl, {
        credentials: 'include',
        method: 'PUT',
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              if (resp.status === 401) {
                // User needs to log in again
                setTokenExpired();
              }
              throw new Error(`Failed to abandon changed settings information: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
            // Handle the result
            addMessage(Level.Information, 'The outstanding changes were successfully abandoned');
            onClose();
        })
        .catch(function(err) {
          console.log('Admin Abandon Location/Species Error: ',err);
          addMessage(Level.Warning, 'An error ocurred when attempting to abandon the changed settings information');
      });
    } catch (error) {
      console.log('Admin Abandon Location/Species Unknown Error: ',err);
      addMessage(Level.Warning, 'An unknown error ocurred when attempting to abandon the changed settings information');
    }
  }, [addMessage, serverURL, settingsToken])


  /**
   * Handles the new user button press
   * @function
   * @param {object} event The triggering event
   * @param {object} {location} The user object to edit or falsy if a new user is wanted
   */
  const handleUserEdit = React.useCallback((event, user) => {
    event.stopPropagation();
    setEditingState({type:EditingStates.User, data:user});
  }, [setEditingState]);

  /**
   * Handles the new collection button press
   * @function
   * @param {object} event The triggering event
   * @param {object} {location} The collection object to edit or falsy if a new collection is wanted
   */
  const handleCollectionEdit = React.useCallback((event, collection) => {
    event.stopPropagation();

    // Check if this is for a new collection
    if (!collection) {
      setEditingState({type:EditingStates.Collection, data:collection});
      return;
    }

    const adminCollectionUrl = serverURL + '/adminCollectionDetails?t=' + encodeURIComponent(settingsToken);
    const formData = new FormData();

    formData.append('bucket', collection.bucket);

    try {
      const resp = fetch(adminCollectionUrl, {
        credentials: 'include',
        method: 'POST',
        body: formData,
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              if (resp.status === 401) {
                // User needs to log in again
                setTokenExpired();
              }
              throw new Error(`Failed to get collection details information: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
            // Handle the result
            setEditingState({type:EditingStates.Collection, data:respData});
        })
        .catch(function(err) {
          console.log('Admin Collection Details Error: ',err);
          addMessage(Level.Warning, 'An error ocurred when attempting to get collection details');
      });
    } catch (error) {
      console.log('Admin Collection Details Unknown Error: ',err);
      addMessage(Level.Warning, 'An unknown error ocurred when attempting to get collection details');
    }

  }, [addMessage, serverURL, setEditingState, settingsToken]);

  /**
   * Handles the new species button press
   * @function
   * @param {object} event The triggering event
   * @param {object} {location} The species object to edit or falsy if a new species is wanted
   */
  const handleSpeciesEdit = React.useCallback((event, species) => {
    event.stopPropagation();
    setEditingState({type:EditingStates.Species, data:species});
  }, [setEditingState]);

  /**
   * Handles the new location button press
   * @function
   * @param {object} event The triggering event
   * @param {object} {location} The location object to edit or falsy if a new location is wanted
   */
  const handleLocationEdit = React.useCallback((event, location) => {
    event.stopPropagation();

    // Check if we have a location, if not we're adding a new one
    if (!location) {
      setEditingState({type:EditingStates.Location, data:null});
      return;
    }

    // Get the location details from the server before editing
    const adminLocationnUrl = serverURL + '/adminLocationDetails?t=' + encodeURIComponent(settingsToken);
    const formData = new FormData();

    formData.append('id', location.idProperty);

    try {
      const resp = fetch(adminLocationnUrl, {
        credentials: 'include',
        method: 'POST',
        body: formData,
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              if (resp.status === 401) {
                // User needs to log in again
                setTokenExpired();
              }
              throw new Error(`Failed to get location details information: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
            // Handle the result
            setEditingState({type:EditingStates.Location, data:respData});
        })
        .catch(function(err) {
          console.log('Admin Location Details Error: ',err);
          addMessage(Level.Warning, 'An error ocurred when attempting to get location details');
      });
    } catch (error) {
      console.log('Admin Location Details Unknown Error: ',err);
      addMessage(Level.Warning, 'An unknown error ocurred when attempting to get location details');
    }

  }, [addMessage, serverURL, setEditingState, settingsToken]);

  /**
   * Handles the user search button press
   * @function
   * @param {object} event The change event for searching
   */
  const searchUsers = React.useCallback((event) => {
    if (event.target.value && userInfo) {
      const ucSearch = event.target.value.toUpperCase();
      setSelectedUsers(userInfo.filter((item) => item.name.toUpperCase().includes(ucSearch) || item.email.toUpperCase().includes(ucSearch) ));
    } else {
      setSelectedUsers(userInfo || []);
    }
  }, [setSelectedUsers, userInfo]);

  /**
   * Handles the collection search button press
   * @function
   * @param {object} event The change event for searching
   */
  const searchCollections = React.useCallback((event) => {
    if (event.target.value && !loadingCollections) {
      const ucSearch = event.target.value.toUpperCase();
      setSelectedCollections(collectionInfo.filter((item) => item.name.toUpperCase().includes(ucSearch) || item.id.toUpperCase().includes(ucSearch) ||
                                                                    item.email.toUpperCase().includes(ucSearch) ));
    } else {
      setSelectedCollections(loadingCollections ? [] : collectionInfo);
    }
  }, [collectionInfo, setSelectedCollections]);

  /**
   * Handles the species search button press
   * @function
   * @param {object} event The change event for searching
   */
  const searchSpecies = React.useCallback((event) => {
    if (event.target.value && masterSpecies) {
      const ucSearch = event.target.value.toUpperCase();
      setSelectedSpecies(masterSpecies.filter((item) => item.name.toUpperCase().includes(ucSearch) || item.scientificName.toUpperCase().includes(ucSearch) ));
    } else {
      setSelectedSpecies(masterSpecies || []);
    }
  }, [masterSpecies, setSelectedSpecies]);

  /**
   * Handles the location search button press
   * @function
   * @param {object} event The change event for searching
   */
  const searchLocations = React.useCallback((event) => {
    if (event.target.value && !loadingLocations) {
      const ucSearch = event.target.value.toUpperCase();
      setSelectedLocations(locationItems.filter((item) => item.nameProperty.toUpperCase().includes(ucSearch) || item.idProperty.toUpperCase().includes(ucSearch) ));
    } else {
      setSelectedLocations(loadingLocations ? [] : locationItems);
    }
  }, [locationItems, setSelectedLocations]);

  /**
   * Handles checking for incomplete uploads that are not known to the database
   * @function
   */
  const handleCheckIncompleteUploads = React.useCallback(() => {
    setCheckIncompleteUploads(true);
  }, []);

  /**
   * Sorts user records by the specified column
   * @function
   * @param {string} sortColumn The name of the column to sort on
   * @param {object} direction The direction to sort in (see SortDirectio)
   */
  const sortUsers = React.useCallback((sortColumn, direction) => {
    const curSortInfo = selectedUsers || [];
    switch(sortColumn) {
      case 'name':
        setSelectedUsers(curSortInfo.sort((a, b) => direction === SortDirection.Ascending ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)));
        break;
      case 'email':
        setSelectedUsers(curSortInfo.sort((a, b) => direction === SortDirection.Ascending ? a.email.localeCompare(b.email) : b.email.localeCompare(a.email)));
        break;
      case 'admin':
        setSelectedUsers(curSortInfo.sort((a, b) => direction === SortDirection.Ascending ? (a.admin === b.admin ? 0 : -1) : (a.admin === b.admin ? -1 : 0) ));
        break;
      case 'auto':
        setSelectedUsers(curSortInfo.sort((a, b) => direction === SortDirection.Ascending ? (a.autoAdded === b.autoAdded ? 0 : -1) : (a.autoAdded === b.autoAdded ? -1 : 0) ));
        break;
    }
  }, [selectedUsers, setSelectedUsers]);

  /**
   * Sorts collections records by the specified column
   * @function
   * @param {string} sortColumn The name of the column to sort on
   * @param {object} direction The direction to sort in (see SortDirectio)
   */
  const sortCollections = React.useCallback((sortColumn, direction) => {
    const curSortInfo = selectedCollections || [];
    switch(sortColumn) {
      case 'name':
        setSelectedCollections(curSortInfo.sort((a, b) => direction === SortDirection.Ascending ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)));
        break;
      case 'id':
        setSelectedCollections(curSortInfo.sort((a, b) => direction === SortDirection.Ascending ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id)));
        break;
      case 'email':
        setSelectedCollections(curSortInfo.sort((a, b) => direction === SortDirection.Ascending ? a.email.localeCompare(b.email) : b.email.localeCompare(a.email)));
        break;
    }
  }, [selectedCollections, setSelectedCollections]);

  /**
   * Sorts species records by the specified column
   * @function
   * @param {string} sortColumn The name of the column to sort on
   * @param {object} direction The direction to sort in (see SortDirectio)
   */
  const sortSpecies = React.useCallback((sortColumn, direction) => {
    const curSortInfo = selectedSpecies || [];
    switch(sortColumn) {
      case 'name':
        setSelectedSpecies(curSortInfo.sort((a, b) => direction === SortDirection.Ascending ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)));
        break;
      case 'sciName':
        setSelectedSpecies(curSortInfo.sort((a, b) => direction === SortDirection.Ascending ? a.scientificName.localeCompare(b.scientificName) :
                                                                                                                b.scientificName.localeCompare(a.scientificName)));
        break;
      case 'key':
        setSelectedSpecies(curSortInfo.sort((a, b) => a.keyBinding  && b.keyBinding ? 
                                                        direction === SortDirection.Ascending ? a.keyBinding.localeCompare(b.keyBinding) : b.keyBinding.localeCompare(a.keyBinding) :
                                                          !a.keyBinding ? 1 : -1
                                            )
                          );
        break;
    }
  }, [selectedSpecies, setSelectedSpecies]);

  /**
   * Sorts Locations records by the specified column
   * @function
   * @param {string} sortColumn The name of the column to sort on
   * @param {object} direction The direction to sort in (see SortDirectio)
   */
  const sortLocations = React.useCallback((sortColumn, direction) => {
    const curSortInfo = selectedLocations || [];
    switch(sortColumn) {
      case 'name':
        setSelectedSpecies(curSortInfo.sort((a, b) => direction === SortDirection.Ascending ? a.nameProperty.localeCompare(b.nameProperty) : 
                                                                                                                  b.nameProperty.localeCompare(a.nameProperty)));
        break;
      case 'id':
        setSelectedSpecies(curSortInfo.sort((a, b) => direction === SortDirection.Ascending ? a.idProperty.localeCompare(b.idProperty) :
                                                                                                                b.idProperty.localeCompare(a.idProperty)));
        break;
      case 'active':
        setSelectedSpecies(curSortInfo.sort((a, b) => direction === SortDirection.Ascending ? (a.active === b.active ? 0 : 1) : (a.active === b.active ? 1 : 0) ));
        break;
    }
  }, [selectedSpecies, setSelectedSpecies]);

  /**
   * Generates the UI for a column heading
   * @function
   * @param {object} selectId The ID used to identify the column when selected
   * @param {boolean} sorted True if the column is sorted
   * @param {object} sortDirection The direction of the sort (see SortDirection). Ignored if sorted is not truthy True
   * @param {int} size The size of the column
   * @param {string} title The title of the column
   * @param {object} titleStyle Addtional styling object
   * @param {function} {sortCb} Optional column to sort by
   * @return {object} The UI object to render
   */
  function generateSettingHeader(selectId, sorted, sortDirection, size, title, titleStyle, sortCb) {
    titleStyle = titleStyle || {};

    return (
          <Grid container direction="row" justifyContent="space-between" alignItems="start" wrap="nowrap" size={size} sx={{paddingLeft:"2px", borderRight:"1px solid grey"}} 
                onClick={() => {
                                const oldSC = sortColumn;
                                const newSortDirection = oldSC === selectId ? (sortDirection===SortDirection.Ascending?SortDirection.Descending:SortDirection.Ascending) : SortDirection.Ascending;
                                setSortColumn(selectId);
                                setSortDirection(newSortDirection);
                                if (sortCb && typeof(sortCb) === 'function') {
                                  sortCb(newSortDirection);
                                }
                              }
                        }
            >
            <Grid sx={{...titleStyle}} >
              <Typography nowrap="true" variant="body" sx={{fontWeight:'bold'}}>
                {title}
              </Typography>
            </Grid>
            {sorted && sortDirection === SortDirection.Ascending && <ArrowDropUpOutlinedIcon />}
            {sorted && sortDirection === SortDirection.Descending && <ArrowDropDownOutlinedIcon />}
            {!sorted && <ArrowDropDownOutlinedIcon sx={{visibility:"hidden"}} />}
          </Grid>
    );
  }

  /**
   * Returns the UI for editing users. Starts the user information fetch if we don't have it already
   * @function
   * @param {function} dblClickFunc Function to handle the user double clicking on a row
   * @return {object} The generated UI
   */
  function generateUsers(dblClickFunc) {
    let curUserInfo = selectedUsers || [];
    if (userInfo === null) {
      getUserInfo();
      setUserInfo([]);
      setSelectedUsers([]);
    }
    if (userInfo === null && curUserInfo.length <= 0) {
      return (
        <Grid container justifyContent="center" alignItems="center" sx={{position:'absolute',top:'0px', right:'0px', bottom:'0px', left:'0px'}} >
          <CircularProgress />
        </Grid>
      );
    }

    dblClickFunc = dblClickFunc ? dblClickFunc : () => {};
    return (
      <Grid id='admin-settings-users-details-wrapper' container direction="column" justifyContent="center" alignItems="center"
            sx={{width:'100%', padding:'0px 5px 0 5px'}} >
        <Grid id="admin-settings-collection-header" container direction="row" justifyContent="space-between" alignItems="start"
              sx={{width:'100%', backgroundColor:'lightgrey', borderBottom:'1px solid black'}} >
          { generateSettingHeader(1, sortColumn === 1, sortDirection, 2, 'Name', {marginRight:"auto"}, (dir)=>sortUsers('name', dir) )}
          { generateSettingHeader(2, sortColumn === 2, sortDirection, 3, 'Email', {marginRight:"auto"}, (dir)=>sortUsers('email', dir) )}
          { generateSettingHeader(3, false,            sortDirection, 5, 'Collections', {marginRight:"auto"})}
          { generateSettingHeader(4, sortColumn === 4, sortDirection, 1, 'Admin', {marginLeft:"auto"}, (dir)=>sortUsers('admin', dir) )}
          { generateSettingHeader(5, sortColumn === 5, sortDirection, 1, 'Auto', {marginLeft:"auto", paddingRight:"5px"}, (dir)=>sortUsers('auto', dir) )}
        </Grid>
        <Grid id='admin-settings-details' sx={{overflowX:'scroll',width:'100%', maxHeight:detailsHeight+'px' }}>
        { curUserInfo.map((item,idx) => 
            <Grid container direction="row" id={"admin-user-"+idx} key={item.name+'-'+idx} direction="row" justifyContent="space-between" alignItems="start"
                  sx={{width:'100%', '&:hover':{backgroundColor:'rgba(0,0,0,0.05)'} }} onDoubleClick={(event) => dblClickFunc(event,item)} >
              <Grid size={2}>
                <Typography nowrap="true" variant="body2">
                  {item.name}
                </Typography>
              </Grid>
              <Grid size={3}>
                <Typography nowrap="true" variant="body2">
                  {item.email}
                </Typography>
              </Grid>
              <Grid size={5}>
                <Typography nowrap="true" variant="body2">
                  { item.collections.map((colItem, colIdx) => 
                      <React.Fragment key={colItem.name+'-'+colIdx}>
                        {colIdx > 0 && ', '}
                        {colItem.name}
                        <span style={{fontWeight:'bold', fontSize:'small'}}>
                          &nbsp;(
                          {colItem.owner && 'O'}
                          {colItem.read && 'R'}
                          {colItem.write && 'W'}
                          )
                        </span>
                      </React.Fragment>
                  )}
                </Typography>
              </Grid>
              <Grid size={1}>
                <Typography nowrap="true" variant="body2" align="center">
                  {item.admin ? 'Y' : ' '}
                </Typography>
              </Grid>
              <Grid size={1} sx={{paddingRight:"5px"}} >
                <Typography nowrap="true" variant="body2" align="right">
                  {item.autoAdded ? 'Y' : 'N'}
                </Typography>
              </Grid>
            </Grid>
        )}
          </Grid>
      </Grid>
    );
  }

  /**
   * Returns the UI for editing Collections
   * @function
   * @param {function} dblClickFunc Function to handle the user double clicking on a row
   * @return {object} The generated UI
   */
  function generateCollections(dblClickFunc) {
    if (loadingCollections) {
      return (
        <Grid container justifyContent="center" alignItems="center" sx={{position:'absolute',top:'0px', right:'0px', bottom:'0px', left:'0px'}} >
          <CircularProgress />
        </Grid>
      );
    }

    dblClickFunc = dblClickFunc ? dblClickFunc : () => {};
    return (
      <Grid id='admin-settings-collections-details-wrapper' container direction="column" justifyContent="center" alignItems="center"
            sx={{width:'100%', padding:'0px 5px 0 5px'}} >
        <Grid id="admin-settings-collection-details-header" container direction="row" justifyContent="space-between" alignItems="start"
              sx={{width:'100%', backgroundColor:'lightgrey', borderBottom:'1px solid black'}} >
          { generateSettingHeader(1, sortColumn === 1, sortDirection, 5, 'Name', {marginRight:"auto"}, (dir)=>sortCollections('name', dir) )}
          { generateSettingHeader(2, sortColumn === 2, sortDirection, 4, 'ID', {marginRight:"auto"}, (dir)=>sortCollections('id', dir) )}
          { generateSettingHeader(3, sortColumn === 3, sortDirection, 3, 'email', {marginLeft:"auto", paddingRight:"5px"}, (dir)=>sortCollections('email', dir) )}
        </Grid>
        <Grid id='admin-settings-details' sx={{overflowX:'scroll',width:'100%', maxHeight:detailsHeight+'px' }}>
        { selectedCollections.map((item, idx) => 
            <Grid container direction="row" id={"admin-species-"+idx} key={item.name+'-'+idx} direction="row" justifyContent="space-between" alignItems="start"
                  sx={{width:'100%', '&:hover':{backgroundColor:'rgba(0,0,0,0.05)'} }} onDoubleClick={(event) => dblClickFunc(event,item)} >
              <Grid size={5}>
                <Typography nowrap="true" variant="body2">
                  {item.name}
                </Typography>
              </Grid>
              <Grid size={4} sx={{marginRight:'auto'}}>
                <Typography nowrap="true" variant="body2">
                  {item.id}
                </Typography>
              </Grid>
              <Grid sizeo={3} sx={{leftMargin:'auto'}}>
                <Typography nowrap="true" variant="body2">
                  {item.email}
                </Typography>
              </Grid>
          </Grid>
        )}
        </Grid>
      </Grid>
    );
  }

  /**
   * Returns the UI for editing the main species list. Starts the main species fetch if we don't have it already
   * @function
   * @param {function} dblClickFunc Function to handle the user double clicking on a row
   * @return {object} The generated UI
   */
  function generateSpecies(dblClickFunc) {
    let curSpecies = selectedSpecies || [];
    if (masterSpecies == null) {
      getMasterSpecies();
      setMasterSpecies([]);
      setSelectedSpecies([]);
    }
    if (curSpecies.length <= 0) {
      return (
        <Grid container justifyContent="center" alignItems="center" sx={{position:'absolute',top:'0px', right:'0px', bottom:'0px', left:'0px'}} >
          <CircularProgress />
        </Grid>
      );
    }

    dblClickFunc = dblClickFunc ? dblClickFunc : () => {};
    return (
      <Grid id='admin-settings-species-details-wrapper' container direction="column" justifyContent="center" alignItems="center"
            sx={{width:'100%', padding:'0px 5px 0 5px'}} >
        <Grid id="admin-settings-species-header" container direction="row" justifyContent="space-between" alignItems="start"
              sx={{width:'100%', backgroundColor:'lightgrey', borderBottom:'1px solid black'}} >
          { generateSettingHeader(1, sortColumn === 1, sortDirection, 5, 'Name', {marginRight:"auto"}, (dir)=>sortSpecies('name', dir) )}
          { generateSettingHeader(2, sortColumn === 2, sortDirection, 5, 'Scientific Name', {marginRight:"auto"}, (dir)=>sortSpecies('sciName', dir) )}
          { generateSettingHeader(3, sortColumn === 3, sortDirection, 2, 'Key Binding', {marginLeft:"auto", paddingRight:"5px"}, (dir)=>sortSpecies('key', dir) )}
        </Grid>
        <Grid id='admin-settings-details' sx={{overflowX:'scroll',width:'100%', maxHeight:detailsHeight+'px' }}>
        { curSpecies.map((item, idx) => 
              <Grid container direction="row" id={"admin-species-"+idx} key={item.name+'-'+idx} direction="row" justifyContent="space-between" alignItems="start"
                    sx={{width:'100%', '&:hover':{backgroundColor:'rgba(0,0,0,0.05)'}}} onDoubleClick={(event) => dblClickFunc(event,item)} >
                <Grid size={5}>
                  <Typography nowrap="true" variant="body2">
                    {item.name}
                  </Typography>
                </Grid>
                <Grid size={5} sx={{marginRight:'auto'}}>
                  <Typography nowrap="true" variant="body2">
                    {item.scientificName}
                  </Typography>
                </Grid>
                <Grid sizeo={2} sx={{leftMargin:'auto'}}>
                  <Typography nowrap="true" variant="body2">
                    {item.keyBinding}
                  </Typography>
                </Grid>
              </Grid>
        )}
        </Grid>
      </Grid>
    );
  }

  /**
   * Returns the UI for editing Locations
   * @function
   * @param {function} dblClickFunc Function to handle the user double clicking on a row
   * @return {object} The generated UI
   */
  function generateLocations(dblClickFunc) {
    if (loadingLocations) {
      return (
        <Grid container justifyContent="center" alignItems="center" sx={{position:'absolute',top:'0px', right:'0px', bottom:'0px', left:'0px'}} >
          <CircularProgress />
        </Grid>
      );
    }

    dblClickFunc = dblClickFunc ? dblClickFunc : () => {};
    return (
      <Grid id='admin-settings-locations-details-wrapper' container direction="column" justifyContent="center" alignItems="center"
            sx={{width:'100%', padding:'0px 5px 0 5px'}} >
        <Grid id="admin-settings-species-header" container direction="row" justifyContent="space-between" alignItems="start"
              sx={{width:'100%', backgroundColor:'lightgrey', borderBottom:'1px solid black'}} >
          { generateSettingHeader(1, sortColumn === 1, sortDirection, 5, 'Name', {marginRight:"auto"}, (dir)=>sortLocations('name', dir) )}
          { generateSettingHeader(2, sortColumn === 2, sortDirection, 3, 'ID', {marginRight:"auto"}, (dir)=>sortLocations('id', dir) )}
          { generateSettingHeader(3, sortColumn === 3, sortDirection, 2, 'Active', {marginRight:"auto"}, (dir)=>sortLocations('active', dir) )}
          { generateSettingHeader(4, false,            sortDirection, 2, 'Location', {marginLeft:"auto", paddingRight:"5px"} )}
        </Grid>
        <Grid id='admin-settings-details' sx={{overflowX:'scroll',width:'100%', maxHeight:detailsHeight+'px' }}>
        { selectedLocations.map((item, idx) => {
            const extraAttribs = item.activeProperty ? {} : {color:'grey'};
            return (<Grid container direction="row" id={"admin-species-"+idx} key={item.name+'-'+idx} justifyContent="space-between" alignItems="start"
                    sx={{width:'100%', '&:hover':{backgroundColor:'rgba(0,0,0,0.05)'}, ...extraAttribs }} onDoubleClick={(event) => dblClickFunc(event,item)} >
                <Grid size={5}>
                  <Typography nowrap="true" variant="body2" >
                    {item.nameProperty}
                  </Typography>
                </Grid>
                <Grid size={3} sx={{marginRight:'auto'}}>
                  <Typography nowrap="true" variant="body2">
                    {item.idProperty}
                  </Typography>
                </Grid>
                <Grid size={2} sx={{marginRight:'auto'}}>
                  <Typography nowrap="true" variant="body2" align="center">
                    {item.activeProperty ? 'Y' : ' '}
                  </Typography>
                </Grid>
                <Grid size={2} sx={{marginLeft:'auto'}} >
                  <Typography nowrap="true" variant="body2" align="right">
                    {item.latProperty + ', ' + item.lngProperty}
                  </Typography>
                </Grid>
              </Grid>
            );}
        )}
        </Grid>
      </Grid>
    );
  }

  /**
   * Generates the UI for the editing of settings entries
   * @function
   * @return {object} The generated UI
   */
  function generateEditingUI() {
    return (
      <Grid container id="settings-admin-edit-wrapper" alignItems="center" justifyContent="center"
            sx={{position:'absolute', top:0, right:0, bottom:0, left:0, backgroundColor:'rgb(0,0,0,0.5)'}}
      >
      {editingState.type === EditingStates.User && <EditUser data={editingState.data} onUpdate={updateUser} onConfirmPassword={onConfirmPassword}
                                                             onClose={() => setEditingState({type:EditingStates.None, data:null})} /> }
      {editingState.type === EditingStates.Collection && <EditCollection data={editingState.data} onUpdate={handleUpdateCollection}
                                                                          onClose={() => setEditingState({type:EditingStates.None, data:null})}/> }
      {editingState.type === EditingStates.Species && <EditSpecies data={editingState.data} onUpdate={updateSpecies} 
                                                                      onClose={() => setEditingState({type:EditingStates.None, data:null})}/> }
      {editingState.type === EditingStates.Location && <EditLocation data={editingState.data} onUpdate={updateLocation}
                                                                      onClose={() => setEditingState({type:EditingStates.None, data:null})}/> }
      </Grid>
    );
  }

  /**
   * Generates the Done panel
   * @function
   * @return {object} The generated UI
   */
  function generateDonePanel() {
    if (locationsModified || speciesModified) {
      return ( 
        <Grid id="admin-settings-panel-done-save" container direction="column" justifyContent="center" alignItems="center"
              sx={{width:'100%', position:'absolute', top:'0px', bottom:'0px'}} >
          <Typography>
            <WarningAmberOutlinedIcon fontSize="small" style={{color:"CornflowerBlue", transform:'scale(1.5)'}} />
            &nbsp;&nbsp;&nbsp;&nbsp;There are some unsaved location or species changes to save
          </Typography>
          <Button onClick={handleSaveChanges} >
            Save
          </Button>
          <Button onClick={onClose} >
            Done For Now
          </Button>
          <Button onClick={handleAbandonChanges} >
            Abandon
          </Button>
          <Typography>
            If you are Done For Now, your changes will be cached and you can apply them later
          </Typography>
          <Typography>
            If you Want to Abandon your changes they will be removed from the list of outstanding changes
          </Typography>
        </Grid>
      );
    }

    return (
      <Grid id="admin-settings-panel-done-close" container direction="column" justifyContent="center" alignItems="center"
             sx={{width:'100%', position:'absolute', top:'0px', bottom:'0px'}} >
        <Typography>
          All changes have been saved
        </Typography>
        <Button onClick={onClose} >
          Close
        </Button>
      </Grid>
    );
  }

  // Setup the tab and page generation
  const adminTabs = [
    {name:'Users', uiFunc:() => generateUsers(handleUserEdit), newName:null, newFunc:null, searchFunc:searchUsers},
    {name:'Collections', uiFunc:() => generateCollections(handleCollectionEdit),
                         buttons:[
                              {name:'New Collection', func:handleCollectionEdit},
                              {name:'Check Incomplete Uploads', func:handleCheckIncompleteUploads},
                          ],
                         searchFunc:searchCollections},
    {name:'Species', uiFunc:() => generateSpecies(handleSpeciesEdit), newName:'Add Species', newFunc:handleSpeciesEdit, searchFunc:searchSpecies},
    {name:'Locations', uiFunc:() => generateLocations(handleLocationEdit), newName:'Add Location', newFunc:handleLocationEdit, searchFunc:searchLocations},
  ];

  /**
   * Updates fields when a new tab is selected for display
   * @function
   * @param {object} event The triggering event object
   * @param {object} newValue The new tab value
   */
  function handleTabChange(event, newValue) {
    if (newValue < adminTabs.length) {
      setActiveTab(newValue);
    } else {
      setActiveTab(adminTabs.length);
      //onClose();
      /*  locationsModified
          speciesModified
      */
    }
  }

  const activeTabInfo = adminTabs[activeTab];
  return (
      <Grid id="settings-admin-wrapper" container direction="row" alignItems="center" justifyContent="center"
            sx={{position:'absolute', top:0, left:0, width:'100vw', height:'100vh', backgroundColor:'rgb(0,0,0,0.5)', zIndex:10000}}
      >
        <Grid container size="grow" alignItems="start" justifyContent="start" sx={{padding:'15px 15px', borderRadius:'20px', overflow:'scroll'}}>
          <Grid size={1}  sx={{backgroundColor:"#EAEAEA", borderRadius:'10px 0px 0px 10px'}}>
            <Tabs id='settings-admin-tabs' value={activeTab} onChange={handleTabChange} aria-label="Administrator Settings Edit" orientation="vertical" variant="scrollable"
                  scrollButtons={false} style={{overflow:'scroll', maxHeight:'100%'}}>
              { adminTabs.map((item, idx) =>
                  <Tab id={'admin-settings-tab-'+idx} key={item.name+'-'+idx} label={
                              <Typography gutterBottom variant="body2" sx={{'&:hover':{fontWeight:'bold'} }}>
                                {item.name}
                              </Typography>
                           }
                     key={idx} {...a11yPropsTabPanel(idx)} sx={{'&:hover':{backgroundColor:'rgba(0,0,0,0.05)'} }}
                  />
                )
              }
              <Tab sx={{paddingTop:'20px'}} label={
                        <Grid container direction="row" justifyContent="start" alignItems="center" sx={{width:'100%', '&:hover':{borderBottom:'1px solid black'} }}>
                          <Grid size={'grow'} justifyContent="start">
                          <Typography gutterBottom variant="body2" sx={{'&:hover':{fontWeight:'bold'} }}>
                            Done
                          </Typography>
                          </Grid>
                          <div style={{marginLeft:'auto'}} >
                            <ExitToAppOutlinedIcon />
                          </div>
                        </Grid>
                       }
                 key={adminTabs.length} {...a11yPropsTabPanel(99)} sx={{'&:hover':{backgroundColor:'rgba(0,0,0,0.05)'} }}
              />
            </Tabs>
          </Grid>
          <Grid id='admin-settings-panel-wrapepr' ref={panelsWrapperRef} size={11} sx={{backgroundColor:'#EAEAEA', borderRadius:'0px 25px 25px 25px'}}>
            { adminTabs.map((item,idx) => 
                <TabPanel id={'admin-settings-panel-'+item.name} key={item.name+'-'+idx}  value={activeTab} index={idx}
                          style={{width:'100%', position:'relative', height:uiSizes.workspace.height+'px'}}>
                  <Grid id="admin-settings-panel-wrapper" container direction="column" justifyContent="center" alignItems="center" sx={{width:'100%'}} >
                    <Typography gutterBottom variant="h4" component="h4">
                      Administration - {item.name}
                    </Typography>
                    {item.uiFunc()}
                  </Grid>
                </TabPanel>
              )
            }
            <TabPanel id={'admin-settings-panel-done-wrapper'} value={activeTab} index={adminTabs.length} key={'done-'+adminTabs.length} 
                      style={{width:'100%', position:'relative',margin:'0 16px auto 8px', height:uiSizes.workspace.height+'px'}}>
              {generateDonePanel()}
            </TabPanel>
            { activeTabInfo && 
              <Grid id='admin-settings-footer' container direction="row" justifyContent="space-between" alignItems="center" 
                    sx={{position:'sticky',bottom:'0px',backgroundColor:'#F0F0F0', borderTop:'1px solid black', boxShadow:'lightgrey 0px -3px 3px',
                         padding:'5px 20px 5px 20px', width:'100%'}}>
                  {activeTabInfo.newName && activeTabInfo.newFunc && 
                    <Grid>
                      <Button id="admin-settings-add-new" size="small" onClick={activeTabInfo.newFunc}>{activeTabInfo.newName}</Button>
                    </Grid>
                  }
                  {activeTabInfo.buttons &&
                    <React.Fragment>
                      {activeTabInfo.buttons.map((one_btn) => 
                        <Grid key={"admin-settings-button-"+one_btn.name} >
                          <Button id={"admin-settings-button-"+one_btn.name} size="small" onClick={one_btn.func}>{one_btn.name}</Button>
                        </Grid>
                      )}
                    </React.Fragment>
                  }
                
                <Grid>
                  <TextField id="search-admin" label={'Search'} placehoder={'Search'} size="small" variant="outlined"
                            onChange={activeTabInfo.searchFunc}
                            slotProps={{
                              input: {
                                endAdornment:
                                  <InputAdornment position="end">
                                    <IconButton
                                      aria-label="Searching"
                                      onClick={activeTabInfo.searchFunc}
                                    >
                                      <SearchOutlinedIcon />
                                    </IconButton>
                                  </InputAdornment>
                              },
                            }}
                 />
                </Grid>
              </Grid>
            }
          </Grid>
        </Grid>
        { editingState.type !== EditingStates.None && generateEditingUI() }
        { checkIncompleteUploads === true && 
            <Grid id="admin-settings-check-uploads" container direction="row" alignItems="center" justifyContent="center" 
                  sx={{...theme.palette.screen_overlay, backgroundColor:'rgb(0,0,0,0.5)', zIndex:11111}}
            >
              <div style={{padding:'25px 10px'}}>
                <Grid container direction="column" alignItems="center" justifyContent="center">
                  <CheckIncompleteUploads onSandboxRefresh={onSandboxRefresh} onCancel={() => setCheckIncompleteUploads(false)} />
                  </Grid>
              </div>
            </Grid>
      }
      </Grid>
  );
}
