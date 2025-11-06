'use client'

/** @module LandingUpload */

import * as React from 'react';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import PriorityHighOutlinedIcon from '@mui/icons-material/PriorityHighOutlined';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import { useTheme } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { CollectionsInfoContext, MobileDeviceContext, SandboxInfoContext } from './serverInfo';

/**
 * Returns the UI for uploads on the Landing page
 * @function
 * @param {boolean} loadingSandbox Set to true when the sandbox information is getting loaded
 * @param {function} onChange Function to call when a new upload is selected
 * @returns {object} The rendered UI
 */
export default function LandingUpload({loadingSandbox, onChange}) {
  const theme = useTheme();
  const mobileDevice = React.useContext(MobileDeviceContext);
  const curSandboxInfo = React.useContext(SandboxInfoContext);

  const sandboxItems = curSandboxInfo;
  const firstItem = sandboxItems && sandboxItems.length > 0 ? sandboxItems[0] : null;

  // Render the UI
  return (
    <React.Fragment>
      { firstItem || loadingSandbox  ? (
        <React.Fragment>
          <Grid container direction="row" alignItems="sflex-tart" justifyContent="flex-start">
            <Grid size={{sm:4, md:4, lg:4}} sx={{left:'auto'}}>
              <Typography gutterBottom sx={{ ...theme.palette.landing_upload_prompt,
                          visibility: !loadingSandbox?"visible":"hidden" }} >
                Unfinished uploads
              </Typography>
            </Grid>
            <Grid size={{sm:4, md:4, lg:4}}>
              <Typography gutterBottom sx={{ ...theme.palette.landing_upload_refresh,
                          visibility: loadingSandbox?"visible":"hidden" }} >
                Refreshing...
              </Typography>
            </Grid>
            <Grid size={{sm:4, md:4, lg:4}}>
              &nbsp;
            </Grid>
          </Grid>
          <Grid id="sandbox-upload-item-wrapper" container direction="column" alignItems="start" justifyContent="start"
                sx={{ ...theme.palette.landing_upload, padding:'0px 5px', minHeight:'40px'  }} >
            {
              sandboxItems && sandboxItems.map((obj, idx) => {
                return obj.uploads.map((up_obj) => {
                  return (
                    up_obj.uploadCompleted === false &&
                      <Grid key={obj.bucket+up_obj.name} container direction="row" alignItems="center" justifyContent="start"  sx={{width:'100%'}} >
                        <Typography variant="body" >
                          {up_obj.name}
                        </Typography>
                        <Tooltip title="Incomplete upload" placement="left">
                          <PriorityHighOutlinedIcon size="small" sx={{color:"sandybrown", marginLeft:'auto'}} />
                        </Tooltip>
                      </Grid>
                  );
                })
              })
            }
          </Grid>
        </React.Fragment>
        )
        : mobileDevice ? <Box>Nothing to do</Box>
            : <Typography gutterBottom sx={{ color: 'text.secondary', fontSize: 14, textAlign: 'center',  }} >
                No incomplete uploads found
              </Typography>
      }
    </React.Fragment>
  );
}
