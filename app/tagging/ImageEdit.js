'use client'

/** @module tagging/ImageEdit */

import * as React from 'react';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import ArrowBackIosOutlinedIcon from '@mui/icons-material/ArrowBackIosOutlined';
import ArrowForwardIosOutlinedIcon from '@mui/icons-material/ArrowForwardIosOutlined';
import Box from '@mui/material/Box';
import CardMedia from '@mui/material/CardMedia';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import Grid from '@mui/material/Grid';
import RemoveOutlinedIcon from '@mui/icons-material/RemoveOutlined';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

import PropTypes from 'prop-types';

import { SpeciesInfoContext, UserSettingsContext } from '../serverInfo';
import ImageAdjustments from './ImageAdjustments';
import ImageEditSpecies from './ImageEditSpecies';

const NAVIGATION_MASK_TIMEOUT = 500; // The timeout value for showing a navigation mask
const NAVIGATION_MASK_CLEAR_TIMEOUT = 300; // The timeout value for ensuring the navigation mask is cleared

// Default image dimensions for when an image is not loaded (in pixels)
const DEF_IMG_WIDTH = 300;
const DEF_IMG_HEIGHT = 300;

// Ranges of image manipulation values
const brightnessRange = {'min':0, 'max':200}; // Can go higher than 200 and that's adjusted below
const contrastRange = {'min':0, 'max':200};
const hueRange = {'min':-180, 'max':180};
const saturationRange = {'min':0, 'max':200};

// Be sure to add to the type parameter comment when adding new types
/**
 * Returns the UI for editing an image
 * @function
 * @param {string} url The URL of the image top display
 * @param {string} type The type of image ('image', 'movie')
 * @param {string} name The name of the image
 * @param {string} parentId The ID of the parent element to use when positioning
 * @param {int} maxWidth The maximum width of the editing controls
 * @param {int} maxHeight The maximum height of the editing controls
 * @param {function} onClose Called when the user is done editing the image
 * @param {boolean} adjustments Set truthiness to true to allow image adjustments
 * @param {boolean} dropable Set truthiness to true to allow species drag-drop to add to existing species
 * @param {object} navigation Set truthiness to true to display the previous and next navigation elements by providing handlers
 * @param {array} species Array of species already available for the image
 * @param {function} onSpeciesAdd Function to call when a species is added
 * @param {function} onSpeciesChange Function to call when a species is modified
 * @param {object} ref Our reference
 * @returns {object} The UI to render
 */
