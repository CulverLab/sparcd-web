/** @module components/EditUser */

import * as React from 'react';
import BorderColorOutlinedIcon from '@mui/icons-material/BorderColorOutlined';
import Box from '@mui/material/Box';
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
  const email1Ref = React.useRef();
  const email2Ref = React.useRef();
  const passwordRef = React.useRef();
  const addMessage = React.useContext(AddMessageContext); // Function adds messages for display
  const [changeEmail, setChangeEmail] = React.useState(false); // Used to signal changing the user's email
  const [emailMessage, setEmailMessage] = React.useState(null); // The working email message
  const [isModified, setIsModified] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [userName, setUserName] = React.useState(data ? data.name : null);
  const [userEmail, setUserEmail] = React.useState(data ? data.email : null);
  const [userIsAdmin, setUserIsAdmin] = React.useState(data ? data.admin : false);
  const [userPasswordNeeded, setUserPasswordNeeded] = React.useState(false);
  const [userUpdateData, setUserUpdateData] = React.useState(null);

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

    let el = document.getElementById('edit-user-name');
    if (el) {
      updatedData.name = el.value;
    }

    el = document.getElementById('edit-user-email');
    if (el) {
      updatedData.email = el.value;
    }

    updatedData.admin = userIsAdmin;

    // When setting admin permissions, we want to make sure they're allowed to
    if (updatedData.admin) {
      setUserPasswordNeeded(true);
      setUserUpdateData(updatedData);
    } else {
      onUpdate(updatedData, onClose, (message) => addMessage(Level.Warning, message));
    }
  }, [addMessage, data, isModified, onClose, onUpdate, setUserPasswordNeeded, setUserUpdateData, userIsAdmin]);

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
    const el = document.getElementById('password-entry');
    if (el && typeof(onConfirmPassword) === 'function') {
      const updatedData = userUpdateData;
      onConfirmPassword(el.value, () => onUpdate(updatedData, 
                                                  () => {setUserUpdateData(null);onClose();},
                                                  (message) => addMessage(Level.Warning, message))
                                                );
      setUserPasswordNeeded(false);
    }
  }, [addMessage, onClose, onConfirmPassword, onUpdate, setUserPasswordNeeded, setUserUpdateData, userUpdateData]);

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
    if ((email1.length < 5 && email2.length < 5) && 
        (email1.length != 0 && email2.length != 0)){
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

  }, [email1Ref, email2Ref, setChangeEmail, setEmailMessage, setIsModified]);

  /**
   * Handles clearing an error message once the user starts changing email addresses
   * @function
   */
  const handleEmailChange = React.useCallback(() => {
    if (emailMessage != null) {
      setEmailMessage(null);
    }
  }, [emailMessage, setEmailMessage]);

  /**
   * Generates the collections UI for editing the user
   * @function
   * @return {object} the UI for editing user collections
   */
  function generateCollections() {
    return (
      <Grid container direction="column" justifyContent="start" alignItems="stretch" sx={{borderTop:'1px solid black'}} >
          <Grid container key={'user-edit-coll-titles'} direction="row" justifyContent="space-between" alignItems="center"
                sx={{backgroundColor:'lightgrey', height:'1.5em'}} >
            <Grid size={{sm:9}} >
              <Typography nowrap="true" align="start" component="div">
                <Box sx={{ fontWeight: 'bold', paddingLeft:'5px' }}>
                Collection
                </Box>
              </Typography>
            </Grid>
            <Grid size={{sm:1}} >
              <Typography nowrap="true" align="center" component="div">
                <Box sx={{ fontWeight: 'bold' }}>
                R
                </Box>
              </Typography>
            </Grid>
            <Grid size={{sm:1}} >
              <Typography nowrap="true" align="center" component="div">
                <Box sx={{ fontWeight: 'bold' }}>
                W
                </Box>
              </Typography>
            </Grid>
            <Grid size={{sm:1}}  >
              <Typography nowrap="true" align="center" component="div" sx={{paddingRight:'5px'}}>
                <Box sx={{ fontWeight: 'bold' }}>
                O
                </Box>
              </Typography>
            </Grid>
          </Grid>
        <div style={{maxHeight:'30vh', overflowX:"scroll"}}>
        { data && data.collections && data.collections.map((item) =>
          <Grid container key={'user-edit-coll-'+item.id} direction="row" justifyContent="space-between" alignItems="center" sx={{height:'2em'}}>
            <Grid size={{sm:9}} sx={{paddingLeft:'5px'}} >
              <Typography variant="body2">
              {item.name}
              </Typography>
            </Grid>
            <Grid size={{sm:1}}  >
              <Typography variant="body2" align="center">
              <Checkbox disabled size="small" checked={!!item.read} onChange={() => setIsModified(true)}/>
              </Typography>
            </Grid>
            <Grid size={{sm:1}}  >
              <Typography variant="body2" align="center">
              <Checkbox disabled size="small" checked={!!item.write} onChange={() => setIsModified(true)}/>
              </Typography>
            </Grid>
            <Grid size={{sm:1}}  >
              <Typography variant="body2" align="center" sx={{paddingRight:'5px'}}>
              <Checkbox disabled size="small" checked={!!item.owner} onChange={() => setIsModified(true)}/>
              </Typography>
            </Grid>
          </Grid>
        )}
        </div>
      </Grid>
    );
  }

  return (
   <Grid sx={{minWidth:'50vw'}} > 
    <Card id="edit-user" sx={{backgroundColor:'#EFEFEF', border:"none", boxShadow:"none"}} >
      <CardHeader id='edit-user-header' title={
                    <Grid container direction="row" alignItems="start" justifyContent="start" wrap="nowrap">
                      <Grid>
                        <Typography gutterBottom variant="h6" component="h4" noWrap="true">
                          Edit User
                        </Typography>
                      </Grid>
                      <Grid sx={{marginLeft:'auto'}} >
                        <div onClick={onClose}>
                          <Tooltip title="Close without saving">
                            <Typography gutterBottom variant="body2" noWrap="true"
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
          <TextField required disabled={userName ? true : false}
                id='edit-user-name'
                label="S3 User Name"
                defaultValue={userName}
                size='small'
                sx={{margin:'10px'}}
                onChange={() => setIsModified(true)}
                inputProps={{style: {fontSize: 12}}}
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                }}
                />
            <TextField id='edit-user-email' disabled hiddenLabel value={userEmail || ''} variant='outlined' type='email' placeholder='email address'
                        sx={{padding:'0px 10px', '&:invalid':{backgroundColor:'rgba(255,0,0.1)'}}}
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
            <FormControlLabel key={'edit-user-admin'} sx={{paddingLeft:'10px'}}
                              control={<Checkbox 
                                                 size="small" 
                                                 checked={userIsAdmin}
                                                 onChange={() => {setIsModified(true);setUserIsAdmin(!userIsAdmin);} }
                                        />} 
                              label={<Typography variant="body2">Has administrative rights</Typography>} />
            {generateCollections()}
        </Grid>          
        </CardContent>
        <CardActions id='filter-content-actions'>
          <Button sx={{flex:'1', disabled:isModified === false }} onClick={onSaveChanges}>Save</Button>
          <Button sx={{flex:'1'}} onClick={onClose} >Cancel</Button>
        </CardActions>
    </Card>
    { userPasswordNeeded && 
        <Grid container id="admin-settings-get-password-wrapper" justifyContent="center" alignItems="center" 
              sx={{position:'absolute', top:0, right:0, bottom:'0px', left:0, background:"rgb(0, 0, 0, 0.7)", zIndex:500}} >
          <Grid container direction="column" justifyContent="space-around" alignItems="center"
                sx={{minWidth:'30%', maxWidth:'50%', backgroundColor:'rgb(230,230,230)', padding:'15px 0'}} spacing={2}>
            <div id="admin-settings-login-close" sx={{height:'20px', flex:'1'}} onClick={() => setUserPasswordNeeded(false)}
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
                      onClick={handlePasswordConfirm}
              >
                Confirm
              </Button>
          </Grid>
        </Grid>
    }
      { changeEmail &&
         <Grid container id="admin-settings-change-email-wrapper" justifyContent="center" alignItems="center" 
              sx={{position:'absolute', top:0, right:0, bottom:'50px', left:0, background:"rgb(0, 0, 0, 0.7)", zIndex:500}} >
          <Grid container direction="column" justifyContent="center" alignItems="center"
                sx={{minWidth:'400px', backgroundColor:'rgb(230,230,230)', padding:'15px 0'}} spacing={2}>
            <div id="admin-settings-change-password-close" sx={{height:'20px', flex:'1'}} onClick={() => setChangeEmail(false)}
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