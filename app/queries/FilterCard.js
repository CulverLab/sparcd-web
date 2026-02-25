/** @module components/FilterCard */

import * as React from 'react';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

/**
 * Returns the wrapper UI for filters
 * @function
 * @param {string} title The title of the filter
 * @param {function} onClose Called when the filter is to be closed
 * @param {array} actions Array of actions to add to the filter (after the children)
 * @param {object} {children} The child elements of the filter (filter specific UI elements)
 * @returns {object} The UI of the filter
 */
export default function FilterCard({title, onClose, actions, children, cardRef}) {
  const theme = useTheme();

  return (
    <Card id="filter-content" ref={cardRef} sx={{backgroundColor:'seashell', border:"none", boxShadow:"none"}} >
      <CardHeader id='filter-conent-header' title={
                    <Grid container direction="row" alignItems="start" justifyContent="start" wrap="nowrap">
                      <Grid>
                        <Typography gutterBottom variant="h6" component="h4" noWrap="true">
                          {title}
                        </Typography>
                      </Grid>
                      <Grid sx={{marginLeft:'auto'}} >
                        <div onClick={onClose}>
                          <Tooltip title="Delete this filter">
                            <Typography gutterBottom variant="body2" noWrap="true"
                                        sx={{textTransform:'uppercase',
                                        color:'grey',
                                        cursor:'pointer',
                                        fontWeight:'500',
                                        backgroundColor:'rgba(0,0,0,0.03)',
                                        padding:'3px 3px 3px 3px',
                                        borderRadius:'3px',
                                        '&:hover':{backgroundColor:'rgba(255,255,255,0.7)', color:'black'}
                                     }}
                            >
                                <CloseOutlinedIcon fontSize="small" />
                            </Typography>
                          </Tooltip>
                        </div>
                      </Grid>
                    </Grid>
                    }
                style={{paddingTop:'0px', paddingBottom:'0px'}}
      />
      <CardContent id='filter-content-content' sx={{paddingTop:'0px', paddingBottom:'0px'}}>
        {children}
      </CardContent>
      { actions ? 
            <CardActions id='filter-content-actions'>
              {actions}
            </CardActions>
        : null
      }
    </Card>
  );
}