const ImageEdit = React.forwardRef(({url, type, name, parentId, maxWidth, maxHeight, onClose, adjustments, dropable,
                                   navigation, species, onSpeciesAdd, onSpeciesChange}, ref) => {
  const imageElementRef = React.useRef(null);
  const imageFrameRef = React.useRef(null);
  const imageTransformWrapperRef = React.useRef(null);
  const lastUrlRef = React.useRef(null);
  const navigationLockedRef = React.useRef(false);        // Used to prevent multiple clicks during navigation
  const navigationMaskRef = React.useRef(null);
  const navigationMaskTimeoutIdRef = React.useRef(null);         // Holds the timeout ID for removing the navigation mask
  const speciesItems = React.useContext(SpeciesInfoContext);  // All the species
  const userSettings = React.useContext(UserSettingsContext); // User display settings
  const [brightness, setBrightness] = React.useState(50);    // Image brightness
  const [contrast, setContrast] = React.useState(50);        // Image contrast
  const [curSpecies, setCurSpecies] = React.useState(!!species ? species : []); // Working species
  const [hue, setHue] = React.useState(50);    // From 360 to -360
  const [imageModified, setImageModified] = React.useState(false); // Used to keep track of when an image is modified
  const [imageSize, setImageSize] = React.useState({width:DEF_IMG_WIDTH,height:DEF_IMG_HEIGHT,top:0,left:0,right:DEF_IMG_WIDTH}); // Adjusted when loaded
  const [movieSize, setMovieSize] = React.useState({width:'auto', height:'auto', heightRatio:430/640});
  const [saturation, setSaturation] = React.useState(50);              // Image saturation

  // Special handling from our parent
  React.useImperativeHandle(ref, () => ({
    resetZoom: () => {
      // Reset the image zoom/pan control
      if (imageTransformWrapperRef.current) {
        imageTransformWrapperRef.current.resetTransform();
      }
    },
    getNode: () => imageFrameRef.current,
  }), []);

  // Used to keep our species up to date
  React.useEffect(() => {
    setCurSpecies(!!species ? species : []);
  }, [species])

  // Check if the URL is new to us and reset the image manipulations
  React.useLayoutEffect(() => {
    if (lastUrlRef.current !== url) {
      // Reset image-specific values 
      setBrightness(50);
      setContrast(50);
      setHue(50);
      setSaturation(50);

      lastUrlRef.current = url;
    }
  }, [url]);

  /**
   * Sets the image size based upon the rendered image
   * @function
   */
  const getImageSize = React.useCallback(() => {
    // We want to measure the actual image to get an exact size
    let imageSize = {width:DEF_IMG_WIDTH,height:DEF_IMG_HEIGHT,top:0,left:0,right:DEF_IMG_WIDTH};
    if (!imageElementRef.current) {
      setImageSize(imageSize);
    } else {
      const elSize = imageElementRef.current.getBoundingClientRect();
      imageSize = {'left':elSize.left, 'top':elSize.top, 'width':elSize.width, 'height':elSize.height, 'right':elSize.right };
      setImageSize(imageSize);
    }

    return imageSize;

  }, [setImageSize])

  // Window resize handler
  React.useLayoutEffect(() => {
      function onResize () {
        getImageSize();
        if (type === 'movie') {
          setMovieSize({width:maxWidth, height:maxWidth * movieSize.heightRatio, heightRatio:movieSize.heightRatio});
        }
      }

      window.addEventListener("resize", onResize);
  
      return () => {
          window.removeEventListener("resize", onResize);
      }
  }, [getImageSize, maxWidth, movieSize, setMovieSize, type]);

  /**
   * Shows or hides the navigational mask
   * @function
   * @param {bool} show When set to true the mask is shown, otherwise it's hidden
   */
  const showNavigationMask = React.useCallback((show = true) => {
    if (navigationMaskRef.current) {
      navigationMaskRef.current.style.display = show ? 'initial': 'none';
      navigationMaskRef.current.style.visibility = show ? 'visible' : 'hidden';
    }
  }, []);


  /**
   * Handle when a draggable object is dragged over
   * @function
   * @param {object} event The triggering event
   */
  const dragoverHandler = React.useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);


  /**
   * Handles the user changing the count for a species
   * @function
   * @param {object} event The triggering event
   * @param {string} speciesName The name of the species whose count is changing
   */
  const handleInputChange = React.useCallback((event, speciesName) => {
    const newValue = event.target.value === '' ? 0 : Number(event.target.value);
    let workingSpecies = curSpecies;
    const speciesIdx = workingSpecies.findIndex((item) => item.name === speciesName);
    if (speciesIdx === -1) {
      console.log('Error: unable to find species for updating count', speciesName);
      return;
    }

    // Do nothing if the value hasn't changed
    if (workingSpecies[speciesIdx].count === newValue) {
      return;
    }

    // Make the change
    setImageModified(true);
    onSpeciesChange(speciesName, newValue);
    setCurSpecies(prev => prev.map((item, idx) => idx !== speciesIdx ? item : {...item, count:newValue} ));
  }, [curSpecies, onSpeciesChange]);

  /**
   * Handler for when a species input field no longer has focus
   * @function
   * @param {object} event The triggering event
   * @param {string} speciesName The name of the species associated with the event
   */
  const handleBlur = React.useCallback((event, speciesName) => {
    let workingSpecies = curSpecies;
    const speciesIdx = workingSpecies.findIndex((item) => item.name === speciesName);
    if (speciesIdx === -1) {
      console.log('Error: unable to find species for final checks', speciesName);
      return;
    }
    let newValue = workingSpecies[speciesIdx].count;
    if (newValue < 0) {
      newValue = 0;
    } else if (newValue > 100) {
      newValue = 100;
    }
    setImageModified(true);
    onSpeciesChange(speciesName, newValue);
    setCurSpecies(prev => prev.map((item, idx) => idx !== speciesIdx ? item : {...item, count:newValue} ));
  }, [curSpecies, onSpeciesChange]);

  /**
   * Handles deleting a species from the image
   * @function
   * @param {string} speciesName The name of the species to delete
   */
  const handleSpeciesDelete = React.useCallback((speciesName) => {
    let workingSpecies = curSpecies;
    const speciesIdx = workingSpecies.findIndex((item) => item.name === speciesName);
    if (speciesIdx === -1) {
      console.log('Error: unable to find species for deletion', speciesName);
      return;
    }

    setImageModified(true);
    onSpeciesChange(speciesName, 0);
    setCurSpecies(prev => prev.filter((_, idx) => idx !== speciesIdx));
  }, [curSpecies, onSpeciesChange]);

  /**
   * Handles the click of a navigation button
   * @function
   * @param {function} navFn The navigation function to call (e.g. navigation.onNext or navigation.onPrev)
   */
  const handleNavigation = React.useCallback((navFn) => {
    if (navigationLockedRef.current === true) return;
    navigationLockedRef.current = true;

    if (imageTransformWrapperRef.current) {
      imageTransformWrapperRef.current.resetTransform();
    }

    window.setTimeout(() => {
      const curNavMaskTimeoutId = navigationMaskTimeoutIdRef.current;
      if (curNavMaskTimeoutId) {
        navigationMaskTimeoutIdRef.current = null;
        window.clearTimeout(curNavMaskTimeoutId);
      }
      if (navFn(imageModified)) {
        navigationMaskTimeoutIdRef.current = window.setTimeout(() => {
          navigationMaskTimeoutIdRef.current = null;
          showNavigationMask(true);
        }, NAVIGATION_MASK_TIMEOUT);
      }
      setImageModified(false);
    }, 100);

    navigationLockedRef.current = false;
  }, [imageModified, showNavigationMask]);

  /**
   * Handles when a species is dropped (as part of drag and drop)
   * @function
   * @param {object} event The triggering event
   */
  const dropHandler = React.useCallback((event) => {
    event.preventDefault();
    // Get the id of the target and add the moved element to the target's DOM
    const speciesScientificName = event.dataTransfer.getData("text/plain").toUpperCase();
    const speciesKeyItem = speciesItems.find((item) => item.scientificName.toUpperCase() === speciesScientificName);
    if (speciesKeyItem) {
      onSpeciesAdd(speciesKeyItem);
      if (userSettings.autonext) {
        handleNavigation(navigation.onNext);
      }
    }
  }, [handleNavigation, navigation, onSpeciesAdd, speciesItems, userSettings.autonext]);

  /**
   * Adjusts the movie size after loading
   * @function
   */
  const adjustMovieSize = React.useCallback(() => {
    // Get the image dimensions
    const curImageSize = getImageSize();
    if (curImageSize.width === DEF_IMG_WIDTH && curImageSize.height === DEF_IMG_HEIGHT) {
      window.setTimeout(adjustMovieSize, 200);
      return;
    }

    if (imageFrameRef.current) {
      imageFrameRef.current.style.backgroundImage = 'revert';
    }

    // Adjust size of the image itself
    if (imageElementRef.current) {
      const movieHeightRatio = curImageSize.height / curImageSize.width; 
      const newHeight1 = maxWidth * movieHeightRatio;
      const newWidth2 = maxHeight / movieHeightRatio;

      let newSizes = {width: maxWidth, 
                      height: newHeight1,
                      heightRatio:movieHeightRatio};
      if (newHeight1 > maxHeight) {
        newSizes.width = newWidth2;
        newSizes.height = maxHeight;
      }
      setMovieSize(newSizes);

      window.setTimeout(() => {
        getImageSize();
        }, 200);
    }
  }, [getImageSize, maxWidth, maxHeight, setMovieSize])

  /**
   * Common function to clear the navigation masking element
   * @function
   */
  const clearNavigationMask = React.useCallback(() => {
    const curNavMaskTimeoutId = navigationMaskTimeoutIdRef.current;
    if (curNavMaskTimeoutId) {
      navigationMaskTimeoutIdRef.current = null;
      window.clearTimeout(curNavMaskTimeoutId);
      showNavigationMask(false);
      window.setTimeout(() => showNavigationMask(false), NAVIGATION_MASK_CLEAR_TIMEOUT);
    } else {
      showNavigationMask(false);
    }
  }, [showNavigationMask]);

  /**
   * Handles when the image loads
   * @function
   */
  const onImageLoad = React.useCallback(() => {
    // Hide the navigation mask
    clearNavigationMask();

    // Adjust if we're showing a movie
    if (type === 'image') {
      getImageSize();
    } else if (type === 'movie') {
      adjustMovieSize();
    }

  }, [adjustMovieSize, clearNavigationMask, getImageSize, type]);

  /**
   * Handles when the image fails to load
   * @function
   */
  const onImageError = React.useCallback(() => {
    // Hide the navigation mask
    clearNavigationMask();

    // Hide the failed image loading
    if (imageElementRef.current) {
      imageElementRef.current.style.visibility = "hidden";
    }

    // Change background image
    if (imageFrameRef.current) {
      imageFrameRef.current.style.backgroundImage = 'url("badimage.png")';
    }

    // Get the image dimensions    
    setImageSize({width:DEF_IMG_WIDTH,height:DEF_IMG_HEIGHT,top:0,left:0,right:DEF_IMG_WIDTH});
  }, [clearNavigationMask, setImageSize]);

  /**
   * The adjusted value for brightness
   */
  const brightnessValue = React.useMemo(() => {
    // Less than 50% we return linearly
    if (brightness <= 50) {
      return brightnessRange.min + (brightness / 100.0) * (brightnessRange.max - brightnessRange.min);
    }

    // Greater than 50% we return on a curve
    return 100 + (((brightness - 50.0) / 50.0) * 300);
  }, [brightness]);

  /**
   * The adjusted value for contrast
   */
  const contrastValue = React.useMemo(() => {
    return contrastRange.min + (contrast / 100.0) * (contrastRange.max - contrastRange.min);
  }, [contrast]);

  /**
   * The adjusted value for hue
   */
  const hueValue = React.useMemo(() => {
    return hueRange.min + (hue / 100.0) * (hueRange.max - hueRange.min);
  }, [hue]);

  /**
   * The adjusted value for saturation
   */
  const saturationValue = React.useMemo(() => {
    return saturationRange.min + (saturation / 100.0) * (saturationRange.max - saturationRange.min);
  }, [saturation]);

  /**
   * The image display controls
   */
  const imageControls = React.useMemo(() => {
    if (type === 'image') {
      return (
          <img ref={imageElementRef} src={url} alt={name} onLoad={onImageLoad} onError={onImageError}
               style={{minWidth:DEF_IMG_WIDTH+'px', minHeight:DEF_IMG_HEIGHT+'px', maxWidth:maxWidth, maxHeight:maxHeight, 
                       filter:'brightness('+brightnessValue+'%) contrast('+contrastValue+'%) hue-rotate('+hueValue+'deg) saturate('+saturationValue+'%)'}} 
          />
      );
    }
    else if (type === 'movie') {
      return (
        <CardMedia
            ref={imageElementRef}
            component='video'
            image={url}
            autoPlay
            controls
            onPlay={onImageLoad}
            sx={{width:movieSize.width, height:movieSize.height}}
        />
      );
    }
    else {
      return (
          <Typography variant="body1">
            Unsupported image type "{type}" not displayed
          </Typography>
      );
    }
  }, [brightnessValue, contrastValue, hueValue, name, maxHeight, maxWidth, movieSize, onImageError, onImageLoad, saturationValue, type, url]);

  // Return the rendered UI
  const rowHeight = imageSize.height / 3.0; // Use for the overlays on the image
  const dropExtras = dropable ? {onDrop:dropHandler,onDragOver:dragoverHandler} : {};
  return (
    <React.Fragment>
      <Box id="edit-image-frame" ref={imageFrameRef} sx={{backgroundColor:'white', backgroundImage:'url("loading.gif")', backgroundRepeat:'no-repeat',
                                        backgroundSize:'cover', padding:'10px 8px', position:'relative'}} {...dropExtras} >
        <TransformWrapper ref={imageTransformWrapperRef}>
          <TransformComponent>
            {imageControls}
          </TransformComponent>
        </TransformWrapper>
        <Stack id="edit-image-controls" style={{ position:'absolute', top:(10)+'px', left:10+'px', minWidth:imageSize.width+'px',
                       maxWidth:imageSize.width+'px', width:imageSize.width+'px', minHeight:maxHeight, maxHeight:maxHeight, 
                       pointerEvents:"none"
                    }}
        >
          <Grid id='edit-image-top-row' container direction="row" alignItems="start" justifyContent="space-between" sx={{minHeight:rowHeight,maxHeight:rowHeight}}>
            <Grid size={{ xs: 4, sm: 4}} sx={{position:'relative'}}>
              <ImageAdjustments isVisible={!!adjustments && type === 'image'}
                                adjustments={{brightness:brightness, contrast:contrast, hue:hue, saturation:saturation}}
                                onBrightnessChange={setBrightness} 
                                onContrastChange={setContrast} onHueChange={setHue} onSaturationChange={setSaturation} />
            </Grid>
            <Grid container size={{ xs: 4, sm: 4}} alignItems="center" justifyContent="center" sx={{cursor:'default', pointerEvents:"auto"}}>
              <Typography component="div" sx={{textTransform:'uppercase',color:'grey',textShadow:'1px 1px black','&:hover':{color:'white'} }}>
                {name}
              </Typography>
            </Grid>
            <Grid container direction="column" alignItems="right" justifyContent="right" sx={{marginLeft:'auto', cursor:'default'}}>
              <div id="image-edit-close" onClick={onClose} style={{height:'20px', display:'block', textAlign:'right', pointerEvents:"auto"}} >
                <CloseOutlinedIcon sx={{textTransform:'uppercase',color:'black',backgroundColor:'rgba(255,255,255,0.3)',
                                               padding:'3px 3px 3px 3px',borderRadius:'3px','&:hover':{backgroundColor:'rgba(255,255,255,0.7)'}
                                             }}
                />
              </div>
              <Grid container direction="column" alignItems="center" justifyContent="center" sx={{marginTop:'30px', marginRight:'5px', pointerEvents:"auto"}}>
                <AddOutlinedIcon fontSize="small" onClick={() => {if (imageTransformWrapperRef.current) imageTransformWrapperRef.current.zoomIn();} }
                                  sx={{border:'1px solid black', backgroundColor:'rgb(255,255,255,0.3)',
                                       '&:hover':{backgroundColor:'rgba(255,255,255,0.7)'}, padding:'3px 0px 3px 0px', minHeight:'1.25em' }}/>
                <RemoveOutlinedIcon fontSize="small" onClick={() => {if (imageTransformWrapperRef.current) imageTransformWrapperRef.current.zoomOut();} } 
                                  sx={{border:'1px solid black', backgroundColor:'rgb(255,255,255,0.3)',
                                        '&:hover':{backgroundColor:'rgba(255,255,255,0.7)'}, padding:'3px 0px 3px 0px', minHeight:'1.25em' }} />
              </Grid>
            </Grid>
          </Grid>
          { navigation ?
            <Grid id='edit-image-mid-row' container direction="row" alignItems="center" justifyContent="center" sx={{minHeight:rowHeight,maxHeight:rowHeight}}>
              <Grid size="grow" sx={{position:'relative', marginRight:'auto'}}>
                <ArrowBackIosOutlinedIcon fontSize="large" onClick={() => handleNavigation(navigation.onPrev)}
                          sx={{backgroundColor:'rgba(255,255,255,0.3)', '&:hover':{backgroundColor:'rgba(255,255,255,0.7)'}, pointerEvents:"auto" }} />
              </Grid>
              <Grid container alignItems="right" justifyContent="right" size={{ xs: 6, sm: 6, md:6 }} sx={{position:'relative', marginLeft:'auto'}}>
                <ArrowForwardIosOutlinedIcon fontSize="large" onClick={() => handleNavigation(navigation.onNext)}
                          sx={{backgroundColor:'rgba(255,255,255,0.3)', '&:hover':{backgroundColor:'rgba(255,255,255,0.7)'}, pointerEvents:"auto" }} />
              </Grid>
            </Grid>
            : null
          }
          <Grid id='edit-image-species-top-row' container direction="row" alignItems="end" justifyContent="end"
                sx={{minHeight:rowHeight,maxHeight:rowHeight}}
          >
          { curSpecies && 
            <Grid id="image-edit-species" size={{ xs:6, sm:6, md:6 }} sx={{position:'relative', marginRight:'auto', pointerEvents:"auto"}}>
              {curSpecies.map((curItem) =>
                curItem.count <= 0 ? null :  
                        <ImageEditSpecies key={name+curItem.name}
                                          name={curItem.name?curItem.name:curItem.scientificName}
                                          count={curItem.count}
                                          onDelete={handleSpeciesDelete}
                                          onChange={handleInputChange}
                                          onBlur={handleBlur}
                        />
              )}
            </Grid>
          }
          </Grid>
          { navigation &&
            <Box id="image-edit-navigate-mask" ref={navigationMaskRef} sx={{position:"absolute", left:"0px", top:"0px", minWidth:imageSize.width, minHeight:imageSize.height,
                    display:"none", backgroundColor:"rgb(255, 255, 255, 0.8)", backgroundImage:'url("loading.gif")', backgroundRepeat:"no-repeat",
                    backgroundPosition:'center center'}} />
          }
        </Stack>
      </Box>
    </React.Fragment>
  );
});

ImageEdit.propTypes = {
  url:             PropTypes.string.isRequired,
  type:            PropTypes.oneOf(['image', 'movie']).isRequired,
  name:            PropTypes.string,
  parentId:        PropTypes.string,
  maxWidth:        PropTypes.number,
  maxHeight:       PropTypes.number,
  onClose:         PropTypes.func.isRequired,
  adjustments:     PropTypes.bool,
  dropable:        PropTypes.bool,
  navigation:      PropTypes.shape({
                     onNext: PropTypes.func.isRequired,
                     onPrev: PropTypes.func.isRequired,
                   }),
  species:         PropTypes.array,
  onSpeciesAdd:    PropTypes.func.isRequired,
  onSpeciesChange: PropTypes.func.isRequired,
};

export default ImageEdit
