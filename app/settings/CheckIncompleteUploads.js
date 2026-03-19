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

import PropTypes from 'prop-types';

import * as Server from './SettingsServerCalls';
import { Level } from '../components/Messages';
import { AddMessageContext, CollectionsInfoContext, TokenExpiredFuncContext, TokenContext } from '../serverInfo';
import * as utils from '../utils';

/**
 * Handles checking for incomplete uploads
 * @function
 * @param {function} onSandboxRefresh Function for refreshing the sandbox entries
 * @param {function} onCancel Function for when the user wants to close this window
 * @return {object} The UI for editing collection
 */
export default function CheckIncompleteUploads({onSandboxRefresh, onCancel}) {
  const theme = useTheme();
  const addMessage = React.useContext(AddMessageContext); // Function adds messages for display
  const cardRef = React.useRef(null);   // Used for sizing
  const completeUploadsRef = React.useRef(null); // Used for sizing
  const collectionInfo = React.useContext(CollectionsInfoContext);
  const checkToken = React.useContext(TokenContext);  // Login token
  const setTokenExpired = React.useContext(TokenExpiredFuncContext);
  const [checkingFailed, setCheckingFailed] = React.useState(false);   // Used to indicate the check failed
  const [checkingForIncomplete, setCheckingForIncomplete] = React.useState(false);   // Used to indicate we're waiting on the server to respong
  const [listHeight, setListHeight] = React.useState(200);
  const [selectedCollections, setSelectedCollections] = React.useState(collectionInfo.map((item)=>item.bucket));
  const serverURL = React.useMemo(() => utils.getServer(), []);

  // Calculate how large the list can be
  React.useLayoutEffect(() => {
    if (completeUploadsRef.current) {
      const parentRect = completeUploadsRef.current.getBoundingClientRect();
      setListHeight(parentRect.height);
    }
  }, []);

  /**
   * Handles when the user selects or deselects a collection
   * @function
   * @param {object} event The triggering event object
   * @param {string} collectionName The name of the collection to add or remove
   */
  const handleCheckboxChange = React.useCallback((event, collectionName) => {

    if (event.target.checked) {
      // Add the collections in if we don't have it already
      if (!selectedCollections.includes(collectionName)) {
        const curCollections = [...selectedCollections, collectionName];
        setSelectedCollections(curCollections);
      }
    } else {
      // Remove the collections if we have it
      const curCollections = selectedCollections.filter((item) => item !== collectionName);
      if (curCollections.length < selectedCollections.length) {
        setSelectedCollections(curCollections);
      }
    }
  }, [selectedCollections]);

  /**
   * Handles selecting all collections to the filter
   * @function
   */
  const handleSelectAll = React.useCallback(() => {
    setSelectedCollections(collectionInfo.map((item)=>item.bucket));
  }, [collectionInfo])

  /**
   * Clears all selected collections
   * @function
   */
  const handleSelectNone = React.useCallback(() => {
    setSelectedCollections([]);
  }, []);

  /**
   * Performs the check for incomplete uploads
   * @function
   */
  const continueCheckIncomplete = React.useCallback(() => {
    // Check if we have something to do
    if (selectedCollections.length === 0) {
      return;
    }

    setCheckingForIncomplete(true);
    setCheckingFailed(false);

    // Get the server to check for incomplete uploads
    const success = Server.continueCheckIncomplete(serverURL, checkToken, selectedCollections, setTokenExpired,
          (respData) => {     // Success
              // Handle the result
              setCheckingForIncomplete(false);
              if (respData.success) {
                addMessage(Level.Information, `Successfully checked for ${respData.count ? parseInt(respData.count) : 0} incomplete uploads`);
                window.setTimeout(() => {onSandboxRefresh();onCancel();}, 1000);
              } else {
                addMessage(Level.Warning, 'Failed the check for incomplete uploads');
                setCheckingFailed(true);
              }
          },
          (err) => {          // Failure
              addMessage(Level.Warning, err);
              setCheckingForIncomplete(false);
              setCheckingFailed(true);
          }
    );

    if (!success) {
      addMessage(Level.Warning, 'An unknown error occurred when attempting to complete saving the changed settings information');
      setCheckingForIncomplete(false);
      setCheckingFailed(true);
    }

  }, [addMessage, checkToken, onSandboxRefresh, selectedCollections, serverURL, setTokenExpired])

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
        <Typography noWrap variant="body2" sx={{fontWeight:'bold', paddingBottom:'7px'}}>
           {checkingFailed === true ? "An error occured while checking for incomplete uploads" : " "}
        </Typography>
        <Grid id='check-complete-uploads-content' ref={completeUploadsRef}
                        sx={{minHeight:listHeight, maxHeight:listHeight, height:listHeight, minWidth:'250px',
                        overflowY:'auto',
                        border:checkingForIncomplete === false ? '1px solid black' : '1px solid grey', borderRadius:'5px', paddingLeft:'5px',
                        backgroundColor:checkingForIncomplete === false ? 'rgb(255,255,255,0.3)' : 'lightgrey'
                      }}>
          {checkingForIncomplete === false ?
            <FormGroup>
              { collectionInfo.map((item) => 
                  <FormControlLabel key={'check-complete-uploads-collections-' + item.name}
                                    control={<Checkbox size="small" 
                                                       checked={selectedCollections.includes(item.bucket)}
                                                       onChange={(event) => handleCheckboxChange(event,item.bucket)}
                                              />} 
                                    label={<Typography variant="body2">{item.name}</Typography>} />
                )
              }
            </FormGroup>
          : <Grid container direction="column" alignItems="center" justifyContent="center" sx={{height:'100%'}}>
              <CircularProgress />
              <Typography gutterBottom variant="body2" sx={{marginTop:'10px'}}>
                Please wait while checking collections ...
              </Typography>
              {selectedCollections.length > 4 &&
                <Typography gutterBottom variant="body3">
                  This may take some time
                </Typography>
              }
            </Grid>
          }
        </Grid>
        <Grid container direction="row" alignItems="center" justifyContent="space-between" sx={{borderBottom:'1px solid grey'}} >
          <Button sx={{flex:1}} size="small" disabled={checkingForIncomplete} onClick={handleSelectAll}>Select All</Button>
          <Button sx={{flex:1}} size="small" disabled={checkingForIncomplete} onClick={handleSelectNone}>Select None</Button>
        </Grid>
      </Stack>
    </CardContent>
    <CardActions>
      <Button id="check-complete-uploads-continue" disabled={selectedCollections.length === 0 || checkingForIncomplete}
              sx={{flex:1}} size="small" onClick={continueCheckIncomplete}>
        Continue
      </Button>
      <Button id="check-complete-uploads-cancel" disabled={checkingForIncomplete} sx={{flex:1}} size="small" onClick={onCancel}>Done</Button>
    </CardActions>
  </Card>
  );
}

CheckIncompleteUploads.propTypes = {
  onSandboxRefresh: PropTypes.func.isRequired,
  onCancel:         PropTypes.func.isRequired,
};
