'use client'

/** @module components/NewInstallation */

import * as React from 'react';

import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import PriorityHighOutlinedIcon from '@mui/icons-material/PriorityHighOutlined';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import styles from './components.module.css';

import { Level } from '../components/Messages';
import { AddMessageContext, BaseURLContext, TokenExpiredFuncContext, SizeContext, TokenContext } from '../serverInfo';

// Enumeration of installation steps
const InstallStep = {
  start: 0,                 // Nothing yet
  checking: 10,             // Checking on things
  checkInstallOk: 20,       // We can install on a new instance
  checkInstallFailed: 21,   // We failed while checking the install
  repairInstall: 22,        // We need to repair the install but don't have admin permissions
  repairInstallAdmin: 23,   // We need to repair the install as an admin
  installExists: 24,        // The install already exists (what are we doing here?)
  executingInstall: 30,     // Running the repair
  executingRepair: 31,      // Running the install
  completed: 40,            // All done
};

/** Returns the UI for the user to comfigure a new installation
  * @function
  * @param {string} newInstallToken The token associated with S3 endpoint
  * @param {function} onCancel The function to call if the user cancells
  * @returns {object} The rendered UI
  */
export default function LoginAgain({newInstallToken, onCancel}) {
  const theme = useTheme();
  const addMessage = React.useContext(AddMessageContext); // Function adds messages for display
  const installToken = React.useContext(TokenContext);  // Login token
  const serverURL = React.useContext(BaseURLContext);
  const setTokenExpired = React.useContext(TokenExpiredFuncContext);
  const [installStep, setInstallStep] = React.useState(InstallStep.start);    // Keeping track of our install state
  const [errorMessage, setErrorMessage] = React.useState(null);     // Last error message received from server

  /**
   * Handles the user wanting to continue with a new installation
   * @function
   */
  const handleContinue = React.useCallback(() => {
    setInstallStep(InstallStep.checking);
    setErrorMessage(null);

    const newInstallCheckUrl = serverURL + '/newInstallCheck?t=' + encodeURIComponent(installToken);

    try {
      const resp = fetch(newInstallCheckUrl, {
        method: 'GET',
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              if (resp.status === 401) {
                // User needs to log in again
                setTokenExpired();
              }
              throw new Error(`Failed to check if a new install is viable: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
            // Process the results
            if (respData.success === true) {
              if (respData.newInstance === true) {
                setInstallStep(InstallStep.checkInstallOk);
              } else {
                setInstallStep(InstallStep.installExists);
              }
            } else {
              if (respData.admin === false && needsRepair === false) {
                if (respData.failedPerms === false) {
                  addMessage(Level.Error, 'Failed to confirm that a new installation will succeed');
                } else {
                  addMessage(Level.Error, 'Unable to finish checking if a new installation will succeed');
                }
                setInstallStep(InstallStep.checkInstallFailed);
                setErrorMessage(respData.message);
              } else if (respData.admin === false && needsRepair === true) {
                addMessage(Level.Warning, 'There is an existing installation that needss repair');
                setInstallStep(InstallStep.repairInstall);
                setErrorMessage(respData.message);
              } else if (respData.admin === true && needsRepair === false) {
                setInstallStep(InstallStep.repairInstallAdmin);
              }
            }
        })
        .catch(function(err) {
          console.log('Check New Install Error: ', err);
          addMessage(Level.Error, 'A problem ocurred while checking the viability of a new install');
          setInstallStep(InstallStep.checkInstallFailed);
      });
    } catch (error) {
      console.log('Check New Install Unknown Error: ',err);
      addMessage(Level.Error, 'An unknown problem ocurred while checking the viability of a new install');
      setInstallStep(InstallStep.checkInstallFailed);
    }

  }, [addMessage, installToken, serverURL, setTokenExpired, setInstallStep]);

  // Return the UI
  return (
      <Grid id="new-install-wrapper" container direction="row" alignItems="center" justifyContent="center" 
            sx={{position:'absolute', top:0, left:0, width:'100vw', height:'100vh', backgroundColor:'rgb(0,0,0,0.75)', zIndex:11111}}
      >
        <div style={{backgroundColor:'honeydew', border:'1px solid grey', borderRadius:'15px', padding:'25px 20px'}}>
          <Grid container direction="column" alignItems="center" justifyContent="center" >
            <img id="sparcd-logo" src="/sparcd.png" alt="SPARC'd Logo" className={styles.titlebar_icon}/>
            <Typography variant="h4" component="h4" sx={{padding:"20px 0px"}}>
              Welcome to setting up a new SPARCd configuration
            </Typography>
            {errorMessage !== null && 
              <Typography variant="body" sx={{fontSize:"larger"}}>
                {errorMessage}
              </Typography>
            }
            <Typography variant="body" sx={{borderBottom:"1px solid lightgrey"}}>
              <IconButton aria-label="Important" size="small">
                <PriorityHighOutlinedIcon style={{color:'sandybrown'}}/>
              </IconButton>
              {installStep === InstallStep.checkInstallFailed ? "Unable to verify that an installation will succeed. Please contact your S3 administrator regarding your permissions"
                  : "Please contact your S3 administrator if you believe that your SPARCd environment is already setup or try logging in again"}
            </Typography>
            <Grid container direction="row" alignItems="center" justifyContent="space-between" sx={{minWidth:"50%", paddingTop:"40px"}}>
              <Button size="small" onClick={onCancel}>Login Again</Button>
              <Button size="small" onClick={handleContinue}>Continue</Button>
            </Grid>
          </Grid>
        </div>
      </Grid>
  );
}
