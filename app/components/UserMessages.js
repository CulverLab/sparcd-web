'use client';

/** @module components/UserMessages */

import * as React from 'react';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Checkbox from '@mui/material/Checkbox';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import DraftsOutlinedIcon from '@mui/icons-material/DraftsOutlined';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import MailOutlinedIcon from '@mui/icons-material/MailOutlined';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ReplayOutlinedIcon from '@mui/icons-material/ReplayOutlined';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import { Level } from './Messages';
import UserMessage, { MESSAGE_TYPE } from './UserMessage';
import { AddMessageContext, TokenExpiredFuncContext, SizeContext, UserMessageContext } from '../serverInfo';

/**
 * Provides the UI for user messages
 * @function
 * @param {function} onAdd Called to add a new message
 * @param {function} onDelete Called to delete messages
 * @param {function} onRefresh Called to refresh the messages
 * @param {function} onRead Called to mark messages as read
 * @param {function} onClose Called when the user is finished
 * @returns {object} The UI for managing messages
 */
export default function UserMessages({onAdd, onDelete, onRefresh, onRead, onClose}) {
  const MAX_MESSAGE_DISPLAY_LENGTH = 50
  const theme = useTheme();
  const addMessage = React.useContext(AddMessageContext); // Function adds messages for display
  const uiSizes = React.useContext(SizeContext);  // UI Dimensions
  const userMessages = React.useContext(UserMessageContext); // The user's messages
  const contentRef = React.useRef();
  const [allSelected, setAllSelected] = React.useState(false);  // When all messages are selected
  const [curMessages, setCurMessages] = React.useState(userMessages ? userMessages.messages : []);
  const [menuAnchor, setMenuAnchor] = React.useState(null);
  const [activeMessageId, setActiveMessageId] = React.useState(null);
  const [readMessage, setReadMessage] = React.useState(null);   // Contains the ID of the message to read
  const [newMessage, setNewMessage] = React.useState(false);    // User wants to compose a message
  const [selectedMessages, setSelectedMessages] = React.useState([]); // The selected messages
  const [messageType, setMessageType] = React.useState(MESSAGE_TYPE.New); // Contains the reply message
  const [titlebarRect, setTitlebarRect] = React.useState(null); // Set when the UI displays

  // Recalcuate where to place ourselves
  React.useLayoutEffect(() => {
    calculateSizes();
  }, []);

  // Reposition ourselves on the center horizontally
  React.useLayoutEffect(() => {
    if (contentRef.current !== null) {
      const curRect = contentRef.current.getBoundingClientRect();
      const curOffsetX = (uiSizes.window.width / 2.0) - (curRect.width / 2.0);

      let el = document.getElementById('messages-wrapper');
      el.style.left = curOffsetX +'px';
      el.style.right = (curOffsetX + curRect.width) +'px';
    }
  }, [uiSizes.window.width]);

  // Adds a resize handler to the window, and automatically removes it
  React.useEffect(() => {
      function onResize () {
        calculateSizes();
      }

      window.addEventListener("resize", onResize);
  
      return () => {
          window.removeEventListener("resize", onResize);
      }
  }, []);

  // Handle messages changing
  React.useEffect(() => {
    setCurMessages(userMessages ? userMessages.messages : []);
  }, [userMessages]);

  /**
   * Calculate some sizes and positions as needed
   * @function
   */
  function calculateSizes() {
    const titleEl = document.getElementsByTagName('header');
    if (titleEl) {
      const curRect = titleEl[0].getBoundingClientRect();
      setTitlebarRect(curRect);
      return curRect;
    }

    return null;
  }

  /**
   * Handles the user checking an individual checkbox
   * @function
   * @param {number} idx The index of the message to enable
   */
  function handleMessageChecked(event, idx) {
    if (event.target.checked) {
      if (!selectedMessages.includes(idx)) {
        setSelectedMessages([...selectedMessages, idx]);
      }
    } else {
      setSelectedMessages(selectedMessages.filter(item => item !== idx));
    }
  }

  /**
   * Handle all items selected or de-selected
   * @function
   */
  function handleAllSelected() {
    const curSelection = !allSelected;
    setAllSelected(curSelection);

    // Only update the selected messages if we have messages to load
    if (userMessages && !userMessages.loading && curMessages) {
      // Select all messages
      if (curSelection === true) {
        const newSelection = [];
        for (let ii = 0; ii < curMessages.length; ii++) {
          newSelection.push(ii);
        }
        setSelectedMessages(newSelection);
      } else {
        // Remove all selections
        setSelectedMessages([]);
      }
    }
  }

  /**
   * Handles deleting selected messages
   * @function
   */
  const handleDeleteSelected = React.useCallback(() => {
    // If nothing is selected, do nothing
    if (selectedMessages.length === 0) {
      return;
    }

    const deleteIds = selectedMessages.map((item) => curMessages[item]).map((msg_item) => msg_item.id);

    // Clear selected messages
    setSelectedMessages([]);
    setAllSelected(false);

    // Delete the messages
    onDelete(deleteIds);

    // Remove from our list
    const remainMessages = curMessages.filter((item) => deleteIds.findIndex((fitem) => fitem === item.id) === -1);
    setCurMessages(remainMessages);

  }, [selectedMessages, setAllSelected, setSelectedMessages, userMessages]);

  /**
   * Handles deleting a single message
   * @function
   * @param {string} deleteId The ID of the message to delete
   */
  const handleDeleteMessage = React.useCallback((deleteId) => {

    const deleteIds = curMessages.filter((item) => item.id === deleteId).map((mitem) => mitem.id);
    if (!deleteIds || deleteIds.length <= 0) {
      return;
    }

    // Delete the messages
    onDelete(deleteIds);

    // Remove our message from the selected list
    let selMsgs = selectedMessages.filter((item) => item !== deleteId);
    setSelectedMessages(selMsgs);

    // Remove the message from our list
    const remainMessages = curMessages.filter((item) => deleteIds.findIndex((fitem) => fitem === item.id) === -1);
    setCurMessages(remainMessages);

  }, [selectedMessages, setSelectedMessages, userMessages]);

  /**
   * Handles the user reading a message
   * @function
   * @param {string} readId The ID of the message to read
   */
  const handleReadMessage = React.useCallback((readId) => {
    const foundIds = curMessages.filter((item) => item.id === readId).map((mitem) => mitem.id);
    if (!foundIds || foundIds.length <= 0) {
      return;
    }

    setMessageType(MESSAGE_TYPE.Read);
    setReadMessage(curMessages.filter((item) => foundIds.findIndex((fitem) => fitem === item.id) !== -1));

  }, [setReadMessage, userMessages])

  /**
   * Handles the reader wanting to read selected messages
   * @function
   */
  const handleReadSelected = React.useCallback(() => {
    // If nothing is selected, do nothing
    if (selectedMessages.length === 0) {
      return;
    }

    const readMsgs = selectedMessages.map((item) => curMessages[item]);
    setReadMessage(readMsgs)

  }, [selectedMessages, setReadMessage]);

  /**
   * Handles the user having read messages
   * @function
   * @param {object} msgIds Array of message IDs to mark as read
   */
  const handleUserReadMessage = React.useCallback((msgIds) => {
    onRead(msgIds);

    // Mark our copy of the messages as read
    setCurMessages(curMessages.map((item) => {
      const foundIdx = msgIds.findIndex((fitem) => fitem === item.id);
      if (foundIdx > -1) {
        item.read_sec = 1;
      }
      return item;
    }));
  }, [curMessages]);

  /**
   * Formats the timestamp for a message
   * @function
   * @param {number} elapsedSec The number of seconds from now to apply to the timestamp
   */
  function formatTimestamp(elapsedSec) {
    let curTs = new Date();
    let createTs = new Date(curTs.getTime() + (elapsedSec * 1000));

    if (curTs.getFullYear() === createTs.getFullYear()) {
      return createTs.toLocaleDateString(navigator.language ? navigator.language : 'en-US', {month:'short', day:'numeric'}) 
    }
    return createTs.toLocaleDateString(navigator.language ? navigator.language : 'en-US', {month:'short', day:'numeric', year:'numeric'}) 
  }

  /**
   * Handle closing the more menu
   * @function
   */
  const handleMoreClose = React.useCallback(() => {
    setMenuAnchor(null);
    setActiveMessageId(null);
  }, [setActiveMessageId, setMenuAnchor]);

  /**
   * Handles the user wanting to reply to a message
   * @function
   * @param {string} messageId The ID of the message to reply to
   */
  const handleMessageReply = React.useCallback((messageId, replyAll) => {
    const replyMsg = curMessages.find((item) => item.id === messageId);
    if (!replyMsg) {
      console.log('ERROR: Reply to Message: unable to find message to reply to');
      return;
    }

    // Save the message for replying
    let formattedOldMessage = (replyMsg.message.toLowerCase().startsWith('<p>') ? replyMsg.message.slice(3) : replyMsg.message);
    formattedOldMessage = formattedOldMessage.toLowerCase().endsWith('</p>') ? formattedOldMessage.slice(0, -4) : formattedOldMessage;
    let newMessage = '<p> </p><p class="mceNonEditable" style="color:grey"> ----------------<br/>' + formattedOldMessage +  '</p>';
    setReadMessage([{...replyMsg, ...{subject:'RE: ' + replyMsg.subject, message:newMessage}}]);
    setMessageType(replyAll ? MESSAGE_TYPE.ReplyAll : MESSAGE_TYPE.Reply);
  }, [setReadMessage, setMessageType, userMessages]);

  /**
   * Handles closing the active message
   * @function
   */
  const handleMessageClose = React.useCallback(() => {
    setReadMessage(null);
    setNewMessage(false);
    setMessageType(MESSAGE_TYPE.None);
  }, [setMessageType, setNewMessage, setReadMessage]);

  // Menu items for more button on each message
  const moreMenuItems = [
    {name: "Reply", action: (msgId) => handleMessageReply(msgId, false)},
    {name: "Reply All", action: (msgId) => handleMessageReply(msgId, true)},
  ];

  /**
   * Generates the click handler for menu items
   * @function
   * @param {string} messageId The ID of the message for this menu
   * @param {function} menuClickHandler The handler for the menu click
   */
  function generateMenuClick(messageId, menuClickHandler) {
    let curId = '' + messageId;
    return () => {menuClickHandler(curId);handleMoreClose();};
  }

  /**
   * Generated a line for each message (or blank ones)
   * @function
   */
  function generateMessageLines() {
    // Check if we're still loading
    if (!userMessages || userMessages.loading === true) {
      return (
        <Grid id="messages-details-list" container direction="column" justifyContent="center" alignItems="center"
              sx={{width:'100%', minHeight:'360px', overflowY:"scroll"}}
              >
          <CircularProgress sx={{minWidth:'60px', minHeight:'60px'}} />
          <Typography variant="body2">
            Loading messages ...
          </Typography>
        </Grid>        
      )
    }

    // Come up with some filler if we need them
    const remainCount = userMessages && curMessages ? (curMessages.length > 15 ? 0 : 15 - curMessages.length) : 15;
    return (
        <Grid id="messages-details-list" container direction="column" justifyContent="start" alignItems="center"
              rowSpacing={0} sx={{overflowY:"scroll", minHeight:'360px', width:'100%'}}
        >
        { curMessages && curMessages.length > 0 &&
          curMessages.map((item, idx) =>
            <Grid id={"message-details-" + idx} key={"message-details-" + idx} wrap="nowrap" container direction="row" alignItems="center" justifyContent="start"
                  sx={{backgroundColor:item.read_sec ? 'rgb(0, 0, 0, 0.03)' : 'transparent', borderBottom:'1px solid rgb(0, 0, 0, 0.07)',
                       width:'100%', minHeight:'1.5em', '&:hover':{backgroundColor:item.read_sec ? 'rgb(50, 70, 100, 0.2)' : 'rgb(150, 170, 200, 0.1)'},
                       cursor:'pointer'
                      }}
            >
              <Checkbox id={'message-'+idx} size="small" checked={selectedMessages.findIndex((item) => item === idx) !== -1}
                        onChange={(event) => handleMessageChecked(event, idx)}
              />
              <Grid container direction="row" wrap="nowrap" alignItems="center" justifyContent="start" sx={{padding:"0px", width:"100%", color:item.read_sec ? 'grey' : 'black'}}
                  onClick={() => handleReadMessage(item.id)}
              >
                <Typography variant="body2" sx={{color:'grey', fontStyle:'italic', fontSize:'x-small'}}>
                  [to: {item.receiver}]
                </Typography>
                <Typography variant="body2">
                  {item.sender}
                </Typography>
                <Typography variant="body2">
                  {item.subject}
                </Typography>
                <Typography variant="body2" sx={{marginLeft:'auto'}}>
                  {formatTimestamp(-(item.created_sec))}
                </Typography>
              </Grid>
              { item.read_sec ? 
                    <Tooltip title='Read'>
                      <DraftsOutlinedIcon fontSize="small" sx={{marginLeft:'auto', color:'grey'}} />
                    </Tooltip>
                    : 
                    <Tooltip title='Unread'>
                      <MailOutlinedIcon fontSize="small" sx={{marginLeft:'auto', color:'grey'}} />
                    </Tooltip>
              }
              <Tooltip title='Delete this message'>
                <IconButton aria-label="delete this message" onClick={() => handleDeleteMessage(item.id)} >
                  <DeleteOutlinedIcon fontSize="small" />
                </IconButton >
              </Tooltip>
              <div>
                <Tooltip title='More options'>
                  <IconButton aria-label="More options" onClick={(event) => {
                              setMenuAnchor(event.currentTarget);
                              setActiveMessageId(item.id);
                            }} >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Menu id={"message-menu-"+idx} 
                      MenuListProps={{'aria-labelledby': 'menu-button'}}
                      anchorEl={menuAnchor}
                      open={Boolean(menuAnchor) && activeMessageId === item.id}
                      onClose={handleMoreClose}
                >
                {moreMenuItems.map((menuItem) => {
                  const msgId = item.id;
                  return (
                    <MenuItem id={"message-more-menu-" + menuItem.name + '-' + idx}
                              key={"message-more-menu-" + menuItem.name + '-' + idx}
                              onClick={() => {menuItem.action(msgId);handleMoreClose();}}
                    >
                      {menuItem.name}
                    </MenuItem>
                  )})
                }
                </Menu>
              </div>
            </Grid>
          )
        }
        { remainCount > 0 && [...Array(remainCount).keys()].map((item, idx) => 
            <Grid id={"message-details-fill-" + idx} key={"message-details-fill-" + idx} container direction="row" alignItems="center" justifyContent="start"
                  sx={{borderBottom:'1px solid rgb(0, 0, 0, 0.07)', width:'100%', minHeight:'1.5em'}}
            >
            </Grid>
          )
        }
        </Grid>
    );
  }

  /**
   * Generates the UI for messages
   * @function
   */
  function generateMessages() {
    return (
      <Grid id='messages-details-wrapper' container direction="column" justifyContent="start" alignItems="start"
            sx={{width:'100%', padding:'0px 5px 0 5px'}} >
        <Grid id='messages-details-toolbar' container direction="row" justifyContent="start" alignItems="center" sx={{width:'100%'}}>
          <Tooltip title='Select'>
            <Checkbox id='messages-check-all' size="small" checked={allSelected} onChange={() => handleAllSelected()} />
          </Tooltip>
          <Tooltip title='Reload messages'>
            <IconButton aria-label="reload messages" onClick={onRefresh} >
              <ReplayOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title='Read'>
            <IconButton aria-label="Read messages" disabled={selectedMessages.length === 0} onClick={handleReadSelected} >
              <DraftsOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title='Delete'>
            <IconButton aria-label="Delete messages" onClick={handleDeleteSelected} >
              <DeleteOutlinedIcon fontSize="small" disabled={selectedMessages.length === 0}/>
            </IconButton>
          </Tooltip>
          <Button size="small" onClick={() => setNewMessage(true)} sx={{marginLeft:'auto'}}>Compose</Button>
        </Grid>
        {generateMessageLines()}
      </Grid>
    );
  }

  // Default the titlebar dimensions if it's not rendered yet
  let workingRect = titlebarRect;
  if (workingRect == null) {
    workingRect = calculateSizes();
    if (workingRect == null) {
      workingRect = {x:20,y:40,width:640};
    }
  }

  return (
  <React.Fragment>
    <Grid id='messages-wrapper'
         sx={{position:'absolute', top:(workingRect.y+20)+'px', right:'20px'}}
    >
      <Card id="messages-content" ref={contentRef} sx={{minWidth:'700px', backgroundColor:'ghostwhite', border:'1px solid lightgrey', borderRadius:'20px'}} >
        <CardHeader title="Your Messages" />
        <CardContent sx={{paddingTop:'0px', paddingBottom:'0px'}}>
          <Grid container direction="column" alignItems="start" justifyContent="start" wrap="nowrap"
                  spacing={1}
                  sx={{minWidth:'250px', overflowY:'scroll', paddingTop:'5px'}}
          >
          {generateMessages()}
          </Grid>
        </CardContent>
        <CardActions>
          <Grid container id="settings-actions-wrapper" direction="row" sx={{justifyContent:'center', alignItems:'center', width:'100%'}}
          >
            <Button variant="contained" onClick={() => onClose()}>Close</Button>
          </Grid>
        </CardActions>
      </Card>
    </Grid>
    { (readMessage !== null || newMessage) && 
        <UserMessage curMessage={newMessage ? null : readMessage} messageType={messageType}
                      onAdd={(recip,subj,msg,onDone) => onAdd(recip,subj,msg,() => {onDone();onRefresh();}) }
                      onRead={(msgIds) => handleUserReadMessage(msgIds)}
                      onReply={(msgId) => {handleMessageClose();window.setTimeout(() => handleMessageReply(msgId, false), 100);}}
                      onReplyAll={(msgId) => {handleMessageClose();window.setTimeout(() => handleMessageReply(msgId, true), 100);}}
                      onClose={() => handleMessageClose()}
        />
    }
  </React.Fragment>
  )
}
