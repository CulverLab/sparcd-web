/** @module components/InputSlider */

import * as React from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import MuiInput from '@mui/material/Input';
import PropTypes from 'prop-types';
import Slider from '@mui/material/Slider';
import { styled } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

// Width of the input field
const Input = styled(MuiInput)`
  width: 42px;
`;

/**
 * Slider with input field implementation
 * @function
 * @param {string} label The label for the slider
 * @param {function} onChange Function to call when the value changes
 * @param {number} curValue The value of the control
 * @param {string} [width='350px'] Optional width of the container
 * @param {string} [paddingRight='5px'] Optional right padding of the container
 * @returns {object} The rendered UI
 */
export default function InputSlider({label, onChange, curValue, width = '350px', paddingRight = '5px'}) {
  const [value, setValue] = React.useState(curValue);

  // Some local variables
  const sliderId = `input-slider-${label.toLowerCase().replace(/\s+/g, '-')}`;

  // Update the current value when it changes
  React.useEffect(() => {
    setValue(curValue);
  }, [curValue]);
  /**
   * Stores the new value when the slider was changed
   * @function
   * @param {object} event The triggering event
   * @param {number} newValue The new value
   */
  const handleSliderChange = (event, newValue) => {
    setValue(newValue);
    onChange(newValue);
  }

  /**
   * Stores the new value when the input field is modified
   * @function
   * @param {object} event The triggering event
   */
  function handleInputChange(event) {
    const newValue = event.target.value === '' ? 0 : Number(event.target.value);
    setValue(newValue);
    onChange(newValue);
  }

  /**
   * Adjusts the value boundaries as needed when focus is lost
   * @function
   */
  function handleBlur() {
    if (value < 0) {
      setValue(0);
      onChange(0);
    } else if (value > 100) {
      setValue(100);
      onChange(100);
    }
  }

  // Return the rendered UI
  return (
    <Box sx={{ width, paddingRight }}>
      <Grid container alignItems="center" justifyContent="space-between">
        <Grid size={3}>
          <Typography id={sliderId} gutterBottom>
            {label}
          </Typography>
        </Grid>
        <Grid size={6}>
          <Slider
            value={typeof value === 'number' ? value : 0}
            onChange={handleSliderChange}
            aria-labelledby={sliderId}
          />
        </Grid>
        <Grid>
          <Input
            value={value}
            size="small"
            onChange={handleInputChange}
            onBlur={handleBlur}
            inputProps={{
              step: 1,
              min: 0,
              max: 100,
              type: 'number',
              'aria-labelledby':sliderId,
            }}
          />
        </Grid>
      </Grid>
    </Box>
  );
}

InputSlider.propTypes = {
  label: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  curValue: PropTypes.number.isRequired,
  width: PropTypes.string,
  paddingRight: PropTypes.string,
};
