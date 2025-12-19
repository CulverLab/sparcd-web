'use client'

import * as React from 'react';
import Grid from '@mui/material/Grid';
import styles from './page.module.css';
import { ThemeProvider } from "@mui/material/styles";
import Typography from '@mui/material/Typography';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import CollectionsManage from './CollectionsManage';
import FooterBar from './components/FooterBar';
import Landing from './Landing';
import Login from './Login';
import { Level, makeMessage, Messages } from './components/Messages';
import Maps from './Maps';
import Queries from './Queries';
import SettingsAdmin from './components/SettingsAdmin';
import SettingsOwner from './components/SettingsOwner';
import theme from './Theme';
import TitleBar from './components/TitleBar';
import UploadManage from './UploadManage';
import UploadEdit from './UploadEdit';
import UserActions from './components/userActions';
import { LoginCheck, LoginValidContext, DefaultLoginValid } from './checkLogin';
import { AddMessageContext, BaseURLContext, CollectionsInfoContext, LocationsInfoContext, MobileDeviceContext, 
         NarrowWindowContext, SandboxInfoContext, SizeContext, SpeciesInfoContext, TokenContext,
         UploadEditContext, UserNameContext, UserSettingsContext } from './serverInfo';
import * as utils from './utils';

// This is declared here so that it doesn't raise an error on server-side compile
const loginStore = {

  loadURL() {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem('login.url')
    }
  },

  loadUsername() {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem('login.user');
    }
  },

  loadRemember() {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem('login.remember');
    }
  },

  saveURL(url) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem('login.url', "" + url);
    }
  },

  saveUsername(username) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem('login.user', "" + username);
    }
  },

  saveRemember(remember) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem('login.remember', !!remember);
    }
  },

  loadLoginInfo() {
    if (!this.loadURL()) {
      this.clearLoginInfo();
    }

    return {
      'url': this.loadURL(),
      'user': this.loadUsername(),
      'remember': this.loadRemember()
    };
  },

  saveLoginInfo(url, username, remember) {
    this.saveURL(url);
    this.saveUsername(username);
    this.saveRemember(remember);
  },

  clearLoginInfo() {
    this.saveURL('');
    this.saveUsername('');
    this.saveRemember(false);
  },

  loadLoginToken() {
    if (typeof window !== "undefined") {
      let curToken = window.localStorage.getItem('login.token');
      return curToken ? curToken : null;
    }

    return null;
  },

  saveLoginToken(token) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem('login.token', "" + token);
    }
  },

  clearLoginToken(token) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem('login.token', '');
    }
  }
};

