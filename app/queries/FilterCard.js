'use client'

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

import PropTypes from 'prop-types';

/**
 * Returns the wrapper UI for filters
 * @function
 * @param {string} title The title of the filter
 * @param {function} onClose Called when the filter is to be closed
 * @param {array} actions Array of actions to add to the filter (after the children)
 * @param {object} cardRef Reference to use for the card
 * @param {object} [children] The child elements of the filter (filter specific UI elements)
 * @returns {object} The UI of the filter
 */
export default function FilterCard({title, onClose, actions, cardRef, children}) {
  const theme = useTheme();

  return (
    <Card id="filter-content" ref={cardRef} sx={{backgroundColor:'seashell', border:"none", boxShadow:"none"}} >
      <CardHeader id='filter-content-header' title={
                    <Grid container direction="row" alignItems="flex-start" justifyContent="flex-start" sx={{flexWrap:'nowrap'}}>
                      <Grid>
                        <Typography gutterBottom variant="h6" component="h4" noWrap>
                          {title}
                        </Typography>
                      </Grid>
                      <Grid sx={{marginLeft:'auto'}} >
                        <Tooltip title="Delete this filter">
                          <IconButton aria-label="Delete this filter" onClick={onClose} size="small">
                            <CloseOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Grid>
                    </Grid>
                    }
                style={{paddingTop:'0px', paddingBottom:'0px'}}
      />
      <CardContent id='filter-content-content' sx={{paddingTop:'0px', paddingBottom:'0px'}}>
        {children}
      </CardContent>
      { actions && 
            <CardActions id='filter-content-actions'>
              {actions}
            </CardActions>
      }
    </Card>
  );
}

FilterCard.propTypes = {
  title:    PropTypes.string.isRequired,
  onClose:  PropTypes.func.isRequired,
  actions:  PropTypes.node,
  children: PropTypes.node.isRequired,
  cardRef:  PropTypes.shape({ current: PropTypes.instanceOf(React.Element) }).isRequired,
};

FilterCard.defaultProps = {
  actions: undefined,
};
