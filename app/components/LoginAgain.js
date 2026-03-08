'use client'

/** @module components/LoginAgain */

import * as React from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import PropTypes from 'prop-types';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';


// Remaining seconds value used to indicate it's not in play
const TIME_CANCELLED_SEC = 99999999;


/** Returns the UI for the user to log in again
  * @function
  * @param {string} message The message to display after a timeout period (if timeout period specified)
  * @param {number} timeoutSec The number of seconds to wait before displaying the login UI. If not truthy, no countdown is displayed
  * @param {function} onCancelTimeout The function to call when the user cancels a timeout countdown
  * @param {function} onTimedOut The function to call when the timer reaches zero or less
  * @param {function} onLogout The handle to call when the user logs out
  * @returns {object} The rendered UI
  */
export default function LoginAgain({message, timeoutSec, onCancelTimeout, onTimedOut, onLogout}) {
  const theme = useTheme();
  const countdownStartRef = React.useRef(null);                 // Holds the current starting timestamp
  const [countdownId, setCountdownId] = React.useState(null);   // The timeout ID for the countdown timer
  const [countdownStart, setCountdownStart] = React.useState(null);   // The starting time for the countdown timer
  const [remainingSec, setRemainingSec] = React.useState(timeoutSec);   // How many seconds left before the countdown ends

  /**
   * Function to handle the user clicking on the screen
   * @function
   */
  const clickListener = React.useCallback(() => {
    onCancelTimeout();

    // Try some cleaning up
    if (countdownId !== null) {
      window.clearTimeout(countdownId);
      setCountdownId(null);
      setRemainingSec(TIME_CANCELLED_SEC);
    }
  }, [countdownId]);

  /**
   * Handles checking the countdown timer when one was requested
   * @function
   */
  const checkTimeout = React.useCallback(() => {
    // We need the start time to do anything
    if (countdownStartRef.current === null) {
      setCountdownId(window.setTimeout(checkTimeout, 500));
      return;
    }

    // Get how many seconds remain on the timer and set the state variables
    const diffSec = (Date.now() - countdownStartRef.current) / 1000;
    const remainSec = timeoutSec - diffSec > 0 ? timeoutSec - diffSec : 0;
    setRemainingSec(remainSec);
    if (remainSec > 0) {
      setCountdownId(window.setTimeout(checkTimeout, 500));
    }
  }, [countdownStartRef, timeoutSec]);

  // Start off the countdown timer if needed (once on mount)
  React.useEffect(() => {
    if (countdownId === null) {
      const startTs = Date.now();
      setCountdownStart(startTs);
      countdownStartRef.current = startTs;
      checkTimeout();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Manages when the timer reaches zero
  React.useEffect(() => {
    if (timeoutSec > 0 && remainingSec <= 0) {
      onTimedOut();
    }
  }, [onTimedOut, remainingSec, timeoutSec]);

  // Keeps the starting timestamp reference up to date
  React.useEffect(() => {
    countdownStartRef.current = countdownStart;
  }, [countdownStart, countdownStartRef]);

  // If we are waiting for a timeout, capture a mouse click
  React.useEffect(() => {
    // Check if we need to capture the click
    if (remainingSec > 0) {
      window.addEventListener("click", clickListener);
    }

    // Return appropriate undo function
    return () => {
      if (remainingSec > 0) {
        window.removeEventListener("click", clickListener);
      }
    };
  }, [clickListener, remainingSec]);

  /**
   * Formats an integer number for display
   * @function
   * @param {number} num The integer number to format
   * @param {number} digits How many whole number digits to display (prepends with zeros when necessary)
   * @returns {string} The formatted integer value
   */
  function formatInteger(num, digits=2) {
    return num.toLocaleString('en-US', {
        minimumIntegerDigits: digits,
        useGrouping: false
    });
  }

  /**
   * Generate the display for the countdown
   * @function
   * @param {number} seconds The number of seconds to display
   * @returns {string} Returns the UI to render as MM:SS
   */
  function generateRemainingSeconds(seconds) {
    seconds = Math.max(Number(seconds) || 0, 0);

    const displayMin = Math.floor(seconds / 60);
    const displaySec = Math.floor(seconds - (displayMin * 60));

    return (
        formatInteger(displayMin) + ":" + formatInteger(displaySec)
    );
  }

  // Return the UI
  return (
      <Grid id="login-timeout-wrapper" container direction="row" alignItems="center" justifyContent="center" 
            sx={{...theme.palette.screen_overlay_grey, zIndex:11111}}
      >
        <Box sx={{backgroundColor:'rgb(0,0,0,0.8)', border:'1px solid grey', borderRadius:'15px', padding:'25px 10px'}}>
          <Grid container direction="column" alignItems="center" justifyContent="center" >
            { remainingSec > 0 ? 
              <React.Fragment>
                <Typography gutterBottom variant="body1" sx={{color:"white"}}>
                  You will be logged out in
                </Typography>
                <Typography variant="h4" component="h4" sx={{padding:"20px 0px", color:"white"}}>
                  {generateRemainingSeconds(remainingSec)}
                </Typography>
                <Typography gutterBottom variant="body1" sx={{color:"white"}}>
                  Click anywhere to continue
                </Typography>
              </React.Fragment>
              :
              <React.Fragment>
                <Typography gutterBottom variant="body1" sx={{color:"white"}}>
                  {message ?? 'You have been logged out. Please log in again.'}
                </Typography>
                <Button size="small" onClick={onLogout}>Login</Button>
              </React.Fragment>
            }
          </Grid>
        </Box>
      </Grid>
  );
}

LoginAgain.propTypes = {
  message: PropTypes.string,
  timeoutSec: PropTypes.number,
  onCancelTimeout: PropTypes.func.isRequired,
  onTimedOut: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
};
