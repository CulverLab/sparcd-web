/** @module tagging/AdjustTimestamp */

import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import DoubleArrowOutlinedIcon from '@mui/icons-material/DoubleArrowOutlined';
import Grid from '@mui/material/Grid';
import MuiInput from '@mui/material/Input';
import Stack from '@mui/material/Stack';
import { styled } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

// Width of the input field
const Input = styled(MuiInput)`
  width: 42px;

  input[type=number] {
    -moz-appearance: textfield;
  }

  input[type=number]::-webkit-outer-spin-button,
  input[type=number]::-webkit-inner-spin-button {
    -webkit-appearance: inner-spin-button;
    opacity: 1;
  }
`;

export const EDIT_FIELD = {
  YEAR:   0,
  MONTH:  1,
  DAY:    2,
  HOUR:   3,
  MINUTE: 4,
  SECOND: 5,
};

// Configuration for all the fields
const FIELD_CONFIG = [
  { id: EDIT_FIELD.YEAR,   label: 'Year',   min: -100, max: 100 },
  { id: EDIT_FIELD.MONTH,  label: 'Month',  min: -12,  max: 12  },
  { id: EDIT_FIELD.DAY,    label: 'Day',    min: -31,  max: 31  },
  { id: EDIT_FIELD.HOUR,   label: 'Hour',   min: -24,  max: 24  },
  { id: EDIT_FIELD.MINUTE, label: 'Minute', min: -60,  max: 60  },
  { id: EDIT_FIELD.SECOND, label: 'Second', min: -60,  max: 60  },
];
const lang = navigator.language || navigator.languages[0];

/**
 * Function to handle the user wanting to change the timestamp in the images
 * @function
 * @param {array} images The array of images to adjust the timestamp for
 * @returns {object} The rendered UI
 */
export default function AdjustImageTimestamp({images, onUpdate, onCancel}) {
  const theme = useTheme();
  const [adjustments, setAdjustments] = React.useState([0, 0, 0, 0, 0, 0]);

  // We adjust the timestamp based upon the earliest time
const earliestTimestamp = React.useMemo(() => {
  // Return the difference if we have two timestamps, otherwise have they empty one be last
  const sorted = [...(images ?? [])].sort((a, b) => a.timestamp && b.timestamp ? a.timestamp - b.timestamp : a ? 1 : -1);
  return sorted.length > 0 ? sorted[0].timestamp : null;
}, [images]);

  // Derive the timestamp from adjustments instead of storing it separately
  const curTimestamp = React.useMemo(() => new Date(
    earliestTimestamp.getFullYear() + adjustments[EDIT_FIELD.YEAR],
    earliestTimestamp.getMonth()    + adjustments[EDIT_FIELD.MONTH],
    earliestTimestamp.getDate()     + adjustments[EDIT_FIELD.DAY],
    earliestTimestamp.getHours()    + adjustments[EDIT_FIELD.HOUR],
    earliestTimestamp.getMinutes()  + adjustments[EDIT_FIELD.MINUTE],
    earliestTimestamp.getSeconds()  + adjustments[EDIT_FIELD.SECOND],
  ), [adjustments, earliestTimestamp]);

  /**
   * Function to handle the use wanting to save the changes
   * @function
   */
  const handleSave = React.useCallback(() => {
    onUpdate(adjustments);
  }, [adjustments, onUpdate]);

  /**
   * Handles the changing of an edit field
   * @function
   * @param {object} event The triggering event
   * @param {EDIT_STATE} fieldId The ID of the field being changed
   */
  const handleChange = React.useCallback((event, fieldId) => {
    const newValue = event.target.value === '' ? 0 : Number(event.target.value);
    if (fieldId < 0 || fieldId >= FIELD_CONFIG.length) {
      console.log(`WARNING: attempting to edit unknown field ${fieldId}`);
      return;
    }
    setAdjustments(prev => {
      const next = [...prev];
      next[fieldId] = newValue;
      return next;
    });
  }, []);

  // Make sure we have something for the user interface
  if (!earliestTimestamp) {
    return null;
  }
  return (
    <Dialog onClose={onCancel} open={true} fullWidth maxWidth='lg' sx={{ "& .MuiPaper-root":{backgroundColor: "white"} }} >
      <DialogTitle>Editing Image Date</DialogTitle>
      <DialogContent>
        <DialogContentText>
        Offset the timestamp{images ? 's' : ''} of the <span style={{fontWeight:'bold', fontSize:'larger'}} >{images ? images.length : 0}</span> images
        </DialogContentText>
        <Stack direction='column' alignItems='center' justifyContent='center'>
          <Stack direction='row' alignItems='center' justifyContent='center' sx={{paddingTop:'20px'}} >
            <Typography sx={{fontFamily:'serif', fontSize:'larger', paddingRight:'20px'}} >
              Example: 
            </Typography>
            <Typography sx={{fontSize:'larger', paddingRight:'20px'}} >
              {earliestTimestamp?.toLocaleString(lang, { hour12: false })}
            </Typography>
            <DoubleArrowOutlinedIcon />
            <Typography sx={{fontSize:'larger', paddingLeft:'20px'}} >
              {curTimestamp?.toLocaleString(lang, { hour12: false })}
            </Typography>
          </Stack>
          <Grid container direction='row' spacing={3} alignItems='center' justifyContent='space-between'
                  sx={{marginTop:'20px', padding:'10px 15px', border:'1px solid silver', borderRadius:'13px', backgroundColor:'rgb(220, 220, 220, 0.2)' }}
          >
            {FIELD_CONFIG.map(({id, label, min, max}) => (
              <Grid key={id} container direction='row' alignItems='center' justifyContent='space-between'>
                <Typography id={`image-adjust-${label.toLowerCase()}`}
                            sx={{textTransform:'Capitalize', color:'inherit', paddingRight:'10px'}}>
                  {label}:
                </Typography>
                <Input
                  value={adjustments[id]}
                  onChange={(event) => handleChange(event, id)}
                  inputProps={{
                    step: 1,
                    min,
                    max,
                    type: 'number',
                    'aria-labelledby': `image-adjust-${label.toLowerCase()}`,
                  }}
                  sx={{position:'relative', color:'inherit', backgroundColor:'white'}}
                />
              </Grid>
            ))}
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions>
       <Button variant='contained' onClick={handleSave}>Save</Button>
       <Button variant='contained' onClick={onCancel}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
