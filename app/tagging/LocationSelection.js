
import * as React from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import LocationItem from '../components/LocationItem'
import { UserSettingsContext } from '../serverInfo';
import { meters2feet } from '../utils';

/**
 * Returns the UI for selecting locations
 * @function
 * @param {string} title The title of the card
 * @param {array} locations The array of locations to choose from
 * @param {object} defaultLocation The current location
 * @param {function} onTTOpen Called when the tooltip is opened
 * @param {function} onTTClose Handler for when a tool tip closes
 * @param {object} dataTT Tooltip data
 * @param {function} onContinue Handler for when the user wants to keep the selection
 * @param {function} onCancel Handler for when the user wants to close this selection box
 * @returns {object} The UI of the location
 */
export default function LocationSelection({title, locations, defaultLocation, onTTOpen, onTTClose, dataTT, onContinue, onCancel}) {
  const theme = useTheme();
  const userSettings = React.useContext(UserSettingsContext);  // User display settings

  /**
   * Handles the user selecting a new location
   * @function
   */
  const handleContinue = React.useCallback(() => {
    const locEl = document.getElementById('upload-edit-location');
    if (!locEl) {
      console.log('ERROR: Unable to find edited location ID for updating');
      return;
    }

    // Find the new location entry
    const newLoc = locations.find((item) => item.idProperty == locEl.value);
    if (!newLoc) {
      console.log('ERROR: Unable to find full location for updating');
      return;
    }

    onContinue(newLoc);

  }, [locations, onContinue])

  let displayCoordSystem = 'LATLON';
  if (userSettings['coordinatesDisplay']) {
    displayCoordSystem = userSettings['coordinatesDisplay'];
  }

  return (
    <Card id='change-location' variant='outlined' sx={{...theme.palette.upload_edit_locations_card}}>
      <CardContent>
        <Typography variant="h5" sx={{ color:'text.primary', textAlign:'center' }}>
          {title}
        </Typography>
        <FormControl fullWidth>
          <Autocomplete
            options={locations}
            id="upload-edit-location"
            autoHighlight
            defaultValue={defaultLocation}
            getOptionLabel={(option) => option.idProperty}
            getOptionKey={(option) => option.idProperty+option.latProperty+option.lngProperty}
            renderOption={(props, loc) => {
              const { key, ...optionProps } = props;
              return (
                  <MenuItem id={loc.idProperty+'-'+key} value={loc.idProperty} key={key} {...optionProps}>
                    <LocationItem shortName={loc.idProperty} longName={loc.nameProperty}
                                  lat={displayCoordSystem === 'LATLON' ? loc.latProperty : loc.utm_x} 
                                  lng={displayCoordSystem === 'LATLON' ? loc.lngProperty: loc.utm_y} 
                                  elevation={userSettings['measurementFormat'] === 'feet' ? meters2feet(loc.elevationProperty) + 'ft' : loc.elevationProperty}
                                  coordType={displayCoordSystem === 'LATLON' ? undefined : loc.utm_code}
                                  onTTOpen={onTTOpen} onTTClose={onTTClose}
                                  dataTT={dataTT} propsTT={props}
                     />
                  </MenuItem> 
              );
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Location"
                slotProps={{
                  htmlInput: {
                    ...params.inputProps,
                    autoComplete: 'new-password', // disable autocomplete and autofill
                  },
                }}
              />
            )}
          >
          </Autocomplete>
        </FormControl>
      </CardContent>
      <CardActions>
        <Button sx={{'flex':'1'}} size="small" onClick={handleContinue} >Continue</Button>
        <Button sx={{'flex':'1'}} size="small" onClick={onCancel} >Cancel</Button>
      </CardActions>
    </Card>
  );
}
