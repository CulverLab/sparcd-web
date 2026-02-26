/** @module components/SettingsAdmin */

import * as React from 'react';
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

import EditCollection from './EditCollection';
import { Level } from '../components/Messages';
import { AddMessageContext, CollectionsInfoContext, TokenExpiredFuncContext, SizeContext, TokenContext } from '../serverInfo';
import * as utils from '../utils';

const EditingStates = {
  None: 0,
  Collection: 1,
};

/**
 * Returns the UI for administrator tasks
 * @function
 * @param {boolean} loadingCollections Flag indicating collections are being loaded
 * @param {function} onConfirmPassword Function for confirming a password re-entry
 * @param {function} onClose Function for when the user wants to close this
 */
export default function SettingsOwner({loadingCollections, onConfirmPassword, onClose}) {
  const theme = useTheme();
  const addMessage = React.useContext(AddMessageContext); // Function adds messages for display
  const collectionInfo = React.useContext(CollectionsInfoContext);
  const setTokenExpired = React.useContext(TokenExpiredFuncContext);
  const settingsToken = React.useContext(TokenContext);  // Login token
  const uiSizes = React.useContext(SizeContext);  // UI Dimensions
  const panelsWrapperRef = React.useRef(null);  // Used for sizeing
  const [activeTab, setActiveTab] = React.useState(0);
  const [detailsHeight, setDetailsHeight] = React.useState(500); // Height for displaying details
  const [editingState, setEditingState] = React.useState({type:EditingStates.None, data:null})
  const [serverURL, setServerURL] = React.useState(utils.getServer());  // The server URL to use
  const [userInfo, setUserInfo] = React.useState(null); // Contains information on users

  const [selectedCollections, setSelectedCollections] = React.useState(loadingCollections ? [] : collectionInfo); // Used for searches

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
   * Handles updating the collection information
   * @function
   * @param {object} collectionNewInfo The updated collection information to save
   * @param {function} onSuccess The callable upon success
   * @param {function} onError The callable upon an issue ocurring
   */
  const updateCollection = React.useCallback((collectionNewInfo, onSuccess, onError) => {
    const userUpdateCollUrl = serverURL + '/ownerCollectionUpdate?t=' + encodeURIComponent(settingsToken);

    const formData = new FormData();

    formData.append('id', editingState.data.id);
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
//              let curColl = collectionInfo.filter((item) => item.id === editingState.data.id);
//              if (curColl && curColl.length > 0) {
//                curColl[0] = respData.data;
//              }
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
   * Handles the new collection button press
   * @function
   * @param {object} event The triggering event
   * @param {object} {location} The collection object to edit or falsy if a new collection is wanted
   */
  const handleCollectionEdit = React.useCallback((event, collection) => {
    event.stopPropagation();
    const adminCollectionUrl = serverURL + '/ownerCollectionDetails?t=' + encodeURIComponent(settingsToken);
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
   * Handles the collection search button press
   * @function
   * @param {object} event The change event for searching
   */
  function searchCollections(event) {
    if (event.target.value && !loadingCollections) {
      const ucSearch = event.target.value.toUpperCase();
      setSelectedCollections(collectionInfo.filter((item) => item.name.toUpperCase().includes(ucSearch) || item.id.toUpperCase().includes(ucSearch) ||
                                                                    item.email.toUpperCase().includes(ucSearch) ));
    } else {
      setSelectedCollections(loadingCollections ? [] : collectionInfo);
    }
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
          <Grid size={5}>
            <Typography nowrap="true" variant="body" sx={{fontWeight:'bold', paddingLeft:'5px'}}>
              Name
            </Typography>
          </Grid>
          <Grid size={4} sx={{marginRight:'auto'}}>
            <Typography nowrap="true" variant="body" sx={{fontWeight:'bold'}}>
              ID
            </Typography>
          </Grid>
          <Grid sizeo={3} sx={{leftMargin:'auto'}}>
            <Typography nowrap="true" variant="body" sx={{fontWeight:'bold', paddingRight:'5px'}}>
              email
            </Typography>
          </Grid>
        </Grid>
        <Grid id='admin-settings-details' sx={{overflowX:'scroll',width:'100%', maxHeight:detailsHeight+'px' }}>
        { selectedCollections.filter((item) => item.permissions.ownerProperty === true).map((item, idx) => 
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
   * Generates the UI for the editing of settings entries
   * @function
   * @return {object} The generated UI
   */
  function generateEditingUI() {
    return (
      <Grid container id="settings-admin-edit-wrapper" alignItems="center" justifyContent="center"
            sx={{position:'absolute', top:0, right:0, bottom:0, left:0, backgroundColor:'rgb(0,0,0,0.5)'}}
      >
      {editingState.type === EditingStates.Collection && <EditCollection data={editingState.data} onUpdate={updateCollection}
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
    {name:'Collections', uiFunc:() => generateCollections(handleCollectionEdit), newName:null, newFunc:null, searchFunc:searchCollections},
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
                <Grid>
                  {activeTabInfo.newName && activeTabInfo.newFunc && <Button id="admin-settings-add-new" size="small" onClick={activeTabInfo.newFunc}>{activeTabInfo.newName}</Button>}
                </Grid>
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
      </Grid>
  );
}
