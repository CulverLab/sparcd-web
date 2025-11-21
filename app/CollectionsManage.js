/** @module CollectionsManage */

import * as React from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import BorderColorOutlinedIcon from '@mui/icons-material/BorderColorOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import CircularProgress from '@mui/material/CircularProgress';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import { CollectionsInfoContext, NarrowWindowContext, SizeContext } from './serverInfo';
import UploadSidebarItem from './components/UploadSidebarItem';

import { pad } from './utils';

/**
 * Renders the UI for managing the list of uploaded folders
 * @function
 * @param {boolean} loadingCollections Indicates if collections are being loaded
 * @param {object} selectedCollection The currently selected collection
 * @param {function} onEditUpload Called when the user wants to edit an upload of a collection
  * @param {function} searchSetup Call when settting up or clearing search elements
* @returns {object} The rendered UI
 */
export default function CollectionsManage({loadingCollections, selectedCollection, onEditUpload, searchSetup}) {
  const theme = useTheme();
  const sidebarRef = React.useRef();
  const collectionsItems = React.useContext(CollectionsInfoContext);
  const narrowWindow = React.useContext(NarrowWindowContext);
  const uiSizes = React.useContext(SizeContext);
  const [expandedUpload, setExpandedUpload] = React.useState(false);
  const [searchIsSetup, setSearchIsSetup] = React.useState(false);
  const [selectionIndex, setSelectionIndex] = React.useState(-1);
  const [sidebarWidth, setSidebarWidth] =  React.useState(200);// Default value is recalculated at display time
  const [totalHeight, setTotalHeight] = React.useState(null);  // Default value is recalculated at display time
  const [windowSize, setWindowSize] = React.useState({width: 640, height: 480});  // Default values are recalculated at display time
  const [workingTop, setWorkingTop] = React.useState(null);    // Default value is recalculated at display time
  const [workspaceWidth, setWorkspaceWidth] = React.useState(640);  // Default value is recalculated at display time

  // Setup search
  React.useLayoutEffect(() => {
    if (!searchIsSetup) {
      searchSetup('Collection Name', handleCollectionSearch);
      setSearchIsSetup(true);
    }
  }, [searchIsSetup]);

  // Initialize collections information
  React.useEffect(() => {
    if (collectionsItems && selectedCollection && (selectionIndex == -1 || selectionIndex >= collectionsItems.length)) {
      setSelectionIndex(collectionsItems.findIndex((item) => item.name === selectedCollection));
    }
  }, [collectionsItems, selectedCollection, selectionIndex, setSelectionIndex]);

  // Recalcuate available space in the window
  React.useLayoutEffect(() => {
    setWindowSize(uiSizes.window);
    calcTotalSize(uiSizes);
  }, [narrowWindow, uiSizes]);


   // Scrolls the selected collection into view
  React.useLayoutEffect(() => {
    if (selectionIndex >= 0 && selectionIndex < collectionsItems.length) {
      const collectionName = collectionsItems[selectionIndex].name;
      let el = document.getElementById("collection-"+collectionName);
      if (el) {
        el.scrollIntoView({behavior: 'instant', block: 'center', inline: 'center'});
      }
    }
  }, [selectionIndex])


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
    if (foundCollections) {
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
   * Handler for when the user's selection changes and prevents default behavior
   * @function
   * @param {object} event The event
   * @param {string} bucket The bucket of the new selected collection
   * @param {string} id The ID of the new selected collection
   */
  function onCollectionChange(event, bucket, id) {
    event.preventDefault();
    setSelectionIndex(collectionsItems.findIndex((item) => item.bucket === bucket && item.id === id));
  }

  /**
   * Calculates the total UI size available for the workarea
   * @function
   * @param {object} curSizes The working sizes of the UI layout
   */
  function calcTotalSize(curSizes) {
    setTotalHeight(uiSizes.workspace.height);
    setWorkingTop(uiSizes.workspace.top);

    let curSidebarWidth = 0;
    if (sidebarRef.current) {
      curSidebarWidth = sidebarRef.current.offsetWidth;
      setSidebarWidth(curSidebarWidth);
    }

    setWorkspaceWidth(uiSizes.workspace.width - curSidebarWidth);
  }

  /**
   * Formats the upload timestamp for display
   * @function
   * @param {object} upload_ts The timestamp object from an upload
   * @returns {str} Returns the formatted timestamp string
   */
  function getLastUploadDate(upload_ts) {
    let return_str = '';
    if (upload_ts) {
      if (upload_ts.date) {
        if (upload_ts.date.year)
          return_str += pad(upload_ts.date.year);
        else
          return_str += 'XXXX';
        if (upload_ts.date.month)
          return_str += '-' + pad(upload_ts.date.month, 2, 0);
        else
          return_str += '-XX';
        if (upload_ts.date.day)
          return_str += '-' + pad(upload_ts.date.day, 2, 0);
        else
          return_str += '-XX';
      }

      if (upload_ts.time) {
        if (upload_ts.time.hour !== null)
          return_str += ' ' + pad(upload_ts.time.hour, 2, 0);
        else
          return_str += ' XX'
        if (upload_ts.time.minute !== null)
          return_str += ':' + pad(upload_ts.time.minute, 2, 0);
        else
          return_str += ':XX'
        if (upload_ts.time.second !== null)
          return_str += ':' + pad(upload_ts.time.second, 2, 0);
        else
          return_str += ':XX'
      }
    }

    if (return_str.length <= 0)
      return_str = 'No last upload date';

    return return_str;
  }

  // Check if we need to specify variables that aren't setup yet
  let curSelectionIndex = selectionIndex;
  if (curSelectionIndex == -1 && collectionsItems && selectedCollection) {
    curSelectionIndex = collectionsItems.findIndex((item) => item.name === selectedCollection);
    setSelectionIndex(curSelectionIndex);
  }


/*

      <Grid id='collection-workspace' container direction="row" alignItems="start" justifyContent="start"
            columnSpacing={2}
            rowSpacing={1}
            style={{ maxHeight:curHeight,
                     maxWidth:workspaceWidth + 'px',
                     minWidth:workspaceWidth + 'px',
                     paddingTop: '10px',
                     overflow:'scroll',
                     margin: '0px',
                     paddingLeft: '5px',
                     background:'linear-gradient(135deg, #83a9c8 0%, #bad7ec 50%, #9eb7d8 100%)'}}
        >
        { collectionsItems && collectionsItems.map((item, idx) =>
          <Grid key={'collection-'+item.name+'-'+idx} >
                <Grid display='flex' justifyContent='left' size='grow' >
                  <Card id={"collection-"+item.name}
                        onClick={(event) => onCollectionChange(event, item.bucket, item.id)}
                        variant="outlined"
                        data-active={selectionIndex === idx ? '' : undefined}
                        sx={{border:'2px solid rgba(128, 128, 185, 0.5)', borderRadius:'15px', minWidth:'400px', maxWidth:'400px',
                              backgroundColor:'rgba(218, 232,242,0.7)',
                              '&[data-active]': {borderColor:'rgba(155, 175, 202, 0.85)'},
                              '&:hover':{backgroundColor:'rgba(185, 185, 185, 0.25)'} }}>
                    <CardActionArea data-active={selectionIndex === idx ? '' : undefined}
                      sx={{height: '100%',  '&[data-active]': {backgroundColor:'rgba(64, 64, 64, 0.23)'} }}
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
      <Grid id='collection-workspace-details' ref={sidebarRef} container direction="column" alignItems="start" justifyContent="start" wrap="nowrap"
            sx={{minWidth:'440px', maxWidth:'440px'}}
      >
        { curCollection && curCollection.uploads.map((item, idx) =>
          <Card id={"collection-upload-"+item.name} key={'collection-'+idx} variant="outlined" 
                sx={{minWidth:'100%', backgroundColor:'#D3DEE6', borderRadius:'10px', '&:hover':{backgroundColor:'rgba(0, 0, 0, 0.25)'} }}>
            <CardHeader title={
                              <Grid id="collection-card-header-wrapper" container direction="row" alignItems="start" justifyContent="start" wrap="nowrap">
                                <Grid>
                                  <Typography gutterBottom variant="h6" component="h4" noWrap="true">
                                    {item.name}
                                  </Typography>
                                </Grid>
                                <Grid sx={{marginLeft:'auto'}}>
                                  <Tooltip title="Edit this upload">
                                    <IconButton aria-label="Edit this upload" onClick={() => onEditUpload(curCollection.id, item.key, "Collections")}>
                                      <BorderColorOutlinedIcon fontSize="small"/>
                                    </IconButton>
                                  </Tooltip>
                                </Grid>
                              </Grid>
                              }
                          style={{paddingBottom:'0px'}}
            />
            <CardContent sx={{paddingTop:'0px'}}>
              <Accordion expanded={expandedUpload === 'upload-details-'+item.name}
                         onChange={handleExpandedChange('upload-details-'+item.name)}
                         sx={{backgroundColor:'#BFCBE1'}}>
                <AccordionSummary
                  id={'summary-'+item.name}
                  expandIcon={<ExpandMoreIcon />}
                  aria-controls="upload-details-content"
                >
                  <Typography component="span">
                    Advanced details
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{backgroundColor:'#C8D2E4'}}>
                  <Grid container id={'collection-upload-'+item.name} direction="column" alignItems="start" justifyContent="start">
                    <Grid sx={{padding:'5px 0'}}>
                      <Typography variant="body2">
                        {item.imagesWithSpeciesCount + '/' + item.imagesCount + ' images tagged with species'}
                      </Typography>
                    </Grid>
                    <Grid sx={{padding:'5px 0'}}>
                      <Typography variant="body2">
                        {item.description}
                      </Typography>
                    </Grid>
                    <Grid sx={{padding:'5px 0'}}>
                      <Typography variant="body2">
                        Uploaded folder{item.folders.length > 1 ? 's' : ''}: {item.folders.join(", ")}
                      </Typography>
                    </Grid>
                    <Grid>
                      <Typography variant="body2" sx={{fontWeight:'500'}}>
                        Edits
                      </Typography>
                    </Grid>
                  </Grid>
                  <Box sx={{border:"1px solid black", width:'100%', minHeight:'4em', maxHeight:'4em', overflow:"scroll"}} >
                    {item.edits.map((editItem, idx) =>
                      <Typography variant="body2" key={"collection-upload-edits-" + idx} sx={{padding:"0 5px"}} >
                        {editItem}
                      </Typography>
                    )}
                  </Box>
                </AccordionDetails>
              </Accordion>
            </CardContent>
          </Card>
        )}
      </Grid>

*/ 

  // Render the UI
  const curHeight = (totalHeight || 480) + 'px';
  const curStart = (workingTop || 25) + 'px';
  const curCollection = collectionsItems && curSelectionIndex >= 0 ? collectionsItems[curSelectionIndex] : {uploads: []};
  return (
    <Box id='collection-manage-workspace-wrapper'>
      <Grid id='collection-manage-workspace' container direction='row' alignItems='start' justifyContent='start' sx={{ width:'100vw' }} columns={48}>
        <div id='collection-manage-workspace-collections-wrapper' 
                style={{minWidth:'calc(100vw - 460px', maxWidth:'calc(100vw - 460px)', maxHeight:curHeight, paddingLeft:'10px', overflowY:'scroll'}}>
          <Grid id='collection-manage-workspace-collections-details' container direction="row">
            { collectionsItems && collectionsItems.map((item, idx) =>
              <Grid key={'collection-'+item.name+'-'+idx} >
                    <Grid display='flex' justifyContent='left' size='grow' >
                      <Card id={"collection-"+item.name}
                            onClick={(event) => onCollectionChange(event, item.bucket, item.id)}
                            variant="outlined"
                            data-active={selectionIndex === idx ? '' : undefined}
                            sx={{border:'2px solid rgba(128, 128, 185, 0.5)', borderRadius:'15px', minWidth:'400px', maxWidth:'400px',
                                  backgroundColor:'rgba(218, 232,242,0.7)',
                                  '&[data-active]': {borderColor:'rgba(155, 175, 202, 0.85)'},
                                  '&:hover':{backgroundColor:'rgba(185, 185, 185, 0.25)'} }}>
                        <CardActionArea data-active={selectionIndex === idx ? '' : undefined}
                          sx={{height: '100%',  '&[data-active]': {backgroundColor:'rgba(64, 64, 64, 0.23)'} }}
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
        <div id='collection-manage-workspace-uploads-wrapper' style={{minWidth:'460px', maxWidth:'446px', maxHeight:curHeight, paddingRight:'10px', overflowY:"scroll"}}>
          <Grid id='collection-manage-workspace-uploads-details' container direction="column" alignItems='start' justifyContent="start">
            { curCollection && curCollection.uploads.map((item, idx) =>
              <Card id={"collection-upload-"+item.name} key={'collection-'+idx} variant="outlined" 
                    sx={{minWidth:'100%', backgroundColor:'#D3DEE6', borderRadius:'10px', '&:hover':{backgroundColor:'rgba(0, 0, 0, 0.25)'} }}>
                <CardHeader title={
                                  <Grid id="collection-card-header-wrapper" container direction="row" alignItems="start" justifyContent="start" wrap="nowrap">
                                    <Grid>
                                      <Typography gutterBottom variant="h6" component="h4" noWrap="true">
                                        {item.name}
                                      </Typography>
                                    </Grid>
                                    <Grid sx={{marginLeft:'auto'}}>
                                      <Tooltip title="Edit this upload">
                                        <IconButton aria-label="Edit this upload" onClick={() => onEditUpload(curCollection.id, item.key, "Collections")}>
                                          <BorderColorOutlinedIcon fontSize="small"/>
                                        </IconButton>
                                      </Tooltip>
                                    </Grid>
                                  </Grid>
                                  }
                              style={{paddingBottom:'0px'}}
                />
                <CardContent sx={{paddingTop:'0px'}}>
                  <Accordion expanded={expandedUpload === 'upload-details-'+item.name}
                             onChange={handleExpandedChange('upload-details-'+item.name)}
                             sx={{backgroundColor:'#BFCBE1'}}>
                    <AccordionSummary
                      id={'summary-'+item.name}
                      expandIcon={<ExpandMoreIcon />}
                      aria-controls="upload-details-content"
                    >
                      <Typography component="span">
                        Advanced details
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{backgroundColor:'#C8D2E4'}}>
                      <Grid container id={'collection-upload-'+item.name} direction="column" alignItems="start" justifyContent="start">
                        <Grid sx={{padding:'5px 0'}}>
                          <Typography variant="body2">
                            {item.imagesWithSpeciesCount + '/' + item.imagesCount + ' images tagged with species'}
                          </Typography>
                        </Grid>
                        <Grid sx={{padding:'5px 0'}}>
                          <Typography variant="body2">
                            {item.description}
                          </Typography>
                        </Grid>
                        <Grid sx={{padding:'5px 0'}}>
                          <Typography variant="body2">
                            Uploaded folder{item.folders.length > 1 ? 's' : ''}: {item.folders.join(", ")}
                          </Typography>
                        </Grid>
                        <Grid>
                          <Typography variant="body2" sx={{fontWeight:'500'}}>
                            Edits
                          </Typography>
                        </Grid>
                      </Grid>
                      <Box sx={{border:"1px solid black", width:'100%', minHeight:'4em', maxHeight:'4em', overflow:"scroll"}} >
                        {item.edits.map((editItem, idx) =>
                          <Typography variant="body2" key={"collection-upload-edits-" + idx} sx={{padding:"0 5px"}} >
                            {editItem}
                          </Typography>
                        )}
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                </CardContent>
              </Card>
            )}
          </Grid>
        </div>
      </Grid>
      { loadingCollections && 
          <Grid id="loading-collections-wrapper" container direction="row" alignItems="center" justifyContent="center" 
                sx={{position:'absolute', top:0, left:0, width:'100vw', height:'100vh', backgroundColor:'rgb(0,0,0,0.5)', zIndex:11111}}
          >
            <div style={{backgroundColor:'rgb(0,0,0,0.8)', border:'1px solid grey', borderRadius:'15px', padding:'25px 10px'}}>
              <Grid container direction="column" alignItems="center" justifyContent="center" >
                  <Typography gutterBottom variant="body2" color="lightgrey">
                    Loading collections, please wait...
                  </Typography>
                  <CircularProgress variant="indeterminate" />
                  <Typography gutterBottom variant="body2" color="lightgrey">
                    This may take a while
                  </Typography>
              </Grid>
            </div>
          </Grid>
      }
    </Box>
  );
}