export default function Home() {
  const DEFAULT_DISPLAY_WIDTH = 800.0;  // Used as default until the window is ready
  const DEFAULT_DISPLAY_HEIGHT = 600.0; // Used as default until the window is ready
  const DEFAULT_HEADER_HEIGHT = 63.0;   // Used as default until the window is ready
  const DEFAULT_FOOTER_HEIGHT = 76.0;   // Used as default until the window is ready
  const defaultUserSettings = {name:'<Zeus>',settings:{},admin:false};
  const [breadcrumbs, setBreadcrumbs] = React.useState([]);
  const [checkedToken, setCheckedToken] = React.useState(false);
  const [collectionInfo, setCollectionInfo] = React.useState(null);
  const [curSearchTitle, setCurSearchTitle] = React.useState(null);
  const [curAction, setCurAction] = React.useState(UserActions.None);
  const [curActionData, setCurActionData] = React.useState(null);
  const [curSearchHandler, setCurSearchHandler] = React.useState(null);
  const [dbUser, setDbUser] = React.useState('');
  const [dbURL, setDbURL] = React.useState('');
  const [displayAdminSettings, setDisplayAdminSettings] =  React.useState(false); // Admin settings editing
  const [displayOwnerSettings, setDisplayOwnerSettings] =  React.useState(false); // Collection owner settings editing
  const [editing, setEditing] = React.useState(false);
  const [isNarrow, setIsNarrow] = React.useState(null);
  const [lastToken, setLastToken] = React.useState(null);
  const [loadingCollections, setLoadingCollections] = React.useState(false);
  const [loadingLocations, setLoadingLocations] = React.useState(false);
  const [loadingSandbox, setLoadingSandbox] = React.useState(false);
  const [loadingSpecies, setLoadingSpecies] = React.useState(false);
  const [locationInfo, setLocationInfo] = React.useState(null);
  const [loginValid, setLoginValid] = React.useState(DefaultLoginValid);
  const [loggedIn, setLoggedIn] = React.useState(null);
  const [messages, setMessages] = React.useState([]);
  const [mobileDeviceChecked, setMobileDeviceChecked] = React.useState(false);
  const [mobileDevice, setMobileDevice] = React.useState(null);
  const [dbRemember, setDbRemember] = React.useState(false);
  const [sandboxInfo, setSandboxInfo] = React.useState(null);
  const [savedLoginFetched, setSavedLoginFetched] = React.useState(false);
  const [savedTokenFetched, setSavedTokenFetched] = React.useState(false);
  const [sizeFooter, setSizeFooter] = React.useState({top:DEFAULT_DISPLAY_HEIGHT-76.0,left:0.0, width:DEFAULT_DISPLAY_WIDTH, height:76.0});
  const [sizeTitle, setSizeTitle] = React.useState({top:0.0, left:0.0, width:DEFAULT_DISPLAY_WIDTH, height:DEFAULT_HEADER_HEIGHT});
  const [sizeWindow, setSizeWindow] = React.useState({DEFAULT_DISPLAY_WIDTH:640, DEFAULT_DISPLAY_HEIGHT:480});
  const [sizeWorkspace, setSizeWorkspace] = React.useState({top:DEFAULT_HEADER_HEIGHT,
                                                            left:0.0,
                                                            width:DEFAULT_DISPLAY_WIDTH, 
                                                            height:DEFAULT_DISPLAY_HEIGHT-DEFAULT_HEADER_HEIGHT-DEFAULT_FOOTER_HEIGHT});
  const [serverURL, setServerURL] = React.useState(utils.getServer());
  const [speciesInfo, setSpeciesInfo] = React.useState(null);
  const [userSettings, setUserSettings] =  React.useState(defaultUserSettings);

  const loginValidStates = loginValid;
  let settingsTimeoutId = null;   // Used to manage of the settings calls to the server
  let settingsRequestId = 0;        // Used to prevent sending multiple requests to server
  let curLoggedIn = loggedIn;

  // TODO: change dependencies to Theme & use @media to adjust
  // Sets the narrow flag when the window is less than 600 pixels
  React.useEffect(() => setIsNarrow(window.innerWidth <= 640), []);

  // Calcuate available space in the window and what the control sizes are
  React.useLayoutEffect(() => {
    calculateLayoutSizes();
  }, []);

  // Adds a resize handler to the window, and automatically removes it
  React.useEffect(() => {
      function onResize () {
          // TODO: transition to MaterialUI sizes          
          const newSize = {'width':window.innerWidth,'height':window.innerHeight};
          setIsNarrow(newSize.width <= 640);
          calculateLayoutSizes();
      }

      window.addEventListener("resize", onResize);
  
      return () => {
          window.removeEventListener("resize", onResize);
      }
  }, []);

  // Load saved token and see if session is still valid
  React.useLayoutEffect(() => {
    if (!savedTokenFetched && !curLoggedIn) {
      const lastLoginToken = loginStore.loadLoginToken();
      setSavedTokenFetched(true);
      setLastToken(lastLoginToken);
      if (lastLoginToken) {
        loginUserToken(lastLoginToken,
          () => {setCheckedToken(true);
                 // Load collections
                 window.setTimeout(() => {loadCollections(lastLoginToken);loadSandbox(lastLoginToken);loadLocations(lastLoginToken);loadSpecies(lastLoginToken);}, 500);
                },
          () => {
            loginStore.clearLoginToken()
            setLastToken(null);
            setCheckedToken(true);
            const loInfo = loginStore.loadLoginInfo();
            setSavedLoginFetched(true);
            if (loInfo != null) {
              setDbURL(loInfo.url);
              setDbUser(loInfo.user);
              setDbRemember(loInfo.remember === 'true');
            }
        });
      } else {
        setCheckedToken(true);
      }
    }

    // Load saved user information: if we haven't already and we're not logged in
    if (!savedLoginFetched && !curLoggedIn) {
      const loInfo = loginStore.loadLoginInfo();
      setSavedLoginFetched(true);
      if (loInfo != null) {
        setDbURL(loInfo.url);
        setDbUser(loInfo.user);
        setDbRemember(loInfo.remember === 'true');
      }
    }
  }, [checkedToken, curLoggedIn, loadCollections, loadSandbox, loadLocations, loadSpecies, loginUserToken, savedTokenFetched, savedLoginFetched]);

  /**
   * Calculates the sizes of the window, header, footer, and workspace area (not used by header or footer)
   * @function
   */
  function calculateLayoutSizes() {
    const newSize = {'width':window.innerWidth,'height':window.innerHeight};
    setSizeWindow(newSize);

    // Get the title size
    let titleSize = {top:0.0, left:0.0, width:newSize.width, height:DEFAULT_HEADER_HEIGHT};
    const titleEl = document.getElementById('sparcd-header');
    if (titleEl) {
      titleSize = titleEl.getBoundingClientRect();
      setSizeTitle({top:0.0, left:0.0, width:window.width, height:titleSize.height});
    }

    // Get the title size
    let footerSize = {top:newSize.height-DEFAULT_FOOTER_HEIGHT, left:0.0, width:newSize.width, height:DEFAULT_FOOTER_HEIGHT};
    const footerEl = document.getElementById('sparcd-footer');
    if (footerEl) {
      footerSize = footerEl.getBoundingClientRect();
      setSizeFooter({top:newSize.width-footerSize, left:0.0, width:newSize.width, height:footerSize});
    }

    // Set the workspace size
    const workspaceSize = {top:titleSize.height, left:titleSize.left, width:titleSize.width, 
                            height:newSize.height-titleSize.height-footerSize.height}
    setSizeWorkspace(workspaceSize);
  }

  /**
   * Restores the indicated navigation breadcrumb
   * @function
   * @param {object} breadcrumb The breadcrumb to restore
   */
  const restoreBreadcrumb = React.useCallback((breadcrumb) => {
    const curCrumbs = breadcrumbs;
    let curRestore = null;
    do {
      curRestore = curCrumbs.pop();
    } while (curRestore && curRestore.name !== breadcrumb.name);
    setCurAction(breadcrumb.action);
    setCurActionData(breadcrumb.actionData);
    setEditing(breadcrumb.editing);
    setBreadcrumbs(curCrumbs);
    clearSearch();
  }, [breadcrumbs, clearSearch, setBreadcrumbs, setCurAction, setCurActionData, setEditing]);

  /**
   * Sets the current action based upon the users selection
   * @function
   * @param {object} action The working user action
   * @param {object} actionData Data associated with the action
   * @param {boolean} areEditing Is this an editing command
   * @param {string} {breadcrumbName} What is the display name of this action
   */
  function setCurrentAction(action, actionData, areEditing, breadcrumbName) {
    if (Object.values(UserActions).indexOf(action) > -1) {
      if (!actionData) {
        actionData = null;
      }
      // TODO: save state and data (and auto-restore)
      const prevAction = curAction;
      const prevActionData = curActionData;
      const prevEditing = editing;
      if (breadcrumbName) {
        let curCrumbs = breadcrumbs;
        let newBreadcrumb = {name:breadcrumbName, action:prevAction, actionData:prevActionData, editing:prevEditing};
        curCrumbs.push(newBreadcrumb);
        setBreadcrumbs(curCrumbs);
      }
      setCurAction(action);
      setCurActionData(actionData);
      setEditing(!!areEditing);
    } else {
      // TODO: Put up informational message about not valid command
      console.log('Invalid current action specified', action);
    }
  }

  // For some reason changing this to useCallback() causes the build to fail 
  /**
   * Fetches the collections from the server
   * @function
   */
  function loadCollections(token) {
    const cur_token = token || lastToken;
    setLoadingCollections(true);
    const collectionUrl =  serverURL + '/collections?t=' + encodeURIComponent(cur_token)
    try {
      const resp = fetch(collectionUrl, {
        method: 'GET'
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              throw new Error(`Failed to get collections: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
          // Save response data
          setLoadingCollections(false);
          const curCollections = respData.sort((first, second) => first.name.localeCompare(second.name, undefined, { sensitivity: "base" }));
          for (let one_coll of curCollections) {
            one_coll.uploads = one_coll.uploads.sort((first, second) => (first.date.date.year > second.date.date.year ||
                                                                         first.date.date.month > second.date.date.month ||
                                                                         first.date.date.day > second.date.date.day || 
                                                                         first.date.time.hour > second.date.time.hour || 
                                                                         first.date.time.minute > second.date.time.minute || 
                                                                         first.date.time.second > second.date.time.second || 
                                                                         first.tdate.ime.nano > second.date.time.nano) ? -1 : 1);
          }
          console.log('COLLECTIONS',curCollections);
          setCollectionInfo(curCollections);
        })
        .catch((err) => {
          console.log('Collections Error: ',err);
          addMessage(Level.Error, 'A problem ocurred while fetching collection information');
          setLoadingCollections(false);
      });
    } catch (error) {
      console.log('Collections Unknown Error: ',error);
      addMessage(Level.Error, 'An unknown problem ocurred while fetching collection information');
      setLoadingCollections(false);
    }
  }

  // For some reason changing this to useCallback() causes the build to fail 
  /**
   * Fetches the sandbox entries from the server
   * @function
   */
  function loadSandbox(token) {
    const cur_token = token || lastToken;
    setLoadingSandbox(true);
    const sandboxUrl =  serverURL + '/sandbox?t=' + encodeURIComponent(cur_token)
    try {
      const resp = fetch(sandboxUrl, {
        method: 'GET'
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              throw new Error(`Failed to get sandbox: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
          // Save response data
          setLoadingSandbox(false);
          console.log('SANDBOX',respData);
          setSandboxInfo(respData);
        })
        .catch((err) => {
          console.log('Sandbox Error: ',err);
          addMessage(Level.Error, 'A problem ocurred while fetching sandbox information');
          setLoadingSandbox(false);
      });
    } catch (error) {
      console.log('Sandbox Unknown Error: ',error);
      addMessage(Level.Error, 'An unknown problem ocurred while fetching sandbox information');
      setLoadingSandbox(false);
    }
  }

  // For some reason changing this to useCallback() causes the build to fail 
  /**
   * Fetches the locations from the server
   * @function
   */
  function loadLocations(token) {
    const cur_token = token || lastToken;
    setLoadingLocations(true);
    const locationsUrl =  serverURL + '/locations?t=' + encodeURIComponent(cur_token)
    try {
      const resp = fetch(locationsUrl, {
        method: 'GET'
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              throw new Error(`Failed to get locations: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
          // Save response data
          setLoadingLocations(false);
          const curLocations = respData.sort((first, second) => first.nameProperty.localeCompare(second.nameProperty, undefined, { sensitivity: "base" }));
          console.log('LOCATIONS RESP:',curLocations);
          setLocationInfo(curLocations);
        })
        .catch((err) => {
          console.log('Locations Error: ',err);
          addMessage(Level.Error, 'A problem ocurred while fetching locations');
          setLoadingLocations(false);
      });
    } catch (error) {
      console.log('Locations Error: ',error);
      addMessage(Level.Error, 'An unknown problem ocurred while fetching locations');
      setLoadingLocations(false);
    }
  }

  // For some reason changing this to useCallback() causes the build to fail 
  /**
   * Fetches the species from the server
   * @function
   */
  function loadSpecies(token) {
    const cur_token = token || lastToken;
    setLoadingSpecies(true);
    const speciesUrl =  serverURL + '/species?t=' + encodeURIComponent(cur_token)
    try {
      const resp = fetch(speciesUrl, {
        method: 'GET'
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              throw new Error(`Failed to get species: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
          // Save response data
          setLoadingSpecies(false);
          const curSpecies = respData.sort((first, second) => first.name.localeCompare(second.name, undefined, { sensitivity: "base" }));
          setSpeciesInfo(curSpecies);
        })
        .catch((err) => {
          console.log('Species Error: ',err);
          addMessage(Level.Error, 'A problem ocurred while fetching species');
          setLoadingSpecies(false);
      });
    } catch (error) {
      console.log('Species Error: ',error);
      addMessage(Level.Error, 'An unknown problem ocurred while fetching species');
      setLoadingSpecies(false);
    }
  }

  /**
   * Adds a message to the message list
   * @function
   * @param {string} level The severity level of the message
   * @param {string} message The message to display
   */
  function addMessage(level, message, title) {
    setMessages([...messages, makeMessage(level, message, title)])
  }

  /**
   * Common function for logging the user in
   * @function
   * @param {object} formData The form data for logging in
   * @param {function} onSuccess Function to call upon success
   * @param {function} onFailure Function to call when there's a login failure
   */
  function commonLoginUser(formData, onSuccess, onFailure) {
    const loginUrl = serverURL + '/login';
    try {
      const resp = fetch(loginUrl, {
        credentials: 'include',
        method: 'POST',
        body: formData
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              throw new Error(`Failed to log in: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
            // Save token and set status
            const loginToken = respData['value'];
            loginStore.saveLoginToken(loginToken);

            let curSettings = respData['settings'];
            if (typeof(curSettings) === 'string') {
              curSettings = JSON.parse(curSettings);
            }

            curSettings['autonext'] = !curSettings['autonext'] ? true : 
                                                      typeof(curSettings['autonext']) === 'boolean' ? curSettings['autonext'] : 
                                                                              curSettings['autonext'].toLowerCase() === 'true';
            curSettings['sandersonDirectory'] = !curSettings['sandersonDirectory'] ? false : 
                                                      typeof(curSettings['sandersonDirectory']) === 'boolean' ? curSettings['sandersonDirectory'] :
                                                                              curSettings['sandersonDirectory'].toLowerCase() === 'true';
            curSettings['sandersonOutput'] = !curSettings['sandersonOutput'] ? false : 
                                                      typeof(curSettings['sandersonOutput']) === 'boolean' ? curSettings['sandersonOutput'] :
                                                                              curSettings['sandersonOutput'].toLowerCase() === 'true';
            setUserSettings({name:respData['name'], settings:curSettings});

            setLoggedIn(true);
            setLastToken(loginToken);
            if (onSuccess && typeof(onSuccess) === 'function') {
              onSuccess(loginToken);
            }
        })
        .catch(function(err) {
          console.log('Error: ',err);
          if (onFailure && typeof(onFailure) === 'function') {
            onFailure();
          }
      });
    } catch (error) {
      if (onFailure && typeof(onFailure) === 'function') {
        onFailure();
      }
    }
  }

  /**
   * Attempts to login the user with credentials
   * @function
   * @param {string} url The url of the storage to access (used as the login validator by the server)
   * @param {string} user The usernanme for logging in
   * @param {string} password The user's associated password
   * @param {function} onSuccess Function to call upon success
   * @param {function} onFailure Function to call when there's a login failure
   */
  function loginUser(url, user, password, onSuccess, onFailure) {
    const formData = new FormData();

    formData.append('url', url);
    formData.append('user', user);
    formData.append('password', password);

    commonLoginUser(formData, onSuccess, onFailure);
  }

  // For some reason changing this to useCallback() causes the build to fail 
  /**
   * Attempts to login the user with a stored token
   * @function
   * @param {string} token The token to try to log in with
   * @param {function} onSuccess Function to call upon success
   * @param {function} onFailure Function to call when there's a login failure
   */
  function loginUserToken(token, onSuccess, onFailure) {
    const formData = new FormData();
    formData.append('token', token);
    commonLoginUser(formData, onSuccess, onFailure);
  }

  /**
   * Handles logging in the user and saves the login information
   * @function
   * @param {string} url The url of the storage to access (used as the login validator by the server)
   * @param {string} user The usernanme for logging in
   * @param {string} password The user's associated password
   * @param {boolean} remember Set to a truthy value to indicate saving non-sensitive login information
   */
  function handleLogin(url, user, password, remember) {
    setDbUser(user);
    setDbURL(url);
    setDbRemember(remember);
    // Check parameters
    const validCheck = LoginCheck(url, user, password);

    setLoginValid(validCheck);
    if (validCheck.valid) {
      // TODO: UI indication while logging in (throbber?)

      // Try to log user in
      loginUser(url, user, password, (new_token) => {
        // If log in successful then...
        if (remember === true) {
          loginStore.saveLoginInfo(url, user, remember);
        } else {
          loginStore.clearLoginInfo();
        }
        // Load collections
        window.setTimeout(() => {loadCollections(new_token);loadSandbox(new_token);loadLocations(new_token);loadSpecies(new_token);}, 500);
      }, () => {
        // If log in fails
        addMessage(Level.Warn, 'Unable to log in. Please check your username and password before trying again', 'Login Failure');
      });
    }
  }

  /**
   * Logs the user out
   * @function
   */
  function handleLogout() {
    setCollectionInfo(null);
    setCurAction(UserActions.None);
    setEditing(false);
    setLastToken(null);
    setLocationInfo(null);
    setLoggedIn(false);
    setLoginValid(DefaultLoginValid);
    setSandboxInfo(null);
    setSpeciesInfo(null);
    setLastToken(null);
    setUserSettings(defaultUserSettings);
    loginStore.clearLoginToken();
  }

  /**
   * Common function that loads the upload image information for editing purposes
   * @function
   * @param {string} collectionId The ID of the collection containing the upload 
   * @param {string} uploadId The ID of the upload to edit
   * @param {function} {cbSuccess} Function to call upon success
   * @param {function} {cbFailure} Function to call upon failure
   */
  function editCollectionUpload(collectionId, uploadId, cbSuccess, cbFailure) {
    const uploadUrl = serverURL + '/uploadImages?t=' + encodeURIComponent(lastToken);
    const formData = new FormData();

    formData.append('id', collectionId);
    formData.append('up', uploadId);

    // Get the information on the upload
    try {
      const resp = fetch(uploadUrl, {
        method: 'POST',
        body: formData
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              throw new Error(`Failed to log in: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
          const curCollection = collectionInfo.find((item) => item.id === collectionId);
          if (curCollection) {
            const curUpload = curCollection.uploads.find((item) => item.key === uploadId);
            if (curUpload) {
              // Add our token in
              if (cbSuccess) {
                const curImages = respData.map((img) => {img['url'] = img['url'] + '&t=' + lastToken; return img;})
                cbSuccess(curUpload, curImages);
              }
            } else {
              console.log('ERROR: unable to find upload ID', uploadId, 'for collection ID', collectionId);
              addMessage(Level.Warning, "Unable to find the upload to edit");
              if (cbFailure) cbFailure();
            }
          } else {
            console.log('ERROR: unable to find collection ID', collectionId);
            addMessage(Level.Warning, "Unable to find the collection for editing");
            if (cbFailure) cbFailure();
          }
        })
        .catch(function(err) {
          console.log('Error: ',err);
          addMessage(Level.Error, 'A problem ocurred while fetching the upload information');
          if (cbFailure) cbFailure();
      });
    } catch (error) {
      console.log('Error: ',error);
      addMessage(Level.Error, 'An unknown problem ocurred while fetching the upload information');
      if (cbFailure) cbFailure();
    }
  }

  /**
   * Reloads the information on the current upload
   * @function
   */
  const uploadReload = React.useCallback(() => {
    let actionData = curActionData;
    editCollectionUpload(actionData.collectionId, actionData.upload, 
                              (curUpload, curImages) => { // Success callback
                                        actionData.images = curImages;
                                        setCurActionData(actionData);
                                      }
                        )
  }, [curActionData, editCollectionUpload, setCurActionData]);

  /**
   * Calls the callback to perform a search
   * @function
   * @param {string} searchTerm The search term to pass to the callback
   */
  const handleSearch = React.useCallback((searchTerm) => {
    return curSearchHandler(searchTerm);
  }, [curSearchHandler]);

  /**
   * Clears the search and the controls
   * @function
   */
  function clearSearch() {
    setCurSearchTitle(null);
    setCurSearchHandler(null);
  }

  /**
   * Enables the setting up of searching feature
   * @function
   * @param {string} searchLabel The label of the search
   * @param {function} searchHandler Function to call when the user wants to search
   */
  const setupSearch = React.useCallback((searchLabel, searchHandler) => {
    if (searchLabel == undefined && searchHandler == undefined) {
      clearSearch();
      return;
    }
    if (!searchHandler || typeof searchHandler != "function") {
      console.log('Error: Invalid function passed when setting up search for \"'+searchLabel+'\"');
      return;
    }

    setCurSearchTitle(searchLabel);
    setCurSearchHandler(() => searchHandler);
  }, [clearSearch, setCurSearchTitle, setCurSearchHandler]);

  /**
   * Fetches the user's settings from the server
   * @function
   */
  function getUserSettings() {
    const settingsUrl = serverURL + '/settings';
    // Get the information on the upload
    /* TODO: make call and wait for response & return correct result
             need to handle null, 'invalid', and token values
    const resp = await fetch(settingsUrl, {
      'method': 'GET',
      'data': formData
    });
    console.log(resp);
    S
    */
  }

  /**
   * Handles enabling administration editing
   * @function
   * @param {string} pw The password to use to check for permission
   * @param {function} {cbSuccess} The success callback
   * @param {function} {cbFail} The failure callback
   */
  function handleAdminSettings(pw, cbSuccess, cbFail) {
    // Check that the password is accurate and display the admin settings pages
    cbSuccess ||= () => {};
    confirmAdminPassword(pw, () => {cbSuccess();setDisplayAdminSettings(true);}, cbFail);
  }

  /**
   * Handles enabling collection owner editing
   * @function
   * @param {string} pw The password to use to check for permission
   * @param {function} {cbSuccess} The success callback
   * @param {function} {cbFail} The failure callback
   */
  function handleOwnerSettings(pw, cbSuccess, cbFail) {
    // Check that the password is accurate and display the admin settings pages
    cbSuccess ||= () => {};
    confirmOwnerPassword(pw, () => {cbSuccess();setDisplayOwnerSettings(true);}, cbFail);
  }

  /**
   * Handles enabling administration editing
   * @function
   * @param {string} pw The password to use to check for permission
   * @param {function} {cbSuccess} The success callback
   * @param {function} {cbFail} The failure callback
   */
  function confirmAdminPassword(pw, cbSuccess, cbFail) {
    // Check that the password is accurate and belongs to an administrator
    const settingsCheckUrl = serverURL + '/settingsAdmin?t=' + encodeURIComponent(lastToken);
    cbSuccess ||= () => {};
    cbFail ||= () => {};

    const formData = new FormData();

    formData.append('value', pw);

    try {
      const resp = fetch(settingsCheckUrl, {
        credentials: 'include',
        method: 'POST',
        body: formData
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              throw new Error(`Failed to check admin permissions: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
            // Check the return
            if (respData.success === true) {
              cbSuccess();
            } else {
              cbFail();
            }
        })
        .catch(function(err) {
          console.log('Admin Settings Error: ',err);
          cbFail();
      });
    } catch (error) {
      console.log('Admin Settings Unknown Error: ',err);
      cbFail();
    }
  }

  /**
   * Handles enabling administration editing
   * @function
   * @param {string} pw The password to use to check for permission
   * @param {function} {cbSuccess} The success callback
   * @param {function} {cbFail} The failure callback
   */
  function confirmOwnerPassword(pw, cbSuccess, cbFail) {
    // Check that the password is accurate and belongs to an administrator
    const settingsCheckUrl = serverURL + '/settingsOwner?t=' + encodeURIComponent(lastToken);
    cbSuccess ||= () => {};
    cbFail ||= () => {};

    const formData = new FormData();

    formData.append('value', pw);

    try {
      const resp = fetch(settingsCheckUrl, {
        credentials: 'include',
        method: 'POST',
        body: formData
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              throw new Error(`Failed to check owner permissions: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
            // Check the return
            if (respData.success === true) {
              cbSuccess();
            } else {
              cbFail();
            }
        })
        .catch(function(err) {
          console.log('Owner Settings Error: ',err);
          cbFail();
      });
    } catch (error) {
      console.log('Owner Settings Unknown Error: ',err);
      cbFail();
    }
  }

  /**
   * Updates the user's settings on the server
   * @function
   * @param {object} newSettings The settings to save on the server for the user
   */
  const updateUserSettings = React.useCallback((newSettings) => {
    const setSettingsUrl = serverURL + '/settings?t=' + encodeURIComponent(lastToken);

    const formData = new FormData();

    formData.append('autonext', newSettings.autonext);
    formData.append('dateFormat', newSettings.dateFormat);
    formData.append('measurementFormat', newSettings.measurementFormat);
    formData.append('sandersonDirectory', newSettings.sandersonDirectory);
    formData.append('sandersonOutput', newSettings.sandersonOutput);
    formData.append('timeFormat', newSettings.timeFormat);
    formData.append('coordinatesDisplay', newSettings.coordinatesDisplay);
    formData.append('email', newSettings.email);

    try {
      const resp = fetch(setSettingsUrl, {
        credentials: 'include',
        method: 'POST',
        body: formData
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              throw new Error(`Failed to set settings: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
            // Save the returned settings
            const curSettings = respData;

            curSettings['autonext'] = typeof(curSettings['autonext']) === 'boolean' ? curSettings['autonext'] : 
                                                                              curSettings['autonext'].toLowerCase() === 'true';
            curSettings['sandersonDirectory'] = typeof(curSettings['sandersonDirectory']) === 'boolean' ? curSettings['sandersonDirectory'] :
                                                                              curSettings['sandersonDirectory'].toLowerCase() === 'true';
            curSettings['sandersonOutput'] = typeof(curSettings['sandersonOutput']) === 'boolean' ? curSettings['sandersonOutput'] :
                                                                              curSettings['sandersonOutput'].toLowerCase() === 'true';

            setUserSettings({name:userSettings['name'], settings:curSettings, admin:userSettings['admin']});
        })
        .catch(function(err) {
          console.log('Settings Error: ',err);
          addMessage(Level.Error, 'A problem ocurred while saving your settings');
      });
    } catch (error) {
      console.log('Settings Unknown Error: ',err);
      addMessage(Level.Error, 'An unkown problem ocurred while saving your settings');
    }
  }, [addMessage, lastToken, serverURL, setUserSettings, userSettings]);

  /**
   * Sets the remember login information flag to true or false (is it truthy, or not?)
   * @function
   * @param {boolean} newRemember Set to true for non-sensitive login details to be remembered, or false
   */
  function handleRememberChanged(newRemember) {
    setDbRemember(newRemember);
  }

  /**
   * Handles displaying the user settings
   * @function
   * @param {object} userSettings The user settings to have managed
   */
  function handleSettings(userSettings) {
    const mySettingsId = settingsRequestId = settingsRequestId+1;
    const workingTimeoutId = settingsTimeoutId;
    settingsTimeoutId = null;
    if (workingTimeoutId != null) {
      window.clearTimeout(workingTimeoutId);
    }
    window.setTimeout(() => {
      // If we're still the only one trying to send settings, send them
      if (settingsRequestId === mySettingsId) {
        settingsTimeoutId = window.setTimeout(() =>
                  {
                    if (settingsRequestId === mySettingsId) updateUserSettings(userSettings)
                  }
        );
      }
    }, 500);
  }

  /**
   * Handles removing a message after it's been closed
   * @function
   * @param {number} messageId The ID of the message to close
   */
  function handleCloseMessage(messageId) {
    const msgIdx = messages.findIndex((item) => item.messageId === messageId);
    if (msgIdx >= 0) {
      messages[msgIdx].closed = true;
      setMessages(messages.toSpliced(msgIdx, 1));
    }
  }

  // Get mobile device information if we don't have it yet
  if (typeof window !== 'undefined') {
    if (mobileDevice == null && !mobileDeviceChecked) {
      setMobileDevice(navigator.userAgent.indexOf('Mobi') > -1);
      setMobileDeviceChecked(true);
    }
  }

  /**
   * Returns the UI components for the specified action
   * @function
   * @param {object} action The well known user action
   * @param {boolean} editing The state of the user editing something
   * @return {object} The rendered action UI
   */
  function renderAction(action, editing) {
    // TODO: Store lastToken fetched (and be sure to update it)
    switch(action) {
      case UserActions.None:
        return (
          <BaseURLContext.Provider value={serverURL}>
            <TokenContext.Provider value={lastToken}>
              <AddMessageContext.Provider value={addMessage}>
                <LocationsInfoContext.Provider value={locationInfo}>
                <CollectionsInfoContext.Provider value={collectionInfo}>
                  <SandboxInfoContext.Provider value={sandboxInfo}>
                    <Landing loadingCollections={loadingCollections} loadingSandbox={loadingSandbox} onUserAction={setCurrentAction} 
                             onSandboxRefresh={() => {loadSandbox(lastToken);loadCollections(lastToken);}}
                    />
                  </SandboxInfoContext.Provider>
                </CollectionsInfoContext.Provider>
                </LocationsInfoContext.Provider>
              </AddMessageContext.Provider>
            </TokenContext.Provider>
          </BaseURLContext.Provider>
        );
      case UserActions.Upload:
        return (
          <BaseURLContext.Provider value={serverURL}>
            <TokenContext.Provider value={lastToken}>
              <AddMessageContext.Provider value={addMessage}>
                <SandboxInfoContext.Provider value={sandboxInfo}>
                  <UploadManage selectedUpload={curActionData} 
                          onEditUpload={(collectionId, uploadId, breadcrumbName) =>
                                          editCollectionUpload(collectionId, uploadId, 
                                              (curUpload, curImages) => { // Success callback
                                                  setCurrentAction(UserActions.UploadEdit, 
                                                                   {collectionId, name:curUpload.name, upload:curUpload.key, location:curUpload.location, images:curImages},
                                                                   true,
                                                                   breadcrumbName);
                                                  }
                                              )
                                        }
                  />
                </SandboxInfoContext.Provider>
              </AddMessageContext.Provider>
            </TokenContext.Provider>
          </BaseURLContext.Provider>
        );
      case UserActions.UploadEdit:
        return (
          <BaseURLContext.Provider value={serverURL}>
            <TokenContext.Provider value={lastToken}>
              <UploadEditContext.Provider value={curActionData}>
                <LocationsInfoContext.Provider value={locationInfo}>
                  <SpeciesInfoContext.Provider value={speciesInfo}>
                    <UploadEdit selectedUpload={curActionData.uploadName}
                            onCancel={() => setCurrentAction(UserActions.Upload, curActionData, false)} 
                            searchSetup={setupSearch}
                            uploadReload={uploadReload}
                    />
                  </SpeciesInfoContext.Provider>
                </LocationsInfoContext.Provider>
              </UploadEditContext.Provider>
            </TokenContext.Provider>
          </BaseURLContext.Provider>
        );
      case UserActions.Collection:
        return (
           <BaseURLContext.Provider value={serverURL}>
             <TokenContext.Provider value={lastToken}>
              <AddMessageContext.Provider value={addMessage}>
                <CollectionsInfoContext.Provider value={collectionInfo}>
                  <CollectionsManage loadingCollections={loadingCollections} selectedCollection={curActionData} 
                          searchSetup={setupSearch}
                          onEditUpload={(collectionId, uploadId, breadcrumbName) =>
                                          editCollectionUpload(collectionId, uploadId, 
                                              (curUpload, curImages) => { // Success callback
                                                  setCurrentAction(UserActions.UploadEdit, 
                                                                   {collectionId, name:curUpload.name, upload:curUpload.key, location:curUpload.location, images:curImages},
                                                                   true,
                                                                   breadcrumbName);
                                                  }
                                              )
                                        }
                  />
                </CollectionsInfoContext.Provider>
              </AddMessageContext.Provider>
             </TokenContext.Provider>
           </BaseURLContext.Provider>
      );
      case UserActions.Query:
        return (
          <BaseURLContext.Provider value={serverURL}>
            <TokenContext.Provider value={lastToken}>
              <AddMessageContext.Provider value={addMessage}>
                <CollectionsInfoContext.Provider value={collectionInfo}>
                  <LocationsInfoContext.Provider value={locationInfo}>
                    <SpeciesInfoContext.Provider value={speciesInfo}>
                      <Queries loadingCollections={loadingCollections}  />
                    </SpeciesInfoContext.Provider>
                  </LocationsInfoContext.Provider>
                </CollectionsInfoContext.Provider>
              </AddMessageContext.Provider>
            </TokenContext.Provider>
          </BaseURLContext.Provider>
        );
      case UserActions.Maps:
        return (
            <TokenContext.Provider value={lastToken}>
              <LocationsInfoContext.Provider value={locationInfo}>
                <Maps />
              </LocationsInfoContext.Provider>
            </TokenContext.Provider>
        );
    }
  }

  // Render the UI
  const narrowWindow = isNarrow;
  const workspaceTop = sizeWorkspace.top + 'px';
  return (
    <main style={{...theme.palette.main}}>
      <ThemeProvider theme={theme}>
        <MobileDeviceContext.Provider value={mobileDevice}>
        <NarrowWindowContext.Provider value={narrowWindow}>
        <SizeContext.Provider value={{footer:sizeFooter, title:sizeTitle, window:sizeWindow, workspace:sizeWorkspace}}>
        <UserNameContext.Provider value={userSettings.name}>
        <UserSettingsContext.Provider value={userSettings.settings}>
          <TokenContext.Provider value={lastToken}>
          <AddMessageContext.Provider value={addMessage}>
          <CollectionsInfoContext.Provider value={collectionInfo}>
            <Grid id='sparcd-wrapper' container direction="row" alignItems="start" justifyContent="start" sx={{minWidth:'100vw',minHeight:'100vh'}}>
              <TitleBar searchTitle={curSearchTitle} onSearch={handleSearch} onSettings={loggedIn ? handleSettings : null}
                        onLogout={handleLogout} size={narrowWindow?"small":"normal"} 
                        breadcrumbs={breadcrumbs} onBreadcrumb={restoreBreadcrumb} onAdminSettings={handleAdminSettings} onOwnerSettings={handleOwnerSettings}/>
              <Box id='sparcd-middle-wrapper' sx={{overflow:"scroll"}} >
                {!curLoggedIn ? 
                  <LoginValidContext.Provider value={loginValidStates}>
                    <Login prev_url={dbURL} prev_user={dbUser} prev_remember={dbRemember} onLogin={handleLogin}
                           onRememberChange={handleRememberChanged} />
                  </LoginValidContext.Provider>
                  :
                    <AddMessageContext.Provider value={addMessage}>
                      {renderAction(curAction, editing)}
                    </AddMessageContext.Provider>
                  }
                </Box>
              <FooterBar />
            </Grid>
          </CollectionsInfoContext.Provider>
          </AddMessageContext.Provider>
          </TokenContext.Provider>
          <Grid id="login-checking-wrapper" container direction="row" alignItems="center" justifyContent="center"
                sx={{...theme.palette.login_checking_wrapper, visibility:checkedToken ? 'hidden':'visible', display:checkedToken ? 'none':'inherit'}}
          >
            <div style={{...theme.palette.login_checking}}>
              <Grid container direction="column" alignItems="center" justifyContent="center" >
                  <Typography gutterBottom variant="body2" color="lightgrey">
                    Restoring previous session, please wait...
                  </Typography>
                  <CircularProgress variant="indeterminate" />
              </Grid>
            </div>
          </Grid>
          { displayAdminSettings &&
                <TokenContext.Provider value={lastToken}>
                <CollectionsInfoContext.Provider value={collectionInfo}>
                <LocationsInfoContext.Provider value={locationInfo}>
                <SpeciesInfoContext.Provider value={speciesInfo}>
                <AddMessageContext.Provider value={addMessage}>
                  <SettingsAdmin loadingCollections={loadingCollections} loadingLocations={loadingLocations}
                                  onConfirmPassword={confirmAdminPassword} onClose={() => setDisplayAdminSettings(false)}/>
                </AddMessageContext.Provider>
                </SpeciesInfoContext.Provider>
                </LocationsInfoContext.Provider>
                </CollectionsInfoContext.Provider>
                </TokenContext.Provider>
          }
          { displayOwnerSettings &&
                <TokenContext.Provider value={lastToken}>
                <CollectionsInfoContext.Provider value={collectionInfo}>
                <AddMessageContext.Provider value={addMessage}>
                  <SettingsOwner loadingCollections={loadingCollections}
                                  onConfirmPassword={confirmOwnerPassword} onClose={() => setDisplayOwnerSettings(false)}/>
                </AddMessageContext.Provider>
                </CollectionsInfoContext.Provider>
                </TokenContext.Provider>
          }
          { // Make sure this is is last
            messages.length > 0 && 
              <Grid id="messages-wrapper" container direction="row" alignItems="start" justifyContent="center"
                    sx={{...theme.palette.messages_wrapper, top: workspaceTop}}>
                <Messages messages={messages} close_cb={handleCloseMessage}/>
              </Grid>
          }
        </UserSettingsContext.Provider>
        </UserNameContext.Provider>
        </SizeContext.Provider>
        </NarrowWindowContext.Provider>
        </MobileDeviceContext.Provider>
      </ThemeProvider>
    </main>
  )
}
