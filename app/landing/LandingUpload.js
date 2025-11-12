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
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { CollectionsInfoContext, MobileDeviceContext, SandboxInfoContext } from '../serverInfo';

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
  const numPrevUploads = React.useMemo(() => {
    // TODO: Make this a call to the server
    return [['Uploads last month TBD', 22], ['Uploads last year TBD', 444], ['Total uploads TBD', 8888]];
  });

  const sandboxItems = curSandboxInfo;

  const unfinished = React.useMemo(() => {
    let found = null;
    if (sandboxItems && sandboxItems.length > 0) {
      for (let oneItem of sandboxItems) {
        if (oneItem && oneItem.uploads && oneItem.uploads.length > 0) {
          for (let oneUp of oneItem.uploads) {
            if (oneUp && oneUp.uploadCompleted !== undefined) {
              if (oneUp.uploadCompleted === false) {
                found = oneItem;
                break;
              }
            }
          }
        }
        if (found !== null) {
          break;
        }
      }
    }
    return found !== null;
  }, [sandboxItems]);

  // Render the UI
  return (
    <Stack>
      { unfinished || loadingSandbox  ? (
        <React.Fragment>
          <Grid id="sandbox-status-wrapper" container direction="row" alignItems="sflex-tart" justifyContent="flex-start">
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
      <Grid id="sandbox-upload-info-wrapper" container direction="row" alignItems="center" justifyContent="space-around"
            sx={{paddingTop:'30px'}}>
        { numPrevUploads.map((item) => {
          return ( 
          <Grid id={"sandbox-upload-info-" + item[0]} key={item[0]} container direction="column" alignItems="center" justifyContent="center" columnSpacing={1}
                  sx={{background:'rgb(155, 189, 217, 0.3)', border:'2px solid rgb(122, 155, 196, 0.25)', borderRadius:'13px', padding:'7px 12px', minWidth:'30%'}} >
            <Typography variant="h4" sx={{color:'#3b5a7d'}} >
              {item[1]}
            </Typography>
            <Typography variant="body2" sx={{fontSize:'x-small', paddingTop:'7px', textTransform:'uppercase', color:'#3b5a7d'}} >
              {item[0]}
            </Typography>
          </Grid>
          );
        })
      }
      </Grid>
    </Stack>
  );
}
