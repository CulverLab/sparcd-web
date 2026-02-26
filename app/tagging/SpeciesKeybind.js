'use client'

/** @module components/SpeciesKeybind */

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

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

  // If we don't have a parent X position, try and get one
  if (parentX === 0) {
    const el = document.getElementById(parentId);
    if (el) {
      setParentX(el.getBoundingClientRect().x);
    }
  }

  // Return the UI
  return (
    <Card sx={{backgroundColor:'rgb(255,255,255,0.8)'}}>
      <CardContent>
        <Typography gutterBottom sx={{ color: 'text.primary', fontSize: 14, textAlign: 'center' }} >
          Setting new keybinding for &nbsp;
          <span style={{ fontSize: 16, fontWeight:'bold'}} >
            {name}
          </span>
        </Typography>
        <Typography gutterBottom sx={{ color: 'text.primary', fontSize: 14, textAlign: 'center', fontWeight:'bold' }} >
          Press a key
        </Typography>
        <Typography gutterBottom variant='h5' sx={{ color: 'text.primary', textAlign: 'center' }} >
          {curKeybind ? (curKeybind === ' ' ? 'SPACE' : curKeybind) : '<none>'}
        </Typography>
      </CardContent>
      <CardActions>
        <Button sx={{flex:'1'}} onClick={() => {setCurKeybind(null);onChange(null);}}>Clear</Button>
        <Button sx={{flex:'1'}} onClick={() => {onChange(curKeybind);onClose();}}>Update</Button>
        <Button sx={{flex:'1'}} onClick={onClose}>Cancel</Button>
    </CardActions>
    </Card>
  );
}