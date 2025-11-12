/** @module LandingCollections */

import * as React from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

import { CollectionsInfoContext, MobileDeviceContext } from '../serverInfo';

/** Returns the UI of the collections for the Landing page
 * @function
 * @param {boolean} loadingCollections Set to true if collections are being loaded
 * @param {function} onChange Function for when a collection selection has changed
 * @returns {object} The rendered UI
 */
export default function LandingCollections({loadingCollections, onChange}) {
  const theme = useTheme();
  const curCollectionsInfo = React.useContext(CollectionsInfoContext);
  const mobileDevice = React.useContext(MobileDeviceContext);  // TODO: Are we on a mobile device (portrait mode)
  const [selectedCollection, setSelectedCollection] = React.useState(null);

  /**
   * Handles a change in the user's selection and calls the parent's change function
   * @function
   * @param {object} event The event object
   */
  function handleChange(event) {
    setSelectedCollection(event.target.value);
    onChange(event.target.value);
  }

  const collectionItems = curCollectionsInfo;
  const firstItem = collectionItems && collectionItems.length > 0 ? collectionItems[0] : null;

  // Render the UI
  return (
    <React.Fragment>
      { firstItem || loadingCollections ? (
        <React.Fragment>
          <Typography gutterBottom sx={{ ...theme.palette.landing_collections_refresh,
                      visibility:loadingCollections?"visible":"hidden" }} >
            Refreshing...
          </Typography>
          <Box id='landing-collections-wrapper' sx={{ ...theme.palette.landing_collections, padding:'0px', minHeight:'40px' }} >
          { collectionItems ?
            <FormControl sx={{width:'100%'}}>
              <RadioGroup
                id='collection-items'
                value={selectedCollection}
                onChange={handleChange}              
              >
                  {
                    collectionItems.map(function(obj, idx) {
                      const itemTheme = idx & 1 ? theme.palette.landing_collections_list : theme.palette.landing_collections_list_alt
                      return <FormControlLabel value={obj.name} control={<Radio />} label={obj.name} key={obj.name+'-'+idx}
                                               sx={{padding:'0px 5px', 
                                                    ...itemTheme,
                                                    marginRight:'0px'}}/>
                    })
                  }
              </RadioGroup>
            </FormControl>
                    : <Grid container justifyContent="center" alignItems="center" sx={{marginTop:'10px'}}>
                        <CircularProgress size='20px'/>
                      </Grid>
                  }
          </Box>
        </React.Fragment>
        ) : mobileDevice ? <Box>Nothing to do</Box>
            : <Typography gutterBottom sx={{ color: 'text.secondary', fontSize: 14, textAlign: 'center',  }} >
                No collections are available
              </Typography>
      }
    </React.Fragment>
  );
}
