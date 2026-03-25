
/** @module components/TitleBar */

import * as React from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Link from '@mui/material/Link';
import MailOutlinedIcon from '@mui/icons-material/MailOutlined';
import MenuOutlinedIcon from '@mui/icons-material/MenuOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

import { Level } from './components/Messages';
import Settings from './settings/Settings';
import styles from './components/components.module.css';
import { AddMessageContext, TokenContext, UserMessageContext, UserNameContext, UserSettingsContext } from './serverInfo';

const WELCOME_TIMEOUT_SEC = 1.5 * 60 * 1000;

/**
 * Renders the title bar
 * @function
 * @param {string} [searchTitle] The optional title of the search field
 * @param {array} [breadcrumbs] An optional list of breadcrumbs to display
 * @param {string} [size] Optionally one of "small" or "full"
 * @param {function} [onSearch] The function to call to perform a search
 * @param {function} [onBreadcrumb] The breadcrumb click handler
 * @param {function} onMessages The function to call to display messages
 * @param {function} onSettings The settings click handler
 * @param {function} onLogout The handler for the user wanting to logout
 * @param {function} onAdminSettings The handler for when an admin users wants to edit system-wide settings
 * @param {function} onOwnerSettings The handler for when an admin users wants to edit collection settings
 * @returns {object} The rendered UI
 */
