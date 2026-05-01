/** @module CollectionsManage */

import * as React from 'react';
import BackspaceOutlined from '@mui/icons-material/BackspaceOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

import CollectionUploadTile from './components/CollectionUploadTile';
import EditUploadDetails from './components/EditUploadDetails';
import MoveUpload from './components/MoveUpload';
import { Level } from './components/Messages';
import * as Server from './ServerCalls';
import { AddMessageContext, CollectionsInfoContext, NarrowWindowContext, SizeContext,
         TokenContext, TokenExpiredFuncContext, UserNameContext } from './serverInfo';
import WorkspaceOverlay from './components/WorkspaceOverlay';
import * as utils from './utils';

/**
 * Renders the UI for managing the list of uploaded folders
 * @function
 * @param {boolean} loadingCollections Indicates if collections are being loaded
 * @param {string} [selectedCollection] The currently selected collection name
 * @param {function} onSelectionChange Called when the user selects a new collection
 * @param {function} onEditUpload Called when the user wants to edit an upload of a collection
 * @param {function} searchSetup Call when settting up or clearing search elements
 * @param {function} onUploadUpdateMetadata Called when an upload's metadata is changed
 * @returns {object} The rendered UI
 */
export default function CollectionsManage({loadingCollections, selectedCollection, onSelectionChange, onEditUpload,
                                            searchSetup, onUploadUpdateMetadata}) {
  const theme = useTheme();
  const sidebarRef = React.useRef();
  const addMessage = React.useContext(AddMessageContext); // Function adds messages for display
  const collectionsItems = React.useContext(CollectionsInfoContext);
  const collectionToken = React.useContext(TokenContext);  // Login token
  const narrowWindow = React.useContext(NarrowWindowContext);
  const uiSizes = React.useContext(SizeContext);
  const userName = React.useContext(UserNameContext);
  const setTokenExpired = React.useContext(TokenExpiredFuncContext);
  const serverURLRef = React.useRef(utils.getServer());   // The starting part of the url to call
  const uploadFilterInputRef = React.useRef(null);        // Used to reference the upload filter
  const [canEditUploads, setCanEditUploads] = React.useState(false); // Keeping track if user can edit uploads
  const [editingUploadMask, setEditingUploadMask] = React.useState(false);
  const [expandedUpload, setExpandedUpload] = React.useState(false);
  const [isAdminChecked, setIsAdminChecked] = React.useState(false); // Has checking for admin happened
  const [isAdmin, setIsAdmin] = React.useState(null); // Null indicates it hasn't been checked yet. Boolean T/F is admin status
  const [otherBuckets, setOtherBuckets] = React.useState(null); // Contains the loaded non-collection buckets
  const [pendingMessage, setPendingMessage] = React.useState(null);
  const [searchIsSetup, setSearchIsSetup] = React.useState(false);
  const [selectionIndex, setSelectionIndex] = React.useState(-1);
  const [totalHeight, setTotalHeight] = React.useState(null);  // Default value is recalculated at display time
  const [uploadDetailEdit, setUploadDetailEdit] = React.useState(null);
  const [uploadFilter, setUploadFilter] = React.useState(null); // The upload filter string for a collection
  const [uploadFiltering, setUploadFiltering] = React.useState(false); // The user wants to filter when set to true
  const [uploadMove, setUploadMove] = React.useState(false); // The user wants to move an upload
  const [uploadSelectionIndex, setUploadSelectionIndex] = React.useState(-1);

  React.useEffect(() => {
    if ((isAdmin === null || isAdmin === undefined) && !isAdminChecked) {
      setIsAdminChecked(true);
      const success = Server.userIsAdminCheck(serverURLRef.current, collectionToken, setTokenExpired,
                              (respData) => { // Success
                                setIsAdmin(!!respData.isAdmin);
                              },
      );

      if (!success) {
        console.log('WARNING: (CollectionsManage) error detected when attmpting to see if user is admin');
      }
    }
  }, [isAdmin]);

  // Initialize collections information
  React.useEffect(() => {
    if (collectionsItems && selectedCollection.collectionName && (selectionIndex === -1 || selectionIndex >= collectionsItems.length)) {
      const collIndex = collectionsItems.findIndex((item) => item.name === selectedCollection.collectionName);
      setSelectionIndex(collIndex);
      setUploadFilter(null);
      setUploadFiltering(false);
      if (collIndex >= 0 && selectedCollection.uploadKey) {
        setUploadSelectionIndex(collectionsItems[collIndex].uploads.findIndex((item) => item.key === selectedCollection.uploadKey));
      } else {
        setUploadSelectionIndex(-1);
      }
    }
  }, [collectionsItems, selectedCollection, selectionIndex]);

  // Recalcuate available space in the window
  React.useLayoutEffect(() => {
    // More size setup
    setTotalHeight(uiSizes.workspace.height);

  }, [narrowWindow, uiSizes]);


   // Scrolls the selected collection into view
  React.useLayoutEffect(() => {
    if (selectionIndex >= 0 && collectionsItems && selectionIndex < collectionsItems.length) {
      // Scroll the collection into view
      const collectionName = collectionsItems[selectionIndex].name;
      let el = document.getElementById("collection-"+collectionName);
      if (el) {
        el.scrollIntoView({behavior: 'instant', block: 'center', inline: 'center'});
      }

      if (uploadSelectionIndex >= 0 && uploadSelectionIndex < collectionsItems[selectionIndex].uploads.length) {
        el = document.getElementById('collection-upload-item-' + collectionsItems[selectionIndex].uploads[uploadSelectionIndex].name);
        if (el) {
          el.scrollIntoView({behavior: 'instant', block: 'center', inline: 'center'});
        }
      }
    }
  }, [collectionsItems, selectionIndex, uploadSelectionIndex])

  /**
   * Searches for collections that meet the search criteria and scrolls it into view
   * @function
   * @param {string} searchTerm The term to search in a collection
   */
  const handleCollectionSearch =  React.useCallback((searchTerm) => {
    const ucSearchTerm = searchTerm.toUpperCase();
    const foundCollections = collectionsItems.filter((item) => item.name.toUpperCase().includes(ucSearchTerm) ||
                                                               item.description.toUpperCase().includes(ucSearchTerm));
    // Scroll finding into view
    if (foundCollections.length > 0) {
      setUploadFilter(null);
      setUploadFiltering(false);
      const elCollection = document.getElementById("collection-"+foundCollections[0].name);
      if (elCollection) {
        elCollection.scrollIntoView();
        elCollection.focus();
        setSelectionIndex(collectionsItems.findIndex((item) => item.name === foundCollections[0].name));
        searchSetup('Collection Name', handleCollectionSearch);
        return true;
      }
    }

    return false;
  }, [collectionsItems, searchSetup]);

  /**
   * Fetches the non-collection buckets from the server
   * @function
   */
  const getOtherBuckets = React.useCallback(() => {
    setPendingMessage('Please wait we\'re loading the additional buckets');
    const success = Server.getOtherBuckets(serverURLRef.current, collectionToken,
                                setTokenExpired,
                                (respData) => {   // Success
                                  setPendingMessage(null);
                                  if (respData.success) {
                                    setOtherBuckets(respData.buckets);
                                  } else {
                                    addMessage(Level.Error, 'Unable to load additional bucket information');
                                  }
                                },
                                (err) => {        // Failure
                                  setPendingMessage(null);
                                  addMessage(Level.Error, 'Error encountered while loadin additional bucket information');
                                }
    );

    if (!success) {
      setPendingMessage(null);
      addMessage(Level.Error, 'An unknown problem occurred while getting additional buckets');
    }

  }, []);

  /**
   * Handle the user wanting to edit an upload
   * @function
   */
  const handleUploadEdit = React.useCallback((curCollectionId, itemKey) => {
    setEditingUploadMask(true);
    window.setTimeout(() => {
        onEditUpload(curCollectionId, itemKey, "Collections", () => {}, () => setEditingUploadMask(false));
    }, 200);
  }, [collectionsItems, onEditUpload, selectionIndex]);

  /**
   * Returns a function that will set the expanded panel name for Accordian panels
   * @function
   * @param {string} panelName Unique identifier of the panel
   * @returns {function} A function that will handle the accordian state change
   */
  function handleExpandedChange(panelName) {
    return (event, isExpanded) => {
      setExpandedUpload(isExpanded ? panelName : false);
    }
  }

  /**
   * Handler for users wanting to edit upload details
   * @function
   * @param {string} collectionId The ID of the collection the upload belongs to
   * @param {object} upload The upload information to edit
   */
  const handleSetUploadDetailsEdit = React.useCallback((collectionId, upload) => {
    setUploadDetailEdit({collectionId, upload});
  }, []);


  /**
   * Enables the user interface to move an upload
   * @function
   * @param {string} collectionId The ID of the collection the upload belongs to
   * @param {object} upload The upload information to edit
   */
  const handleSetUploadMove = React.useCallback((collectionId, upload) => {
    setUploadMove({collectionId, upload});
  }, []);

  /**
   * Handles an edit change to an upload detail
   * @function
   * @param {Array} uploads The list of uploads related to the request
   * @param {string} comment The updated comment
   * @param {object} upload The upload associated with this change
   * @param {function} [onSuccess] The function to call upon success
   * @param {function} [onFailure] The function to call upon filure
   */
  const handleUploadDetailChange = React.useCallback((upload, comment, onSuccess, onFailure) => {

    onSuccess ||= () => {};
    onFailure ||= () => {};

    if (!uploadDetailEdit) {
      addMessage(Level.Error, 'Unable to find the upload to modify');
      return;
    }
    // Somehow we aren't the current edit
    if (upload.key !== uploadDetailEdit.upload.key) {
      return;
    }

    setPendingMessage('Please wait while making the changes to the upload details');
    const success = Server.updateUploadDetails(serverURLRef.current, collectionToken,
                                uploadDetailEdit.collectionId,
                                upload.key,
                                comment,
                                setTokenExpired,
                                (respData) => {   // Success
                                  setPendingMessage(null);
                                  if (respData.success) {
                                    setUploadDetailEdit(null);
                                    onSuccess(upload.key);
                                    // Reload the collections
                                    onUploadUpdateMetadata();
                                  } else {
                                    addMessage(Level.Error, 'Unable to update the collection details');
                                    onFailure(upload.key);
                                  }
                                },
                                (err) => {        // Failure
                                  addMessage(Level.Error, 'An problem occurred while updating the upload information');
                                  onFailure(upload.key);
                                  setPendingMessage(null);
                                }
    );

    if (!success) {
      setPendingMessage(null);
      addMessage(Level.Error, 'An unknown problem occurred while updating the upload information');
      onFailure(upload.key);
    }

  }, [addMessage, collectionToken, serverURLRef, setTokenExpired, uploadDetailEdit]);

  /**
   * Handles the moving of an upload to another collection
   * @function
   * @param {string} srcCollectionId The source collection ID
   * @param {object} upload The upload to move
   * @param {string} dstCollectionId The ID of the destination collection or bucket name
   */
  const handleUploadMove = React.useCallback((srcCollectionId, upload, dstCollectionId, onSuccess, onFailure) => {
    onSuccess ||= () => {};
    onFailure ||= () => {};

    setPendingMessage('Please wait while the upload is being moved');
    const success = Server.moveUpload(serverURLRef.current, collectionToken,
                                srcCollectionId,
                                upload.key,
                                dstCollectionId,
                                setTokenExpired,
                                (respData) => {   // Success
                                  setPendingMessage(null);
                                  if (respData.success) {
                                    onUploadUpdateMetadata();
                                    onSuccess();
                                  } else {
                                    addMessage(Level.Error, 'Unable to move the upload');
                                    onFailure(null);
                                  }
                                },
                                (err) => {        // Failure
                                  addMessage(Level.Error, 'An problem occurred while moving the upload');
                                  setPendingMessage(null);
                                  onFailure(null);
                                }
    );

    if (!success) {
      setPendingMessage(null);
      addMessage(Level.Error, 'An unknown problem occurred while moving the upload');
      onFailure(null);
    }

  }, [addMessage, collectionToken, serverURLRef, setTokenExpired]);

  /**
   * Handler for when the user's selection changes and prevents default behavior
   * @function
   * @param {object} event The event
   * @param {string} bucket The bucket of the new selected collection
   * @param {string} id The ID of the new selected collection
   */
  const onCollectionChange = React.useCallback((event, bucket, id) => {
    event.preventDefault();

    const collIndex = collectionsItems.findIndex((item) => item.bucket === bucket && item.id === id);
    setSelectionIndex(collIndex);
    setUploadFilter(null);
    setUploadFiltering(false);

    onSelectionChange(collectionsItems[collIndex].name);
  }, [collectionsItems, onSelectionChange]);

  /**
   * Handles the upload filter changing
   * @function
   * @param {object} event The triggering event
   */
  const handleUploadFilterChange = React.useCallback((event) => {
    setUploadFilter(event.target.value);
  }, []);

  /**
   * Formats the upload timestamp for display
   * @function
   * @param {object} uploadTS The timestamp object from an upload
   * @returns {string} Returns the formatted timestamp string
   */
  function getLastUploadDate(uploadTS) {
    let returnStr = '';
    if (uploadTS) {
      if (uploadTS.date) {
        if (uploadTS.date.year) {
          returnStr += utils.pad(uploadTS.date.year);
        } else {
          returnStr += 'XXXX';
        }
        if (uploadTS.date.month) {
          returnStr += '-' + utils.pad(uploadTS.date.month, 2, 0);
        } else {
          returnStr += '-XX';
        }
        if (uploadTS.date.day) {
          returnStr += '-' + utils.pad(uploadTS.date.day, 2, 0);
        } else {
          returnStr += '-XX';
        }
      }

      if (uploadTS.time) {
        if (uploadTS.time.hour !== null) {
          returnStr += ' ' + utils.pad(uploadTS.time.hour, 2, 0);
        } else {
          returnStr += ' XX';
        }
        if (uploadTS.time.minute !== null) {
          returnStr += ':' + utils.pad(uploadTS.time.minute, 2, 0);
        } else {
          returnStr += ':XX';
        }
        if (uploadTS.time.second !== null) {
          returnStr += ':' + utils.pad(uploadTS.time.second, 2, 0);
        } else {
          returnStr += ':XX';
        }
      }
    }

    if (returnStr.length <= 0) {
      returnStr = 'No last upload date';
    }

    return returnStr;
  }

  // Keep collection upload edit permissions up to date
  React.useEffect(() => {
    if (isAdmin) {
      setCanEditUploads(true);
      return;
    }

    let curEditUploads = false;

    // Check for the necessary permissions
    if (collectionsItems && selectedCollection.collectionName) {
      const curColl = collectionsItems.find((item) => item.name === selectedCollection.collectionName);
      if (curColl && curColl.permissions && curColl.permissions.usernameProperty === userName) {
        if (curColl.permissions.ownerProperty || curColl.permissions.uploadProperty) {
          curEditUploads = true;
        }
      }
    }

    setCanEditUploads(curEditUploads);

  }, [collectionsItems, selectedCollection]);

  /**
   * Function to handle the user clicking the filtering icons
   * @function
   */
  const handlesUploadFiltering = React.useCallback(() => {
    // If we're stopping filtering, we need to clear the filter
    if (uploadFiltering) {
      setUploadFilter(null);
    }
    setUploadFiltering(prev => !prev);
  }, [uploadFiltering]);

  /**
   * Function that handles the user clearing the filder
   * @function
   * @param {object} event The triggering event
   */
  const handleClearFilter = React.useCallback((event) => {
    setUploadFilter(null);
  }, []);

  // Keep the current uploads available
  const filteredUploads = React.useMemo(() => {
    const uploads = collectionsItems?.[selectionIndex]?.uploads;
    if (!uploads?.length) return [];
    if (!uploadFilter) return uploads;

    const lowerFilter = uploadFilter.toLowerCase();
    return uploads.filter((item) =>
      item.name.toLowerCase().includes(lowerFilter) ||
      item.key.toLowerCase().includes(lowerFilter) ||
      item.description.toLowerCase().includes(lowerFilter) ||
      item.location.toLowerCase().includes(lowerFilter) ||
      item.edits?.some((e) => e.toLowerCase().includes(lowerFilter)) ||
      item.folders?.some((folder) => folder.toLowerCase().includes(lowerFilter))
    );

  }, [collectionsItems, selectionIndex, uploadFilter]);

  // Setup search
  React.useEffect(() => {
    if (!searchIsSetup && collectionsItems) {
      searchSetup('Collection Name', handleCollectionSearch);
      setSearchIsSetup(true);
    }
  }, [collectionsItems, handleCollectionSearch, loadingCollections, searchIsSetup, searchSetup]);

  // Render the UI
  const curHeight = (totalHeight || 480) + 'px';
  const curCollection = collectionsItems && selectionIndex >= 0 ? collectionsItems[selectionIndex] : { uploads: [] };
  return (
    <Box id='collection-manage-workspace-wrapper'>
      <Grid id='collection-manage-workspace' container direction='row' alignItems='start' justifyContent='start' sx={{ width:'100vw' }} columns={48}>
        <div id='collection-manage-workspace-collections-wrapper' 
                style={{minWidth:'calc(100vw - 460px)', maxWidth:'calc(100vw - 460px)', maxHeight:curHeight, paddingLeft:'10px', overflowY:'scroll'}}>
          <Grid id='collection-manage-workspace-collections-details' container direction="row" sx={{gap:'12px'}} >
            { collectionsItems && collectionsItems.map((item, idx) =>
              <Grid key={'collection-'+item.name+'-'+idx} >
                    <Grid display='flex' justifyContent='left' size='grow' >
                      <Card id={"collection-"+item.name}
                            onClick={(event) => onCollectionChange(event, item.bucket, item.id)}
                            variant="outlined"
                            data-active={selectionIndex === idx ? '' : undefined}
                            sx={{border:'1px solid', borderColor:'#7f8c96', borderRadius:'6px', minWidth:'400px', maxWidth:'400px',
                                  backgroundColor:'#f6f7f8',
                                  color:'text.primary',
                                  '&[data-active]': {borderColor:'#4f6274', backgroundColor:'#e8ecef'},
                                  '&:hover':{backgroundColor:'#eeeeee'}
                                }}
                      >
                        <CardActionArea data-active={selectionIndex === idx ? '' : undefined}
                          sx={{height: '100%',
                               color:'inherit',
                               '&[data-active]': {backgroundColor:'transparent'},
                               '&.Mui-focusVisible': {
                                 outline:'2px solid #1565c0',
                                 outlineOffset:'-2px',
                               },
                          }}
                        >
                          <CardContent>
                            <Grid container direction="column" spacing={1}>
                              <Grid>
                                <Typography variant='body' sx={{fontSize:'larger', fontWeight:(selectionIndex === idx ? 'bold' : 'normal')}}>
                                  {item.name}
                                </Typography>
                              </Grid>
                              <Grid>
                                <Typography variant="body">
                                  {item.organization}
                                </Typography>
                              </Grid>
                              <Grid>
                                <Typography variant="body" sx={{whiteSpace:"pre-wrap"}} >
                                  {item.id}
                                </Typography>
                              </Grid>
                              <Grid>
                                <Typography variant="body" sx={{whiteSpace:"pre-wrap"}} >
                                  {item.description}
                                </Typography>
                              </Grid>
                              <Grid>
                                <Typography variant="body">
                                  Uploads - {item.uploads.length}
                                </Typography>
                              </Grid>
                              { item.uploads.length > 0 &&
                                <Grid>
                                  <Typography variant="body">
                                    Last upload: {getLastUploadDate(item.last_upload_ts)}
                                  </Typography>
                                </Grid>
                              }
                          </Grid>
                          </CardContent>
                        </CardActionArea>
                      </Card>
                    </Grid>
              </Grid>
            )}
          </Grid>
        </div>
        <div id='collection-manage-workspace-uploads-wrapper' style={{minWidth:'460px', maxWidth:'460px', maxHeight:curHeight, paddingRight:'10px', overflowY:"scroll"}}>
          <Grid id='collection-manage-workspace-uploads-details' container direction="column" alignItems='start' justifyContent="start" sx={{gap:'8px'}}>
            { filteredUploads && 
              <Grid container direction="row" alignItems="center" justifyContent="flex-end"
                    onClick={uploadFiltering ? null : handlesUploadFiltering}
                    sx={{backgroundColor:'snow', width:'100%', border:'1px solid grey', borderRadius:'7px'}}
              >
                { uploadFiltering &&
                  <TextField
                    variant="standard"
                    size="small"
                    id="colleciton-upload-search"
                    margin="dense"
                    placeholder="Filter"
                    sx={{paddingLeft:'10px', flexGrow:1}}
                    value={uploadFilter || ''}
                    autoFocus
                    slotProps={{
                      input: {
                        inputRef:uploadFilterInputRef,
                        endAdornment:(
                          <InputAdornment position="end">
                            <IconButton onClick={handleClearFilter} onMouseDown={(e) => e.preventDefault()}>
                              <BackspaceOutlined/>
                            </IconButton>
                          </InputAdornment>
                        )
                      },
                    }}
                    onChange={handleUploadFilterChange}
                  />
                }
                <IconButton 
                          onClick={!uploadFiltering ? null : handlesUploadFiltering}
                          onMouseDown={(e) => e.preventDefault()}
                          sx={{marginLeft:'auto', fontSize:"small", padding:'1px'}}
                >
                  <SearchOutlinedIcon fontSize={uploadFiltering ? "large" : "small"}  />
                </IconButton>
              </Grid>
            }
            { filteredUploads && filteredUploads.map((item, idx) => 
                <CollectionUploadTile
                              key={'collection-upload-tile-'+item.key}
                              upload={item}
                              active={uploadSelectionIndex === idx}
                              expanded={expandedUpload === 'upload-details-'+item.name}
                              onUploadEdit={() => handleUploadEdit(curCollection.id, item.key)}
                              onExpandChange={handleExpandedChange('upload-details-'+item.name)}
                              onEditDetails={!canEditUploads ? null : () => handleSetUploadDetailsEdit(curCollection.id, item)}
                              onUploadMove={!isAdmin ? null : () => handleSetUploadMove(curCollection.id, item)}
                />
            )}
          </Grid>
        </div>
      </Grid>
      { uploadMove &&
          <MoveUpload collectionId={uploadMove.collectionId}
                      upload={uploadMove.upload}
                      admin={isAdmin}
                      buckets={isAdmin ? otherBuckets : undefined}
                      getBuckets={isAdmin ? getOtherBuckets : undefined}
                      onMove={handleUploadMove}
                      onClose={() => setUploadMove(null)}
          />
      }
      { uploadDetailEdit &&
          <EditUploadDetails upload={uploadDetailEdit.upload}
                            onChange={handleUploadDetailChange}
                            onClose={() => setUploadDetailEdit(null)}
          />
      }
      { loadingCollections && 
          <WorkspaceOverlay>
            <Typography gutterBottom variant="body2" color="lightgrey">
              Loading collections, please wait...
            </Typography>
            <CircularProgress variant="indeterminate" />
            <Typography gutterBottom variant="body2" color="lightgrey">
              This may take a while
            </Typography>
          </WorkspaceOverlay>
      }
      { editingUploadMask && 
          <WorkspaceOverlay>
              <Typography gutterBottom variant="body2" color="lightgrey">
                Preparing to edit uploaded images
              </Typography>
              <CircularProgress variant="indeterminate" />
              <Button size="small" variant="contained" onClick={() => setEditingUploadMask(false)} sx={{marginTop:'10px'}}>
                Cancel
              </Button>
          </WorkspaceOverlay>
      }
      { pendingMessage && 
          <WorkspaceOverlay>
              <Typography gutterBottom variant="body2" color="lightgrey">
                {pendingMessage}
              </Typography>
              <CircularProgress variant="indeterminate" />
          </WorkspaceOverlay>
      }
    </Box>
  );
}

CollectionsManage.propTypes = {
  loadingCollections:     PropTypes.bool.isRequired,
  selectedCollection:     PropTypes.string,
  onSelectionChange:      PropTypes.func.isRequired,
  onEditUpload:           PropTypes.func.isRequired,
  searchSetup:            PropTypes.func.isRequired,
  onUploadUpdateMetadata: PropTypes.func.isRequired,
};

CollectionsManage.defaultProps = {
  selectedCollection: null,
};
