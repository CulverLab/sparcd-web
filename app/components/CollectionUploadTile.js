'use client'

/** @module components/CollectionUploadTile */

import * as React from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import BorderColorOutlinedIcon from '@mui/icons-material/BorderColorOutlined';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton'
import ReplyOutlinedIcon from '@mui/icons-material/ReplyOutlined';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

/**
 * Header sub-component for CollectionUploadTile, memoized to prevent re-renders
 * when only accordion state changes in the parent.
 * @function
 * @param {string} name The name to display
 * @param {function} onUploadEdit Called when the user wants to edit this upload
 * @param {function} [onUploadMove] Called when the user wants to move an upload. If falsey the associated element
 *                                  is not added
 * @returns {object} The UI to render
 */
const UploadTileHeader = React.memo(function UploadTileHeader({name, onUploadEdit, onUploadMove}) {
  return (
    <Grid container direction="row" alignItems="start" justifyContent="start" wrap="nowrap">
      <Grid sx={{marginRight: 'auto'}} >
        <Typography variant="h6" component="h4" noWrap>
          {name}
        </Typography>
      </Grid>
      { onUploadMove &&
        <Grid>
          <Tooltip title="Move this upload">
            <IconButton aria-label="Move this upload" onClick={onUploadMove}>
              <ReplyOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Grid>
      }
      <Grid >
        <Tooltip title="Edit this upload">
          <IconButton aria-label="Edit this upload" onClick={onUploadEdit}>
            <BorderColorOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Grid>
    </Grid>
  );
});

UploadTileHeader.propTypes = {
  name:         PropTypes.string.isRequired,
  onUploadEdit: PropTypes.func.isRequired,
};

/**
 * Returns the UI for a collection upload
 * @function
 * @param {object} upload The upload to display
 * @param {string} key The item key
 * @param {boolean} active This tile is active when set to true
 * @param {boolean} expanded The details are expanded when set to true
 * @param {function} onUploadEdit Function to call when the upload is to be edited
 * @param {function} onExpandChange Function to call when the use expands or collapses the details
 * @param {function} [onEditDetails] When specified, enables editing upload details and is called if the user wants to edit details
 * @param {function} [`onUploadMove`] When specified, enables the icon to move an upload to another collection and called if the user wants to move an upload
 */
const CollectionUploadTile = React.memo(function CollectionUploadTile({upload, active, expanded, onUploadEdit, onExpandChange,
                                              onEditDetails, onUploadMove}) {
  return (
    <Card id={"collection-upload-item-"+upload.name} variant="outlined" 
          data-active={active ? '' : undefined}
          sx={{minWidth:'100%', backgroundColor:'#f6f7f8', color:'text.primary', borderColor:'#7f8c96', borderRadius:'6px',
                '&:hover':{backgroundColor:'#eeeeee'},
                '&[data-active]': {borderColor:'#4f6274', backgroundColor:'#e8ecef'},
                '&[data-active]:hover': { backgroundColor:'#e0e4e7' },
              }}
    >
      <CardHeader sx={{ pb: 0 }}
                  title={<UploadTileHeader name={upload.name} onUploadEdit={onUploadEdit} onUploadMove={onUploadMove} />} 
      />
      <CardContent sx={{ pt: 0 }}>
        <Accordion expanded={expanded}
                   onChange={onExpandChange}
                   sx={{backgroundColor:'#f1f3f5', color:'text.primary'}}>
          <AccordionSummary
            id={'summary-'+upload.name}
            expandIcon={<ExpandMoreIcon />}
            aria-controls={`upload-details-content-${upload.name}`}
          >
            <Typography component="span">
              Advanced details
            </Typography>
          </AccordionSummary>
          <AccordionDetails id={`upload-details-content-${upload.name}`} sx={{backgroundColor:'#f7f8f9', color:'text.primary'}}>
            <Grid container id={'collection-upload-'+upload.name} direction="column" alignItems="start" justifyContent="start">
              <Grid sx={{padding:'5px 0', width:'100%'}}>
                <Grid container direction="row" alignItems="start" justifyContent="space-between">
                  <Typography variant="body2">
                    {upload.imagesWithSpeciesCount + '/' + upload.imagesCount + ' images tagged with species'}
                  </Typography>
                  { onEditDetails &&
                        <IconButton onClick={onEditDetails} sx={{marginLeft:'auto'}}>
                          <EditNoteOutlinedIcon fontSize="small" />
                        </IconButton>
                  }
                </Grid>
              </Grid>
              <Grid sx={{padding:'5px 0'}}>
                <Typography variant="body2">
                  {upload.description}
                </Typography>
              </Grid>
              <Grid sx={{padding:'5px 0'}}>
                <Typography variant="body2" sx={{fontStyle:'italic'}}>
                  Uploaded folder{upload.folders.length > 1 ? 's' : ''}:
                </Typography>
                <Typography variant="body2" sx={{wordWrap:'break-word', wordBreak:'break-all'}}>
                  {upload.folders.join(", ")}
                </Typography>
              </Grid>
              <Grid>
                <Typography variant="body2" sx={{fontWeight:'500'}}>
                  Edits
                </Typography>
              </Grid>
            </Grid>
            <Box sx={{border:"1px solid black", width:'100%', minHeight:'4em', maxHeight:'4em', overflow:"scroll"}} >
              {upload.edits.map((editItem, idx) =>
                <Typography variant="body2" key={"collection-upload-edits-" + idx} sx={{padding:"0 5px"}} >
                  {editItem}
                </Typography>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>
      </CardContent>
    </Card>
    )
});


CollectionUploadTile.propTypes = {
  upload: PropTypes.shape({
    name:                   PropTypes.string.isRequired,
    description:            PropTypes.string,
    folders:                PropTypes.arrayOf(PropTypes.string),
    edits:                  PropTypes.arrayOf(PropTypes.string),
    imagesCount:            PropTypes.number,
    imagesWithSpeciesCount: PropTypes.number,
  }).isRequired,
  active:         PropTypes.bool,
  expanded:       PropTypes.bool,
  onUploadEdit:   PropTypes.func.isRequired,
  onExpandChange: PropTypes.func.isRequired,
  onEditDetails:  PropTypes.func,
};

CollectionUploadTile.defaultProps = {
  active:       false,
  expanded:     false,
  onEditDetails: null,
};

export default CollectionUploadTile;
