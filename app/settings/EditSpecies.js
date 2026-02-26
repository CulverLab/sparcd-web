/** @module components/EditSpecies */

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Checkbox from '@mui/material/Checkbox';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import { AddMessageContext, DefaultImageIconURL } from '../serverInfo';
import { Level } from '../components/Messages';

/**
 * Handles editing a species' entry
 * @function
 * @param {object} {data} The species data. If falsy a new species is assumed
 * @param {function} onUpdate Called to update the species information when changes made
 * @param {function} onClose Called when the editing is completed
 * @return {object} The UI for editing species
 */
export default function EditSpecies({data, onUpdate, onClose}) {
  const theme = useTheme();
  const addMessage = React.useContext(AddMessageContext); // Function adds messages for display
  const [isModified, setIsModified] = React.useState(false);

  /**
   * Handles saving the changes to the user
   * @function
   */
  function onSaveChanges() {
    if (!isModified) {
      return;
    }

    // Save the edited species data
    let updatedData = data ? JSON.parse(JSON.stringify(data)) : {};

    let el = document.getElementById('edit-species-name');
    if (el) {
      updatedData.name = el.value;
      if (updatedData.name.length < 3) {
        addMessage(Level.Warning, "Please enter a longer name")
        el.focus();
        return;
      }
    }

    el = document.getElementById('edit-species-scientific');
    if (el) {
      updatedData.scientificName = el.value;
      if (updatedData.scientificName.length <= 0) {
        addMessage(Level.Warning, "Please enter a scientific name")
        el.focus();
        return;
      }
    }

    el = document.getElementById('edit-species-keybind');
    if (el) {
      updatedData.keyBinding = el.value;
    }

    el = document.getElementById('edit-species-url');
    if (el) {
      updatedData.speciesIconURL = el.value;
      if (!updatedData.speciesIconURL) {
        updatedData.speciesIconURL = DefaultImageIconURL;
      }
    }

    onUpdate(updatedData, onClose, (message) => addMessage(Level.Warning, message));
  }

  return (
   <Grid sx={{minWidth:'50vw'}} > 
    <Card id="edit-species" sx={{backgroundColor:'#EFEFEF', border:"none", boxShadow:"none"}} >
      <CardHeader id='edit-species-header' title={
                    <Grid container direction="row" alignItems="start" justifyContent="start" wrap="nowrap">
                      <Grid>
                        <Typography gutterBottom variant="h6" component="h4" noWrap="true">
                          Edit Species
                        </Typography>
                      </Grid>
                      <Grid sx={{marginLeft:'auto'}} >
                        <div onClick={onClose}>
                          <Tooltip title="Close without saving">
                            <Typography gutterBottom variant="body2" noWrap="true"
                                        sx={{textTransform:'uppercase',
                                        color:'grey',
                                        cursor:'pointer',
                                        fontWeight:'500',
                                        backgroundColor:'rgba(0,0,0,0.03)',
                                        padding:'3px 3px 3px 3px',
                                        borderRadius:'3px',
                                        '&:hover':{backgroundColor:'rgba(255,255,255,0.7)', color:'black'}
                                     }}
                            >
                                <CloseOutlinedIcon fontSize="small" />
                            </Typography>
                          </Tooltip>
                        </div>
                      </Grid>
                    </Grid>
                    }
                style={{paddingTop:'0px', paddingBottom:'0px'}}
      />
      <CardContent id='edit-species-details' sx={{paddingTop:'0px', paddingBottom:'0px'}}>
        <Grid container direction="column" justifyContent="start" alignItems="stretch"
              sx={{minWidth:'400px', border:'1px solid black', borderRadius:'5px', backgroundColor:'rgb(255,255,255,0.3)' }}>
          <TextField required
                id='edit-species-name'
                label="Name"
                defaultValue={data ? data.name : null}
                size='small'
                sx={{margin:'10px'}}
                onChange={() => setIsModified(true)}
                inputProps={{style: {fontSize: 12}}}
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                }}
                />
          <TextField disabled={!!data}
                id='edit-species-scientific'
                label="Scientific Name"
                defaultValue={data ? data.scientificName : null}
                size='small'
                sx={{margin:'10px'}}
                onChange={() => setIsModified(true)}
                inputProps={{style: {fontSize: 12}}}
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                }}
                />
          <TextField 
                id='edit-species-keybind'
                label="Keybinding"
                defaultValue={data ? data.keyBinding : null}
                size='small'
                sx={{margin:'10px'}}
                onChange={() => setIsModified(true)}
                inputProps={{maxLength:1, style: {fontSize: 12}}}
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                }}
                />
          <TextField 
                id='edit-species-url'
                label="Icon URL"
                type='url'
                defaultValue={data ? data.speciesIconURL : null}
                size='small'
                sx={{margin:'10px'}}
                onChange={() => setIsModified(true)}
                inputProps={{style: {fontSize: 12}}}
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                }}
                />
        </Grid>          
        </CardContent>
        <CardActions id='filter-content-actions'>
          <Button sx={{flex:'1', disabled:isModified === false }} onClick={onSaveChanges}>Save</Button>
          <Button sx={{flex:'1'}} onClick={onClose} >Cancel</Button>
        </CardActions>
    </Card>
  </Grid>
  );
}