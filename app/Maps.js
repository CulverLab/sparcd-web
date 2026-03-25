/** @module Maps */

import * as React from 'react';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';

import { SizeContext } from './serverInfo';

// Lazy load the ESRI component because that's the way it needs to be
const MapsEsriLazyload = React.lazy(() => import('./components/MapsEsri'));

// All the ESRI map choices we're supporting
const mapChoices = [
  {provider:'esri', name:'Esri World Street Map', value:'streets-vector', config:{mapName:'streets-vector'}},
  {provider:'esri', name:'Esri World Topo Map', value:'topo-vector', config:{mapName:'topo-vector'}},
  {provider:'esri', name:'Esri World Imagery', value:'satellite', config:{mapName:'satellite'}},
];


/**
 * Provides the UI for displaying maps
 * @function
 * @returns {object} The UI for showing maps
 */
export default function Maps() {
  const theme = useTheme();
  const uiSizes = React.useContext(SizeContext);
  const [curMapChoice, setCurMapChoice] = React.useState(mapChoices[0]); // The current map to display

  /* TODO: Have these come from the server based upon the known locations */
  // TODO: const extent = [{x:-109.0, y:36.0}, {x:-115.0, y:30.0}];
  const center = {x:-110.9742, y:32.2540}

  /* TODO:
  OpenTopoMap("Open Topo Map", "https://opentopomap.org/about", new MapTileLayer("OpenTopoMap", "https://{c}.tile.opentopomap.org/{z}/{x}/{y}.png", 0, 17)),

  https://giuliacajati.medium.com/all-about-openstreetmap-using-react-js-c24fd0856aca
  */

  /**
   * Handle the user choosing a different ESRI map to display
   * @function
   * @param {string} newMapValue The value associated with the new map
   */
  const handleMapChanged = React.useCallback((newMapValue) => {
    const newChoice = mapChoices.find((item) => item.value === newMapValue);
    setCurMapChoice(newChoice);
  }, []);

  // Return the UI
  return (
    <Box id='maps-workspace-wrapper' sx={{ flexGrow: 1, width: '100vw'}} >
      {curMapChoice && curMapChoice.provider === 'esri' 
          && <MapsEsriLazyload id={"map-" + curMapChoice.value} key={"map-" + curMapChoice.value} center={center}
                              top={uiSizes.workspace.top} width={uiSizes.workspace.width} height={uiSizes.workspace.height}
                              mapChoices={mapChoices} {...curMapChoice.config} onChange={handleMapChanged}
              />
      }
   </Box>
  );
}