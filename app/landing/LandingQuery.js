'use client'

/** @module LandingUQuery */

import * as React from 'react';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import PriorityHighOutlinedIcon from '@mui/icons-material/PriorityHighOutlined';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { CollectionsInfoContext, MobileDeviceContext, SandboxInfoContext } from '../serverInfo';

/**
 * Returns the UI for queries on the Landing page
 * @function
 * @returns {object} The rendered UI
 */
export default function LandingQuery() {
  const theme = useTheme();
  const numAnimalIds = React.useMemo(() => {
    // TODO: Make this a call to the server
    return [['Bears TBD', 22], ['Bobcats TBD', 444], ['Unicorns TBD', 6], ['Narwhals TBD', 0], ['Mosasaurs TBD', 1]];
  });
  const showAnimalIdx = React.useMemo(() => {
    let foundIdx = [Math.floor(Math.random() * numAnimalIds.length),
                    Math.floor(Math.random() * numAnimalIds.length),
                    Math.floor(Math.random() * numAnimalIds.length)];
    let fixed = 0;
    while (fixed < 5) {
      let fixedValue = false;
      for (let idx = 1; idx < foundIdx.length; idx++) {
        const found = foundIdx.filter((item) => item === foundIdx[idx]);
        if (found.length > 1) {
          // We have a duplicate
          foundIdx[idx] = Math.floor(Math.random() * numAnimalIds.length);
          fixedValue = true;
        }
      }

      if (fixedValue === true) {
        fixed++;
      } else {
        break;
      }
    }

    return foundIdx;
  }, [numAnimalIds]);

  // Render the UI
  return (
    <Stack>
      <Grid id="sandbox-upload-info-wrapper" container direction="row" alignItems="center" justifyContent="space-around"
            sx={{paddingTop:'30px'}}>
        { numAnimalIds.map((item, idx) => 
          showAnimalIdx && showAnimalIdx.includes(idx) &&
                  <Grid id={"sandbox-upload-info-" + item[0]} key={item[0]} container direction="column" alignItems="center" justifyContent="center" columnSpacing={1}
                          sx={{background:'rgb(155, 189, 217, 0.3)', border:'2px solid rgb(122, 155, 196, 0.25)', borderRadius:'13px', padding:'7px 12px', minWidth:'30%'}} >
                    <Typography variant="h4" sx={{color:'#3b5a7d'}} >
                      {item[1]}
                    </Typography>
                    <Typography variant="body2" sx={{fontSize:'x-small', paddingTop:'7px', textTransform:'uppercase', color:'#3b5a7d'}} >
                      {item[0]}
                    </Typography>
                  </Grid>
        )
      }
      </Grid>
    </Stack>
  );
}
