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
    main: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      minHeight: '100vh',
      backgroundColor: '#EFEFEF',
      background: 'linear-gradient(135deg, #3b5a7d 0%, #9bbdd9 50%, #7a9bc4 100%)',
    },
    title_bar: {
      width: '100vw',
      padding: '5px 10px 5px 10px',
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'left',
      alignItems: 'center',
      borderBottom: '1px solid black',
      boxShadow: '2px 3px 3px #bbbbbb',
      backgroundColor: 'white',
    },
    footer_bar: {
      width: '100vw',
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '5px 5px 5px 5px',
      borderTop: '1px solid gray',
      backgroundColor: 'white',
    },
    footer_wrapper: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      minWidth: '33%',
      whiteSpace: 'nowrap',
    },
    footer_sub_item: {
      fontWeight: 'normal',
      fontSize: 'x-small',
    },
    footer_copyright: {
      fontWeight: 'normal',
      fontSize: 'x-small',
      alignSelf: 'end',
      whiteSpace: 'nowrap',
      maxWidth: '33%',
    },
    footer_outside_link: {
      color: 'blue',
      fontSize: '6pt',
      fontWeight: 'bold',
      border: '1px solid black',
      borderRadius: '3px',
      padding: '0px 2px',
    },
    login_wrapper: {
      width: '100vw',
      height: '100%',
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      gridTemplateRows: '29% 42% 29%',
    },
    login_dialog_wrapper: {
      alignSelf: 'center',
      maxHeight: '360px',
      gridColumn: 2,
      gridRow: 2,
      width: '338px',
      border: '2px solid white',
      borderRadius: '20px',
      backgroundColor: 'rgba(200, 200, 200, 0.50)',
    },
    login_dialog: {
    },
    login_dialog_items: {
      display: 'grid',
      gridTemplateColumns: '1fr 2fr',
      fontSize: 'smaller',
    },
    login_checking_wrapper: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgb(0,0,0,0.5)',
      zIndex: 11111,
    },
    login_checking: {
      backgroundColor: 'rgb(0,0,0,0.8)',
      border: '1px solid grey',
      borderRadius: '15px',
      padding: '25px 10px',
    },
    login_button: {
      main: '#EFEFEF',
      light: '#FFFFFF',
      dark: '#E0E0E0',
      contrastText: '#000000',
    },
    login_dialog_login_button_wrap: {
      marginRight: '10px',
      gridColumn: 2,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'flex-end',
    },
    messages_wrapper: {
      position: 'absolute',
      top:  '40px',
      right: '0px',
      bottom: '0px',
      left: '0px',
    },
    landing_card: {
      backgroundColor: 'rgba(255, 255, 255, 0.78)',
      borderRadius: '15px',
      minHeight: '20vh',
      minWidth: '46vw',
      maxWidth: '46vw',
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
      maxHeight: '20vh',
      overflow: 'scroll',
      padding: '0em 1em 0em 1em'
    },
    landing_collections_refresh: {
      color: 'text.secondary',
      fontSize: 'x-small', 
      textAlign: 'center'
    },
    landing_collections_list: {
      backgroundColor: '#ecf1f4',
    },
    landing_collections_list_alt: {
      backgroundColor: '#d7dee4',
    },
    landing_page_map_image_wrapper: {
      maxHeight:'180px',
      border:'1px solid grey',
      borderRadius:'10px',
      overflow:'clip',
    },
    folder_upload: {
      background: 'rgb(240, 240, 255)',
      padding: '1em 2em 1em 2em',
      borderRadius: '15px',
      backgroundColor: 'rgb(212, 230, 241, 0.95)',
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
      'backgroundColor': 'rgba(128, 128, 128, 0.65)'
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
