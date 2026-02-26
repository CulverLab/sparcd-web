/** @module components/ImageTile */

import * as React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

/**
 * Returns the UI for one image tile
 * @function
 * @param {string} name The name of the image to display
 * @param {string} type The type of image the tile is
 * @param {object} species Array of species associated with the tile
 * @param {function} onClick Handler for the user clicking the tile
 * @return {object} The UI to render
 */
export default function ImageTile({name, type, species, onClick}) {
  const theme = useTheme();

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
  return (
    <Card id={name} onClick={onClick} variant={haveSpecies?"soft":"outlined"}
          sx={{minWidth:'200px', '&:hover':{backgroundColor:theme.palette.action.active} }}>
      <CardActionArea data-active={haveSpecies ? '' : undefined}
        sx={{height: '100%', '&[data-active]': {backgroundColor:'rgb(0, 0, 0, 0.35)'} }}
      >
        <CardContent>
          <Grid container spacing={1} alignItems="center" sx={{width:'100%'}}>
            <Grid container direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="body" sx={{textTransform:'uppercase'}}>
                {name}
              </Typography>
              {haveSpecies ? <CheckCircleOutlinedIcon fontSize="small" sx={{color:"#68AB68", leftMargin:'auto'}}/> : null}
            </Grid>
            {generateImageSvg(haveSpecies ? 'grey':undefined, haveSpecies ? '#68AB68':undefined)}
            <Typography variant="body" sx={{marginLeft:'auto', border:'1px solid black', borderRadius:'7px', backgroundColor:haveSpecies ? 'dimgrey' : 'silver', padding:'2px 5px' }}>
              {type}
            </Typography>
            <Grid container id={`species-list-${name}-info`} spacing={0} direction="column" alignItems="center" justifyContent="flex-start"
                  sx={{width:'100%'}}>
              <Grid container direction="row" alignItems="center" justifyContent="space-between"
                    sx={{width:'100%'}}>
              { species.map((curSpecies,idxSpecies) => 
                      <Box key={name+curSpecies.name+idxSpecies} sx={{width:'50%', rightMargin:'auto'}} >
                        <Typography variant="body3" sx={{textTransform:'capitalize'}}>
                          {curSpecies.name + ': ' + curSpecies.count}
                        </Typography>
                      </Box>
                )
              }
              </Grid>
            </Grid>
          </Grid>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
