'use client'

/** @module components/SpeciesSidebarItem */

import * as React from 'react';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ZoomInOutlinedIcon from '@mui/icons-material/ZoomInOutlined';
import { useTheme } from '@mui/material/styles';

/**
 * Renders a single species item
 * @function
 * @param {object} species Contains the name, speciesIconURL, and keybinding for the species
 * @param {function} onKeybindClick Function to call when the species UI is clicked
 * @param {function} onZoomClick Handles zooming in on a species image
 * @returns {object} The rendered UI item
 */
export default function SpeciesSidebarItem({id, species, size, onKeybindClick, onZoomClick}) {
  const theme = useTheme();

  let cardSx = size === "small" ? {'maxWidth':'120px'} : {'maxWidth':'200px'}
  let mediaSx = size === "small" ? theme.palette.species_sidebar_item_media_small : theme.palette.species_sidebar_item_media;
  let nameSx = size === "small" ? {fontSize:"xx-small"} : {};

  function getCardActions() {
    if (size === "small") {
      return (
        <CardActions>
          <Stack spacing={1}>
            <Typography variant='body3' nowrap='true' sx={{ flex:'1',color:'text.primary'}}>
              {species.name}
            </Typography>
            <Button sx={{flex:'1'}} style={{marginTop:'0px', fontSize:"x-small"}} size="small" onClick={(event)=>onKeybindClick(event)}>
              {species.keyBinding == null ? "Keybind" : (species.keyBinding == ' ' ? "<SPACE>" : "<" + species.keyBinding + ">")}
            </Button>
          </Stack>
        </CardActions>
      );
    } else {
      return (
        <CardActions>
          <Typography variant='body3' nowrap='true' sx={{ flex:'1',color:'text.primary'}}>
            {species.name}
          </Typography>
          <Button sx={{flex:'1'}} size="small" onClick={(event)=>onKeybindClick(event)}>
            {species.keyBinding == null ? "Keybind" : (species.keyBinding == ' ' ? "<SPACE>" : "<" + species.keyBinding + ">")}
          </Button>
        </CardActions>
      );
    }
  }

  // Render the UI
  return (
    <Grid id={id} draggable='true' display='flex' justifyContent='left' size='grow' spacing='1' sx={cardSx}>
      <Card sx={{ ...theme.palette.species_sidebar_item }} >
        <div style={{position:'relative', display:'inline-block', cursor:'pointer'}}  onClick={(event)=>onZoomClick(event)}>
          <CardMedia
            sx={{...mediaSx}}
            image={species.speciesIconURL}
            title={species.name}
          />
          <div style={{position:'absolute', top:'5%', left:'5%'}}>
            <ZoomInOutlinedIcon sx={{color:'white', fontSize:30}}/>
          </div>
        </div>
        {getCardActions()}
      </Card>
    </Grid>
  );
}
