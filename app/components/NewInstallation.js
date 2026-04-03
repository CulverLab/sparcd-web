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

import PropTypes from 'prop-types';

import styles from './components.module.css';

import { Level } from '../components/Messages';
import { AddMessageContext, BaseURLContext, TokenExpiredFuncContext, SizeContext } from '../serverInfo';

// Enumeration of installation steps
const InstallStep = {
  start: 0,                   // Nothing yet
  checking: 10,               // Checking on things
  newInstallOk: 20,           // We can install on a new instance
  installExists: 21,          // The install already exists (what are we doing here?)
  repairInstallOk: 22,        // The installation needs repair
  installPermissionsFail: 23, // The install already exists (what are we doing here?)
  checkInstallFailed: 29,     // Checking for installation failed
  executingInstall: 30,       // Running the install
  executingRepair: 31,        // Running the repair
  installCompleted: 40,       // Successfullly installed a new instance
  repairCompleted: 41,        // Successfullly repaired an existing installation
  installFailed: 48,          // Unable to create a new installation
  repairFailed: 49,           // Unable to repair an existing installation
  unauthorized: 50            // Not authorized to do anything
};

/** Returns the UI for the user to comfigure a new installation
  * @function
  * @param {string} newInstallToken The token associated with S3 endpoint
  * @param {boolean} isRepair Set to True if we're repairing the server and not initializing one
  * @param {function} onCancel The function to call if the user cancells
  * @returns {object} The rendered UI
  */
