/** @module Maps */

import * as React from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import { useTheme } from '@mui/material/styles';

import { SizeContext } from './serverInfo';
import * as utils from './utils';

// Lazy load the ESRI component because that's the way it needs to be
const MapsEsriLazyload = React.lazy(() => import('./components/MapsEsri'));


/**
 * Provides the UI for displaying maps
 * @function
 * @returns {object} The UI for showing maps
 */
export default function Maps() {
  const theme = useTheme();
  const uiSizes = React.useContext(SizeContext);
  const [curMapChoice, setCurMapChoice] = React.useState(null); // The current map to display
  const [serverURL, setServerURL] = React.useState(utils.getServer());  // The server URL to use
  const [totalHeight, setTotalHeight] = React.useState(null);  // Default value is recalculated at display time
  const [windowSize, setWindowSize] = React.useState({width: 640, height: 480});  // Default values are recalculated at display time
  const [workingTop, setWorkingTop] = React.useState(null);    // Default value is recalculated at display time
  const [workspaceWidth, setWorkspaceWidth] = React.useState(640);  // Default value is recalculated at display time
  // TODO: Have these come from the server
  const extent = [{x:-109.0, y:36.0}, {x:-115.0, y:30.0}];
  const center = {x:-110.9742, y:32.2540}

  // All the ESRI map choices we're supporting
  const mapChoices = [
    {provider:'esri', name:'Esri World Street Map', value:'streets-vector', config:{mapName:'streets-vector'}},
    {provider:'esri', name:'Esri World Topo Map', value:'topo-vector', config:{mapName:'topo-vector'}},
    {provider:'esri', name:'Esri World Imagery', value:'satellite', config:{mapName:'satellite'}},
  ];

/*
  OpenTopoMap("Open Topo Map", "https://opentopomap.org/about", new MapTileLayer("OpenTopoMap", "https://{c}.tile.opentopomap.org/{z}/{x}/{y}.png", 0, 17)),

  https://giuliacajati.medium.com/all-about-openstreetmap-using-react-js-c24fd0856aca
*/

  // Recalcuate available space in the window
  React.useLayoutEffect(() => {
    const newSize = {'width':window.innerWidth,'height':window.innerHeight};
    setWindowSize(newSize);
    calcTotalSize(newSize);
    setWorkspaceWidth(newSize.width);
  }, [totalHeight, workingTop, workspaceWidth]);

  // Adds a handler for when the window is resized, and automatically removes the handler
  React.useLayoutEffect(() => {
      function onResize () {
        const newSize = {'width':window.innerWidth,'height':window.innerHeight};

        setWindowSize(newSize);

        calcTotalSize(newSize);

        const newWorkspaceWidth = newSize.width;
        setWorkspaceWidth(newWorkspaceWidth);
      }

      window.addEventListener("resize", onResize);
  
      return () => {
          window.removeEventListener("resize", onResize);
      }
  }, [totalHeight, workingTop, workspaceWidth]);

  /**
   * Calculates the total UI size available for the workarea
   * @function
   * @param {object} curSize The total width and height of the window
   */
  function calcTotalSize(curSize) {
    const elWorkspace = document.getElementById('maps-workspace-wrapper');
    if (elWorkspace) {
      const elWorkspaceSize = elWorkspace.getBoundingClientRect();
      setTotalHeight(elWorkspaceSize.height);
      setWorkingTop(0);
    }

    setWorkspaceWidth(curSize.width);
  }

  /**
   * Handle the user choosing a different ESRI map to display
   * @function
   * @param {string} newMapValue The value associated with the new map
   */
  const handleMapChanged = React.useCallback((newMapValue) => {
    const newChoice = mapChoices.find((item) => item.value === newMapValue);
    setCurMapChoice(newChoice);
  }, [mapChoices, setCurMapChoice]);

  // Set the map to the default if one isn't specified
  if (!curMapChoice) {
    setCurMapChoice(mapChoices[0]);
  }

  // Return the UI
  const curHeight = totalHeight + 'px';
  return (
    <Box id='maps-workspace-wrapper' sx={{ flexGrow: 1, 'width': '100vw'}} >
      {curMapChoice && curMapChoice.provider === 'esri' 
          && <MapsEsriLazyload id={"map-" + curMapChoice.value} key={"map-" + curMapChoice.value} center={center}
                              top={uiSizes.workspace.top} width={uiSizes.workspace.width} height={uiSizes.workspace.height}
                              mapChoices={mapChoices} {...curMapChoice.config} onChange={handleMapChanged}
              />
      }
   </Box>
  );
}