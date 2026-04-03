'use client'

/** @module components/WorkspaceOverlay */

import * as React from 'react';
import Backdrop from '@mui/material/Backdrop';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

/**
 * Returns the UI for a top-level overlay of the workspace
 * @function
 * @param {React.ReactNode} [children] The children to display
 */
export default function WorkspaceOverlay({children}) {
  const theme = useTheme();

  return (
    <Backdrop open={true} sx={{backgroundColor:'rgb(0,0,0,0.5)', zIndex:11111}} >
      <Paper sx={{display:'flex', flexDirection:'column', alignItems:'center', backgroundColor:'rgb(0,0,0,0.8)',
                  border:'1px solid grey', borderRadius:'15px', padding:'25px 10px'}}>
          {children}
      </Paper>
    </Backdrop>
  );
}

WorkspaceOverlay.propTypes = {
  children: PropTypes.node,
};
