'use client'

/** @module components/FolderUploadForm */

import * as React from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import { allTimezones, useTimezoneSelect } from "react-timezone-select";

import LocationItem from '../components/LocationItem'
import { meters2feet } from '../utils';
import { BaseURLContext, ExpiredTokenFuncContext, TokenContext } from '../serverInfo';

/**
 * Renders the UI for user provided details when uploading files
 * @function
 * @param {string} displayCoordSystem The coordinate system to display location information in
 * @param {string} measurementFormat The format to display measurement formats
 * @param {object} collectionInfo Array of collections the user can choose from
 * @param {object} locationItems Array of locations uthe user can choose from
 * @param {function} onCollectionChange Handles where the user chooses a collection
 * @param {function} onCommentChange Handles where the user changes the comment field
 * @param {function} onLocationChange Handles where the user chooses a location
 * @param {function} onTimezoneChange Handles where the user chooses a different timezone
 * @returns {object} The rendered UI
 */
export default function FolderUploadForm({displayCoordSystem, measurementFormat, collectionInfo, locationItems, onCollectionChange,
                                          onCommentChange, onLocationChange, onTimezoneChange}) {
  const theme = useTheme();
  const setExpiredToken = React.useContext(ExpiredTokenFuncContext);
  const serverURL = React.useContext(BaseURLContext);
  const uploadToken = React.useContext(TokenContext);
  const { options, parseTimezone } = useTimezoneSelect({ labelStyle:'altName', allTimezones });
  const [selectedTimezone, setSelectedTimezone] = React.useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [tooltipData, setTooltipData] = React.useState(null);       // Data for tooltip

  let curLocationFetchIdx = -1; // Working index of location data to fetch

  /**
   * Calls the server to get location details for tooltips
   * @function
   * @param {int} locIdx The index of the location to get the details for
   */
  const getTooltipInfo = React.useCallback((locIdx) => {
    if (curLocationFetchIdx != locIdx) {
      curLocationFetchIdx = locIdx;
      const cur_loc = locationItems[curLocationFetchIdx];
      const locationInfoUrl = serverURL + '/locationInfo?t=' + encodeURIComponent(uploadToken);

      const formData = new FormData();

      formData.append('id', cur_loc.idProperty);
      formData.append('name', cur_loc.nameProperty);
      formData.append('lat', cur_loc.latProperty);
      formData.append('lon', cur_loc.lngProperty);
      formData.append('ele', cur_loc.elevationProperty);
      try {
        const resp = fetch(locationInfoUrl, {
          credentials: 'include',
          method: 'POST',
          body: formData
        }).then(async (resp) => {
              if (resp.ok) {
                return resp.json();
              } else {
                if (resp.status === 401) {
                  // User needs to log in again
                  setExpiredToken();
                }
                throw new Error(`Failed to get location information: ${resp.status}`, {cause:resp});
              }
            })
          .then((respData) => {
              // Save tooltip information
              const locInfo = Object.assign({}, respData, {'index':curLocationFetchIdx});

              if (locIdx === curLocationFetchIdx) {
                setTooltipData(locInfo);
              }
                })
          .catch(function(err) {
            console.log('Location tooltip Error: ',err);
        });
      } catch (error) {
        console.log('Location tooltip Unknown Error: ',err);
      }
    }
  }, [curLocationFetchIdx, locationItems, serverURL, setTooltipData, uploadToken]);

  /**
   * Clears tooltip information when no longer needed. Ensures only the working tooltip is cleared
   * @function
   * @param {int} locIdx The index of the location to clear
   */
  const clearTooltipInfo = React.useCallback((locIdx) => {
    // Only clear the information if we're the active tooltip
    if (locIdx == curLocationFetchIdx) {
      setTooltipData(null);
    }
  }, [curLocationFetchIdx, setTooltipData]);

  /**
   * Handles when the user changes the timezone
   * @function
   * @param {object} event The change event
   */
  const handleTimezoneChange = React.useCallback((event) => {
    const parsedTz = parseTimezone(event.target.value);
    setSelectedTimezone(parsedTz);
    onTimezoneChange(parsedTz);
  }, [setSelectedTimezone, onTimezoneChange]);

  return (
    <Grid id='folder-upload-details-wrapper' container direction="column" alignItems="center" justifyContent="start" gap={2}>
      <FormControl fullWidth>
        <Autocomplete
          options={collectionInfo}
          id="folder-upload-collections"
          autoHighlight
          onChange={onCollectionChange}
          defaultValue={null}
          getOptionLabel={(option) => option.name}
          getOptionKey={(option) => option.name+option.id}
          renderOption={(props, col) => {
            const { key, ...optionProps } = props;
            return (
                <MenuItem id={col.id+'-'+key} value={col.name} key={key} {...optionProps}>
                  {col.name}
                </MenuItem> 
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Collection"
              required={true}
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
      <FormControl fullWidth>
        <Autocomplete
          options={locationItems}
          id="folder-upload-location"
          autoHighlight
          onChange={onLocationChange}
          defaultValue={null}
          getOptionLabel={(option) => option.idProperty}
          getOptionKey={(option) => option.idProperty+option.latProperty+option.lngProperty}
          filterOptions={(options, { inputValue }) => options.filter((item) => 
                                                        item.idProperty.toLowerCase().includes(inputValue.toLowerCase()) ||
                                                            item.nameProperty.toLowerCase().includes(inputValue.toLowerCase()) )
                        }
          renderOption={(props, loc) => {
            const { key, ...optionProps } = props;
            return (
                <MenuItem id={loc.idProperty+'-'+key} value={loc.idProperty} key={key} {...optionProps}>
                  <LocationItem shortName={loc.idProperty} longName={loc.nameProperty}
                                lat={displayCoordSystem === 'LATLON' ? loc.latProperty : loc.utm_x} 
                                lng={displayCoordSystem === 'LATLON' ? loc.lngProperty: loc.utm_y} 
                                elevation={measurementFormat === 'feet' ? meters2feet(loc.elevationProperty) + 'ft' : loc.elevationProperty}
                                coordType={displayCoordSystem === 'LATLON' ? undefined : loc.utm_code}
                                onTTOpen={getTooltipInfo} onTTClose={clearTooltipInfo}
                                dataTT={tooltipData} propsTT={props}
                   />
                </MenuItem> 
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Location"
              required={true}
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
      <FormControl fullWidth>
        <Grid container direction="column" alignContent="start" justifyContent="start" sx={{paddingTop:"10px"}} >
          <Typography gutterBottom variant="body">
            Mountain Range - Site Name - No. of images collected - Date Uploaded - Date collected
          </Typography>
          <Typography gutterBottom variant="body2">
            (e.g.: Santa Rita Mountains - SAN06 - 39 images - uploaded 04-10-2020 - collected 03-28-2000)
          </Typography>
          <TextField required fullWidth id="folder-upload-comment" label="Comment" onChange={onCommentChange} />
        </Grid>
      </FormControl>
      <FormControl fullWidth={true}>
        <Grid container direction="row" alignItems="center" justifyContent="space-between" sx={{paddingTop:"10px"}} >
          <Typography gutterBottom variant="body">
            Timezone of images
          </Typography>
          <Select id="landing-page-upload-timezone" value={selectedTimezone} onChange={handleTimezoneChange}>
            {options.map((option) => 
              <MenuItem key={option.value} value={option.value} selected={selectedTimezone === option.value} >
                <Typography gutterBottom variant="body2">
                  {option.label}
                </Typography>
              </MenuItem>
            )}
          </Select>
        </Grid>
      </FormControl>
    </Grid>
  );
}
