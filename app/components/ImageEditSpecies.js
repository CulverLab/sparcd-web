/** @module components/ImageEditSpecies */

import * as React from 'react';
import ArrowBackIosOutlinedIcon from '@mui/icons-material/ArrowBackIosOutlined';
import ArrowForwardIosOutlinedIcon from '@mui/icons-material/ArrowForwardIosOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import HighlightOffOutlinedIcon from '@mui/icons-material/HighlightOffOutlined';
import MuiInput from '@mui/material/Input';
import { styled } from '@mui/material/styles';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { SpeciesInfoContext } from '../serverInfo';
import InputSlider from './InputSlider';

// Width of the input field
const Input = styled(MuiInput)`
  width: 42px;
`;

/**
 * Returns the UI for the species associated with an image
 * @function
 * @param {string} name The species name
 * @param {number} count The number associated with the species name
 * @param {function} onDelete The function to handle deleting the species
 * @param {function} onChange Function called when species count value changes
 * @param {function} onBlur Function called when the input control loses focus
 * @returns {object} The UI for a spceies count
 */
export default function ImageEditSpecies({name, count, onDelete, onChange, onBlur}) {

  return (
    <Grid id={'image-edit-species-'+name} key={'image-edit-species-'+name} container direction="row"  alignItems="center"
          sx={{padding:'0px 5px 0px 5px', width:'200px', color:'#4f4f4f',
             backgroundColor:'rgba(255,255,255,0.45)', '&:hover':{backgroundColor:'rgba(255,255,255,0.8)',color:'black'},
             borderRadius:'5px', minWidth:'400px'
          }}
          style={{height:'2em'}}
    >
          <Grid size={8}>
              <Typography id={"species-name-"+name} variant="body" sx={{textTransform:'Capitalize',color:'inherit'}}>
                {name}
              </Typography>
          </Grid>
          <Grid sx={{marginLeft:'auto'}}>
              <Input
                value={count}
                size="small"
                onChange={(event) => onChange(event, name)}
                onBlur={(event) => onBlur(event, name)}
                inputProps={{
                  step: 1,
                  min: 0,
                  max: 100,
                  type: 'number',
                  'aria-labelledby':"species-name-"+name,
                }}
                sx={{flex:'6', position:'relative', marginLeft:'auto', color:'inherit'}}
              />
          </Grid>
      <Grid sx={{marginLeft:'auto'}} size={1}>
        <HighlightOffOutlinedIcon color='inherit' onClick={() => onDelete(name)}/>
      </Grid>
    </Grid>
  );
}