export default function TitleBar({searchTitle, breadcrumbs, size, onSearch, onBreadcrumb, onSettings, onLogout, onMessages, onAdminSettings, onOwnerSettings}) {
  const theme = useTheme();
  const searchId = React.useMemo(() => "search-" + (searchTitle ? searchTitle.toLowerCase().replaceAll(' ', '-') : "sparcd"), [searchTitle]);
  const addMessage = React.useContext(AddMessageContext); // Function adds messages for display
  const loginToken = React.useContext(TokenContext);  // Login token
  const userMessages = React.useContext(UserMessageContext);  // User messages
  const userName = React.useContext(UserNameContext);  // User display name
  const userSettings = React.useContext(UserSettingsContext);  // User display settings
  const searchRef = React.useRef(null);         // The search element
  const welcomeHasTimedOut = React.useRef(false); // Flag used to show the welcome has timed out
  const welcomeTimeoutRef = React.useRef(null); // Stores the timer ID for removing welcome message
  const [welcomeShown, setWelcomeShown] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);
  
  const haveUnreadMessages = React.useMemo(() => {
    return userMessages?.count > 0 && userMessages?.messages?.filter((item) => item.read_sec === null).length > 0;
  }, [userMessages]);

  // Used to setup the welcome message
  React.useEffect(() => {
    if (!loginToken || welcomeShown || welcomeHasTimedOut.current) {
      return;
    }

    setWelcomeShown(true);

    if (welcomeTimeoutRef.current == null) {
      welcomeTimeoutRef.current = window.setTimeout(() => {
          setWelcomeShown(false);
          welcomeHasTimedOut.current = true;
          welcomeTimeoutRef.current = null;
      }, WELCOME_TIMEOUT_SEC);
    }

    // Clears outstanding timeouts
    return () => {
      if (welcomeTimeoutRef.current) {
        window.clearTimeout(welcomeTimeoutRef.current);
        welcomeTimeoutRef.current= null;
      }
    };

  }, [loginToken]);
  /**
   * Handles the clicking of the search icon
   * @function
   */
  const clickHandler = React.useCallback(() => {
    if (searchRef.current && searchRef.current.value) {
      if (onSearch?.(searchRef.current.value)) {
        searchRef.current.value = null;
      }
    }
  }, [onSearch]);

  /**
   * Handles the Enter key to start a search
   * @function
   * @param {object} event The event
   */
  const handleSearchChange = React.useCallback((event) => {
    if (event.key === 'Enter') {
      clickHandler();
    }
  }, [clickHandler]);

  /**
   * Handles the user requesting breadcrumb navigation
   * @function
   * @param {object} navItem The chosen breadcrumb navigation item
   */
  const handleNav = React.useCallback((navItem) => {
    onBreadcrumb?.(navItem);
  }, [onBreadcrumb]);

  /**
   * Handles the user requesting settings closure
   * @function
   */
  const handleSettingsClose = React.useCallback(() => {
    setShowSettings(false);
  }, []);

  /**
   * Function to add a login check failed message
   * @function
   */
  const loginCheckFailedMessage = React.useCallback(() => {
    addMessage(Level.Warning, 'Login check failed');
  }, [addMessage])

  /**
   * Handles the user wanting to make admin changes
   * @function
   * @param {string} pw The password for administration editing
   */
  const handleAdminSettings = React.useCallback((pw) => {
    onAdminSettings?.(pw, handleSettingsClose, loginCheckFailedMessage);
  }, [handleSettingsClose, loginCheckFailedMessage, onAdminSettings]);

  /**
   * Handles the user wanting to make collection changes
   * @function
   * @param {string} pw The password for administration editing
   */
  const handleOwnerSettings = React.useCallback((pw) => {
    onOwnerSettings?.(pw, handleSettingsClose, loginCheckFailedMessage);
  }, [handleSettingsClose, loginCheckFailedMessage, onOwnerSettings]);

  /**
   * Function to handle navigating home
   * @function
   */
  const handleNavigateHome = React.useCallback(() => {
    window.location.href="/";
  }, []);

  /**
   * Function to handle showing messages
   * @function
   */
  const handleShowMessages = React.useCallback(() => {
    onMessages(loginToken)
  }, [loginToken, onMessages]);

  /**
   * Function to handle showing settings
   * @function
   */
  const handleShowSettings = React.useCallback(() => {
    setShowSettings(true)
  }, []);

  /**
   * Function to handle logout
   * @function
   */
  const handleLogout = React.useCallback(() => {
    handleSettingsClose();
    onLogout();
  }, [handleSettingsClose, onLogout]);

  /**
   * Handle the user navigating through breadcrumbs
   * @function
   * @param {object} event The triggering event
   */
  const handleBreadcrumbNavigation = React.useCallback((event) => {
    const idx = parseInt(event.currentTarget.dataset.idx, 10);
    if (idx >= 0 && idx < breadcrumbs.length) {
      handleNav(breadcrumbs[idx]);
    }
  }, [breadcrumbs, handleNav]);


  const extraInputSX = React.useMemo(() => {
    return size === "small" ? { maxWidth: '10em' } : {};
  }, [size]);

  // Render the UI
  return (
    <header id='sparcd-header' style={{...theme.palette.title_bar}} role="banner">
      <Box sx={{ flexGrow: 1, 'width': '100vw' }} >
        <Grid id='sparcd-header-items' container direction="column" spacing={0} sx={{flexGrow:1}}>
          <Grid id='sparcd-header-image-wrapper' container direction="row" spacing={3} sx={{flexGrow:1}}>
            <Grid id='sparcd-header-image-link' size="grow" container direction="row" alignItems="center" sx={{cursor:'pointer'}}>
                <div onClick={handleNavigateHome}
                      aria-label="Scientific Photo Analysis for Research and Conservation database"
                      role="link"
                      tabIndex={0}
                      className={styles.titlebar_title}
                >
                  SPARC&apos;d
                </div>
                <img id="sparcd-logo" src="/sparcd.png" alt="SPARC'd Logo" className={styles.titlebar_icon}/>
            </Grid>
            <Grid id='sparcd-header-search-wrapper' sx={{marginLeft:'auto'}} style={{paddingLeft:'0px'}}>
              <Grid id='sparcd-header-search' container direction="row">
                { welcomeShown && loginToken != null ? 
                    <Grid container alignItems="center" justifyContent="center" sx={{paddingRight:'10px', color:'dimgrey'}}>
                      <Typography sx={{fontSize:'larger'}}>
                        Welcome back
                      </Typography>
                      <Typography sx={{fontSize:'larger', fontFamily:'cursive', fontWeight:'bold'}}>
                        &nbsp;{userName}
                      </Typography>
                      <Typography sx={{fontSize:'larger'}}>
                        !
                      </Typography>
                    </Grid>
                  : loginToken !== null &&
                    <Grid container alignItems="center" justifyContent="center" sx={{paddingRight:'10px', color:'dimgrey'}}>
                      <Typography sx={{fontSize:'larger', fontFamily:'cursive', fontWeight:'bold'}}>
                        &nbsp;{userName}
                      </Typography>
                    </Grid>
                }
                { searchTitle &&
                  <TextField id={searchId} label={searchTitle} placeholder={searchTitle} size="small" variant="outlined" sx={extraInputSX}
                            onKeyDown={handleSearchChange}
                            slotProps={{
                              input: {
                                inputRef: searchRef,
                                endAdornment:
                                  <InputAdornment position="end">
                                    <IconButton
                                      aria-label="description for action"
                                      onClick={clickHandler}
                                    >
                                      <SearchOutlinedIcon />
                                    </IconButton>
                                  </InputAdornment>
                              },
                            }}
                 />
                }
                { loginToken !== null && 
                  <Tooltip title='Messages'>
                    <IconButton fontSize="small" onClick={handleShowMessages}
                                sx={{ ...(haveUnreadMessages ? theme.palette.have_messages : {}) }}
                      >
                      <MailOutlinedIcon fontSize="small"/>
                    </IconButton>
                  </Tooltip>
                }
                { loginToken !== null && 
                  <Tooltip title='Settings'>
                    <IconButton size="small" onClick={handleShowSettings}>
                      <MenuOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                }
              </Grid>
            </Grid>
          </Grid>
          <Grid size={{xs:12}} sx={{paddingTop:'0', visibility:'visible'}} >
            <Typography sx={{fontSize:"small", fontWeight:'bold'}}>
            { breadcrumbs?.length ? 
                breadcrumbs.map((item, idx) => {
                              return (<React.Fragment key={"breadcrumb-" + idx + '-' + item.name} >
                                        &nbsp;
                                        <Link component="button" underline="hover" data-idx={idx} 
                                              onClick={handleBreadcrumbNavigation}
                                        >
                                          {item.name}{idx < (breadcrumbs.length -1) ? ' / ' : ' '}
                                        </Link>
                                      </React.Fragment>
                              );}
                            )
              : <React.Fragment>&nbsp;</React.Fragment>
            }
            </Typography>
          </Grid>
        </Grid>
      </Box>
      {showSettings && onSettings != null && <Settings curSettings={userSettings} onChange={onSettings} onClose={handleSettingsClose} 
                                                       onLogout={handleLogout} onAdminSettings={handleAdminSettings} 
                                                       onOwnerSettings={handleOwnerSettings} />
      }
    </header>
    );
}

TitleBar.propTypes = {
  searchTitle:     PropTypes.string,
  breadcrumbs:     PropTypes.arrayOf(PropTypes.shape({
    name:          PropTypes.string.isRequired,
  })),
  size:            PropTypes.oneOf(['small', 'full']),
  onSearch:        PropTypes.func,
  onBreadcrumb:    PropTypes.func,
  onSettings:      PropTypes.func,
  onLogout:        PropTypes.func.isRequired,
  onMessages:      PropTypes.func.isRequired,
  onAdminSettings: PropTypes.func.isRequired,
  onOwnerSettings: PropTypes.func.isRequired,
};
