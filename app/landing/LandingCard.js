'use client'

/** @module components/LandingCard */

import * as React from 'react';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

/**
 * Returns the common card UI for actions on the Landing page
 * @function
 * @param {string} title The title of the card
 * @param {string | React.node} subtitle The subtitle to display
 * @param {array} action Array of objects with onClick handler, disabled flag, and title (aka. name) for a card
 * @param {object} [children] The children elements of the card
 * @returns {object} The rendered Landing card
 */
export default function LandingCard({title, subtitle, action, children}) {
  const theme = useTheme();

  // Handle actions as array or an object
  let curAction = action;
  if (curAction instanceof Array) {
    curAction = curAction.filter((act) => act != null);
    if (curAction.length === 1) {
      curAction = curAction[0];
    }
  }
  const actionsIsArray = curAction instanceof Array;

  // Render the card UI
  return (
    <Card variant="outlined" id={'landing-card-' + title.replace(/\s+/g, '-')}
          sx={{...theme.palette.landing_card, 
                minWidth: '100%',
                maxWidth: '100vw'}} >
      <CardHeader title={<span style={{fontWeight:'bold'}}>{title}</span>} subheader={subtitle} />
      <CardContent sx={{minHeight:theme.palette.landing_card.minHeight}}>
        {children}
      </CardContent>
      <CardActions>
        { actionsIsArray ? 
          curAction.map(function(obj, idx) {
            return <Button size="large" onClick={obj.onClick} key={obj.title} sx={{flex:1}} disabled={obj.disabled}>{obj.title}</Button>;
          })
          : <Button size="large" onClick={curAction.onClick} disabled={curAction.disabled}>{curAction.title}</Button>
        }
      </CardActions>
    </Card>
  );
}

LandingCard.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  action: PropTypes.oneOfType([
    PropTypes.shape({
      title: PropTypes.string.isRequired,
      onClick: PropTypes.func.isRequired,
      disabled: PropTypes.bool,
    }),
    PropTypes.arrayOf(PropTypes.shape({
      title: PropTypes.string.isRequired,
      onClick: PropTypes.func.isRequired,
      disabled: PropTypes.bool,
    })),
  ]).isRequired,
  children: PropTypes.node,
};
