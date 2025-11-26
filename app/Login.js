/** @module Login */

import Image from 'next/image'
import styles from './page.module.css'
import { useContext, useState, useLayoutEffect } from 'react';
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

import wildcatResearch from '../public/wildcatResearch.png'
import {urlValid, userValid, passwordValid} from './checkLogin'
import {LoginValidContext} from './checkLogin'
import { SizeContext } from './serverInfo';

/** Returns the Login dialog
  * @function
  * @param {string} [prev_url] URL that was previously used to log in
  * @param {string} [prev_user] Username that was previously used to log in
  * @param {boolean} [prev_remember] Flag indicating the remember-me flag was set
  * @param {function} onLogin The login function to call when the user clicks the login button
  * @param {function} onRememberChange Called when the remember checkbox changes
  * @returns {object} The rendered UI
  */
export default function Login({prev_url, prev_user, prev_remember, onLogin, onRememberChange}) {
  const theme = useTheme();
  const uiSizes = useContext(SizeContext);
  const valuesValid = useContext(LoginValidContext);
  const [rememberChecked, setRememberChecked] = useState(prev_remember);
  const [showPassword, setShowPassword] = useState(false);
  const [workspaceTop, setWorkspaceTop] = useState(0);
  const [workspaceHeight, setWorkspaceHeight] = useState(480);

  useLayoutEffect(() => {
    const focusId = !prev_url ? 'url-entry' : (!prev_user ? 'username-entry' : 'password-entry')
    const el = document.getElementById(focusId);
    if (el) {
      el.focus();
    }
    if (prev_remember !== rememberChecked) {
      setRememberChecked(prev_remember);
    }

    if (uiSizes !== null) {
      let workspaceEl = document.getElementById('login-wrapper');
      if (workspaceEl) {
        setWorkspaceTop(uiSizes.workspace.top);
        setWorkspaceHeight(uiSizes.workspace.height);
      }
    }
  }, [prev_url, prev_user, prev_remember, rememberChecked, uiSizes]);

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
    let ctrl = document.getElementById('url-entry');
    const url = ctrl.value;
    ctrl = document.getElementById('username-entry');
    const user = ctrl.value;
    ctrl = document.getElementById('password-entry');
    const password = ctrl.value;
    ctrl = document.getElementById('remember-login-fields');
    const remember = ctrl.checked;

    onLogin(url, user, password, remember);
  }

  // Return the UI
  let curWorkspaceHeight = workspaceHeight ? workspaceHeight : 650;
  let curWorkspaceTop = workspaceTop ? workspaceTop : 63;
  return (
    <div id="login-wrapper" className={styles.login_background}
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
                    label="Database URL"
                    defaultValue={prev_url}
                    size='small'
                    error={!valuesValid.url}
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
                    label="Username"
                    defaultValue={prev_user}
                    size='small'
                    error={!valuesValid.user}
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
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    size='small'
                    error={!valuesValid.password}
                    sx={{m:5}}
                    inputProps={{style: {fontSize:12}}}
                    onKeyPress={((ev) => {if (ev.key === 'Enter') { ev.preventDefault(); callLoginFunc(ev); } })}
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
                        required 
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