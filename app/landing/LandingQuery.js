'use client'

/** @module LandingQuery */

import * as React from 'react';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';

import * as Server from './LandingServerCalls';
import LandingInfoTile from './LandingInfoTile';
import { BaseURLContext, TokenExpiredFuncContext, TokenContext } from '../serverInfo';

/**
 * Returns the UI for queries on the Landing page
 * @function
 * @returns {object} The rendered UI
 */
export default function LandingQuery() {
  const theme = useTheme();
  const tokenExpiredFunc = React.useContext(TokenExpiredFuncContext);
  const serverURL = React.useContext(BaseURLContext);
  const queryToken = React.useContext(TokenContext);
  const [animalsNums,setAnimalsNums] = React.useState(null);

  /**
   * Retrieves the species stats from the server
   * @function
   */
  const getSpeciesStats = React.useCallback(() => {

    const success = Server.getSpeciesStats(serverURL, queryToken, tokenExpiredFunc,
          (respData) => {   // Success
              // Process the results
            setAnimalsNums(respData);
          },
          (err) => {        // Failure - Do nothing

          }
    );

    if (!success) {
      // Do nothing
    }

  }, [serverURL, queryToken, tokenExpiredFunc]);

  // Get the statistics to show
  React.useLayoutEffect(() => {
    if (animalsNums === null) {
      getSpeciesStats();
    }
  }, [animalsNums, getSpeciesStats]);

  // Make animalsNums load from server
  const showAnimalIdx = React.useMemo(() => {
    if (animalsNums === null || animalsNums.length === 0) {
      return null;
    }

    // Clamp the number of tiles to show to the available data
    const numTiles = Math.min(3, animalsNums.length);
    const foundIdx = new Set();

    while (foundIdx.size < numTiles) {
      foundIdx.add(Math.floor(Math.random() * animalsNums.length));
    }

    return [...foundIdx];
  }, [animalsNums]);

  // Render the UI
  return (
    <Stack>
      <Grid id="sandbox-query-info-wrapper" container direction="row" alignItems="center" justifyContent="space-around"
            sx={{paddingTop:'10px'}}>
        { animalsNums?.map((item, idx) => showAnimalIdx?.includes(idx) && <LandingInfoTile key={item[0]} title={item[1]} details={item[0]} />
        )
      }
      </Grid>
    </Stack>
  );
}
