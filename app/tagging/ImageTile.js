/** @module tagging/ImageTile */

import * as React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

import PropTypes from 'prop-types';

/**
 * Returns the UI for one image tile
 * @function
 * @param {string} name The name of the image to display
 * @param {string} type The type of image the tile is
 * @param {object} timestamp The timestamp of the image
 * @param {Array} species Array of species associated with the tile
 * @param {function} onClick Handler for the user clicking the tile
 * @return {object} The UI to render
 */
export default function ImageTile({name, type, timestamp, species, onClick}) {
  if (!species) {
    species = [];
  }

  function generateImageSvg(bgColor, fgColor) {
    if (bgColor == null) {
      bgColor = 'lightgrey';
    }
    if (fgColor == null) {
      fgColor = '#959595';
    }
    return (
      <svg
          viewBox="0 0 150 150"
          xmlns="http://www.w3.org/2000/svg"
          stroke="black"
          fill="grey"
          height="50px"
          width="50px">
        <circle cx='40%' cy='15%' r='2' fill={fgColor} stroke='transparent' strokeWidth='0px' />
        <rect x='10%' y='10%' width='80%' height='80%' fill={bgColor} opacity='0.75' stroke='transparent' strokeWidth='0px'/>
        <line x1='15%' y1='15%' x2='40%' y2='15%' stroke={fgColor} strokeWidth={6}/>
        <circle cx='15%' cy='15%' r='3' fill={fgColor} stroke='transparent' strokeWidth='0px' />
        <line x1='15%' y1='15%' x2='15%' y2='85%' stroke={fgColor} strokeWidth={6}/>
        <circle cx='15%' cy='85%' r='3' fill={fgColor} stroke='transparent' strokeWidth='0px' />
        <line x1='15%' y1='85%' x2='85%' y2='85%' stroke={fgColor} strokeWidth={6}/>
        <circle cx='85%' cy='85%' r='3' fill={fgColor} stroke='transparent' strokeWidth='0px' />
        <line x1='85%' y1='15%' x2='85%' y2='85%' stroke={fgColor} strokeWidth={6}/>
        <circle cx='85%' cy='15%' r='3' fill={fgColor} stroke='transparent' strokeWidth='0px' />
        <line x1='60%' y1='15%' x2='85%' y2='15%' stroke={fgColor} strokeWidth={6}/>
        <circle cx='60%' cy='15%' r='3' fill={fgColor} stroke='transparent' strokeWidth='0px' />
        <path d="M 90 60 L 60 60 L 53 65 L 53 75 L 59 75 L 65 70 L 67 76 L 66 87 L 63 87 L 63 89 L 69 89 L 77 75 L 80 77 L 82 78 L 83 88 L 79 88 L 86 88 L 86 80 L 92 81 L 95 88 L 92 88 L 92 89 L 100 89 L 100 69 L 90 60"
              fill={fgColor} stroke={fgColor} strokeWidth='3px' />
      </svg>
    );
  }

  const haveSpecies = species && species.length > 0;
  const speciesCount = species.filter((curSpecies) => curSpecies.count > 0).length;
  return (
    <Card id={name} onClick={onClick} variant={haveSpecies?"soft":"outlined"}
          sx={{minWidth:'200px',
               color:'text.primary',
               backgroundColor: haveSpecies ? '#f1fbf3' : 'background.paper',
               border:'1px solid',
               borderColor: haveSpecies ? '#4f8f5b' : 'divider',
               '&:hover':{
                 backgroundColor: haveSpecies ? '#e7f6ea' : '#f5f5f5',
                 color:'text.primary',
               },
               '&:hover .MuiTypography-root':{
                 color:'text.primary',
               },
          }}>
      <CardActionArea data-active={haveSpecies ? '' : undefined}
        sx={{height: '100%',
             color:'inherit',
             '& .MuiCardActionArea-focusHighlight': {
               backgroundColor:'#1565c0',
             },
             '&[data-active]': {
               backgroundColor:'#f1fbf3',
               color:'text.primary',
             },
             '&[data-active]:hover': {
               backgroundColor:'#e7f6ea',
               color:'text.primary',
             },
             '&[data-active] .MuiTypography-root': {
               color:'text.primary',
             },
        }}
      >
        <CardContent>
          <Grid container spacing={1} alignItems="center" sx={{width:'100%'}}>
            <Grid container direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="body1" sx={{textTransform:'uppercase'}}>
                {name}
              </Typography>
              {haveSpecies ?
                <Box sx={{display:'flex', alignItems:'center', gap:'4px', marginLeft:'auto',
                          color:'#256b35', backgroundColor:'#e2f4e5', border:'1px solid #5fa66b',
                          borderRadius:'999px', padding:'1px 7px'}}>
                  <CheckCircleOutlinedIcon fontSize="small" sx={{color:'inherit'}}/>
                  <Typography variant="body3" sx={{color:'inherit', fontWeight:600}}>
                    Tagged
                  </Typography>
                </Box>
                : null}
            </Grid>
            {generateImageSvg(haveSpecies ? '#dbe9dd':undefined, haveSpecies ? '#5fa66b':undefined)}
            <Grid container direction='row' alignItems='center' justifyContent='space-between' sx={{width:'100%'}} >
              <Typography variant="body1" sx={{border:'1px solid', borderColor:'divider', borderRadius:'7px', backgroundColor:haveSpecies ? '#d8eadf' : '#edf3f7', color:'text.primary', padding:'2px 5px' }}>
                {type}
              </Typography>
              <Typography variant="body1" sx={{marginLeft:'auto'}} >
                {timestamp ? timestamp.toLocaleString() : ''}
              </Typography>
            </Grid>
            <Grid container id={`species-list-${name}-info`} spacing={0} direction="column" alignItems="center" justifyContent="flex-start"
                  sx={{width:'100%'}}>
              <Grid container direction="row" alignItems="center" justifyContent="space-between"
                    sx={{width:'100%'}}>
              { species.map((curSpecies,idxSpecies) => curSpecies.count > 0 &&
                      <Box key={name+curSpecies.name+idxSpecies} sx={{width:'50%', marginRight:'auto'}} >
                        <Typography variant="body3" sx={{textTransform:'capitalize'}}>
                          {curSpecies.name + ': ' + curSpecies.count}
                        </Typography>
                      </Box>
                )
              }
              {haveSpecies && speciesCount === 0 &&
                <Typography variant="body3" sx={{color:'text.secondary'}}>
                  Tagged
                </Typography>
              }
              </Grid>
            </Grid>
          </Grid>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

ImageTile.propTypes = {
  name:    PropTypes.string.isRequired,
  type:    PropTypes.string.isRequired,
  species: PropTypes.arrayOf(PropTypes.shape({
             name:  PropTypes.string.isRequired,
             count: PropTypes.number.isRequired,
           })),
  onClick: PropTypes.func.isRequired,
};

ImageTile.defaultProps = {
  species: [],
};
