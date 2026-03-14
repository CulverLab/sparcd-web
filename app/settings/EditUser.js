'use client'

/** @module components/EditUser */

import * as React from 'react';
import BorderColorOutlinedIcon from '@mui/icons-material/BorderColorOutlined';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Checkbox from '@mui/material/Checkbox';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import LoginIcon from '@mui/icons-material/Login';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

import PropTypes from 'prop-types';

import UserCollections from './UserCollections';
import { AddMessageContext } from '../serverInfo';
import { Level } from '../components/Messages';

/**
 * Handles editing a user's entry
 * @function
 * @param {object} {data} The user's data. If falsy a new user is assumed
 * @param {function} onUpdate Called to update the user information when changes made
 * @param {function} onConfirmPassword Called to confirm the user's re-entered password when adding admin permissions
 * @param {function} onClose Called when the editing is completed
 * @return {object} The UI for editing users
 */
export default function EditUser({data, onUpdate, onConfirmPassword, onClose}) {
  const theme = useTheme();
  const email1Ref = React.useRef(null);
  const email2Ref = React.useRef(null);
  const userEmailRef = React.useRef(null);
  const userNameRef = React.useRef(null);
  const userPasswordRef = React.useRef(null);
  const addMessage = React.useContext(AddMessageContext); // Function adds messages for display
  const [changeEmail, setChangeEmail] = React.useState(false); // Used to signal changing the user's email
  const [emailMessage, setEmailMessage] = React.useState(null); // The working email message
  const [isModified, setIsModified] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [userEmail, setUserEmail] = React.useState(data ? data.email : null);
  const [userIsAdmin, setUserIsAdmin] = React.useState(data ? data.admin : false);
  const [userPasswordNeeded, setUserPasswordNeeded] = React.useState(false);
  const [userUpdateData, setUserUpdateData] = React.useState(null);

  // Additional variables
  const userName = data ? data.name : null;

  /**
   * Handles saving the changes to the user
   * @function
   */
  const onSaveChanges = React.useCallback(() => {
    if (!isModified) {
      return;
    }

    // Save the edited user data
    let updatedData = data ? JSON.parse(JSON.stringify(data)) : {};

    if (userNameRef.current) {
      updatedData.name = userNameRef.current.value;
    }

    if (userEmailRef.current) {
      updatedData.email = userEmailRef.current.value;
    }

    updatedData.admin = userIsAdmin;

    // When setting admin permissions, we want to make sure they're allowed to
    if (updatedData.admin) {
      setUserPasswordNeeded(true);
      setUserUpdateData(updatedData);
    } else {
      onUpdate(updatedData, onClose, (message) => addMessage(Level.Warning, message));
    }
  }, [addMessage, data, isModified, onClose, onUpdate, userIsAdmin]);

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
   * Called when the user confirms their entered password
   * @function
   */
  const handlePasswordConfirm = React.useCallback(() => {
    if (userPasswordRef.current && typeof(onConfirmPassword) === 'function') {
      const updatedData = userUpdateData;
      onConfirmPassword(userPasswordRef.current.value, () => onUpdate(updatedData, 
                                                  () => {setUserUpdateData(null);onClose();},
                                                  (message) => addMessage(Level.Warning, message))
                                                );
      setUserPasswordNeeded(false);
    }
  }, [addMessage, onClose, onConfirmPassword, onUpdate, setUserUpdateData, userUpdateData]);

  /**
   * Handles the user wanting to change their email
   * @function
   */
  const handleChangeEmail = React.useCallback(() => {
    setChangeEmail(true);
  }, []);

  /**
   * Handles when the user wants to save update email
   * @function
   */
  const handleSaveEmail = React.useCallback(() => {
    let email1 = null;
    let email2 = null;

    if (email1Ref.current) {
      email1 = email1Ref.current.value;
    }
    if (email2Ref.current) {
      email2 = email2Ref.current.value;
    }

    // Make sure we have something to work with
    if (email1 === null && email2 === null){
      return;
    }
    if ((email1.length < 5 && email2.length < 5) && 
        (email1.length !== 0 && email2.length !== 0)){
      setEmailMessage("An invalid email was entered. Please correct and try again")
      email1Ref.current.focus();
      email1Ref.current.select();
      return;
    }

    // Make the comparisons and help the user 
    if (email1 === email2) {
      setUserEmail(email1);
      setChangeEmail(false);
      setIsModified(true);
    } else {
      setEmailMessage("Your emails don't match. Please enter a valid email")
      email1Ref.current.focus();
      email1Ref.current.select();
    }

  }, []);

  /**
   * Handles clearing an error message once the user starts changing email addresses
   * @function
   */
  const handleEmailChange = React.useCallback(() => {
    if (emailMessage !== null) {
      setEmailMessage(null);
    }
  }, [emailMessage]);

  return (
   <Grid sx={{minWidth:'50vw'}} > 
    <Card id="edit-user" sx={{backgroundColor:'#EFEFEF', border:"none", boxShadow:"none"}} >
      <CardHeader id='edit-user-header' title={
                    <Grid container direction="row" alignItems="start" justifyContent="start" sx={{flexWrap:'nowrap'}} >
                      <Grid>
                        <Typography gutterBottom variant="h6" component="h4" noWrap>
                          Edit User
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
      <CardContent id='edit-user-details' sx={{paddingTop:'0px', paddingBottom:'0px'}}>
        <Grid container direction="column" justifyContent="start" alignItems="stretch"
              sx={{minWidth:'400px', border:'1px solid black', borderRadius:'5px', backgroundColor:'rgb(255,255,255,0.3)' }}>
          <TextField required disabled={!!userName}
                id='edit-user-name'
                label="S3 User Name"
                defaultValue={userName}
                size='small'
                sx={{margin:'10px'}}
                onChange={() => setIsModified(true)}
                slotProps={{
                  input:{inputRef:userNameRef},
                  htmlInput: {style:{fontSize:12}},
                  inputLabel: {shrink: true},
                }}
                />
            <TextField id='edit-user-email' disabled hiddenLabel value={userEmail || ''} variant='outlined' type='email' placeholder='email address'
                        sx={{padding:'0px 10px', '&:invalid':{backgroundColor:'rgba(255,0,0.1)'}}}
                        slotProps={{
                          input: {
                            inputRef:userEmailRef,
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
            <FormControlLabel key={'edit-user-admin'} sx={{paddingLeft:'10px'}}
                              control={<Checkbox 
                                                 size="small" 
                                                 checked={userIsAdmin}
                                                 onChange={() => {setIsModified(true);setUserIsAdmin(!userIsAdmin);} }
                                        />} 
                              label={<Typography variant="body2">Has administrative rights</Typography>} />
            <UserCollections collections={data?.collections} />
        </Grid>          
        </CardContent>
        <CardActions id='filter-content-actions'>
          <Button sx={{flex:1}} disabled={!isModified} onClick={onSaveChanges}>Save</Button>
          <Button sx={{flex:1}} onClick={onClose} >Cancel</Button>
        </CardActions>
    </Card>
    { userPasswordNeeded && 
        <Grid container id="admin-settings-get-password-wrapper" justifyContent="center" alignItems="center" 
              sx={{...theme.palette.screen_overlay_grey, zIndex:500}} >
          <Grid container direction="column" justifyContent="space-around" alignItems="center"
                sx={{minWidth:'30%', maxWidth:'50%', backgroundColor:'rgb(230,230,230)', padding:'15px 0'}} spacing={2}>
            <div id="admin-settings-login-close" onClick={() => setUserPasswordNeeded(false)}
                                                 style={{marginLeft:'auto', marginRight:'10px', cursor:'pointer'}} >
                <Typography variant="body3" sx={{textTransform:'uppercase',color:'black',backgroundColor:'rgba(255,255,255,0.3)',
                                                 padding:'3px 3px 3px 3px',borderRadius:'3px','&:hover':{backgroundColor:'rgba(255,255,255,0.7)',fontWeight:'bold'}
                                               }}>
                  X
                </Typography>

            </div>
            <div>
              <Typography gutterBottom variant="h6" component="h6">
                Please confirm your password
              </Typography>
              <Typography gutterBottom variant="body2">
                to enable administrative privileges
              </Typography>
            </div>
              <TextField required 
                    autoFocus
                    id='password-entry'
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    size='small'
                    sx={{width:'95%', margin:'0px'}}
                    slotProps={{
                        htmlInput: {style:{fontSize:12}},
                        inputLabel: {shrink: true},
                      input: {
                        inputRef:userPasswordRef,
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
                      onClick={handlePasswordConfirm}
              >
                Confirm
              </Button>
          </Grid>
        </Grid>
    }
      { changeEmail &&
         <Grid container id="admin-settings-change-email-wrapper" justifyContent="center" alignItems="center" 
              sx={{...theme.palette.screen_overlay_grey, zIndex:500}} >
          <Grid container direction="column" justifyContent="center" alignItems="center"
                sx={{minWidth:'400px', backgroundColor:'rgb(230,230,230)', padding:'15px 0'}} spacing={2}>
            <div id="admin-settings-change-password-close" onClick={() => setChangeEmail(false)}
                  style={{marginLeft:'auto', marginRight:'10px', cursor:'pointer'}} >
                <Typography variant="body3" sx={{textTransform:'uppercase',color:'black',
                                                 padding:'3px 3px 3px 3px',borderRadius:'3px','&:hover':{backgroundColor:'rgba(255,255,255,0.7)',fontWeight:'bold'}
                                               }}>
                  X
                </Typography>

            </div>
            <div>
              <Typography gutterBottom variant="h6" component="h6">
                Change email
              </Typography>
            </div>
            <TextField required 
                  id='email1-entry'
                  label="New Email"
                  type='email'
                  sx={{width:'95%', margin:'0px'}}
                  onChange={handleEmailChange}
                  slotProps={{
                    input:{inputRef:email1Ref},
                    htmlInput: {style:{fontSize:12}},
                    inputLabel: {shrink: true},
                  }}
                  />
            <TextField required 
                  id='emai2-entry'
                  label="Confirm Email"
                  type='email'
                  sx={{width:'95%', margin:'0px'}}
                  onChange={handleEmailChange}
                  slotProps={{
                    input:{inputRef:email2Ref},
                    htmlInput: {style:{fontSize:12}},
                    inputLabel: {shrink: true},
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

EditUser.propTypes = {
  data: PropTypes.shape({
    name:        PropTypes.string,
    email:       PropTypes.string,
    admin:       PropTypes.bool,
    collections: PropTypes.arrayOf(PropTypes.shape({
      id:    PropTypes.string.isRequired,
      name:  PropTypes.string.isRequired,
      read:  PropTypes.bool,
      write: PropTypes.bool,
      owner: PropTypes.bool,
    })),
  }),
  onUpdate:          PropTypes.func.isRequired,
  onConfirmPassword: PropTypes.func.isRequired,
  onClose:           PropTypes.func.isRequired,
};

EditUser.defaultProps = {
  data: null,
};
