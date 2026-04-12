'use client'

/** @module tagging/SpeciesKeybind */

import * as React from 'react';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';

import PropTypes from 'prop-types';

/**
 * Returns the UI for setting a binding key for a species
 * @function
 * @param {string} keybind The current keybind
 * @param {string} name The name of the species
 * @param {string} parentId Used when the window is resized to assist in positioning
 * @param {function} onClose The function to call when the user is dont with the keybinding
 * @param {function} onChange Called when a new keybinding is set or cleared
 * @returns {object} The UI for changing a species keybinding
 */
export default function SpeciesKeybind({keybind, name, parentId, onClose, onChange}) {
  const [parentX, setParentX] = React.useState(0);
  const [curKeybind, setCurKeybind] = React.useState(keybind);
  const [errorMessage, setErrorMessage] = React.useState(null);

  // Handler for when the window is resized
  React.useLayoutEffect(() => {
      function onResize () {
        const el = document.getElementById(parentId);
        if (el) {
          setParentX(el.getBoundingClientRect().x);
        }
      }

      window.addEventListener("resize", onResize);
  
      return () => {
          window.removeEventListener("resize", onResize);
      }
  }, [parentId]);

  // If we don't have a parent X position, try and get one
  React.useLayoutEffect(() => {
    if (parentX === 0) {
      const el = document.getElementById(parentId);
      if (el) {
        setParentX(el.getBoundingClientRect().x);
      }
    }
  }, [parentId]);

  // Captures the keypresses
  React.useEffect(() => {
    function onKeypress(event) {
      if (event.key !== 'Meta') {
        setCurKeybind(event.key.toUpperCase());
        event.preventDefault();
      }
    }
    document.addEventListener("keydown", onKeypress);

    return () => {
      document.removeEventListener("keydown", onKeypress);
    }
  }, []);

  /**
   * Handles the user setting the keybinding to a key
   * @function
   */
  const handleBindChange = React.useCallback(() => {
    setErrorMessage(null);

    const res = onChange(curKeybind);

    // Check for an error
    if (res) {
      setErrorMessage(res);
    } else {
      onClose();
    }
  }, [curKeybind, onChange, onClose]);

  // Return the UI
  return (
    <Card id="specied-keybind" sx={{backgroundColor:'rgb(255,255,255,0.8)'}}>
      <CardContent>
        <Typography gutterBottom sx={{ color: 'text.primary', fontSize: 14, textAlign:'center' }} >
          Setting new keybinding for &nbsp;
          <span style={{ fontSize: 16, fontWeight:'bold'}} >
            {name}
          </span>
        </Typography>
        { errorMessage && 
          <Typography gutterBottom variant='body2' sx={{textAlign:'center', color:'indianred' }} >
            {errorMessage}
          </Typography>
        }
        <Typography gutterBottom sx={{ color:'text.primary', fontSize: 14, textAlign: 'center', fontWeight:'bold' }} >
          Press a key
        </Typography>
        <Typography gutterBottom variant='h5' sx={{ color:'text.primary', textAlign:'center' }} >
          {curKeybind ? (curKeybind === ' ' ? 'SPACE' : curKeybind) : '<none>'}
        </Typography>
      </CardContent>
      <CardActions>
        <Button sx={{flex:1}} onClick={() => {setErrorMessage(null);setCurKeybind(null);}}>Clear</Button>
        <Button sx={{flex:1}} onClick={() => {handleBindChange();}}>Update</Button>
        <Button sx={{flex:1}} onClick={onClose}>Cancel</Button>
    </CardActions>
    </Card>
  );
}
SpeciesKeybind.propTypes = {
  keybind:  PropTypes.string,
  name:     PropTypes.string.isRequired,
  parentId: PropTypes.string,
  onClose:  PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
};

SpeciesKeybind.defaultProps = {
  keybind:  null,
  parentId: null,
};
