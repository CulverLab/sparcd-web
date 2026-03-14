/** @module Messages */

import * as React from 'react';
import Button from '@mui/material/Button';
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
	if (LevelValues.find((item) => item === levelLower) < 0) {
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
	return {level: levelLower ? levelLower : Level.Information,
			message: String(message),
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
 * @param {function} [closeCb] Function to call upon the message closing
 * @returns {object} The UI for messages
 */
export function Messages({messages, messagesMax, messagesTimeout, closeCb}) {
 	const theme = useTheme();
  const timeoutIds = React.useRef({});

  /**
   * Handles closing the message's timeouts
   * @function
   */
  const closeMessageTimeouts = React.useCallback(() => {
    for (const msgId in timeoutIds.current) {
      window.clearTimeout(timeoutIds.current[msgId]);
    }
    timeoutIds.current = {};
  }, []);

  // Check for needing to clear all messages
  React.useEffect(() => {
  	if (!messages) {
      closeMessageTimeouts();
  	}
    return undefined;
  }, [messages]);

  /**
   * Handles closing the message
   * @function
   * @param msgId The ID of the message to close
   */
  const handleCloseMessage = React.useCallback((msgId) => {
    if (timeoutIds.current[msgId] != null) {
      window.clearTimeout(timeoutIds.current[msgId]);
      delete timeoutIds.current[msgId];
    }

    // Let the caller know it's been closed
    if (typeof closeCb === 'function') {
      closeCb(msgId);
    } else {
      const el = document.getElementById(`sparcd-message-${msgId}`);
      if (el) {
        el.style.display = 'none';
      }
    }
  }, [closeCb]);

	// Figure out the maximum number of messages
  const curMax = (!messagesMax || typeof messagesMax !== 'number' || messagesMax < 1) ? MAX_DISPLAY_MESSAGES : Math.min(messages.length, messagesMax);

	// Figure out the timeout
  const curTimeout = (messagesTimeout && typeof messagesTimeout === 'number') ? messagesTimeout : 6;

  /**
   * Handles generating the UI of a message as well as setting the timeout
   * @function
   * @param {object} curMessage The message to return the UI for
   * @param {number} count The count of displayed messages before this one
   * @returns {object} The rendered message UI
   */
  function generateMessage(curMessage, count) {

    // Setup the auto-removal of the message we're about to return
    if (typeof window !== "undefined" && !(curMessage.messageId in timeoutIds.current)) {
      timeoutIds.current[curMessage.messageId] = window.setTimeout(
        () => handleCloseMessage(curMessage.messageId),
        curMessage.level !== Level.Error ? curTimeout * 1000 : 30 * 60 * 1000   // 30 minutes if an error is displayed
      );
    }

    return (
      <Grid id={"sparcd-message-" + curMessage.messageId} key={"message" + curMessage.messageId} container direction="column" 
            sx={{position:'absolute', marginTop:((15*count)+5)+'px', marginLeft:((15*count))+'px', 
                 color:LevelColors[curMessage.level].color, backgroundColor:LevelColors[curMessage.level].background, 
                 padding:'10px', minWidth:'50vw', maxWidth:'90vw',
                 border:'1px solid black', borderRadius:'10px', zIndex:999999
                }}>
        <Grid id={"sparcd-message-titlebar-" + curMessage.messageId} container direction="row" alignItems="flex-start" justifyContent="space-between">
          {curMessage.level === Level.Error && <ErrorOutlineOutlinedIcon />}
          {curMessage.level === Level.Warning && <WarningAmberOutlinedIcon />}
          {curMessage.level === Level.Information && <InfoOutlinedIcon />}
          <Typography gutterBottom variant="h4" sx={{fontWeight:'bold'}} >
            {curMessage.title}
          </Typography>
          <IconButton onClick={()=>handleCloseMessage(curMessage.messageId)} aria-label="close message" sx={{marginBotton:'25px', cursor:'pointer'}}>
              <CloseIcon />
          </IconButton>
        </Grid>
        <Grid container direction="row" alignItems="center" justifyContent="space-between">
          <Typography gutterBottom variant="body1" sx={{paddingTop:'20px'}} >
            {curMessage.message}
          </Typography>
        </Grid>
        { curMessage.level === Level.Error && 
              <Grid container direction="row" alignItems="center" justifyContent="center" sx={{paddingTop:'10px'}}>
                <Button variant="contained" onClick={()=>handleCloseMessage(curMessage.messageId)}>
                  OK
                </Button>
              </Grid>
        }
      </Grid>
    );
  }

  let messageCount = 0;
	return ( 
		<React.Fragment>
		{
			messages.slice(0, curMax).map((item) => {
        // Check for messages that are closed
        if (item.closed) {
          return null;
        }

        return generateMessage(item, messageCount++);
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
  closeCb: PropTypes.func,
};
