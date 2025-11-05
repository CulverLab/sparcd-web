/** @module theme */

import { createTheme } from '@mui/material/styles';
import { grey } from '@mui/material/colors';

/** The working theme */
let theme = createTheme({
  typography: {
    button: {
      textTransform: 'none'
    }
  },
  palette: {
    background: {
      default: grey[500],
      paper: grey[500],
    },
    login_button: {
      main: '#EFEFEF',
      light: '#FFFFFF',
      dark: '#E0E0E0',
      contrastText: '#000000'
    },
    landing_card: {
      background: 'rgba(224, 227, 232, 0.7)',
      minHeight: '20vh',
      maxWidth: '40vw',
      uploadImage: "https://arizona.box.com/shared/static/dcxcm0y8u6cnwcz6tftovo68ixkcd2c0.jpg",
      collectionsImage: '../public/CollectionsImage.jpg',
      searchImage: '../public/SearchImage.jpg',
      mapsImage: '../public/MapsImage.jpg',
    },
    landing_upload: {
      border: '1px solid black',
      maxHeight: '24vh',
      overflow: 'scroll',
      padding: '0em 1em 0em 1em'
    },
    landing_upload_prompt: {
      color: 'text.secondary',
      fontSize: 'x-small', 
      fontWeight: 'bold',
      textAlign: 'start'
    },
    landing_upload_refresh: {
      color: 'text.secondary',
      fontSize: 'x-small', 
      textAlign: 'center'
    },
    landing_collections: {
      border: '1px solid black',
      maxHeight: '24vh',
      overflow: 'scroll',
      padding: '0em 1em 0em 1em'
    },
    landing_collections_refresh: {
      color: 'text.secondary',
      fontSize: 'x-small', 
      textAlign: 'center'
    },
    folder_upload: {
      background: 'rgb(240, 240, 255)',
      padding: '1em 2em 1em 2em'
    },
    left_sidebar: {
      height: '100%',
      width: '150px',
      maxWidth: '150px',
      minWidth: '150px',
      background: 'white',
      borderRight: '1px solid black',
      margin: '0px 0px 0px 0px'
    },
    top_sidebar: {
      height: '50px',
      maxWidth: '50px',
      minWidth: '50px',
      background: 'white',
      borderBottom: '1px solid black',
      margin: '0px 0px 0px 0px'
    },
    left_sidebar_item: {
      padding: '10px 10px 10px 10px',
      borderTop: '1px solid white',
      borderBottom: '1px solid white'
    },
    left_sidebar_item_selected: {
      fontWeight: 'bold',
      borderTop: '1px solid grey',
      borderBottom: '1px solid grey'
    },
    upload_edit_locations_card: {
      backgroundColor:'action.selected',
      minWidth:'50vw',
      maxWidth:'75vw'
    },
    upload_edit_locations_spinner_background: {
      position:'absolute',
      left:'0px',
      top:'0px',
      width:'75px',
      height:'57px',
      backgroundColor:'rgba(255,255,255,0.4)',
      borderRadius:'5px'
    },
    image_sidebar_item: {
      background: '#E0F0E0',
      border: '1px solid black',
    },
    image_sidebar_item_media: {
      minHeight: '150px',
      maxHeight: '150px',
      width: '200px'
    },
    species_left_sidebar: {
      height: '100%',
      width: '200px',
      maxWidth: '200px',
      minWidth: '200px',
      background: 'white',
      borderRight: '1px solid black',
      margin: '0px 0px 0px 0px'
    },
    species_top_sidebar: {
      width: '100%',
      height: '175px',
      maxHeight: '175px',
      minHeight: '175px',
      background: 'white',
      borderRight: '1px solid black',
      margin: '0px 0px 0px 0px'
    },
    species_sidebar_item: {
      background: '#E0F0E0',
      border: '1px solid black',
    },
    species_sidebar_item_media: {
      minHeight: '150px',
      maxHeight: '150px',
      width: '200px'
    },
    species_sidebar_item_media_small: {
      minHeight: '100px',
      maxHeight: '100px',
      width: '100px'
    },
    screen_disable: {
      'position': 'absolute',
      'left': '0px',
      'top': '0px',
      'width': '100vw',
      'height': '100vh',
      'backgroundColor': 'rgba(128, 128, 128, 0.50)'
    },
    screen_overlay: {
      'position': 'absolute',
      'left': '0px',
      'top': '0px',
      'width': '100vw',
      'height': '100vh',
    }
  }
});

theme.typography['body3'] = {
  ...theme.typography.body2,
  fontSize: '0.71rem',
  lineHeight: '1.22'
};

export default theme;
