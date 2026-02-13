/** @module components/CheckIncompleteUploads */

import * as React from 'react';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import { Level } from './Messages';
import { AddMessageContext, CollectionsInfoContext, SizeContext, TokenExpiredFuncContext, TokenContext } from '../serverInfo';
import * as utils from '../utils';

/**
 * Handles checking for incomplete uploads
 * @function
 * @param {function} onSandboxRefresh Function for refreshing the sandbox entries
 * @param {function} onClose Function for when the user wants to close this
 * @return {object} The UI for editing collection
 */
export default function CheckIncompleteUploads({onSandboxRefresh, onCancel}) {
  const theme = useTheme();
  const addMessage = React.useContext(AddMessageContext); // Function adds messages for display
  const cardRef = React.useRef();   // Used for sizeing
  const collectionInfo = React.useContext(CollectionsInfoContext);
  const checkToken = React.useContext(TokenContext);  // Login token
  const setTokenExpired = React.useContext(TokenExpiredFuncContext);
  const uiSizes = React.useContext(SizeContext);
  const [checkingFailed, setCheckingFailed] = React.useState(false);   // Used to indicate the check failed
  const [checkingForIncomplete, setCheckingForIncomplete] = React.useState(false);   // Used to indicate we're waiting on the server to respong
  const [listHeight, setListHeight] = React.useState(200);
  const [selectedCollections, setSelectedCollections] = React.useState(collectionInfo.map((item)=>item.bucket));
  const [serverURL, setServerURL] = React.useState(utils.getServer());  // The server URL to use
  const [selectionRedraw, setSelectionRedraw] = React.useState(0); // Used to redraw the UI

  // Calculate how large the list can be
  React.useLayoutEffect(() => {
    if (cardRef && cardRef.current) {
      const parentEl = document.getElementById('check-complete-uploads-content');
      if (parentEl) {
        const parentRect = parentEl.getBoundingClientRect();
        setListHeight(parentRect.height);
      }
    }
  }, [cardRef]);

  /**
   * Handles when the user selects or deselects a collection
   * @function
   * @param {object} event The triggering event object
   * @param {string} collectionName The name of the collection to add or remove
   */
  const handleCheckboxChange = React.useCallback((event, collectionName) => {

    if (event.target.checked) {
      const collectionIdx = selectedCollections.findIndex((item) => collectionName === item);
      // Add the collections in if we don't have it already
      if (collectionIdx < 0) {
        const curCollections = selectedCollections;
        curCollections.push(collectionName);
        setSelectedCollections(curCollections);
        setSelectionRedraw(selectionRedraw + 1);
      }
    } else {
      // Remove the collections if we have it
      const curCollections = selectedCollections.filter((item) => item !== collectionName);
      if (curCollections.length < selectedCollections.length) {
        setSelectedCollections(curCollections);
        setSelectionRedraw(selectionRedraw + 1);
      }
    }
  }, [selectedCollections, setSelectedCollections, selectionRedraw, setSelectionRedraw]);

  /**
   * Handles selecting all collections to the filter
   * @function
   */
  const handleSelectAll = React.useCallback(() => {
    setSelectedCollections(collectionInfo.map((item)=>item.bucket));
  }, [collectionInfo, setSelectedCollections])

  /**
   * Clears all selected collections
   * @function
   */
  const handleSelectNone = React.useCallback(() => {
    setSelectedCollections([]);
  }, [setSelectedCollections]);

  /**
   * Performs the check for incomplete uploads
   * @function
   * @param {function} onCancel The function to call when the user cancels
   */
  const continueCheckIncomplete = React.useCallback((onCancel) => {
    // Check if we have something to do
    if (!selectedCollections || selectedCollections.length <= 0) {
      return;
    }

    // Get the server to check for incomplete uploads
    const checkIncompleteUrl = serverURL + '/adminCheckIncomplete?t=' + encodeURIComponent(checkToken);

    const formData = new FormData();
    formData.append('collections', JSON.stringify(selectedCollections));

    setCheckingForIncomplete(true);
    setCheckingFailed(false);

    try {
      const resp = fetch(checkIncompleteUrl, {
        method: 'POST',
        body: formData,
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              if (resp.status === 401) {
                // User needs to log in again
                setTokenExpired();
              }
              throw new Error(`Failed to update changed settings information: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
            // Handle the result
            setCheckingForIncomplete(false);
            if (respData.success) {
              addMessage(Level.Info, `Successfully checked for ${respData.count ? parseInt(respData.count) : 0} incomplete uploads`);
              window.setTimeout(() => {onSandboxRefresh();onCancel();}, 1000);
            } else {
              addMessage(Level.Warning, 'Failed the check for incomplete uploads');
              checkingFailed(true);
            }
        })
        .catch(function(err) {
          console.log('Admin Save Location/Species Error: ',err);
          addMessage(Level.Warning, 'An error ocurred when attempting to complete saving the changed settings information');
          setCheckingForIncomplete(false);
          setCheckingFailed(true);
      });
    } catch (error) {
      console.log('Admin Save Location/Species Unknown Error: ',err);
      addMessage(Level.Warning, 'An unknown error ocurred when attempting to complete saving the changed settings information');
      setCheckingForIncomplete(false);
      setCheckingFailed(true);
    }
  }, [addMessage, selectedCollections, serverURL, setCheckingForIncomplete, checkToken])

  // Return the UI
  return (
   <Card id='check-complete-uploads-wrapper' ref={cardRef} variant="outlined" sx={{ ...theme.palette.folder_upload, maxWidth:'50vw', backgroundColor:'#EAEAEA'}} >
    <CardHeader sx={{ textAlign: 'center' }}
       title={
        <Typography gutterBottom variant="h6" component="h4">
          Check for Incomplete Uploads
        </Typography>
       }
     />
    <CardContent>
      <Stack>
        <Typography nowrap="true" variant="body2" sx={{fontWeight:'bold', paddingBottom:'7px'}}>
           {checkingFailed === true ? "An error occured while checking for incomplete uploads" : " "}
        </Typography>
        <Grid id='check-complete-uploads-content' sx={{minHeight:listHeight+'px', maxHeight:listHeight+'px', height:listHeight+'px', minWidth:'250px', overflow:'scroll',
                        border:checkingForIncomplete === false ? '1px solid black' : '1px solid grey', borderRadius:'5px', paddingLeft:'5px',
                        backgroundColor:checkingForIncomplete === false ? 'rgb(255,255,255,0.3)' : 'lightgrey'
                      }}>
          {checkingForIncomplete === false ?
            <FormGroup>
              { collectionInfo.map((item) => 
                  <FormControlLabel key={'check-complete-uploads-collections-' + item.name}
                                    control={<Checkbox size="small" 
                                                       checked={selectedCollections.findIndex((curCollections) => curCollections===item.bucket) > -1 ? true : false}
                                                       onChange={(event) => handleCheckboxChange(event,item.bucket)}
                                              />} 
                                    label={<Typography variant="body2">{item.name}</Typography>} />
                )
              }
            </FormGroup>
          : <Grid container direction="column" alignItems="center" justifyContent="center" sx={{height:'100%'}}>
              <CircularProgress />
              <Typography gutterBottom variant="body2">
                Please wait while checking collections ...
              </Typography>
            </Grid>
          }
        </Grid>
        <Grid container direction="row" alignItems="center" justifyContent="space-between" sx={{borderBottom:'1px solid grey'}} >
          <Button sx={{'flex':'1'}} size="small" disabled={checkingForIncomplete} onClick={handleSelectAll}>Select All</Button>
          <Button sx={{'flex':'1'}} size="small" disabled={checkingForIncomplete} onClick={handleSelectNone}>Select None</Button>
        </Grid>
      </Stack>
    </CardContent>
    <CardActions>
      <Button id="check-complete-uploads-continue" disabled={selectedCollections.length === 0 || checkingForIncomplete}
              sx={{'flex':'1'}} size="small" onClick={continueCheckIncomplete}>
        Continue
      </Button>
      <Button id="check-complete-uploads-cancel" disabled={checkingForIncomplete} sx={{'flex':'1'}} size="small" onClick={onCancel}>Done</Button>
    </CardActions>
  </Card>
  );
}
