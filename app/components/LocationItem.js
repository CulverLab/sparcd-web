/** @module components/LocationItem */

import * as React from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PropTypes from 'prop-types';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

/**
 * Returns the UI for a single location with tooltip. The tooltip information
 * is not displayed until the caller specifies that it's available by setting
 * the dataTT parameter to match the propsTT["data-option-index"] parameter field
 * @function
 * @param {string} shortName The short name, or ID, of the location
 * @param {string} longName The full name of the location
 * @param {number} lat The working latitude of the location
 * @param {number} lng The working longitude of the location
 * @param {number} elevation The working elevation of the location
 * @param {string} [coordType] Optional coordinate type string
 * @param {function} onTTOpen Handler for when a tool tip opens
 * @param {function} onTTClose Handler for when a tool tip closes
 * @param {object} dataTT Tooltip data
 * @param {object} propsTT Properties related to the tooltip
 * @returns {object} The UI of the location
 */
export default function LocationItem({shortName, longName, lat, lng, elevation, coordType, onTTOpen, onTTClose, dataTT, propsTT={}}) {
  const theme = useTheme();

  // Initialize some variables
  const coordPrefix = coordType ? `${coordType}: ` : '';
  const optionIndex = propsTT["data-option-index"];

  /**
   * Handler for tooltip opening
   * @function
   */
  const handleTTOpen  = React.useCallback(() => {
    onTTOpen(optionIndex);
  },  [onTTOpen,  propsTT]);

  /**
   * Handler for tooltip closing
   * @function
   */
  const handleTTClose = React.useCallback(() => {
    onTTClose(optionIndex);
  }, [onTTClose, propsTT]);

  return (
    <Grid container direction="row" justifyContent='space-between' sx={{width:'100%'}} >
      <Box display="flex" justifyContent="flex-start">
        {shortName}
      </Box>
      <Box display="flex" justifyContent="flex-end" >
        <Typography variant="body1" sx={{ fontSize:'small', overflow:"hidden"}}>
          {longName}
        </Typography>
        &nbsp;
        <Tooltip
          onOpen={handleTTOpen}
          onClose={handleTTClose}
          title={
            dataTT && dataTT.index === optionIndex ?
              <React.Fragment>
                <Typography color={theme.palette.text.primary} sx={{fontSize:'small'}}>{shortName}</Typography>
                <Typography color={theme.palette.text.primary} sx={{fontSize:'x-small'}}>{`${coordPrefix}${lat}, ${lng}`}</Typography>
                <Typography color={theme.palette.text.primary} sx={{fontSize:'x-small'}}>{`Elevation: ${elevation}`}</Typography>
              </React.Fragment>
              : 
              <React.Fragment>
                <Typography color={theme.palette.text.secondary} sx={{fontSize:'small'}}>{shortName}</Typography>
                <Typography color={theme.palette.text.secondary} sx={{fontSize:'x-small'}}>{"------, ------"}</Typography>
                <Typography color={theme.palette.text.secondary} sx={{fontSize:'x-small'}}>{'Elevation: ----'}</Typography>
                <Box sx={{...theme.palette.upload_edit_locations_spinner_background, position:'relative'}}>
                  <CircularProgress size={40} sx={{position:'absolute', transform: 'translate(-50%, -50%)', left: '50%', top: '50%'}}/>
                </Box>
              </React.Fragment>
          }
        >
        <InfoOutlinedIcon color="info" fontSize="small" />
        </Tooltip>
      </Box>
    </Grid>
  );
}

LocationItem.propTypes = {
  shortName: PropTypes.string.isRequired,
  longName: PropTypes.string.isRequired,
  lat: PropTypes.number.isRequired,
  lng: PropTypes.number.isRequired,
  elevation: PropTypes.number.isRequired,
  coordType: PropTypes.string,
  onTTOpen: PropTypes.func.isRequired,
  onTTClose: PropTypes.func.isRequired,
  dataTT: PropTypes.object,
  propsTT: PropTypes.object.isRequired,
};