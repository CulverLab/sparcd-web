'use client'

import * as React from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

import ActionsRouter from './ActionsRouter';
import ContextProviders from './components/ContextProviders';
import FooterBar from './FooterBar';
import Login from './Login';
import LoginAgain from './components/LoginAgain';
import * as loginStore from './loginStore';
import { Level, makeMessage, Messages } from './components/Messages';
import NewInstallation from './components/NewInstallation';
import * as Server from './ServerCalls';
import SettingsAdmin from './settings/SettingsAdmin';
import SettingsOwner from './settings/SettingsOwner';
import theme from './Theme';
import TitleBar from './TitleBar';
import UserActions from './components/userActions';
import UserMessages from './messages/UserMessages';
import { LoginCheck, LoginValidContext, DefaultLoginValid } from './checkLogin';
import * as utils from './utils';


// Events to tap into when detecting if we're idle
const idleListenEvents = [
  "mousedown",
  "mousemove",
  "wheel",
  "keydown",
  "touchstart",
  "scroll"
];


const DEFAULT_IDLE_TIMEOUT_SEC =  20 * 60; // 20 minutes
const IDLE_LOGOUT_TIMEOUT_SEC =  2 * 60;   // 3 minutes
const IDLE_NEW_INSTALL_TIMEOUT_SEC =  2 * 60; // 2 minutes

const DEFAULT_DISPLAY_WIDTH = 800.0;  // Used as default until the window is ready
const DEFAULT_DISPLAY_HEIGHT = 600.0; // Used as default until the window is ready
const DEFAULT_HEADER_HEIGHT = 63.0;   // Used as default until the window is ready
const DEFAULT_FOOTER_HEIGHT = 76.0;   // Used as default until the window is ready


const DEFAULT_USER_SETTINGS = {name:'<Zeus>',settings:{},admin:false};

/**
 * The entry point of the application
 * @function
 * @return {React.ReactNode} The UI to render
 */
