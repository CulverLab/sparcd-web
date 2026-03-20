/** @module Login */

import * as React from 'react';
import Image from 'next/image'
import styles from './page.module.css'
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import LoginIcon from '@mui/icons-material/Login';
import TextField from '@mui/material/TextField';
import { useTheme } from '@mui/material/styles';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

import PropTypes from 'prop-types';

import wildcatResearch from '../public/wildcatResearch.png'
import { LoginValidContext } from './checkLogin'
import { SizeContext } from './serverInfo';

/** Returns the Login dialog
  * @function
  * @param {string} [prevUrl] URL that was previously used to log in
  * @param {string} [prevUser] Username that was previously used to log in
  * @param {boolean} [prevRemember] Flag indicating the remember-me flag was set
  * @param {function} onLogin The login function to call when the user clicks the login button
  * @param {function} onRememberChange Called when the remember checkbox changes
  * @returns {object} The rendered UI
  */
export default function Login({prevUrl, prevUser, prevRemember, onLogin, onRememberChange}) {
  const theme = useTheme();
  const uiSizes = React.useContext(SizeContext);
  const valuesValid = React.useContext(LoginValidContext);
  const loginWrapperRef = React.useRef(null);   // The login wrapper control reference
  const passwordRef = React.useRef(null);   // The password control reference
  const urlRef = React.useRef(null);        // The URL control reference
  const usernameRef = React.useRef(null);   // The username control reference
  const [rememberChecked, setRememberChecked] = React.useState(prevRemember);
  const [showPassword, setShowPassword] = React.useState(false);
  const [workspaceHeight, setWorkspaceHeight] = React.useState(480);

  // Focus management
  React.useLayoutEffect(() => {
    const focusRef = !prevUrl ? urlRef : (!prevUser ? usernameRef : passwordRef);
    if (focusRef.current) {
      focusRef.current.focus();
    }
  }, [prevUrl, prevUser]);

  // Sync remember checkbox
  React.useLayoutEffect(() => {
    if (prevRemember !== rememberChecked) {
      setRememberChecked(prevRemember);
    }
  }, [prevRemember, rememberChecked]);

  // Workspace sizing
  React.useLayoutEffect(() => {
    if (uiSizes !== null) {
      setWorkspaceHeight(uiSizes.workspace.height);
    }
  }, [uiSizes]);

  /**
   * Handler that toggles the show password state
   * @function
   */
  const handleClickShowPassword = () => setShowPassword((show) => !show);

  /**
   * Suppresses the default handling of a mouse down event on the password field
   * @function
   * @param {object} event The event object
   */
  const handleMouseDownPassword = (event) => {
    event.preventDefault();
  };

  /**
   * Suppresses the default handling of a mouse up event on the password field
   * @function
   * @param {object} event The event object
   */
  const handleMouseUpPassword = (event) => {
    event.preventDefault();
  };

  /**
   * Sets the state of the remember flag when the UI changes
   * @function
   * @param {object} event The event object
   */
  const rememberChanged = (event) => {
    setRememberChecked(event.target.checked);
    onRememberChange(event.target.checked);
  }

  /**
   * Calls the login function parameter
   * @function
   */
  function callLoginFunc() {
    const url = urlRef.current?.value;
    const user = usernameRef.current?.value;
    const password = passwordRef.current?.value;
    const remember = rememberChecked;

    onLogin(url, user, password, remember);
  }

  // Return the UI
  let curWorkspaceHeight = workspaceHeight ? workspaceHeight : 650;
  return (
    <div id="login-wrapper" ref={loginWrapperRef} className={styles.login_background}
           style={{height:curWorkspaceHeight+'px'}} >
    <div style={{...theme.palette.login_wrapper}}>
      <div style={{...theme.palette.login_dialog_wrapper}}>
        <div style={{...theme.palette.login_dialog}}>
          <Image height='60' alt="Wildcats Research" src={wildcatResearch} placeholder='blur' />
          <div style={{...theme.palette.login_dialog_items}}>
            <Box
              component='form'
              sx={{ '& > :not(style)': { m: 1, width: '37ch' } }}
              noValidate
              autoComplete='off'
            >
              <TextField required 
                    id='url-entry'
                    inputRef={urlRef}
                    label="Database URL"
                    defaultValue={prevUrl}
                    size='small'
                    error={valuesValid.url === false}
                    sx={{m:5}}
                    type={'url'}
                    inputProps={{style: {fontSize:12}}}
                    slotProps={{
                      inputLabel: {
                        shrink: true,
                      },
                    }}
                    />
              <TextField required 
                    id='username-entry'
                    inputRef={usernameRef}
                    label="Username"
                    defaultValue={prevUser}
                    size='small'
                    error={valuesValid.user === false}
                    sx={{m:5}}
                    inputProps={{style: {fontSize:12}}}
                    slotProps={{
                      inputLabel: {
                        shrink: true,
                      },
                    }}
                    />
              <TextField required 
                    id='password-entry'
                    inputRef={passwordRef}
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    size='small'
                    error={valuesValid.password === false}
                    sx={{m:5}}
                    inputProps={{style: {fontSize:12}}}
                    onKeyDown={((ev) => {if (ev.key === 'Enter') { ev.preventDefault(); callLoginFunc(ev); } })}
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
                    <FormGroup>
                      <FormControlLabel 
                        size="small"
                        control={<Checkbox id='remember-login-fields' checked={rememberChecked} onChange={rememberChanged} />}
                        label={<span style={{ fontSize:12, color:'rgba(0, 0, 0, 0.6)' }}>Remember URL and username</span>}
                        />
                    </FormGroup>

            <div style={{...theme.palette.login_dialog_login_button_wrap}}>
              <Button size='small' color='login_button'
                      sx={{bgcolor: 'background.default', '&:hover':{backgroundColor:'#AEAEAE'}}} endIcon={<LoginIcon />} 
                      onClick={callLoginFunc}
              >
                Login
              </Button>
            </div>
            </Box>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

Login.propTypes = {
  prevUrl: PropTypes.string,
  prevUser: PropTypes.string,
  prevRemember: PropTypes.bool,
  onLogin: PropTypes.func.isRequired,
  onRememberChange: PropTypes.func.isRequired,
};

Login.defaultProps = {
  prevUrl: '',
  prevUser: '',
  prevRemember: false,
};
