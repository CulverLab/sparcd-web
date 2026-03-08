'use client'

/** @module Messages */

import * as React from 'react';
import CloseIcon from '@mui/icons-material/Close';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PropTypes from 'prop-types';
import Typography from '@mui/material/Typography';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { useTheme } from '@mui/material/styles';

// Max possible messages to display at one time
const MAX_DISPLAY_MESSAGES = 3;

// Sequential message ID for messages
let messageId = 0;

// Window colors based upon message level
const LevelColors = {
  error: {background:'rgba(255, 230, 230, 0.83)', color:'black'},
  warning: {background:'rgba(255, 250, 190, 0.83)', color:'black'},
  information: {background:'rgba(235, 255, 255, 0.83)', color:'black'},
};

const LevelValues = ['error','warning','information'];    // Keep lowercase
const LevelDisplay = ['Error','Warning','Information'];   // Levels for display

// The message level values
export const Level = {
  Error: LevelValues[0],
  Warning: LevelValues[1],
  Warn: LevelValues[1],
  Info: LevelValues[2],
  Information: LevelValues[2]
}

/**
 * Creates a message object
 * @function
 * @param {string} level The level as defined in Level (e.g.: Level.Error)
 * @param {string} message The actual message to display
 * @param {string} [title] The title to window to show with the messages
 * @returns {object} A message object
 */
export function makeMessage(level, message, title) {
	// Check the level to see if it's a valid value
	let levelLower = level.toLowerCase();
	if (!LevelValues.find((item) => item === levelLower)) {
		levelLower = undefined;
	}

  // Check for a title
  if (!title) {
    if (levelLower) {
      title = LevelDisplay[LevelValues.indexOf(levelLower)];
    } else {
      title = LevelDisplay[LevelValues.indexOf('information')];
    }
  }

	// Return the message object
	return {level: level ? levelLower : Level.Information,
			message: message + '',
      title: title,
			messageId: ++messageId,
      closed: false
			}
}

/**
 * Provides the UI for messages
 * @function
 * @param {object} messages The array of message objects to display
 * @param {number} [messagesMax] The maximum number of messages to display at one time (default is 3)
 * @param {number} [messagesTimeout] The number of seconds before a message times out
 * @param {function} [close_cb] Function to call upon the message closing
 * @returns {object} The UI for messages
 */
export function Messages({messages, messagesMax, messagesTimeout, close_cb}) {
 	const theme = useTheme();

	if (!messages) {
		return null;
	}

  close_cb ||= (msgId) => { const el = document.getElementById(`sparcd-message-${msgId}`); if (el) el.style.display = 'none'; };

	// Figure out the maximum number of messages
  const curMax = (!messagesMax || typeof messagesMax !== 'number' || messagesMax < 1) ? MAX_DISPLAY_MESSAGES : Math.min(messages.length, messagesMax);

	// Figure out the timeout
  const curTimeout = (!messagesTimeout || typeof messagesTimeout !== 'number') ? 6 : messagesTimeout;

	// If we have a callback, make sure it's a function otherwise we force the message to disppear
	if (!close_cb || typeof close_cb !== 'function') {
		close_cb = (msgId) => {const el=document.getElementById("sparcd-message-"+msgId); if (el) el.style.display='none';};
	}

	return ( 
		<React.Fragment>
		{
			messages.slice(0, curMax).reverse().map((item, idx) => {
        // Check for messages that are closed
        if (item.closed) {
          return null;
        }

        // Setup the auto-removal of the message
        if (typeof window !== "undefined") {
          window.setTimeout(() => close_cb(item.messageId), curTimeout * 1000);
        }

				return (
          <Grid id={"sparcd-message-" + item.messageId} key={"message" + item.messageId} container direction="column" 
                sx={{position:'absolute', marginTop:((15*idx)+5)+'px', marginLeft:((15*idx))+'px', 
                     color:LevelColors[item.level].color, backgroundColor:LevelColors[item.level].background, 
                     padding:'10px', minWidth:'50vw', maxWidth:'90vw',
                     border:'1px solid black', borderRadius:'10px', zIndex:999999
                    }}>
            <Grid id={"sparcd-message-titlebar-" + item.messageId} container direction="row" alignItems="flex-start" justifyContent="space-between">
              {item.level === Level.Error && <ErrorOutlineOutlinedIcon />}
              {item.level === Level.Warning && <WarningAmberOutlinedIcon />}
              {item.level === Level.Information && <InfoOutlinedIcon />}
              <Typography gutterBottom variant="h4" sx={{fontWeight:'bold'}} >
                {item.title}
              </Typography>
              <IconButton onClick={()=>close_cb(item.messageId)} aria-label="close message" sx={{marginBotton:'25px', cursor:'pointer'}}>
                  <CloseIcon />
              </IconButton>
            </Grid>
            <Grid container direction="row" alignItems="center" justifyContent="space-between">
              <Typography gutterBottom variant="body1" sx={{paddingTop:'20px'}} >
                {item.message}
              </Typography>
            </Grid>
					</Grid>
				);
			})
		}
		</React.Fragment>
	);
}

Messages.propTypes = {
  // Array of message objects created by makeMessage()
  messages: PropTypes.arrayOf(
    PropTypes.shape({
      messageId: PropTypes.number.isRequired,
      level: PropTypes.oneOf([Level.Error, Level.Warning, Level.Information]).isRequired,
      message: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      closed: PropTypes.bool,
    })
  ),

  // Maximum number of messages to show at once (default: MAX_DISPLAY_MESSAGES)
  messagesMax: PropTypes.number,

  // Seconds before a message auto-dismisses (default: 6)
  messagesTimeout: PropTypes.number,

  // Called with messageId when a message is closed
  close_cb: PropTypes.func,
};