export default function NewInstallation({newInstallToken, isRepair, onCancel}) {
  const theme = useTheme();
  const addMessage = React.useContext(AddMessageContext); // Function adds messages for display
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

    const newInstallCheckUrl = serverURL + '/installCheck?t=' + encodeURIComponent(newInstallToken);

    try {
      fetch(newInstallCheckUrl, {
        credentials: 'include',
        method: 'GET',
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              if (resp.status === 401) {
                // User needs to log in again
                setTokenExpired();
              }
              throw new Error(`Failed to check if a new install is viable: ${resp.status}: ${await resp.text()}`);
            }
          })
        .then((respData) => {
            // Process the results
            if (respData.success === true) {
              if (respData.newInstance === true) {
                setInstallStep(InstallStep.newInstallOk);
              } else {
                setInstallStep(InstallStep.installExists);
              }
            } else {
              if (respData.needsRepair === true) {
                if (respData.admin === true) {
                  addMessage(Level.Warning, 'The SPARCd installation is missing some settings and needs to be repaired');
                  setInstallStep(InstallStep.repairInstallOk);
                } else {
                  addMessage(Level.Error, 'You do not have permissions to make changes on the server');
                  setInstallStep(InstallStep.unauthorized);
                }
                setErrorMessage(respData.message);
              } else if (respData.failedPerms === true) {
                addMessage(Level.Error, 'You do not have the necessary S3 permissions install SPARCd');
                setInstallStep(InstallStep.installPermissionsFail);
                setErrorMessage(respData.message);
              } else {
                addMessage(Level.Error, 'You are not an administrator of this SPARCd installation');
                setInstallStep(InstallStep.unauthorized);
                setErrorMessage(respData.message);
              }
            }
        })
        .catch(function(err) {
          console.log('Check New Install Error: ', err);
          addMessage(Level.Error, 'A problem occurred while checking the viability of a new install');
          setInstallStep(InstallStep.checkInstallFailed);
      });
    } catch (err) {
      console.log('Check New Install Unknown Error: ',err);
      addMessage(Level.Error, 'An unknown problem occurred while checking the viability of a new install');
      setInstallStep(InstallStep.checkInstallFailed);
    }

  }, [addMessage, serverURL, setTokenExpired, setInstallStep]);

  /**
   * Handles the user wanting to install SPARCd
   * @function
   */
  const handleContinueInstall = React.useCallback(() => {
    setInstallStep(InstallStep.executingInstall);
    setErrorMessage(null);

    const newInstallUrl = serverURL + '/installNew?t=' + encodeURIComponent(newInstallToken);

    try {
      fetch(newInstallUrl, {
        credentials: 'include',
        method: 'GET',
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              if (resp.status === 401) {
                // User needs to log in again
                setTokenExpired();
              }
              throw new Error(`Failed to create a new installation: ${resp.status}: ${await resp.text()}`);
            }
          })
        .then((respData) => {
          if (respData.success === true) {
            setInstallStep(InstallStep.installCompleted);
          } else {
            setInstallStep(InstallStep.installFailed);
          }
        })
        .catch(function(err) {
          console.log('New Install Error: ', err);
          addMessage(Level.Error, 'A problem occurred while creating a new install');
          setInstallStep(InstallStep.installFailed);
      });
    } catch (err) {
      console.log('New Install Unknown Error: ',err);
      addMessage(Level.Error, 'An unknown problem occurred while creating a new install');
      setInstallStep(InstallStep.installFailed);
    }
  }, [addMessage, serverURL, setTokenExpired, setInstallStep])

  /**
   * Handles the user wanting to continue repairing the SPARCd installation
   * @function
   */
  const handleContinueRepair = React.useCallback(() => {
    setInstallStep(InstallStep.executingRepair);

    const installRepairUrl = serverURL + '/installRepair?t=' + encodeURIComponent(newInstallToken);

    try {
      fetch(installRepairUrl, {
        credentials: 'include',
        method: 'GET',
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              if (resp.status === 401) {
                // User needs to log in again
                setTokenExpired();
              }
              throw new Error(`Failed to repair existing installation: ${resp.status}: ${await resp.text()}`);
            }
          })
        .then((respData) => {
          if (respData.success === true) {
            setInstallStep(InstallStep.repairCompleted);
          } else {
            setInstallStep(InstallStep.repairFailed);
          }
        })
        .catch(function(err) {
          console.log('Install Repair Error: ', err);
          addMessage(Level.Error, 'A problem occurred while trying to repair an existing installation');
          setInstallStep(InstallStep.repairFailed);
      });
    } catch (err) {
      console.log('Install Repair Unknown Error: ',err);
      addMessage(Level.Error, 'An unknown problem occurred while trying to repair an existing installation');
      setInstallStep(InstallStep.repairFailed);
    }
  }, [addMessage, serverURL, setTokenExpired, setInstallStep])

  /**
   * Returns the message based upon what our install step
   * @function
   */
  function getStageMessage(curStep) {
    switch(curStep) {
      case InstallStep.newInstallOk:
        return "Working on the next step for installing SPARCd";
      case InstallStep.installExists:
        return "SPARCd is already installed. Unable to continue";
      case InstallStep.repairInstallOk:
        return "The installation needs repair"
      case InstallStep.installPermissionsFail:
        return "You do not have the necessary permissions to create a new installation"
      case InstallStep.checkInstallFailed:
        return "Unable to verify that an installation will succeed. Please contact your S3 administrator regarding your permissions";
      default:
        return "Please contact your S3 administrator if you believe that your SPARCd environment is already setup, or try logging in again";
    }
  }

  // Return the UI
  // TODO: Use WorkspaceOverly with Theme changes to match what we have here
  return (
      <React.Fragment>
        <Grid id="new-install-wrapper" container direction="row" alignItems="center" justifyContent="center" 
              sx={{position:'absolute', top:0, left:0, width:'100vw', height:'100vh', backgroundColor:'rgb(0,0,0,0.75)', zIndex:11111}}
        >
          <div style={{backgroundColor:'honeydew', border:'1px solid grey', borderRadius:'15px', padding:'25px 20px'}}>
            <Grid container direction="column" alignItems="center" justifyContent="center" >
              <img id="sparcd-logo" src="/sparcd.png" alt="SPARC'd Logo" className={styles.titlebar_icon}/>
              <Typography variant="h4" component="h4" sx={{padding:"20px 0px"}}>
                {isRepair === false ? "Welcome to setting up a new SPARCd configuration" : "Welcome to repairing your SPARCd configuration"}
              </Typography>
              {errorMessage !== null && 
                <Typography variant="body1" sx={{fontSize:"larger"}}>
                  {errorMessage}
                </Typography>
              }
              <Typography variant="body1" sx={{borderBottom:"1px solid lightgrey"}}>
                <IconButton aria-label="Important" >
                  <PriorityHighOutlinedIcon fontSize="small" style={{color:'sandybrown'}}/>
                </IconButton>
                {getStageMessage(installStep) }
              </Typography>
              <Grid container direction="row" alignItems="center" justifyContent="space-between" sx={{minWidth:"50%", paddingTop:"40px"}}>
                <Button size="small" onClick={onCancel}>Login Again</Button>
                <Button size="small" onClick={handleContinue}>
                  {installStep === InstallStep.installExists ? "Try Again" : "Continue"}
                </Button>
              </Grid>
            </Grid>
          </div>
        </Grid>
        { (installStep === InstallStep.newInstallOk || installStep === InstallStep.installCompleted) &&
          <Grid id="new-install-new-wrapper" container direction="row" alignItems="center" justifyContent="center" 
                sx={{position:'absolute', top:0, left:0, width:'100vw', height:'100vh', backgroundColor:'rgb(0,0,0,0.75)', zIndex:11111}}
          >
            <div id="new-install-new" style={{backgroundColor:'honeydew', border:'1px solid grey', borderRadius:'15px', padding:'25px 20px'}}>
              <Grid container direction="column" alignItems="center" justifyContent="center">
                <Typography variant="body1" >
                You can now install SPARCd on the new server
                </Typography>
                <Grid container direction="row" alignItems="center" justifyContent="space-between" sx={{width:'100%', padding:"40px 20px 0px 20px"}}>
                  <Button size="small" onClick={() => setInstallStep(InstallStep.start)}>Cancel Install</Button>
                  <Button size="small" onClick={handleContinueInstall}>Continue Installation</Button>
                </Grid>
              </Grid>
            </div>
          </Grid>
        }
        { (installStep === InstallStep.repairInstallOk || installStep === InstallStep.repairCompleted) &&
          <Grid id="new-install-repair-wrapper" container direction="row" alignItems="center" justifyContent="center" 
                sx={{position:'absolute', top:0, left:0, width:'100vw', height:'100vh', backgroundColor:'rgb(0,0,0,0.75)', zIndex:11111}}
          >
            <div id="new-install-repair" style={{backgroundColor:'honeydew', border:'1px solid grey', borderRadius:'15px', padding:'25px 20px'}}>
              <Grid container direction="column" alignItems="center" justifyContent="center">
                <Typography variant="body1" >
                The SPARCd installation needs to be repaired
                </Typography>
                <Typography variant="body3" >
                The settings files are missing and need to be restored
                </Typography>
                <Grid container direction="row" alignItems="center" justifyContent="space-between" sx={{minWidth:"50%", padding:"40px 20px 0px 20px"}}>
                  <Button size="small" onClick={() => setInstallStep(InstallStep.start)}>Cancel Repair</Button>
                  <Button size="small" onClick={handleContinueRepair}>Continue Repair</Button>
                </Grid>
              </Grid>
            </div>
          </Grid>
        }
        { (installStep === InstallStep.executingInstall || installStep === InstallStep.executingRepair) &&
          <Grid id="new-install-working" container direction="row" alignItems="center" justifyContent="center" 
                sx={{position:'absolute', top:0, left:0, width:'100vw', height:'100vh', backgroundColor:'rgb(0,0,0,0.75)', zIndex:11111}}
          >
            <div id="new-install-repair" style={{backgroundColor:'honeydew', border:'1px solid grey', borderRadius:'15px', padding:'25px 20px'}}>
              <Grid container direction="column" alignItems="center" justifyContent="center">
                <Typography variant="body1" >
                  Please wait while the {installStep === InstallStep.executingInstall ? "installation" : "repair"} completes
                </Typography>
              </Grid>
            </div>
          </Grid>
        }
        { (installStep === InstallStep.installCompleted || installStep === InstallStep.repairCompleted) &&
          <Grid id="new-install-completed" container direction="row" alignItems="center" justifyContent="center" 
                sx={{position:'absolute', top:0, left:0, width:'100vw', height:'100vh', backgroundColor:'rgb(0,0,0,0.75)', zIndex:11111}}
          >
            <div id="new-install-repair" style={{backgroundColor:'honeydew', border:'1px solid grey', borderRadius:'15px', padding:'25px 20px'}}>
              <Grid container direction="column" alignItems="center" justifyContent="center">
                <Typography variant="h4" component="h4" sx={{padding:"20px 0px"}}>
                  {installStep === InstallStep.installCompleted ? "Install" : "Repair"} has completed successfully
                </Typography>
                <Grid container direction="row" alignItems="center" justifyContent="center" sx={{padding:"40px 20px 0px 20px"}}>
                  <Button size="small" onClick={() => {setInstallStep(InstallStep.start);onCancel();}}>OK</Button>
                </Grid>
              </Grid>
            </div>
          </Grid>
        }
        { (installStep === InstallStep.installFailed || installStep === InstallStep.repairFailed) &&
          <Grid id="new-install-failed" container direction="row" alignItems="center" justifyContent="center" 
                sx={{position:'absolute', top:0, left:0, width:'100vw', height:'100vh', backgroundColor:'rgb(0,0,0,0.75)', zIndex:11111}}
          >
            <div id="new-install-repair" style={{backgroundColor:'honeydew', border:'1px solid grey', borderRadius:'15px', padding:'25px 20px'}}>
              <Grid container direction="column" alignItems="center" justifyContent="center">
                <Typography variant="h4" component="h4" sx={{padding:"20px 0px"}}>
                  <IconButton aria-label="Important">
                    <PriorityHighOutlinedIcon fontSize="small" style={{color:'crimson'}}/>
                  </IconButton>
                  {installStep === InstallStep.installFailed ? "Install" : "Repair"} has failed to complete
                </Typography>
                <Grid container direction="row" alignItems="center" justifyContent="space-between" sx={{minWidth:"50%", padding:"40px 20px 0px 20px"}}>
                  <Button size="small" onClick={() => setInstallStep(InstallStep.start)}>Clear Message</Button>
                </Grid>
              </Grid>
            </div>
          </Grid>
        }
      </React.Fragment>
  );
}

NewInstallation.propTypes = {
  // The token associated with the S3 endpoint
  newInstallToken: PropTypes.string.isRequired,

  // Set to true if repairing an existing install rather than initializing a new one
  isRepair: PropTypes.bool.isRequired,

  // Called when the user clicks "Login Again" / cancels the flow
  onCancel: PropTypes.func.isRequired,
};
