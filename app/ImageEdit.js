'use client'

/** @module ImageEdit */

import * as React from 'react';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import ArrowBackIosOutlinedIcon from '@mui/icons-material/ArrowBackIosOutlined';
import ArrowForwardIosOutlinedIcon from '@mui/icons-material/ArrowForwardIosOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CardMedia from '@mui/material/CardMedia';
import Grid from '@mui/material/Grid';
import HighlightOffOutlinedIcon from '@mui/icons-material/HighlightOffOutlined';
import MuiInput from '@mui/material/Input';
import RemoveOutlinedIcon from '@mui/icons-material/RemoveOutlined';
import { styled } from '@mui/material/styles';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { v4 as uuidv4 } from 'uuid';

import { SpeciesInfoContext, UserSettingsContext } from './serverInfo';
import ImageAdjustments from './components/ImageAdjustments';
import ImageEditSpecies from './components/ImageEditSpecies';
import InputSlider from './components/InputSlider';

// Width of the input field
const Input = styled(MuiInput)`
  width: 42px;
`;

// Default image dimensions for when an image is not loaded (in pixels)
const DEF_IMG_WIDTH = 300;
const DEF_IMG_HEIGHT = 300;

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
 * @param {function} onSpeciesChange Function to call when a species is added or a count is modified
 * @param {object} ref Our reference
 * @returns {object} The UI to render
 */
