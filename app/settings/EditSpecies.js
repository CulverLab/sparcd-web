/** @module components/EditSpecies */

import * as React from 'react';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

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
  const speciesKeybindRef = React.useRef(null);
  const speciesNameRef = React.useRef(null);
  const speciesSciNameRef = React.useRef(null);
  const speciesUrlRef = React.useRef(null);
  const addMessage = React.useContext(AddMessageContext); // Function adds messages for display
  const defaultUrl = React.useContext(DefaultImageIconURL); // What to use when an icon url isn't specied
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

    if (speciesNameRef.current) {
      updatedData.name = speciesNameRef.current.value;
      if (updatedData.name.length < 3) {
        addMessage(Level.Warning, "Please enter a longer name")
        speciesNameRef.current.focus();
        return;
      }
    }

    if (speciesSciNameRef.current) {
      updatedData.scientificName = speciesSciNameRef.current.value;
      if (updatedData.scientificName.length <= 0) {
        addMessage(Level.Warning, "Please enter a scientific name")
        speciesSciNameRef.current.focus();
        return;
      }
    }

    if (speciesKeybindRef.current) {
      updatedData.keyBinding = speciesKeybindRef.current.value;
    }

    if (speciesUrlRef.current) {
      updatedData.speciesIconURL = speciesUrlRef.current.value;
      if (!updatedData.speciesIconURL) {
        updatedData.speciesIconURL = defaultUrl;
      }
    }

    onUpdate(updatedData, onClose, (message) => addMessage(Level.Warning, message));
  }

  return (
   <Grid sx={{minWidth:'50vw'}} > 
    <Card id="edit-species" sx={{backgroundColor:'#EFEFEF', border:"none", boxShadow:"none"}} >
      <CardHeader id='edit-species-header' title={
                    <Grid container direction="row" alignItems="start" justifyContent="start" sx={{flexWrap:'nowrap'}}>
                      <Grid>
                        <Typography gutterBottom variant="h6" component="h4" noWrap>
                          Edit Species
                        </Typography>
                      </Grid>
                      <Grid sx={{marginLeft:'auto'}} >
                        <div onClick={onClose}>
                          <Tooltip title="Close without saving">
                            <Typography gutterBottom variant="body2" noWrap
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
                slotProps={{
                  input:{inputRef:speciesNameRef},
                  htmlInput: {style:{fontSize:12}},
                  inputLabel: {shrink: true},
                }}
                />
          <TextField disabled={!!data}
                id='edit-species-scientific'
                label="Scientific Name"
                defaultValue={data ? data.scientificName : null}
                size='small'
                sx={{margin:'10px'}}
                onChange={() => setIsModified(true)}
                slotProps={{
                  input:{inputRef:speciesSciNameRef},
                  htmlInput: {style:{fontSize:12}},
                  inputLabel: {shrink: true},
                }}
                />
          <TextField 
                id='edit-species-keybind'
                label="Keybinding"
                defaultValue={data ? data.keyBinding : null}
                size='small'
                sx={{margin:'10px'}}
                onChange={() => setIsModified(true)}
                slotProps={{
                  input:{inputRef:speciesKeybindRef},
                  htmlInput: {style:{fontSize:12}, maxLength:1},
                  inputLabel: {shrink: true},
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
                slotProps={{
                  input:{inputRef:speciesUrlRef},
                  htmlInput: {style:{fontSize:12}},
                  inputLabel: {shrink: true},
                }}
                />
        </Grid>          
        </CardContent>
        <CardActions id='filter-content-actions'>
          <Button sx={{flex:1}} disabled={!isModified} onClick={onSaveChanges}>Save</Button>
          <Button sx={{flex:1}} onClick={onClose} >Cancel</Button>
        </CardActions>
    </Card>
  </Grid>
  );
}

EditSpecies.propTypes = {
  data: PropTypes.shape({
    name:           PropTypes.string,
    scientificName: PropTypes.string,
    keyBinding:     PropTypes.string,
    speciesIconURL: PropTypes.string,
  }),
  onUpdate: PropTypes.func.isRequired,
  onClose:  PropTypes.func.isRequired,
};

EditSpecies.defaultProps = {
  data: null,
};
