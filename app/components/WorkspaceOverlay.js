'use client'

/** @module components/WorkspaceOverlay */

import * as React from 'react';
import Backdrop from '@mui/material/Backdrop';
import Paper from '@mui/material/Paper';

import PropTypes from 'prop-types';

/**
 * Returns the UI for a top-level overlay of the workspace
 * @function
 * @param {React.ReactNode} [children] The children to display
 */
export default function WorkspaceOverlay({children}) {
  return (
    <Backdrop open={true} sx={{backgroundColor:'rgba(10, 18, 28, 0.72)', zIndex:11111}} >
      <Paper sx={{display:'flex', flexDirection:'column', alignItems:'center', backgroundColor:'rgba(14, 23, 33, 0.92)',
                  color:'common.white', border:'1px solid', borderColor:'divider', borderRadius:'15px', padding:'25px 10px'}}>
          {children}
      </Paper>
    </Backdrop>
  );
}

WorkspaceOverlay.propTypes = {
  children: PropTypes.node,
};
