'use client'

/** @module queries/QueryResults */

import * as React from 'react';
import Box from '@mui/material/Box';
import DownloadForOfflineOutlinedIcon from '@mui/icons-material/DownloadForOfflineOutlined';
import Grid from '@mui/material/Grid';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

import ResultsPanel from './ResultsPanel';
import { UserSettingsContext } from '../serverInfo';

/**
 * Internal TabPanel element type
 * @function
 * @param {object} props The properties of the TabPanel element
 * @returns {object} Returns the UI for the TabPanel
 */
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`query-results-tabpanel-${index}`}
      aria-labelledby={`query-results-${index}`}
      {...other}
    >
    {value === index && (
      <Box id={`tabpanel-box-=${index}`}>
        {children}
      </Box>
    )}
    </div>
  );
}

// Define the types of the properties accepted by the TabPanel
TabPanel.propTypes = {
  children: PropTypes.node,
  index: PropTypes.number.isRequired,
  value: PropTypes.number.isRequired,
};

/**
 * Returns the a11y properties for a tab control
 * @function
 * @param {integer} index The index of the tab
 * @returns {object} The properties to use for the tab
 */
function a11yPropsTabPanel(index) {
  return {
    id: `query-results-${index}`,
    'aria-controls': `query-results-${index}`,
  };
}

/**
 * Generates the UI for displaying query results
 * @param {object} results The results of a query to display
 * @param {number} maxHeight The max height to set the panel to
 * @param {function} onDownload The function to call when the user wants to download a result
 * @returns {object} The UI of the query results
 */
export default function QueryResults({results, maxHeight, onDownload}) {
  const theme = useTheme();
  const userSettings = React.useContext(UserSettingsContext);  // User display settings
  const [activeTab, setActiveTab] = React.useState(0);

  // Reset our default tab when results change
  React.useEffect(() => {
    setActiveTab(0);
  }, [results]);

  /**
   * Updates fields when a new tab is selected for display
   * @function
   * @param {object} event The triggering event object
   * @param {object} newValue The new tab value
   */
  const handleTabChange = React.useCallback((event, newValue) => {
    setActiveTab(newValue);
  }, []);

  const tabsOrder = React.useMemo(() => {
      return userSettings?.sandersonOutput ? results.tabs.order : results.tabs.order.filter((item) => !item.includes('DrSanderson'))
    }, [results, userSettings]);

  return (
    <Grid id="query-results-panel-wrapper" container size="grow" alignItems="start" justifyContent="start">
      <Grid size={2}  sx={{backgroundColor:"#EAEAEA", height:maxHeight}}>
        { results.resultsCount && 
          <Grid container direction="column" alignItems="center" justifyContent="center"
                      sx={{width:'100%', borderBottom:'1px solid darkgrey', paddingTop:'5px', paddingBottom:'5px', backgroundColor:'#DFDFDF'}}
          >
            <Typography variant="body2" sx={{color:'dimgrey', fontStyle:'italic'}} >
              {results.resultsCount} Results Found
            </Typography>
          </Grid>
        }
        <Tabs id='query-results-tabs' value={activeTab} onChange={handleTabChange} aria-label="Query results" orientation="vertical" variant="scrollable"
              scrollButtons={false} style={{overflow:'clip', maxHeight:'100%'}}>
        { tabsOrder.map((item, idx) => {
            return (
              <Tab label={
                        <Grid container direction="row" alignItems="center" justifyContent="center" sx={{width:'100%'}} >
                          <Typography gutterBottom variant="body2" >
                            {results.tabs[item]}
                          </Typography>
                          <Tooltip title={'Download '+results.tabs[item]}>
                              <Grid onClick={() => onDownload(item)} style={{marginLeft:'auto', borderRadius:'5px','&:hover':{backgroundColor:'rgba(0,0,255,0.05)'} }}>
                                <DownloadForOfflineOutlinedIcon sx={{fontSize:'30px', padding:'5px'}} />
                              </Grid>
                          </Tooltip>
                        </Grid>
                       }
                 key={item} {...a11yPropsTabPanel(idx)} sx={{'&:hover':{backgroundColor:'rgba(0,0,0,0.05)'} }}
              />
              )
          })
        }
        </Tabs>
      </Grid>
      <Grid size={10} sx={{overflowX:'auto',display:'flex'}}>
        { tabsOrder.map((item, idx) => {
            return (
              <TabPanel id={'query-result-panel-'+item} value={activeTab} index={idx} key={item+'-'+idx} 
                        style={{overflowX:'auto', overflowY:'auto', width:'100%', position:'relative',margin:'0', height:(maxHeight-10)}}>
                { activeTab === idx  && <ResultsPanel results={results} tabName={tabsOrder[activeTab]} /> }
              </TabPanel>
            )}
          )
        }
      </Grid>
    </Grid>
  );
}

QueryResults.propTypes = {
  maxHeight: PropTypes.number.isRequired,
  onDownload: PropTypes.func.isRequired,
  results: PropTypes.shape({
    tabs: PropTypes.shape({
      order: PropTypes.arrayOf(PropTypes.string).isRequired,
    }).isRequired,
    resultsCount: PropTypes.number,
  }).isRequired,
};
