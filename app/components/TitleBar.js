
/** @module components/TitleBar */

import * as React from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Link from '@mui/material/Link';
import MenuOutlinedIcon from '@mui/icons-material/MenuOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import { Level } from './Messages';
import Settings from './Settings';
import styles from './components.module.css';
import { AddMessageContext, TokenContext, UserNameContext, UserSettingsContext } from '../serverInfo';

/**
 * Renders the title bar
 * @function
 * @param {string} [searchTitle] The optional title of the search field
 * @param {array} [breadcrumbs] An optional list of breadcrumbs to display
 * @param {string} [size] Optionally one of "small" or "full"
 * @param {function} [onSearch] The function to call to perform a search
 * @param {function} [onBreadcrumb] The breadcrumb click handler
 * @param {function} onSettings The settings click handler
 * @param {function} onLogout The handler for the user wanting to logout
 * @param {function} onAdminSettings The handler for when an admin users wants to edit system-wide settings
 * @param {function} onOwnerSettings The handler for when an admin users wants to edit collection settings
 * @returns {object} The rendered UI
 */
export default function TitleBar({searchTitle, breadcrumbs, size, onSearch, onBreadcrumb, onSettings, onLogout, onAdminSettings, onOwnerSettings}) {
  const theme = useTheme();
  const searchId = React.useMemo(() => "search-" + (searchTitle ? searchTitle.toLowerCase().replaceAll(' ', '-') : "sparcd"), [searchTitle]);
  const addMessage = React.useContext(AddMessageContext); // Function adds messages for display
  const loginToken = React.useContext(TokenContext);  // Login token
  const userName = React.useContext(UserNameContext);  // User display name
  const userSettings = React.useContext(UserSettingsContext);  // User display settings
  const [showSettings, setShowSettings] = React.useState(false);
  const [welcomeShown, setWelcomeShown] = React.useState(false); // Flag used to show users a welcome message
  const [welcomeTimeoutId, setWelcomeTimeoutId] = React.useState(null); // Stores the timer ID for removing welcome message

  const WELCOME_TIMEOUT_SEC = 1.5 * 60 * 1000;

  // Used to setup the welcome message
  React.useLayoutEffect(() => {
    if (!welcomeShown && loginToken) {
      setWelcomeShown(true);
      if (!welcomeTimeoutId) {
        setWelcomeTimeoutId(window.setTimeout(() => setWelcomeTimeoutId(null), WELCOME_TIMEOUT_SEC));
      }
    }
  }, [loginToken, setWelcomeShown, setWelcomeTimeoutId, welcomeShown, welcomeTimeoutId]);

  /**
   * Handles the clicking of the search icon
   * @function
   */
  function clickHandler() {
    const searchEl = document.getElementById(searchId);
    if (searchEl && searchEl.value) {
      if (onSearch(searchEl.value)) {
        searchEl.value = null;
      }
    }
  }

  /**
   * Handles the Enter key to start a search
   * @function
   * @apram {object} event The event
   */
  function handleSearchChange(event) {
    if (event.key == 'Enter') {
      clickHandler();
    }
  }

  /**
   * Handles the user requesting breadcrumb navigation
   * @function
   * @param {object} navItem The chosen breadcrumb navigation item
   */
  function handleNav(navItem) {
    onBreadcrumb(navItem);
  }

  /**
   * Handles the user requesting settings closure
   * @function
   */
  function handleSettingsClose() {
    setShowSettings(false);
  }

  /**
   * Handles the user wanting to make admin changes
   * @function
   * @param {string} pw The password for administration editing
   */
  const handleAdminSettings = React.useCallback((pw) => {
    onAdminSettings(pw, handleSettingsClose, () => {addMessage(Level.Warning, 'Login check failed');});
  }, [onAdminSettings, handleSettingsClose, addMessage, Level]);

  /**
   * Handles the user wanting to make collection changes
   * @function
   * @param {string} pw The password for administration editing
   */
  const handleOwnerSettings = React.useCallback((pw) => {
    onOwnerSettings(pw, handleSettingsClose, () => {addMessage(Level.Warning, 'Login check failed');});
  }, [onOwnerSettings, handleSettingsClose, addMessage, Level]);

  const extraInputSX = size === "small" ? {maxWidth:'10em'} : {};

  // Render the UI
  return (
    <header id='sparcd-header' style={{...theme.palette.title_bar}} role="banner">
      <Box sx={{ flexGrow: 1, 'width': '100vw' }} >
        <Grid id='sparcd-header-items' container direction="column" spacing={0} sx={{flexGrow:1}}>
          <Grid id='sparcd-header-image-wrapper' container direction="row" spacing={3} sx={{flexGrow:1}}>
            <Grid id='sparcd-header-image-link' size="grow" container direction="row" alignItems="center" sx={{cursor:'pointer'}}>
                <div onClick={() => window.location.href="/"}
                  aria-description="Scientific Photo Analysis for Research & Conservation database"
                  className={styles.titlebar_title}>SPARC&apos;d
                </div>
                <img id="sparcd-logo" src="/sparcd.png" alt="SPARC'd Logo" className={styles.titlebar_icon}/>
            </Grid>
            <Grid id='sparcd-header-search-wrapper' sx={{marginLeft:'auto'}} style={{paddingLeft:'0px'}}>
              <Grid id='sparcd-header-search' container direction="row">
                { welcomeTimeoutId !== null && loginToken !== null ? 
                    <Grid container alignItems="center" justifyContent="center" sx={{paddingRight:'10px', color:'dimgrey'}}>
                      <Typography style={{fontSize:'larger'}}>
                        Welcome back
                      </Typography>
                      <Typography style={{fontSize:'larger', fontFamily:'cursive', fontWeight:'bold'}}>
                        &nbsp;{userName}
                      </Typography>
                      <Typography style={{fontSize:'larger'}}>
                        !
                      </Typography>
                    </Grid>
                  : loginToken !== null &&
                    <Grid container alignItems="center" justifyContent="center" sx={{paddingRight:'10px', color:'dimgrey'}}>
                      <Typography style={{fontSize:'larger', fontFamily:'cursive', fontWeight:'bold'}}>
                        &nbsp;{userName}
                      </Typography>
                    </Grid>
                }
                { searchTitle &&
                  <TextField id={searchId} label={searchTitle} placehoder={searchTitle} size="small" variant="outlined" style={extraInputSX}
                            onKeyPress={handleSearchChange}
                            slotProps={{
                              input: {
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
                  <IconButton size="small" onClick={() => setShowSettings(true)}>
                    <MenuOutlinedIcon fontSize="small" />
                  </IconButton>
                }
              </Grid>
            </Grid>
          </Grid>
          <Grid size={{xs:12}} style={{paddingTop:'0', visibility:'visible'}} >
            <Typography sx={{fontSize:"xx-small"}}>
            { breadcrumbs && breadcrumbs.length > 0 ? 
                breadcrumbs.map((item, idx) => {
                              return (<React.Fragment key={"breadcrumb-" + idx + '-' + item.name} >
                                        &nbsp;
                                        <Link component="button" underline="hover" sx={{fontSize:'larger'}}
                                              onClick={() => handleNav(item)}
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
                                                       onLogout={() => {handleSettingsClose();onLogout();}} onAdminSettings={(pw) => handleAdminSettings(pw)} 
                                                       onOwnerSettings={(pw) => handleOwnerSettings(pw)} />
      }
    </header>
    );
}