export default function ImageEdit({url, type, name, parentId, maxWidth, maxHeight, onClose, adjustments, dropable,
                                   navigation, species, onSpeciesChange, ref}) {
  const imageTransformWrapperRef = React.useRef(null);
  const navigationMaskTimeoutId = React.useRef(null);         // Holds the timeout ID for removing the navigation mask
  const speciesItems = React.useContext(SpeciesInfoContext);  // All the species
  const userSettings = React.useContext(UserSettingsContext); // User display settings
  const [brightness, setBrightness] = React.useState(50);    // Image brightness
  const [contrast, setContrast] = React.useState(50);        // Image contrast
  const [hue, setHue] = React.useState(50);    // From 360 to -360
  const [imageModified, setImageModified] = React.useState(false); // Used to keep track of when an image is modified
  const [imageSize, setImageSize] = React.useState({width:DEF_IMG_WIDTH,height:DEF_IMG_HEIGHT,top:0,left:0,right:DEF_IMG_WIDTH}); // Adjusted when loaded
  const [lastUrl, setLastUrl] = React.useState(null);  // Used to ensure bightness, et al are reset on a new image
  const [movieSize, setMovieSize] = React.useState({width:'auto', height:'auto', heightRatio:430/640});
  const [showAdjustments, setShowAdjustments] = React.useState(false);  // Show image brightness, etc
  const [saturation, setSaturation] = React.useState(50);              // Image saturation
  const [speciesRedraw, setSpeciesRedraw] = React.useState(null);       // Forces redraw due to species change
  const [imageId, setImageId] = React.useState('image-edit-image-'+uuidv4()); // Unique image ID

  const brightnessRange = {'min':0, 'max':200}; // Can go higher than 200 and that's adjusted below
  const contrastRange = {'min':0, 'max':200};
  const hueRange = {'min':-180, 'max':180};
  const saturationRange = {'min':0, 'max':200};

  const NAVIGATION_MASK_TIMEOUT = 500; // The timeout value for showing a navigation mask
  const NAVIGATION_MASK_CLEAR_TIMEOUT = 300; // The timeout value for ensuring the navigation mask is cleared

  // Working species
  let curSpecies = species != undefined ? species : [];

  // Used to prevent multiple clicks during navigation
  let navigationLocked = false;

  // Special handling from our parent
  React.useImperativeHandle(ref, () => ({
    resetZoom: () => {
      // Reset the image zoom/pan control
      if (imageTransformWrapperRef.current) {
        imageTransformWrapperRef.current.resetTransform();
      }
    }
  }), [imageTransformWrapperRef]);

  // Check if the URL is new to us and reset the image manipulations
  React.useLayoutEffect(() => {
    if (lastUrl !== url) {
      // Reset image-specific values 
      setBrightness(50);
      setContrast(50);
      setHue(50);
      setSaturation(50);

      setLastUrl(url);
    }
  }, [imageTransformWrapperRef, lastUrl, setBrightness, setContrast, setHue, setLastUrl, setSaturation, url]);

  /**
   * Sets the image size based upon the rendered image
   * @function
   */
  const getImageSize = React.useCallback(() => {
    const el = document.getElementById(imageId);
    let imageSize = {width:DEF_IMG_WIDTH,height:DEF_IMG_HEIGHT,top:0,left:0,right:DEF_IMG_WIDTH};
    if (!el) {
      setImageSize(imageSize);
    } else {
      const elSize = el.getBoundingClientRect();
      imageSize = {'left':elSize.left, 'top':elSize.top, 'width':elSize.width, 'height':elSize.height, 'right':elSize.right };
      setImageSize(imageSize);
    }

    return imageSize;

  }, [imageId, setImageSize])

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
  }, [getImageSize, movieSize, setMovieSize]);

  /**
   * Handle when a draggable object is dragged over
   * @function
   * @param {object} event The triggering event
   */
  function dragoverHandler(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  /**
   * Handles when a species is dropped (as part of drag and drop)
   * @function
   * @param {object} event The triggering event
   */
  function dropHandler(event) {
    event.preventDefault();
    // Get the id of the target and add the moved element to the target's DOM
    const speciesScientificName = event.dataTransfer.getData("text/plain").toUpperCase();
    const speciesKeyItem = speciesItems.find((item) => item.scientificName.toUpperCase() === speciesScientificName);
    if (speciesKeyItem) {
      handleSpeciesAdd(speciesKeyItem);
      if (userSettings.autonext) {
        handleNavigationNext();
      }
    }
  }

  /**
   * Common handler for adding a species to the image
   * @function
   * @param {object} speciesAdd The species being added
   */
  function handleSpeciesAdd(speciesAdd) {
    const haveSpeciesIdx = curSpecies.findIndex((item) => item.name === speciesAdd.name);
    if (haveSpeciesIdx > -1) {
      curSpecies[haveSpeciesIdx].count = parseInt(curSpecies[haveSpeciesIdx].count) + 1;
      window.setTimeout(() => {
        setSpeciesRedraw(name+curSpecies[haveSpeciesIdx].name+curSpecies[haveSpeciesIdx].count);
      }, 100);
      setImageModified(true);
      onSpeciesChange(speciesAdd.name, curSpecies[haveSpeciesIdx].count);
    } else {
      curSpecies.push({name:speciesAdd.name,scientificName:speciesAdd.scientificName,count:1});
      window.setTimeout(() => {
        setSpeciesRedraw(name+speciesAdd.name+'1');
      }, 100);
      setImageModified(true);
      onSpeciesChange(speciesAdd.name, 1);
    }
  }

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
    if (speciesIdx == -1) {
      console.log('Error: unable to find species for updating count', speciesName);
      return;
    }

    // Do nothing if the value hasn't changed
    if (workingSpecies[speciesIdx].count == newValue) {
      return;
    }

    // Make the change
    setImageModified(true);
    onSpeciesChange(speciesName, newValue);
    workingSpecies[speciesIdx].count = newValue;
    curSpecies = workingSpecies;
    setSpeciesRedraw(workingSpecies[speciesIdx].name+workingSpecies[speciesIdx].count);
  }, [curSpecies, onSpeciesChange, setSpeciesRedraw]);

  /**
   * Handler for when a species input field no longer has focus
   * @function
   * @param {object} event The triggering event
   * @param {string} speciesName The name of the species associated with the event
   */
  const handleBlur = React.useCallback((event, speciesName) => {
    let workingSpecies = curSpecies;
    const speciesIdx = workingSpecies.findIndex((item) => item.name === speciesName);
    if (speciesIdx == -1) {
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
    workingSpecies[speciesIdx].count = newValue;
    curSpecies = workingSpecies;
    setSpeciesRedraw(workingSpecies[speciesIdx].name+workingSpecies[speciesIdx].count);
  }, [curSpecies, onSpeciesChange, setSpeciesRedraw]);

  /**
   * Handles deleting a species from the image
   * @function
   * @param {string} speciesName The name of the species to delete
   */
  function handleSpeciesDelete(speciesName) {
    let workingSpecies = curSpecies;
    const speciesIdx = workingSpecies.findIndex((item) => item.name === speciesName);
    if (speciesIdx == -1) {
      console.log('Error: unable to find species for deletion', speciesName);
      return;
    }
    const removedSpecies = workingSpecies[speciesIdx];
    setImageModified(true);
    onSpeciesChange(speciesName, 0);
    workingSpecies.splice(speciesIdx, 1);
    curSpecies = workingSpecies;
    setSpeciesRedraw(removedSpecies.name+'-deleted');
  }

  /**
   * Shows the navigation mask
   * @function
   */
  function showNavigationMask() {
    // Show the mask
    const el = document.getElementById("image-edit-navigate-mask");
    if (el) {
      el.style.display = "initial";
      el.style.visibility = "visible";
    }
  }

  /**
   * Hides the navigation mask
   * @function
   */
  function hideNavigationMask() {
    // Hide the mask
    const el = document.getElementById("image-edit-navigate-mask");
    if (el) {
      el.style.display = "none";
      el.style.visibility = "hidden";
    }
  }

  /**
   * Handles the click of the next image button
   * @function
   */
  const handleNavigationNext = React.useCallback(() => {
    // Prevent multiple navigation attempts through fast clicking before the control is reloaded
    if (navigationLocked === true) {
      return;
    }
    navigationLocked = true;

    // Reset the image zoom/pan control
    if (imageTransformWrapperRef.current) {
      imageTransformWrapperRef.current.resetTransform();
    }

    // Set a timer to allow the pan/zoom control to reset
    window.setTimeout( () => {
      // Check if we have a pending timeout and cancel it
      const curNavMaskTimeoutId = navigationMaskTimeoutId.current;
      if (curNavMaskTimeoutId) {
        navigationMaskTimeoutId.current = null;
        window.clearTimeout(curNavMaskTimeoutId);
      }

      // Perform the navigation
      if (navigation.onNext(imageModified)) {
        // Show the mask after a timeout if we have navigation
        navigationMaskTimeoutId.current = window.setTimeout(() => {
              // Clear our timer ID and show the mask
              navigationMaskTimeoutId.current = null;
              showNavigationMask();
          }, NAVIGATION_MASK_TIMEOUT);
      }

      setImageModified(false);
    }, 100);

    navigationLocked = false;

  }, [imageTransformWrapperRef, navigation, navigationLocked, NAVIGATION_MASK_TIMEOUT, navigationMaskTimeoutId]);

  /**
   * Handles the click of the prev image button
   * @function
   */
  const handleNavigationPrev = React.useCallback(() => {
    // Prevent multiple navigation attempts through fast clicking before the control is reloaded
    if (navigationLocked === true) {
      return;
    }
    navigationLocked = true;

    // Reset the image zoom/pan control
    if (imageTransformWrapperRef.current) {
      imageTransformWrapperRef.current.resetTransform();
    }

    // Set a timer to allow the pan/zoom control to reset
    window.setTimeout( () => {
      // Check if we have a pending timeout and cancel it
      const curNavMaskTimeoutId = navigationMaskTimeoutId.current;
      if (curNavMaskTimeoutId) {
        navigationMaskTimeoutId.current = null;
        window.clearTimeout(curNavMaskTimeoutId);
      }

      // Perform the navigation
      if (navigation.onPrev(imageModified)) {
        // Show the mask after a timeout if we have navigation
        navigationMaskTimeoutId.current = window.setTimeout(() => {
              // Clear our timer ID and show the mask
              navigationMaskTimeoutId.current = null;
              showNavigationMask();
          }, NAVIGATION_MASK_TIMEOUT);
      }

      setImageModified(false);
    }, 100);

    navigationLocked = false;

  }, [imageTransformWrapperRef, navigation, navigationLocked, NAVIGATION_MASK_TIMEOUT, navigationMaskTimeoutId]);

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

    let el = document.getElementById('edit-image-frame');
    if (el) {
      el.style.backgroundImage = 'revert';
    }

    // Adjust size
    el = document.getElementById(imageId);
    if (el) {
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
  }, [getImageSize, setMovieSize])

  /**
   * Handles when the image loads
   * @function
   */
  const onImageLoad = React.useCallback(() => {
    // Hide the navigation mask
    const curNavMaskTimeoutId = navigationMaskTimeoutId.current;
    if (curNavMaskTimeoutId) {
      navigationMaskTimeoutId.current = null;
      window.clearTimeout(curNavMaskTimeoutId);

      // Clear the mask and set a timer to ensure the mask is cleared in case there's timeout overlaps
      hideNavigationMask();
      window.setTimeout(() => hideNavigationMask(), NAVIGATION_MASK_CLEAR_TIMEOUT);
    } else {
      hideNavigationMask();
    }

    // Adjust if we're showing a movie
    if (type === 'image') {
      getImageSize();
    } else if (type === 'movie') {
      adjustMovieSize();
    }

  }, [adjustMovieSize, hideNavigationMask, navigationMaskTimeoutId]);

  /**
   * Handles when the image failes to load
   * @function
   */
  const onImageError = React.useCallback(() => {
    const curNavMaskTimeoutId = navigationMaskTimeoutId.current;
    if (curNavMaskTimeoutId) {
      navigationMaskTimeoutId.current = null;
      window.clearTimeout(curNavMaskTimeoutId);

      // Clear the mask and set a timer to ensure the mask is cleared in case there's timeout overlaps
      hideNavigationMask();
      window.setTimeout(() => hideNavigationMask(), NAVIGATION_MASK_CLEAR_TIMEOUT);
    } else {
      hideNavigationMask();
    }

    // Hide the failed image loading
    let el = document.getElementById(imageId);
    if (el) {
      el.style.visibility = "hidden";
    }

    // Change background image
    el = document.getElementById('edit-image-frame');
    if (el) {
      el.style.backgroundImage = 'url("badimage.png")';
    }

    // Get the image dimensions    
    setImageSize({width:DEF_IMG_WIDTH,height:DEF_IMG_HEIGHT,top:0,left:0,right:DEF_IMG_WIDTH});
  }, [imageId, setImageSize]);

  /**
   * Returns the adjusted value for brightness
   * @function
   */
  function getBrightness() {
    // Less than 50% we return linearly
    if (brightness <= 50) {
      return brightnessRange.min + (brightness / 100.0) * (brightnessRange.max - brightnessRange.min);
    }

    // Greater than 50% we return on a curve
    return 100 + (((brightness - 50.0) / 50.0) * 300);
  }

  /**
   * Returns the adjusted value for contrast
   * @function
   */
  function getContrast() {
    return contrastRange.min + (contrast / 100.0) * (contrastRange.max - contrastRange.min);
  }

  /**
   * Returns the adjusted value for hue
   * @function
   */
  function getHue() {
    return hueRange.min + (hue / 100.0) * (hueRange.max - hueRange.min);
  }

  /**
   * Returns the adjusted value for saturation
   * @function
   */
  function getSaturation() {
    return saturationRange.min + (saturation / 100.0) * (saturationRange.max - saturationRange.min);
  }

  /**
   * Used to generate the image display control
   * @function
   */
  function generateImageControls() {
    if (type === 'image') {
      return (
          <img id={imageId} src={url} alt={name} onLoad={onImageLoad} onError={onImageError}
               style={{minWidth:DEF_IMG_WIDTH+'px', minHeight:DEF_IMG_HEIGHT+'px', maxWidth:maxWidth, maxHeight:maxHeight, 
                       filter:'brightness('+getBrightness()+'%) contrast('+getContrast()+'%) hue-rotate('+getHue()+'deg) saturate('+getSaturation()+'%)'}} 
          />
      );
    }
    else if (type === 'movie') {
      return (
        <CardMedia
            id={imageId}
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
          <Typography variant="body">
            Unsupported image type "{type}" not displayed
          </Typography>
      );
    }
  }

  // Return the rendered UI
  const rowHeight = imageSize.height / 3.0; // Use for the overlays on the image
  const dropExtras = dropable ? {onDrop:dropHandler,onDragOver:dragoverHandler} : {};
  return (
    <React.Fragment>
      <Box id="edit-image-frame" ref={ref} sx={{backgroundColor:'white', backgroundImage:'url("loading.gif")', backgroundRepeat:'no-repeat',
                                        backgroundSize:'cover', padding:'10px 8px', position:'relative'}} {...dropExtras} >
        <TransformWrapper ref={imageTransformWrapperRef}>
          <TransformComponent>
            {generateImageControls()}
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
              <Typography variant="body" sx={{textTransform:'uppercase',color:'grey',textShadow:'1px 1px black','&:hover':{color:'white'} }}>
                {name}
              </Typography>
            </Grid>
            <Grid container direction="column" alignItems="right" justifyContent="right" sx={{marginLeft:'auto', cursor:'default'}}>
              <div id="image-edit-close" onClick={onClose} style={{height:'20px', display:'block', textAlign:'right', pointerEvents:"auto"}} >
                <Typography variant="body3" sx={{textTransform:'uppercase',color:'black',backgroundColor:'rgba(255,255,255,0.3)',
                                                 padding:'3px 3px 3px 3px',borderRadius:'3px','&:hover':{backgroundColor:'rgba(255,255,255,0.7)'}
                                               }}>
                  X
                </Typography>
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
                <ArrowBackIosOutlinedIcon fontSize="large" onClick={handleNavigationPrev}
                          sx={{backgroundColor:'rgba(255,255,255,0.3)', '&:hover':{backgroundColor:'rgba(255,255,255,0.7)'}, pointerEvents:"auto" }} />
              </Grid>
              <Grid container alignItems="right" justifyContent="right" size={{ xs: 6, sm: 6, md:6 }} sx={{position:'relative', marginLeft:'auto'}}>
                <ArrowForwardIosOutlinedIcon fontSize="large" onClick={handleNavigationNext}
                          sx={{backgroundColor:'rgba(255,255,255,0.3)', '&:hover':{backgroundColor:'rgba(255,255,255,0.7)'}, pointerEvents:"auto" }} />
              </Grid>
            </Grid>
            : null
          }
          <Grid id='edit-image-top-row' container direction="row" alignItems="end" justifyContent="end"
                sx={{minHeight:rowHeight,maxHeight:rowHeight}}
          >
            <Grid id="image-edit-species" size={{ xs:6, sm:6, md:6 }} sx={{position:'relative', marginRight:'auto', visibility:(curSpecies ? 'visible' : 'hidden'), pointerEvents:"auto"}}>
              {curSpecies.map((curItem) =>
                <ImageEditSpecies key={name+curItem.name} name={curItem.name?curItem.name:curItem.scientificName} count={curItem.count} onDelete={handleSpeciesDelete}
                                  onChange={handleInputChange} onBlur={handleBlur} />
              )}
            </Grid>
          </Grid>
          { navigation &&
            <Box id="image-edit-navigate-mask" sx={{position:"absolute", left:"0px", top:"0px", minWidth:imageSize.width, minHeight:imageSize.height,
                    display:"none", backgroundColor:"rgb(255, 255, 255, 0.8)", backgroundImage:'url("loading.gif")', backgroundRepeat:"no-repeat",
                    backgroundPosition:'center center'}} />
          }
        </Stack>
      </Box>
    </React.Fragment>
  );
}