export default function Home() {
  const checkForIdleRef = React.useRef(true);   // Reference used to determine if we check for the user being idle
  const idleTimeoutSecRef = React.useRef(DEFAULT_IDLE_TIMEOUT_SEC);     // Make this server configurable (during login)
  const idleLogoutTimeoutSecRef = React.useRef(IDLE_LOGOUT_TIMEOUT_SEC);     // Make this server configurable (during login)
  const idleLastTimestampRef = React.useRef(Date.now());                // The last time detected not being idle
  const lastIdleTimeoutIdRef = React.useRef(null);   // The last timeout ID we set for checking the idle
  const savedLoginFetchedRef = React.useRef(false);
  const savedTokenFetchedRef = React.useRef(false);
  const settingsRequestIdRef = React.useRef(0);      // Used to prevent sending multiple requests to server
  const settingsTimeoutIdRef = React.useRef(null);   // Used to manage of the settings calls to the server
  const serverURLRef = React.useRef(utils.getServer());
  const [breadcrumbs, setBreadcrumbs] = React.useState([]);
  const [checkedToken, setCheckedToken] = React.useState(false);
  const [collectionInfo, setCollectionInfo] = React.useState(null);
  const [createNewInstance, setCreateNewInstance] = React.useState(false);  // Flag used to create a new instance of SPARCd
  const [curSearchTitle, setCurSearchTitle] = React.useState(null);
  const [curAction, setCurAction] = React.useState(UserActions.None);
  const [curActionData, setCurActionData] = React.useState(null);
  const [curSearchHandler, setCurSearchHandler] = React.useState(null);
  const [dbRemember, setDbRemember] = React.useState(false);
  const [dbUser, setDbUser] = React.useState('');
  const [dbURL, setDbURL] = React.useState('');
  // TODO: Change these to display enumeration
  const [displayAdminSettings, setDisplayAdminSettings] =  React.useState(false); // Admin settings editing
  const [displayMessages, setDisplayMessages] = React.useState(false);            // Display messages
  const [displayOwnerSettings, setDisplayOwnerSettings] =  React.useState(false); // Collection owner settings editing
  // TODO: end of above
  const [editing, setEditing] = React.useState(false);
  const [isNarrow, setIsNarrow] = React.useState(null);
  const [lastToken, setLastToken] = React.useState(null);
  const [loadingCollections, setLoadingCollections] = React.useState(false);
  const [loadingLocations, setLoadingLocations] = React.useState(false);
  const [loadingOtherSpecies, setLoadingOtherSpecies] = React.useState(false);
  const [loadingSandbox, setLoadingSandbox] = React.useState(false);
  const [loadingSpecies, setLoadingSpecies] = React.useState(false);
  const [locationInfo, setLocationInfo] = React.useState(null);
  const [loginValid, setLoginValid] = React.useState(DefaultLoginValid);
  const [loggedIn, setLoggedIn] = React.useState(null);
  const [messages, setMessages] = React.useState([]);     // Information, Warning, Error messages
  const [mobileDevice, setMobileDevice] = React.useState(null);
  const [repairInstance, setRepairInstance] = React.useState(false);    // The S3 side needs repairs
  const [sandboxInfo, setSandboxInfo] = React.useState(null);
  const [sizeFooter, setSizeFooter] = React.useState({top:DEFAULT_DISPLAY_HEIGHT-76.0,left:0.0, width:DEFAULT_DISPLAY_WIDTH, height:76.0});
  const [sizeTitle, setSizeTitle] = React.useState({top:0.0, left:0.0, width:DEFAULT_DISPLAY_WIDTH, height:DEFAULT_HEADER_HEIGHT});
  const [sizeWindow, setSizeWindow] = React.useState({width: DEFAULT_DISPLAY_WIDTH, height: DEFAULT_DISPLAY_HEIGHT});
  const [sizeWorkspace, setSizeWorkspace] = React.useState({top:DEFAULT_HEADER_HEIGHT,
                                                            left:0.0,
                                                            width:DEFAULT_DISPLAY_WIDTH, 
                                                            height:DEFAULT_DISPLAY_HEIGHT-DEFAULT_HEADER_HEIGHT-DEFAULT_FOOTER_HEIGHT});
  const [speciesInfo, setSpeciesInfo] = React.useState(null);
  const [speciesOtherInfo, setSpeciesOtherInfo] = React.useState(null);
  const [userLoginAgain, setUserLoginAgain] = React.useState(false);      // The user needs to log in again
  const [userIdleTimedOut, setUserIdleTimedOut] = React.useState(false);  // The user idles out and needs to log in again
  const [userMessages, setUserMessages] =  React.useState({count:null, messages:null});
  const [userSettings, setUserSettings] =  React.useState(DEFAULT_USER_SETTINGS);

  /**
   * Handles the idle events
   * @function
   */
  const idleListener = React.useCallback((event) => {
    idleLastTimestampRef.current = Date.now();
  }, []);

  /**
   * Handles checking if the user has been idle for too long
   * @function
   */
  const checkIdleTimeout = React.useCallback(() => {
    // Check if we're disabled
    if (!checkForIdleRef.current || !loggedIn) {
      if (lastIdleTimeoutIdRef.current === null) {
        lastIdleTimeoutIdRef.current = window.setTimeout(checkIdleTimeout, idleTimeoutSecRef.current * 1000);
      }
      return;
    }

    // Get the elapsed time since the user did something
    const diffSec = (Date.now() - idleLastTimestampRef.current) / 1000;

    // We idle out if we are at, or exceed, the limit
    if (diffSec >= idleTimeoutSecRef.current) {
      lastIdleTimeoutIdRef.current = null;
      setUserIdleTimedOut(true);
    } else {
      // Set the timeout for our remaining seconds
      setUserIdleTimedOut(false);
      if (lastIdleTimeoutIdRef.current === null) {
        lastIdleTimeoutIdRef.current = window.setTimeout(checkIdleTimeout, (idleTimeoutSecRef.current - diffSec) * 1000);
      }
    }

  }, [loggedIn]);

  // Setup the idle detection
  React.useEffect(() => {
    // Adding out listeners
    idleListenEvents.forEach((name) => window.addEventListener(name, idleListener, { passive:true } ));

    // Start the timer for checking the idle flag (we wait a minimum of the idle timout seconds)
    if (lastIdleTimeoutIdRef.current === null) {
      lastIdleTimeoutIdRef.current = window.setTimeout(checkIdleTimeout, idleTimeoutSecRef.current * 1000);
    }

    return () => {
      // Stop any timeout
      if (lastIdleTimeoutIdRef.current !== null) {
        window.clearTimeout(lastIdleTimeoutIdRef.current);
        lastIdleTimeoutIdRef.current = null;
      }
      checkForIdleRef.current = false;

      // Remove our listeners
      idleListenEvents.forEach((name) => window.removeEventListener(name, idleListener, { passive:true } ));
    }
  }, [checkIdleTimeout, idleListener]);

  /**
   * Adds a message to the message list
   * @function
   * @param {string} level The severity level of the message
   * @param {string} message The message to display
   */
  const addMessage = React.useCallback((level, message, title) => {
    setMessages(prev => [...prev, makeMessage(level, message, title)])
  }, []);

  /**
   * Fetches the messages from the server
   * @function
   */
  const handleFetchMessages = React.useCallback((loginToken) => {
    setUserMessages(prev => ({...prev, loading:true}));


    const success = Server.messages(serverURLRef.current, loginToken, setUserLoginAgain,
                                (respData) => {   // Success
                                    // Save response data
                                    if (respData.success) {
                                      setUserMessages({count:respData.messages.length, messages:respData.messages, loading:false});
                                    } else {
                                      addMessage(Level.Warning, respData.message);
                                      setUserMessages(prev => ({...prev, loading:false, count:0, messages:[]}) );
                                    }
                                },
                                (err) => {        // Failure
                                    addMessage(Level.Error, 'A problem occurred while fetching messages');
                                    setUserMessages(prev => ({...prev, loading:false, count:0, messages:[]}) );
                                }
    );

    if (!success) {
      addMessage(Level.Error, 'An unknown problem occurred while fetching messages');
      setUserMessages(prev => ({...prev, loading:false, count:0, messages:[]}) );     
    }

  }, [addMessage, setUserLoginAgain]);

  /**
   * Function to handle a successful call to login
   * @function
   * @param {object} respData The response data
   * @param {function} [onSuccess] Function to call upon success
   */
  const handleSuccessfulLogin = React.useCallback((respData, onSuccess) => {
    // First check that we have a successful return
    if (respData.success === true) {
      // Save token and set status
      const loginToken = respData['value'];
      loginStore.saveLoginToken(loginToken);

      let curSettings = respData['settings'];
      if (typeof(curSettings) === 'string') {
        curSettings = JSON.parse(curSettings);
      }

      curSettings['autonext'] = utils.coerceBool(curSettings['autonext'], true);
      curSettings['sandersonDirectory'] = utils.coerceBool(curSettings['sandersonDirectory'], false);
      curSettings['sandersonOutput'] = utils.coerceBool(curSettings['sandersonOutput'], false);

      setUserSettings({name:respData.name, settings:curSettings});
      setUserMessages({count:respData.messageCount ? respData.messageCount : 0, messages:null, loading: false})

      setUserIdleTimedOut(false);
      setLoggedIn(true);
      setLastToken(loginToken);
      window.setTimeout(() => handleFetchMessages(loginToken), 1000);

      if (onSuccess && typeof(onSuccess) === 'function') {
        onSuccess(loginToken, respData['newInstance'], respData['needsRepair']);
      } else if (respData['newInstance']) {
        // Indicate we have a new instance
        setCreateNewInstance(true);
      } else if (respData['needsRepair']) {
        // Indicate we needs to repair the instance
        setRepairInstance(true);
      }
    }
  }, [handleFetchMessages]);

  /**
   * Common function for logging the user in
   * @function
   * @param {object} formData The form data for logging in
   * @param {function} [onSuccess] Function to call upon success
   * @param {function} [onFailure] Function to call when there's a login failure
   */
  const commonLoginUser = React.useCallback((formData, onSuccess, onFailure) => {
    const success = Server.login(serverURLRef.current, formData, 
                        (respData) => {   // Success 
                            handleSuccessfulLogin(respData, onSuccess);
                        },
                        (err) => {        // Failure
                            if (onFailure && typeof onFailure === 'function') {
                              onFailure();
                            }
                        }
    );

    if (!success) {
      if (onFailure && typeof onFailure === 'function') {
        onFailure();
      }     
    }
  }, [handleSuccessfulLogin]);

  /**
   * Attempts to login the user with credentials
   * @function
   * @param {string} url The url of the storage to access (used as the login validator by the server)
   * @param {string} user The usernanme for logging in
   * @param {string} password The user's associated password
   * @param {function} onSuccess Function to call upon success
   * @param {function} onFailure Function to call when there's a login failure
   */
  const loginUser = React.useCallback((url, user, password, onSuccess, onFailure) => {
    const formData = new FormData();

    formData.append('url', url);
    formData.append('user', user);
    formData.append('password', password);

    commonLoginUser(formData, onSuccess, onFailure);
  }, [commonLoginUser]);

  /**
   * Attempts to login the user with a stored token
   * @function
   * @param {string} token The token to try to log in with
   * @param {function} onSuccess Function to call upon success
   * @param {function} onFailure Function to call when there's a login failure
   */
  const loginUserToken = React.useCallback((token, onSuccess, onFailure) => {
    const formData = new FormData();
    formData.append('token', token);
    commonLoginUser(formData, onSuccess, onFailure);
  }, [commonLoginUser]);

  /**
   * Fetches the collections from the server
   * @function
   */
  const loadCollections = React.useCallback((token) => {
    const curToken = token || lastToken;
    setLoadingCollections(true);

    const success = Server.collections(serverURLRef.current, curToken, setUserLoginAgain,
                            (respData) => {   // Success
                                // Save response data
                                setLoadingCollections(false);
                                const curCollections = respData.sort((first, second) => first.name.localeCompare(second.name, undefined, { sensitivity: "base" }));
                                for (let one_coll of curCollections) {
                                  one_coll.uploads = one_coll.uploads.sort((first, second) => utils.compareUploadDates(first, second));
                                }
                                console.log('HACK: COLLECTIONS',curCollections);
                                setCollectionInfo(curCollections);
                            },
                            (err) => {        // Failure
                                addMessage(Level.Error, 'A problem occurred while fetching collection information');
                                setLoadingCollections(false);
                            }
    );

    if (!success) {
      addMessage(Level.Error, 'An unknown problem occurred while fetching collection information');
      setLoadingCollections(false);     
    }
  }, [addMessage, lastToken, setUserLoginAgain]);

  /**
   * Fetches the locations from the server
   * @function
   */
  const loadLocations = React.useCallback((token) => {
    const curToken = token || lastToken;
    setLoadingLocations(true);

    const success = Server.locations(serverURLRef.current, curToken, setUserLoginAgain, 
                          (respData) => {   // Success
                              // Save response data
                              setLoadingLocations(false);
                              const curLocations = respData.sort((first, second) => first.nameProperty.localeCompare(second.nameProperty, undefined, { sensitivity: "base" }));
                              console.log('HACK: LOCATIONS RESP:',curLocations);
                              setLocationInfo(curLocations);
                          },
                          (err) => {        // Failure
                              addMessage(Level.Error, 'A problem occurred while fetching locations');
                              setLoadingLocations(false);
                          }
    );
    if (!success) {
      addMessage(Level.Error, 'An unknown problem occurred while fetching locations');
      setLoadingLocations(false);
    }
  }, [addMessage, lastToken, setUserLoginAgain]);

  /**
   * Fetches the un-official species from the server
   * @function
   * @param {string} token The login token to use
   * @param {int} {retries} The number of times the request has been attempted (don't specify on initial call)
   */
  const loadOtherSpecies = React.useCallback((token, retries) => {
    const curToken = token || lastToken;
    const curRetries = retries || 0;
    setLoadingOtherSpecies(true);

    const success = Server.speciesOther(serverURLRef.current, curToken, setUserLoginAgain,
                                (respData) => {   // Success
                                    // Save response data
                                    console.log('HACK: OTHER SPECIES',respData);
                                    if (respData && respData.length > 0) {
                                      setLoadingOtherSpecies(false);
                                      setSpeciesOtherInfo(respData);
                                    } else if (curRetries < 5) {
                                      // Keep the spinner spinning until we have some result
                                      // We keep using curToken here since we've already checked the logic and determined which token to use
                                      window.setTimeout(() => loadOtherSpecies(curToken, curRetries+1), (curRetries+1) * 3000);
                                    } else {
                                      setLoadingOtherSpecies(false);
                                    }
                                },
                                (err) => {        // Failure
                                    addMessage(Level.Error, 'A problem occurred while fetching additional species');
                                    setLoadingOtherSpecies(false);
                                }
    );

    if (!success) {
      addMessage(Level.Error, 'An unknown problem occurred while fetching additional species');
      setLoadingOtherSpecies(false);
    }
  }, [addMessage, lastToken, setUserLoginAgain]);

  /**
   * Fetches the sandbox entries from the server
   * @function
   */
  const loadSandbox = React.useCallback((token) => {
    const curToken = token || lastToken;
    setLoadingSandbox(true);

    const success = Server.sandbox(serverURLRef.current, curToken, setUserLoginAgain, 
                            (respData) => {   // Success
                                // Save response data
                                setLoadingSandbox(false);
                                console.log('HACK: SANDBOX',respData);
                                setSandboxInfo(respData);
                            },
                            (err) => {        // Failure
                                addMessage(Level.Error, 'A problem occurred while fetching sandbox information');
                                setLoadingSandbox(false);
                            }
    );
    if (!success) {
      addMessage(Level.Error, 'An unknown problem occurred while fetching sandbox information');
      setLoadingSandbox(false);
    }
  }, [addMessage, lastToken, setUserLoginAgain]);

  /**
   * Fetches the species from the server
   * @function
   */
  const loadSpecies = React.useCallback((token) => {
    const curToken = token || lastToken;
    setLoadingSpecies(true);

    const success = Server.species(serverURLRef.current, curToken, setUserLoginAgain,
                              (respData) => {   // Success
                                  // Save response data
                                  console.log('HACK: SPECIES',respData);
                                  setLoadingSpecies(false);
                                  const curSpecies = respData.sort((first, second) => first.name.localeCompare(second.name, undefined, { sensitivity: "base" }));
                                  setSpeciesInfo(curSpecies);
                              },
                              (err) => {        // Failure
                                  addMessage(Level.Error, 'A problem occurred while fetching species');
                                  setLoadingSpecies(false);
                              }
    );

    if (!success) {
      addMessage(Level.Error, 'An unknown problem occurred while fetching species');
      setLoadingSpecies(false);
    }
  }, [addMessage, lastToken, setUserLoginAgain]);

  /**
   * Performs pos-login actions
   * @function
   * @param {string} token The login token to use
   */
  const loginAfterActions = React.useCallback((token) => {
    loadCollections(token);
    loadSandbox(token);
    loadLocations(token);
    loadSpecies(token);
    loadOtherSpecies(token);
  }, [loadCollections, loadLocations, loadOtherSpecies, loadSandbox, loadSpecies]);

  /**
   * Handles logging in the user and saves the login information
   * @function
   * @param {string} url The url of the storage to access (used as the login validator by the server)
   * @param {string} user The usernanme for logging in
   * @param {string} password The user's associated password
   * @param {boolean} remember Set to a truthy value to indicate saving non-sensitive login information
   */
  const handleLogin = React.useCallback((url, user, password, remember) => {
    setDbUser(user);
    setDbURL(url);
    setDbRemember(remember);
    // Check parameters
    const validCheck = LoginCheck(url, user, password);

    setLoginValid(validCheck);
    if (validCheck.valid) {
      // Try to log user in
      loginUser(url, user, password,
        (newToken, newInstance, repairServer) => {  // Successful login
          if (remember === true) {
            loginStore.saveLoginInfo(url, user, remember);
          } else {
            loginStore.clearLoginInfo();
          }
          // Check for messages
          window.setTimeout(() => handleFetchMessages(newToken), 100);
          // Load collections if it's not a new instance
          if (!newInstance && !repairServer) {
            window.setTimeout(() => loginAfterActions(newToken), 500);
          } else {
            // Indicate we have a new instance or we need to repair
            setCreateNewInstance(newInstance);
            setRepairInstance(repairServer);
            if (newInstance || repairServer) {
              idleTimeoutSecRef.current = IDLE_NEW_INSTALL_TIMEOUT_SEC;
            }
          }
        },
        () => { // Failed to log in
          addMessage(Level.Warn, 'Unable to log in. Please check your username and password before trying again', 'Login Failure');
        }
      );
    }
  }, [addMessage, handleFetchMessages, loginAfterActions, loginUser]);


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
    if (!savedTokenFetchedRef.current && !loggedIn) {
      const lastLoginToken = loginStore.loadLoginToken();
      savedTokenFetchedRef.current = true;
      setLastToken(lastLoginToken);
      if (lastLoginToken) {
        loginUserToken(lastLoginToken,
          () => {setCheckedToken(true);
                 // Load collections
                 window.setTimeout(() => loginAfterActions(lastLoginToken), 500);
                },
          () => {
            loginStore.clearLoginToken()
            setLastToken(null);
            setCheckedToken(true);
            const loInfo = loginStore.loadLoginInfo();
            savedLoginFetchedRef.current = true;
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
    if (!savedLoginFetchedRef.current && !loggedIn) {
      const loInfo = loginStore.loadLoginInfo();
      savedLoginFetchedRef.current = true;
      if (loInfo != null) {
        setDbURL(loInfo.url);
        setDbUser(loInfo.user);
        setDbRemember(loInfo.remember === 'true');
      }
    }
  }, [checkedToken, loggedIn, loginAfterActions, loginUserToken]);

  /**
   * Calculates the sizes of the window, header, footer, and workspace area (not used by header or footer)
   * @function
   */
  const calculateLayoutSizes = React.useCallback(() => {
    const newSize = {'width':window.innerWidth,'height':window.innerHeight};
    setSizeWindow(newSize);

    // Get the title size
    let titleSize = {top:0.0, left:0.0, width:newSize.width, height:DEFAULT_HEADER_HEIGHT};
    const titleEl = document.getElementById('sparcd-header');
    if (titleEl) {
      titleSize = titleEl.getBoundingClientRect();
      setSizeTitle({top:0.0, left:0.0, width:window.innerWidth, height:titleSize.height});
    }

    // Get the footer size
    let footerSize = {top:newSize.height-DEFAULT_FOOTER_HEIGHT, left:0.0, width:newSize.width, height:DEFAULT_FOOTER_HEIGHT};
    const footerEl = document.getElementById('sparcd-footer');
    if (footerEl) {
      footerSize = footerEl.getBoundingClientRect();
      setSizeFooter({top:newSize.height-footerSize.height, left:0.0, width:newSize.width, height:footerSize.height});
    }

    // Set the workspace size
    const workspaceSize = {top:titleSize.height, left:titleSize.left, width:titleSize.width, 
                            height:newSize.height-titleSize.height-footerSize.height}
    setSizeWorkspace(workspaceSize);
  }, []);

  /**
   * Clears the search and the controls
   * @function
   */
  const clearSearch = React.useCallback(() => {
    setCurSearchTitle(null);
    setCurSearchHandler(null);
  }, []);

  /**
   * Restores the indicated navigation breadcrumb
   * @function
   * @param {object} breadcrumb The breadcrumb to restore
   */
  const restoreBreadcrumb = React.useCallback((breadcrumb) => {
    const curCrumbs = [...breadcrumbs];
    let curRestore = null;
    do {
      curRestore = curCrumbs.pop();
    } while (curRestore && curRestore.name !== breadcrumb.name);
    setCurAction(breadcrumb.action);
    setCurActionData(breadcrumb.actionData);
    setEditing(breadcrumb.editing);
    setBreadcrumbs(curCrumbs);
    clearSearch();
  }, [breadcrumbs, clearSearch]);

  /**
   * Sets the current action based upon the users selection
   * @function
   * @param {object} action The working user action
   * @param {object} actionData Data associated with the action
   * @param {boolean} areEditing Is this an editing command
   * @param {string} {breadcrumbName} What is the display name of this action
   */
  const setCurrentAction = React.useCallback((action, actionData, areEditing, breadcrumbName) => {
    if (Object.values(UserActions).indexOf(action) > -1) {
      if (!actionData) {
        actionData = null;
      }
      // TODO: save state and data (and auto-restore)
      const prevAction = curAction;
      const prevActionData = curActionData;
      const prevEditing = editing;
      if (breadcrumbName) {
        let curCrumbs = [...breadcrumbs];
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
  }, [breadcrumbs, curAction, curActionData, editing]);

  /**
   * Logs the user out
   * @function
   */
  const handleLogout = React.useCallback(() => {
    setCollectionInfo(null);
    setCurAction(UserActions.None);
    setEditing(false);
    setLocationInfo(null);
    setLoggedIn(false);
    setLoginValid(DefaultLoginValid);
    setSpeciesOtherInfo(null);
    setSandboxInfo(null);
    setSpeciesInfo(null);
    setLastToken(null);
    setUserLoginAgain(false);
    setUserSettings(DEFAULT_USER_SETTINGS);
    setUserIdleTimedOut(false);
    setBreadcrumbs([]);
    loginStore.clearLoginToken();
  }, []);

  /**
   * Common function that loads the upload image information for editing purposes
   * @function
   * @param {string} collectionId The ID of the collection containing the upload 
   * @param {string} uploadId The ID of the upload to edit
   * @param {function} {cbSuccess} Function to call upon success
   * @param {function} {cbFailure} Function to call upon failure
   */
  const editCollectionUpload = React.useCallback((collectionId, uploadId, cbSuccess, cbFailure) => {

    const success = Server.uploadImages(serverURLRef.current, lastToken, collectionId, uploadId, setUserLoginAgain,
                              (respData) => {   // Success
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
                              },
                              (err) => {        // Failure
                                  addMessage(Level.Error, 'A problem occurred while fetching the upload information');
                                  if (cbFailure && typeof cbFailure === 'function') {
                                    cbFailure();
                                  }
                              }
    );

    if (!success) {
      addMessage(Level.Error, 'An unknown problem occurred while fetching the upload information');
      if (cbFailure && typeof cbFailure === 'function') {
        cbFailure();
      }
    }
  }, [addMessage, collectionInfo, lastToken, setUserLoginAgain]);

  /**
   * Reloads the information on the current upload
   * @function
   */
  const uploadReload = React.useCallback(() => {
    editCollectionUpload(curActionData.collectionId, curActionData.uploadId, 
                              (curUpload, curImages) => { // Success callback
                                        setCurActionData(prev => {return {...prev, images:curImages};});
                                      }
                        )
  }, [curActionData, editCollectionUpload]);

  /**
   * Updates the metadata on the current upload
   * @function
   */
  const uploadUpdate = React.useCallback(() => {
    loadCollections(lastToken)
  }, [lastToken, loadCollections]);

  /**
   * Calls the callback to perform a search
   * @function
   * @param {string} searchTerm The search term to pass to the callback
   */
  const handleSearch = React.useCallback((searchTerm) => {
    return curSearchHandler(searchTerm);
  }, [curSearchHandler]);

  /**
   * Enables the setting up of searching feature
   * @function
   * @param {string} searchLabel The label of the search
   * @param {function} searchHandler Function to call when the user wants to search
   */
  const setupSearch = React.useCallback((searchLabel, searchHandler) => {
    if (searchLabel === undefined && searchHandler === undefined) {
      clearSearch();
      return;
    }
    if (!searchHandler || typeof searchHandler !== "function") {
      console.log('Error: Invalid function passed when setting up search for \"'+searchLabel+'\"');
      return;
    }

    setCurSearchTitle(searchLabel);
    setCurSearchHandler(() => searchHandler);
  }, [clearSearch]);

  /**
   * Handles enabling administration editing
   * @function
   * @param {string} pw The password to use to check for permission
   * @param {function} {cbSuccess} The success callback
   * @param {function} {cbFail} The failure callback
   */
  const confirmAdminPassword = React.useCallback((pw, cbSuccess, cbFail) => {

    const success = Server.settingsAdminCheck(serverURLRef.current, lastToken, pw, setUserLoginAgain,
                                (respData) => {   // Success
                                    // Check the return
                                    if (respData.success === true) {
                                      cbSuccess();
                                    } else {
                                      cbFail();
                                    }
                                },
                                (err) => {        // Failure
                                    cbFail();
                                }
    );

    if (!success) {
      cbFail();
    }
  }, [lastToken]);

  /**
   * Handles enabling administration editing
   * @function
   * @param {string} pw The password to use to check for permission
   * @param {function} {cbSuccess} The success callback
   * @param {function} {cbFail} The failure callback
   */
  const handleAdminSettings = React.useCallback((pw, cbSuccess, cbFail) => {
    // Check that the password is accurate and display the admin settings pages
    cbSuccess ||= () => {};
    cbFail ||= () => {};

    const onPasswordConfirmed = () => {
      cbSuccess();
      setDisplayAdminSettings(true);
    };

    confirmAdminPassword(pw, onPasswordConfirmed, cbFail);
  }, [confirmAdminPassword]);

  /**
   * Handles enabling administration editing
   * @function
   * @param {string} pw The password to use to check for permission
   * @param {function} {cbSuccess} The success callback
   * @param {function} {cbFail} The failure callback
   */
  const confirmOwnerPassword = React.useCallback((pw, cbSuccess, cbFail) => {
    cbSuccess ||= () => {};
    cbFail ||= () => {};

    const success = Server.settingsOwnerCheck(serverURLRef.current, lastToken, pw, setUserLoginAgain,
                              (respData) => {   // Success
                                  // Check the return
                                  if (respData.success === true) {
                                    cbSuccess();
                                  } else {
                                    cbFail();
                                  }
                              },
                              (err) => {        // Failure
                                  cbFail();
                              }
    );

    if (!success) {
      cbFail();
    }
  }, [lastToken]);

  /**
   * Handles enabling collection owner editing
   * @function
   * @param {string} pw The password to use to check for permission
   * @param {function} {cbSuccess} The success callback
   * @param {function} {cbFail} The failure callback
   */
  const handleOwnerSettings = React.useCallback((pw, cbSuccess, cbFail) => {
    // Check that the password is accurate and display the admin settings pages
    cbSuccess ||= () => {};
    cbFail ||= () => {};

    const onPasswordConfirmed = () => {
      cbSuccess();
      setDisplayOwnerSettings(true);
    };

    confirmOwnerPassword(pw, onPasswordConfirmed, cbFail);
  }, [confirmOwnerPassword]);

  /**
   * Updates the user's settings on the server
   * @function
   * @param {object} newSettings The settings to save on the server for the user
   */
  const updateUserSettings = React.useCallback((newSettings) => {

    const success = Server.userSettings(serverURLRef.current, lastToken, newSettings, setUserLoginAgain, 
                          (respData) => {   // Success
                              // Save the returned settings
                              const curSettings = respData;

                              curSettings['autonext'] = utils.coerceBool(curSettings['autonext'], true);
                              curSettings['sandersonDirectory'] = utils.coerceBool(curSettings['sandersonDirectory'], false);
                              curSettings['sandersonOutput'] = utils.coerceBool(curSettings['sandersonOutput'], false);

                              setUserSettings(prev => ({...prev, settings:curSettings}) );
                          },
                          (err) => {        // Failure
                              addMessage(Level.Error, 'A problem occurred while saving your settings');
                          }
    );

    if (!success) {
      addMessage(Level.Error, 'An unknown problem occurred while saving your settings');
    }

  }, [addMessage, lastToken, setUserLoginAgain]);

  /**
   * Handles adding a new message
   * @function
   * @param {string} recipients The comma separated list of recipients
   * @param {string} subject The subject of the message
   * @param {string} message The message itself
   * @param {function} onMessageSent The function to call after the message sent
   */
  const handleNewMessage = React.useCallback((recipients, subject, message, onMessageSent) => {

    const success = Server.messageAdd(serverURLRef.current, lastToken, recipients, subject, message, setUserLoginAgain,
                            (respData) => {   // Success
                                // Check the return
                                if (onMessageSent && typeof onMessageSent === 'function') {
                                  onMessageSent(respData.success, respData.message)
                                }
                            },
                            (err) => {        // Failure
                                addMessage(Level.Error, 'A problem occurred while adding your message');
                            }
    );

    if (!success) {
      addMessage(Level.Error, 'An unknown problem occurred while adding your message');
    }

  }, [addMessage, lastToken, setUserLoginAgain]);

  /**
   * Handles marking messages as read
   * @function
   * @param {object} msgIds The array of message IDs to mark
   */
  const handleReadMessages= React.useCallback((msgIds) => {

    const success = Server.messageRead(serverURLRef.current, lastToken, msgIds, setUserLoginAgain,
                        (respData) => {   // Success
                            // It appears that everything worked out
                        },
                        (err) => {        // Failure
                            // Don't do anything
                        }
    );

    if (!success) {
      // We ignore the error
    }

  }, [lastToken, setUserLoginAgain]);

  /**
   * Handles deleting messages
   * @function
   * @param {object} msgIds The array of message IDs to delete
   */
  const handleDeleteMessages= React.useCallback((msgIds) => {

    const success = Server.messageDelete(serverURLRef.current, lastToken, msgIds, setUserLoginAgain, 
                              (respData) => {   // Success
                                  // It appears that everything worked out
                              },
                              (err) => {        // Failure
                                  // Do nothing when it doesn't work
                              }
    );

    if (!success) {
      // Do nothing when it doesn't work
    }

  }, [lastToken, setUserLoginAgain]);

  /**
   * Sets the remember login information flag to true or false (is it truthy, or not?)
   * @function
   * @param {boolean} newRemember Set to true for non-sensitive login details to be remembered, or false
   */
  const handleRememberChanged = React.useCallback((newRemember) => {
    setDbRemember(newRemember);
  }, []);

  /**
   * Handles displaying the user settings
   * @function
   * @param {object} userSettings The user settings to have managed
   */
  const handleSettings = React.useCallback((userSettings) => {
    const mySettingsId = settingsRequestIdRef.current = settingsRequestIdRef.current+1;
    const workingTimeoutId = settingsTimeoutIdRef.current;
    settingsTimeoutIdRef.current = null;
    if (workingTimeoutId != null) {
      window.clearTimeout(workingTimeoutId);
    }
    window.setTimeout(() => {
      // If we're still the only one trying to send settings, send them
      if (settingsRequestIdRef.current === mySettingsId) {
        settingsTimeoutIdRef.current = window.setTimeout(() =>
                  {
                    settingsTimeoutIdRef.current = null;
                    if (settingsRequestIdRef.current === mySettingsId) updateUserSettings(userSettings)
                  }, 100);
      }
    }, 500);
  }, [updateUserSettings]);

  /**
   * Handles removing a message after it's been closed
   * @function
   * @param {number} messageId The ID of the message to close
   */
  const handleCloseMessage = React.useCallback((messageId) => {
    setMessages(prev => {
      const idx = prev.findIndex((item) => item.messageId === messageId);
      return idx >= 0 ? prev.toSpliced(idx, 1) : prev;
    });
  }, []);

  /**
   * Handles disabling and enabling the check for the user being idle
   * @function
   * @param {boolean} disabled Set to true to disable the check and false to enable it
   */
  const handleDisableIdleCheck = React.useCallback((disabled) => {
    const prevDisabled = checkForIdleRef.current;

    checkForIdleRef.current = !disabled;

    // When we're changing from not checking to checking for idle, we need a new timestamp
    if (prevDisabled === false && checkForIdleRef.current === true) {
      idleLastTimestampRef.current = Date.now();
    }
  }, []);

  /**
   * Handles when creating a new instance of SPARCd is cancelled
   * @function
   */
  const handleCancelNewInstallation = React.useCallback(() => {
    idleTimeoutSecRef.current = DEFAULT_IDLE_TIMEOUT_SEC;
    setCreateNewInstance(false);
    setRepairInstance(false);
    handleLogout();
  }, [handleLogout]);

  // Get mobile device information if we don't have it yet
  React.useLayoutEffect(() => {
    if (mobileDevice == null && typeof window !== 'undefined') {
      setMobileDevice(navigator.userAgent.indexOf('Mobi') > -1);
    }
  }, [mobileDevice]);

  /**
   * Function to handle when the token has expired
   * @function
   */
  const handleTokenExpired = React.useCallback(() => {
    setUserLoginAgain(true);
  }, []);

  /**
   * Function to handle sandbox refresh
   * @function
   */
  const handleSandboxRefresh = React.useCallback(() => {
    loadSandbox(lastToken);
    loadCollections(lastToken);
  }, [lastToken, loadCollections, loadSandbox]);

  /**
   * Function to handle user wanting to display messages
   * @function
   */
  const handleDisplayMessages = React.useCallback(() => {
    setDisplayMessages(true);
    handleFetchMessages(lastToken);
  }, [handleFetchMessages, lastToken]);

  /**
   * Function to handle the timeout when logging in again
   * @function
   */
  const handleLoginAgainTimeout = React.useCallback(() => {
    setLastToken(null);
    loginStore.clearLoginToken();
    setUserLoginAgain(true);
  }, []);

  /**
   * Function to handle the user cancelling the timer when asked to login again
   * @function
   */
  const handleCancelLoginAgainTimeout = React.useCallback(() => {
    setUserIdleTimedOut(false);
  }, []);

  /**
   * Function to handle refreshing user messages
   * @function
   */
  const handleUserMessagesRefresh = React.useCallback(() => {
    handleFetchMessages(lastToken);
  }, [handleFetchMessages, lastToken]);

  /**
   * Function to close the admin settings
   * @function
   */
  const handleCloseSettingsAdmin = React.useCallback(() => {
    setDisplayAdminSettings(false);
  }, []);

  /**
   * Function to close owner settings
   * @function
   */
  const handleCloseSettingsOwner = React.useCallback(() => {
    setDisplayOwnerSettings(false);
  }, []);

  /**
   * Function to close the user settings
   * @function
   */
  const handleCloseUserMessages = React.useCallback(() => {
    handleFetchMessages(lastToken);
    setDisplayMessages(false);
  }, [handleFetchMessages, lastToken]);

  // Render the UI
  const providerValues = React.useMemo(() => (
  {
      addMessage,
      collectionInfo,
      handleDisableIdleCheck,
      isNarrow,
      lastToken,
      locationInfo,
      mobileDevice,
      onTokenExpired: handleTokenExpired,
      sandboxInfo,
      serverURL: serverURLRef.current,
      sizes: { footer: sizeFooter, title: sizeTitle, window: sizeWindow, workspace: sizeWorkspace },
      speciesInfo,
      speciesOtherInfo,
      userMessages,
      userSettings,
    }
  ), [addMessage, collectionInfo, handleDisableIdleCheck, handleTokenExpired, isNarrow, lastToken, locationInfo, mobileDevice, sandboxInfo,
      sizeFooter, sizeTitle, sizeWindow, sizeWorkspace, speciesInfo, speciesOtherInfo, userMessages, userSettings]);

  return (
    <main style={{...theme.palette.main}}>
      <ContextProviders values={providerValues} >
          <Grid id='sparcd-wrapper' container direction="row" alignItems="start" justifyContent="start" sx={{minWidth:'100vw',minHeight:'100vh'}}>
            <TitleBar searchTitle={curSearchTitle}
                      size={isNarrow?"small":"normal"} 
                      onSearch={handleSearch}
                      onSettings={loggedIn ? handleSettings : null}
                      onLogout={handleLogout}
                      breadcrumbs={breadcrumbs} 
                      onBreadcrumb={restoreBreadcrumb}
                      onAdminSettings={handleAdminSettings}
                      onOwnerSettings={handleOwnerSettings}
                      onMessages={handleDisplayMessages}
            />
            <Box id='sparcd-middle-wrapper' >
              {!loggedIn || createNewInstance === true || repairInstance === true ? 
                <LoginValidContext.Provider value={loginValid}>
                  <Login prevUrl={dbURL} prevUser={dbUser} prevRemember={dbRemember} onLogin={handleLogin}
                         onRememberChange={handleRememberChanged} />
                </LoginValidContext.Provider>
                :
                  <ActionsRouter 
                          action={curAction}
                          curActionData={curActionData}
                          loadingCollections={loadingCollections}
                          loadingSandbox={loadingSandbox}
                          onSetAction={setCurrentAction}
                          onEditUpload={editCollectionUpload}
                          onSandboxRefresh={handleSandboxRefresh}
                          setupSearch={setupSearch}
                          uploadReload={uploadReload}
                          uploadUpdate={uploadUpdate}
                  />
                }
              </Box>
            <FooterBar />
          </Grid>
          { !checkedToken &&
            <Grid id="login-checking-wrapper" container direction="row" alignItems="center" justifyContent="center"
                  sx={{...theme.palette.login_checking_wrapper}}
            >
              <div style={{...theme.palette.login_checking}}>
                <Grid container direction="column" alignItems="center" justifyContent="center" >
                    <Typography gutterBottom variant="body2" color="grey">
                      Restoring previous session, please wait...
                    </Typography>
                    <CircularProgress variant="indeterminate" />
                </Grid>
              </div>
            </Grid>
          }
          { displayAdminSettings &&
              <SettingsAdmin loadingCollections={loadingCollections}
                              loadingLocations={loadingLocations}
                              onConfirmPassword={confirmAdminPassword}
                              onSandboxRefresh={handleSandboxRefresh}
                              onClose={handleCloseSettingsAdmin}
              />
          }
          { displayOwnerSettings &&
              <SettingsOwner loadingCollections={loadingCollections}
                              onConfirmPassword={confirmOwnerPassword} 
                              onClose={handleCloseSettingsOwner}
              />
          }
          { displayMessages && 
              <UserMessages onAdd={handleNewMessage}
                            onDelete={handleDeleteMessages}
                            onRefresh={handleUserMessagesRefresh}
                            onRead={handleReadMessages}
                            onClose={handleCloseUserMessages}
              />
          }
          { (createNewInstance === true || repairInstance === true) &&
              <NewInstallation newInstallToken={lastToken} isRepair={repairInstance} onCancel={handleCancelNewInstallation} />
          }
          { // Needs to be next to last (allow messages to overlay)
            (userLoginAgain === true || userIdleTimedOut === true) && 
              <LoginAgain 
                      message={userLoginAgain === true ? "Your session has expired. Please log in again" : "This session has been idle for too long. Please login again"}
                      timeoutSec={userLoginAgain !== true && userIdleTimedOut === true ? idleLogoutTimeoutSecRef.current : null}
                      onCancelTimeout={handleCancelLoginAgainTimeout}
                      onTimedOut={handleLoginAgainTimeout}
                      onLogout={handleLogout}
              />
          }
          { // Make sure this is last
            messages.length > 0 && 
              <Grid id="messages-wrapper" container direction="row" alignItems="start" justifyContent="center"
                    sx={{...theme.palette.messages_wrapper, top:sizeWorkspace.top}}>
                <Messages messages={messages} closeCb={handleCloseMessage}/>
              </Grid>
          }
      </ContextProviders>
    </main>
  )
}
