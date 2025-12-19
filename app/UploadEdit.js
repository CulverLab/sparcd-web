'use client'

/** @module UploadEdit */

import * as React from 'react';
import BorderColorOutlinedIcon from '@mui/icons-material/BorderColorOutlined';
import Box from '@mui/material/Box';
import CardMedia from '@mui/material/CardMedia';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import { AddMessageContext, LocationsInfoContext, NarrowWindowContext, SizeContext, SpeciesInfoContext, TokenContext, 
          UploadEditContext, UserSettingsContext } from './serverInfo';
import ImageEdit from './ImageEdit';
import ImageTile from './components/ImageTile';
import { Level } from './components/Messages';
import LocationSelection from './LocationSelection';
import SpeciesKeybind from './components/SpeciesKeybind';
import SpeciesSidebar from './components/SpeciesSidebar';
import SpeciesSidebarItem from './components/SpeciesSidebarItem';
import * as utils from './utils';

import styles from './page.module.css'

/**
 * Handles editing an upload from a collection
 * @function
 * @param {object} selectedUpload The active upload to edit
 * @param {function} onCancel Call when finished with the the upload edit
 * @param {function} searchSetup Call when settting up or clearing search elements
 * @param {function} uploadReload Call when the current upload information needs to be reloaded
 * @returns {object} The UI to render
 */
export default function UploadEdit({selectedUpload, onCancel, searchSetup, uploadReload}) {
  const theme = useTheme();
  const sidebarSpeciesRef = React.useRef(null); // Used for sizeing
  const sidebarTopRef = React.useRef(null);     // Used for sizeing
  const navigationIndicatorTimerId = React.useRef(null); // Used to manage navigation indicator timeout IDs
  const editingStates = React.useMemo(() => {return({'none':0, 'listImages':2, 'editImage': 3}) }, []); // Different states of this page
  const addMessage = React.useContext(AddMessageContext); // Function adds messages for display
  const curUpload = React.useContext(UploadEditContext);
  const editToken = React.useContext(TokenContext);  // Login token
  const locationItems = React.useContext(LocationsInfoContext);
  const narrowWindow = React.useContext(NarrowWindowContext);
  const speciesItems = React.useContext(SpeciesInfoContext);
  const uiSizes = React.useContext(SizeContext);
  const userSettings = React.useContext(UserSettingsContext);  // User display settings
  const [changesMade, setChangesMade] = React.useState(false); // Used to see if there have been changes made
  const [checkedServerChanges, setCheckedServerChanges] = React.useState(false); // Used for checking the server for changes
  const [curEditState, setCurEditState] = React.useState(editingStates.none); // Working page state
  const [curImageEdit, setCurImageEdit] = React.useState(null);         // The image to edit
  const [curImageModified, setCurImageModified] = React.useState(false);// The image being edited was changed
  const [curLocationInfo, setCurLocationInfo] = React.useState(null);   // Working location when fetching tooltip
  const [editingLocation, setEditingLocation] = React.useState(true);   // Changing collection locations flag
  const [havePreviousChanges, setHavePreviousChanges] = React.useState(false);// Used to signal that previous changes we found
  const [lastSpeciesRequestId, setLastSpeciesRequestId] = React.useState(null);  // Use to keep track of what was sent to the server
  const [maxTilesDisplay, setMaxTilesDisplay] = React.useState(40);     // Set the maximum number of tiles to display
  const [navigationRedraw, setNavigationRedraw] = React.useState(null); // Forcing redraw on navigation
  const [nextImageEdit, setNextImageEdit] = React.useState(null);       // The next image in array for editing
  const [observerActive, setObserverActive] = React.useState(false);    // Used to indicate that we've set the observer
  const [pendingMessage, setPendingMessage] = React.useState(null);     // Used to display a pending message on the UI
  const [serverURL, setServerURL] = React.useState(utils.getServer());  // The server URL to use
  const [sidebarWidthLeft, setSidebarWidthLeft] = React.useState(150);  // Width of left sidebar
  const [sidebarHeightTop, setSidebarHeightTop] = React.useState(50);   // Height of top sidebar
  const [sidebarHeightSpecies, setSidebarHeightSpecies] = React.useState(0);   // Height of species sidebar when on top
  const [speciesKeybindName, setSpeciesKeybindName] = React.useState(null); // Name of species for assigning new keybind
  const [speciesRedraw, setSpeciesRedraw] = React.useState(null);       // Force redraw when new species added to image
  const [speciesZoomName, setSpeciesZoomName] = React.useState(null);   // Species to show larger image
  const [workingTop, setWorkingTop] = React.useState(null);             // The absolute top X of workspace
  const [workspaceWidth, setWorkspaceWidth] = React.useState(150);  // The subtracted value is initial sidebar width
  const [totalHeight, setTotalHeight] = React.useState(null);       // Total available height of workspace
  const [tooltipData, setTooltipData] = React.useState(null);       // Data for tooltip
  const [windowSize, setWindowSize] = React.useState({'width':640,'height':480}); // The current window size

  // Some local variables
  const curUploadLocation = React.useMemo(() => locationItems.find((item) => item.idProperty === curUpload.location), [curUpload, locationItems]);

  let curLocationFetchIdx = -1; // Working index of location data to fetch
  let workingTileCount = 40;

  /**
   * Calculates the total available height for the workspace
   * @function
   * @param {object} curSize The working height and width of the window
   */
  const calcTotalHeight = React.useCallback((curSize) => {
    setTotalHeight(uiSizes.workspace.height);
    setWorkingTop(uiSizes.workspace.top);

    // Get the top sidebar and add in the species sidebar if it's on top as well
    const elTopSidebar = document.getElementById('top-sidebar');
    if (elTopSidebar) {
      const elTopSidebarSize = elTopSidebar.getBoundingClientRect();
      setSidebarHeightTop(elTopSidebarSize.height);
    } else {
      setSidebarHeightTop(0);
    }

    const elSpeciesSidebar = document.getElementById('species-sidebar');
    if (elSpeciesSidebar) {
      const elSpeciesSidebarSize = elSpeciesSidebar.getBoundingClientRect();
      if (narrowWindow) {
        setSidebarHeightSpecies(elSpeciesSidebarSize.height);
        setSidebarWidthLeft(0);
      } else {
        setSidebarHeightSpecies(0);
        setSidebarWidthLeft(elSpeciesSidebarSize.width);
      }
    }
  }, [narrowWindow, uiSizes])

  /**
   * Updates the server when the species count changes
   * @function
   * @param {string} requestId The ID of this request used to keep track on the server side
   * @param {string} imageName The name of the image getting changed
   * @param {string} speciesName The name of the species whose count is changing
   * @param {int} speciesCount The new count for that species
   */
  const handleSpeciesChange = React.useCallback((requestId, imageName, speciesName, speciesCount) => {
    const curImageIdx = curUpload.images.findIndex((item) => item.name === imageName);
    if (curImageIdx === -1) {
      console.log('Warning: Unable to find image for updating species', imageName);
      return;
    }
    const curSpeciesIdx = curUpload.images[curImageIdx].species.findIndex((item) => item.name === speciesName);
    if (curSpeciesIdx === -1) {
      console.log('Warning: Unable to find species',speciesName,'for updating count in image',imageName);
      return;
    }
    curUpload.images[curImageIdx].species[curSpeciesIdx].count = speciesCount;

    const curKeySpeciesIdx = speciesItems.findIndex((item) => item.scientificName === curUpload.images[curImageIdx].species[curSpeciesIdx].scientificName);
    if (curKeySpeciesIdx <= -1) {
      console.log('Warning: Unable to find species',speciesName,'in list of species for updating image',imageName);
      return;
    }

    // Mark this image entry as modified
    setCurImageModified(true);

    const speciesUrl = serverURL + '/imageSpecies?t=' + encodeURIComponent(editToken);
    const formData = new FormData();

    formData.append('timestamp', new Date().toISOString());
    formData.append('collection', curUpload.collectionId);
    formData.append('upload', curUpload.upload);
    formData.append('path', curUpload.images[curImageIdx].s3_path);
    formData.append('common', speciesItems[curKeySpeciesIdx].name);
    formData.append('species', speciesItems[curKeySpeciesIdx].scientificName);
    formData.append('count', speciesCount);
    formData.append('reqid', requestId);

    try {
      const resp = fetch(speciesUrl, {
        method: 'POST',
        body: formData
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              throw new Error(`Failed to update image species: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
            // Mark that something has changed
          setChangesMade(true);
        })
        .catch(function(err) {
          console.log('Update Species Count Error: ',err);
          addMessage(Level.Error, 'A problem ocurred while updating the image species');
      });
    } catch (err) {
      console.log('Update Species Count Unknown Error: ',err);
      addMessage(Level.Error, 'An unkown problem ocurred while updating the image species');
    }
  }, [addMessage, curUpload, editToken, serverURL, speciesItems, setCurImageModified]);

  /**
   * Common add a species to the current image function
   * @function
   * @param {string} requestId The unique request ID used to coordinate with the server
   * @param {object} speciesAdd The species to add to the image
   */
  const handleSpeciesAdd = React.useCallback((requestId, speciesAdd) => {
    const haveSpeciesIdx = curImageEdit.species.findIndex((item) => item.scientificName === speciesAdd.scientificName);
    let workingSpecies = null;
    if (haveSpeciesIdx > -1) {
      workingSpecies = curImageEdit.species[haveSpeciesIdx];
      curImageEdit.species[haveSpeciesIdx].count = parseInt(curImageEdit.species[haveSpeciesIdx].count) + 1;
      window.setTimeout(() => {
        setSpeciesRedraw(curImageEdit.name+curImageEdit.species[haveSpeciesIdx].name+curImageEdit.species[haveSpeciesIdx].count);
      }, 100);
    } else {
      workingSpecies = {scientificName:speciesAdd.scientificName, name:speciesAdd.name, count:1};
      curImageEdit.species.push(workingSpecies);
      window.setTimeout(() => {
        setSpeciesRedraw(curImageEdit.name+workingSpecies.name+'1');
      }, 100);
    }
    handleSpeciesChange(requestId, curImageEdit.name, workingSpecies.name, workingSpecies.count);
  }, [curImageEdit, curImageModified, handleSpeciesChange, setSpeciesRedraw])

  /**
   * Handles the user scrolling past the end of the images, so we load more
   * @function
   */
  const onMoreImages = React.useCallback(() => {
    if (curUpload && curUpload.images && maxTilesDisplay < curUpload.images.length) {
      // Figure out how many tiles across we are
      let rowTilesCount = 4;
      const el = document.getElementById('image-edit-workspace');
      if (el && el.children && el.children.length > 1) {
        const childTop = el.children[0].getBoundingClientRect().top;
        rowTilesCount = 1;
        while (rowTilesCount < 40 && rowTilesCount < curUpload.images.length) {
          if (el.children[rowTilesCount].getBoundingClientRect().top != childTop) {
            break;
          }
          rowTilesCount++;
        }
      }

      workingTileCount = workingTileCount + 40;
      setMaxTilesDisplay(workingTileCount + (workingTileCount % rowTilesCount));
    }
  }, [curUpload, maxTilesDisplay]);

  // Check if we need to setup an interaction observer
  React.useLayoutEffect(() => {
    if (!observerActive) {
      const el = document.getElementById('upload-edit-observer');
      if (el) {
        const observerOptions = {
          root: document.getElementById('image-edit-wrapper-box'),
          rootMargin: "5px",
          threshold: 0.0,
        };
        const observer = new IntersectionObserver(onMoreImages, observerOptions);
        observer.observe(el);
        setObserverActive(observer);
      }
    }
  });

  /**
   * Shows the previous image for editing
   * @function
   * @param {bool} imageModified Flag indicating that the current image was modified
   * @param {string} [requestId] The optional request ID associated with th current image
   * @return {bool} Returns true when there's a next image to navigate to, and false otherwise
   */
  const handlePrevImage = React.useCallback((imageModified, requestId) => {
    finishImageEdits(imageModified, requestId ? requestId : lastSpeciesRequestId);

    const curImageIdx =  curUpload.images.findIndex((item) => item.name === curImageEdit.name);
    if (curImageIdx === -1) {
      console.log("Error: unable to find current image before advancing to previous image");
      return false;
    }
    if (curImageIdx > 0) {
      const newImage = curUpload.images[curImageIdx-1];
      const imageEl = document.getElementById(newImage.name);
      setCurImageEdit(newImage);
      if (imageEl) {
        imageEl.scrollIntoView();
      }
      setNextImageEdit(curImageIdx > 1 ? curUpload.images[curImageIdx-2] : null);
      setNavigationRedraw('redraw-image-'+newImage.name);
      setCurImageModified(false);

      // Set the navigation indicator
      const el = document.getElementById('image-edit-edit-wrapper');
      if (el) {
        el.style.borderLeft = '4px solid MediumSeaGreen';
        el.style.borderRight = '4px solid white';
        const prevTimeoutId = navigationIndicatorTimerId.current;
        if (prevTimeoutId) {
          navigationIndicatorTimerId.current = null;
          window.clearTimeout(prevTimeoutId);
        }
        navigationIndicatorTimerId.current = window.setTimeout(() => {
            navigationIndicatorTimerId.current = null;
            el.style.borderLeft = '4px solid white';
        }, 5000)
      }

      return true;
    }

    return false;
  }, [curImageEdit, curUpload, finishImageEdits, lastSpeciesRequestId, setCurImageEdit, setCurImageModified, setNavigationRedraw]);

  /**
   * Shows the next image for editing
   * @function
   * @param {bool} imageModified Flag indicating that the current image was modified
   * @param {string} [requestId] The optional request ID associated with th current image
   * @return {bool} Returns true when there's a next image to navigate to, and false otherwise
   */
  const handleNextImage = React.useCallback((imageModified, requestId) => {
    finishImageEdits(imageModified, requestId ? requestId : lastSpeciesRequestId);

    const curImageIdx =  curUpload.images.findIndex((item) => item.name === curImageEdit.name);
    if (curImageIdx === -1) {
      console.log("Error: unable to find current image before advancing to next image");
      return false;
    }
    if (curImageIdx < curUpload.images.length - 1) {
      const newImage = curUpload.images[curImageIdx+1];
      const imageEl = document.getElementById(newImage.name);
      setCurImageEdit(newImage);
      if (imageEl) {
        imageEl.scrollIntoView();
      }
      setNextImageEdit(curImageIdx < curUpload.images.length - 2 ? curUpload.images[curImageIdx+2] : null);
      setNavigationRedraw('redraw-image-'+newImage.name);
      setCurImageModified(false);

      // Set the navigation indicator
      const el = document.getElementById('image-edit-edit-wrapper');
      if (el) {
        el.style.borderRight = '4px solid MediumSeaGreen';
        el.style.borderLeft = '4px solid white';
        const prevTimeoutId = navigationIndicatorTimerId.current;
        if (prevTimeoutId) {
          navigationIndicatorTimerId.current = null;
          window.clearTimeout(prevTimeoutId);
        }
        navigationIndicatorTimerId.current = window.setTimeout(() => {
            navigationIndicatorTimerId.current = null;
            el.style.borderRight = '4px solid white';
        }, 5000)
      }

      return true;
    }

    return false;
  }, [curImageEdit, curUpload, finishImageEdits, lastSpeciesRequestId, setCurImageEdit, setCurImageModified, setNavigationRedraw]);

  // Render time width and height measurements
  React.useLayoutEffect(() => {
    setWorkspaceWidth(uiSizes.workspace.width);
    setWindowSize(uiSizes.window);
    calcTotalHeight(uiSizes);
  }, [uiSizes])

  // Measurements when resizing the window
  React.useLayoutEffect(() => {
      function onResize () {
        // Calculate the top sidebar and add in the species sidebar if it's on top as well
        if (sidebarTopRef && sidebarTopRef.current) {
          topHeight = sidebarTopRef.current.offsetHeight;
          setSidebarHeightTop(topHeight);
        }

        if (sidebarSpeciesRef && sidebarSpeciesRef.current) {
          if (narrowWindow) {
            leftWidth = 0;
            setSidebarWidthLeft(0);
            setSidebarHeightSpecies(sidebarSpeciesRef.current.offsetHeight);
          } else {
            leftWidth = sidebarSpeciesRef.current.offsetWidth;
            setSidebarWidthLeft(leftWidth);
            setSidebarHeightSpecies(0);
          }
        }

        const newWorkspaceWidth = uiSizes.workspace.width - leftWidth;
        setWorkspaceWidth(newWorkspaceWidth);
      }

      window.addEventListener("resize", onResize);
  
      return () => {
          window.removeEventListener("resize", onResize);
      }
  }, [narrowWindow, uiSizes]);

  /**
   * Handles user kep presses
   * @function
   * @param {object} event The keypress event
   */
  const onKeypress = React.useCallback((event) => {
    if (curEditState === editingStates.editImage) {
      if (event.key !== 'Meta') {
        if (event.key === 'ArrowLeft') {
          handlePrevImage(curImageModified);
        } else if (event.key === 'ArrowRight') {
          handleNextImage(curImageModified);
        } else if (!event.altKey && !event.ctrlKey) {
          const speciesKeyItem = speciesItems.find((item) => item.keyBinding == event.key.toUpperCase());
          if (speciesKeyItem) {
            let requestId = Date.now();
            setLastSpeciesRequestId(requestId);
            handleSpeciesAdd(requestId, speciesKeyItem);
            event.preventDefault();

            if (userSettings.autonext) {
              handleNextImage(true, requestId);
            }
          }
        }
      }
    }
  }, [curEditState, editingStates, finishImageEdits, handleNextImage, handlePrevImage, handleSpeciesAdd, setLastSpeciesRequestId, speciesItems, userSettings]);

  // Handling keypress events when adding a species to an image
  React.useEffect(() => {
    document.addEventListener("keydown", onKeypress);

    return () => {
      document.removeEventListener("keydown", onKeypress);
    }
  }, [onKeypress]);


  // Determine if we already have changes on the server
  React.useEffect(() => {
    if (!changesMade && !checkedServerChanges) {
      const checkChangesUrl = serverURL + '/checkChanges?t=' + encodeURIComponent(editToken);
      const formData = new FormData();

      formData.append('id', curUpload.collectionId);
      formData.append('up', curUpload.upload);

      try {
        const resp = fetch(checkChangesUrl, {
          method: 'POST',
          body: formData
        }).then(async (resp) => {
              if (resp.ok) {
                return resp.json();
              } else {
                throw new Error(`Failed to check for update server changes: ${resp.status}`, {cause:resp});
              }
            })
          .then((respData) => {
            setChangesMade(respData.changesMade);
            setHavePreviousChanges(respData.changesMade);
            setCheckedServerChanges(true);
          })
          .catch(function(err) {
            console.log('Check Changes Error: ', err);
            addMessage(Level.Error, 'A problem ocurred while checking for server upload changes');
        });
      } catch (error) {
        console.log('Check Changes Unknown Error: ', err);
        addMessage(Level.Error, 'An unkown problem ocurred checking for server upload changes');
      }
    }
  }, [addMessage, changesMade, checkedServerChanges, curUpload, editToken, serverURL, setChangesMade, setCheckedServerChanges]);

  /**
   * Searches for images that meet the search criteria and scrolls it into view
   * @function
   * @param {string} searchTerm The term to search an image name for
   * @param {number} {iterCount} The number of times we have tried to automatically find a term
   */
  const handleImageSearch = React.useCallback((searchTerm, iterCount) => {
    const lcSearchTerm = searchTerm.toLowerCase();
    const foundImage = curUpload.images.find((item) => item.name.toLowerCase().includes(lcSearchTerm));
    if (!foundImage) {
      return false;
    }

    iterCount = iterCount === undefined ? 0 : iterCount;
    if (iterCount > 4) {
      // Something is wrong, we have failed
      return false;
    }

    const foundEl = document.getElementById(foundImage.name);
    if (!foundEl) {
      const imageIndex = curUpload.images.findIndex((item) => item.name === foundImage.name);
      while (workingTileCount < imageIndex && workingTileCount < curUpload.images.length - 1) {
        onMoreImages();
      }

      window.setTimeout(() => handleImageSearch(searchTerm, iterCount + 1), 500);
      return true;
    }

    foundEl.scrollIntoView();
    foundEl.focus();

    window.setTimeout(() => 
        {
            foundEl.classList.add(styles.blink);
            window.setTimeout(() => foundEl.classList.remove(styles.blink), 1500);
        }, 200);
    return true;
  }, [curUpload, workingTileCount, onMoreImages]);

  /**
   * Updates the server with a new location for the upload
   * @function
   * @param {object} newLoc The new location to update the collection to
   */
  const onLocationContinue = React.useCallback((newLoc) => {

    // Check for a change so we don't make unneeded edits
    if (newLoc.idProperty !== curUpload.location) {

      const updateLocationUrl = serverURL + '/uploadLocation?t=' + encodeURIComponent(editToken);
      const formData = new FormData();

      setPendingMessage("Updating location, please wait ...");

      formData.append('timestamp', new Date().toISOString());
      formData.append('collection', curUpload.collectionId);
      formData.append('upload', curUpload.upload);
      formData.append('locId', newLoc.idProperty);
      formData.append('locName', newLoc.nameProperty);
      formData.append('locElevation', newLoc.elevationProperty);
      formData.append('locLat', newLoc.latProperty);
      formData.append('locLon', newLoc.lngProperty);

      try {
        const resp = fetch(updateLocationUrl, {
          method: 'POST',
          body: formData
        }).then(async (resp) => {
              if (resp.ok) {
                return resp.json();
              } else {
                throw new Error(`Failed to upload location: ${resp.status}`, {cause:resp});
              }
            })
          .then((respData) => {
              // Clean up the UI
              setPendingMessage(null);
              setChangesMade(true);
          })
          .catch(function(err) {
            console.log('Update Location Error: ',err);
            addMessage(Level.Error, 'A problem ocurred while updating the collection location');
            setPendingMessage(null);
        });
      } catch (error) {
        console.log('Update Location Unknown Error: ',err);
        addMessage(Level.Error, 'An unkown problem ocurred while updating the collection location');
        setPendingMessage(null);
      }
    }

    curUpload.location = newLoc.idProperty;
    setCurEditState(editingStates.listImages);
    setEditingLocation(false);
    searchSetup('Image Name', handleImageSearch);
  }, [addMessage, curUpload, editingStates, handleImageSearch, setPendingMessage, searchSetup, serverURL, setCurEditState, setEditingLocation])


  // Adding drag-and-drop starting attributes to species elements
  React.useLayoutEffect(() => {
    speciesItems.forEach((item) => {
      const el = document.getElementById('card-' + item.name);
      el.addEventListener("dragstart", (ev) => dragstartHandler(ev, item.scientificName));
    });
  }, [speciesItems]);


  // Checking if we already have a location for the upload so we skip the initial prompt to assign loc.
  React.useEffect(() => {
    if (curUpload && curUpload.location) {
      setCurEditState(editingStates.listImages);
      setEditingLocation(false);
      searchSetup('Image Name', handleImageSearch);
    }
  }, [curUpload]);

  /**
   * Setting the drag information when drag starts
   * @function
   * @param {object} event The drag start event
   * @param {string} value The drag sequence value
   */
  function dragstartHandler(event, value) {
    // Add the target element's id to the data transfer object
    event.dataTransfer.setData("text/plain", value);
    event.dataTransfer.dropEffect = "copy";
  }

  /**
   * Calls the edit cancel function to stop editing an upload
   * @function
   * @param {object} event The current event
   */
  function handleCancel(event) {
    onCancel();
  }

  /**
   * Sets up for changing a species keybinding
   * @function
   * @param {object} event The current event
   * @param {string} name The species name to change
   * @param {object} oldKeybinding The old keybinding value
   */
  function onKeybindClick(event, name, oldKeybinding) {
    setSpeciesZoomName(null);
    if (curEditState !== editingStates.editImage) {
      setSpeciesKeybindName(name);
    } else {
      setSpeciesKeybindName(null);
    }
  }

  /**
   * Updates the server with the changed species keybinding
   * @function
   * @param {string} speciesName The name of the species to change the keybinding for
   * @param {string} newKey The new keybinding character
   */
  function keybindChange(speciesName, newKey) {
    const newKeySpeciesIdx = speciesItems.findIndex((item) => item.name === speciesName);
    if (newKeySpeciesIdx <= -1) {
      return;
    }

    const keybindUrl = serverURL + '/speciesKeybind?t=' + encodeURIComponent(editToken);
    const formData = new FormData();

    formData.append('common', speciesItems[newKeySpeciesIdx].name);
    formData.append('scientific', speciesItems[newKeySpeciesIdx].scientificName);
    formData.append('key', newKey);

    try {
      const resp = fetch(keybindUrl, {
        method: 'POST',
        body: formData
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              throw new Error(`Failed to update species keybind: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
            // Nothing to do            
        })
        .catch(function(err) {
          console.log('Update Location Error: ',err);
          addMessage(Level.Error, 'A problem ocurred while updating the keybinding');
      });
    } catch (error) {
      console.log('Update Location Unknown Error: ',err);
      addMessage(Level.Error, 'An unkown problem ocurred while updating the keybinding');
    }

    speciesItems[newKeySpeciesIdx].keyBinding = newKey;
  }

  /**
   * Updates the currently edited image with any changes made
   * @function
   * @param {bool} imageModified Inicator for if the image was modified
   * @param {string} requestId The last sent request ID
   * @param {function} {cbSuccess} The optional function to call upon success
   * @param {function} {cbFailure} The optional function to call upon failure
   */
  function finishImageEdits(imageModified, requestId, cbSuccess, cbFailure) {
    const curImageIdx =  curUpload.images.findIndex((item) => item.name === curImageEdit.name);
    if (curImageIdx === -1) {
      console.log("Error: unable to find current image to commit changes made");
      addMessage(Level.Error, "Unable to find working image in order to commit the changes made");
      return;
    }

    if (imageModified && curUpload) {
      submitImageEditComplete(curUpload.collectionId, curUpload.upload, curUpload.images[curImageIdx].s3_path, requestId, cbSuccess, cbFailure);
    } else {
      if (typeof(cbSuccess) === 'function') {
        cbSuccess();
      }
    }
  }

  /**
   * Makes the call when the user has fully completed editing images. We retry if that's an option (and the request hasn't worked out)
   * for a number of times before we have the server save what it has by setting the tryHarder flag
   * @function
   * @param {string} collectionId The ID of the collection the image belongs to
   * @param {string} uploadName The name of the upload begin edited
   * @param {string} lastRequestId The last request ID we sent to the server
   * @param {string} timestamp The ISO string of the edit timestamp
   * @param {integer} {numTries} The number of attempted tries
   * @param {bool} {tryHarder} When true sets the try harder flag on the server request. This can't be set too early
   *                            in case there's an edit that has been delayed in being received and processed by the server
   */
  const submitAllImageEdited = React.useCallback((collectionId, uploadName, lastRequestId, timestamp, numTries, tryHarder) => {

    numTries = numTries ? numTries + 1 : 1;

    const allEditedUrl = serverURL + '/imagesAllEdited?t=' + encodeURIComponent(editToken);
    const formData = new FormData();

    formData.append('collection', collectionId);
    formData.append('upload', uploadName);
    if (lastRequestId !== null) {
      formData.append('requestId', lastRequestId);
    }
    formData.append('timestamp', timestamp);
    if (tryHarder === true) {
      formData.append('force', true);
    }

    try {
      const resp = fetch(allEditedUrl, {
        method: 'POST',
        body: formData
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              throw new Error(`Failed to finish all image editing changes: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
            // Check for a good response
            if (respData.success === true) {
              // Check if most things worked out but a retry is in order
              if (respData.retry === undefined || respData.retry !== true) {
                setPendingMessage(null);
                setChangesMade(false);
                setCurImageModified(false);
                if (respData.imagesReloaded !== undefined && respData.imagesReloaded) {
                  // Cause the images to be reloaded
                  uploadReload();
                }
              } else {
                // Things worked out, but there may be a timing issue with the edits, try again if we're not trying too much
                const tryHarder = numTries === 3;
                if (numTries < 4) {
                  window.setTimeout(() => submitAllImageEdited(collectionId, uploadName, lastRequestId, timestamp, numTries, tryHarder), 1000 * numTries);
                } else {
                  setPendingMessage(null);
                  if (respData.foundEdits > 0) {
                    addMessage(Level.Error, "Unable to finish all image editing changes ");
                  }
                }
              }
            }
        })
        .catch(function(err) {
          setPendingMessage(null);
          console.log('Finish Images Edit Error: ',err);
          addMessage(Level.Error, 'A problem ocurred while finishing the edited images changes');
      });
    } catch (err) {
      setPendingMessage(null);
      console.log('Finish Images Edit Commit Unknown Error: ',err);
      addMessage(Level.Error, 'An unkown problem ocurred while finishing the edited image changes');
    }
  }, [addMessage, editToken, serverURL]);

  /**
   * Handles the user finishing up image edits
   * @function
   */
  const handleImageEditClose = React.useCallback(() => {
    setCurEditState(editingStates.listImages);
    searchSetup('Image Name', handleImageSearch);

    setPendingMessage("Finishing any changes made to images");

    finishImageEdits(curImageModified, lastSpeciesRequestId,
        () => { if (changesMade) {
                  submitAllImageEdited(curUpload.collectionId, curUpload.upload, lastSpeciesRequestId, new Date().toISOString());
                } else {
                  setPendingMessage(null);
                }
              }
    );
  }, [curImageModified, curUpload, editingStates, finishImageEdits, handleImageSearch, lastSpeciesRequestId, searchSetup,
      setCurEditState, setPendingMessage, submitAllImageEdited]);

  /**
   * Makes the call for an image to be finished with editing. Allows for retry events
   * @function
   * @param {string} collectionId The ID of the collection the image belongs to
   * @param {string} uploadName The name of the upload begin edited
   * @param {string} image_path The path of the image 
   * @param {object} lastRequestId The ID of the last image-specific request ID sent
   * @param {function} {cbSuccess} The optional function to call upon success
   * @param {function} {cbFailure} The optional function to call upon failure
   * @param {integer} {numTries} The number of attempted tries
   */
  const submitImageEditComplete = React.useCallback((collectionId, uploadName, imagePath, lastRequestId, cbSuccess, cbFailure, numTries) => {

    numTries = numTries ? numTries + 1 : 1;
    const failureFunc = typeof(cbFailure) === 'function' ? cbFailure : (msg) => addMessage(Level.Error, msg);

    const completedUrl = serverURL + '/imageEditComplete?t=' + encodeURIComponent(editToken);
    const formData = new FormData();

    formData.append('collection', collectionId);
    formData.append('upload', uploadName);
    formData.append('path', imagePath);
    formData.append('lastReqid', lastRequestId);  // Last species request sent out

    try {
      const resp = fetch(completedUrl, {
        method: 'POST',
        body: formData
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              throw new Error(`Failed to update image with editing changes: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
            // Check for a good response and 
            if (respData.success === true) {
              if (respData.retry !== true) {
                if (typeof(cbSuccess) === 'function') {
                  cbSuccess();
                }
              } else {
                // Things worked out, but there may be a timing issue with the edits, try again if we're not trying too much
                if (numTries < 4) {
                  window.setTimeout(() => submitImageEditComplete(collectionId, uploadName, imagePath, lastRequestId, cbSuccess, cbFailure, numTries), 1000 * numTries);
                } else {
                  // We've made many tries, if there isn't an error, we assume it was taken care of
                  if (respData.error !== true) {
                    if (typeof(cbSuccess) === 'function') {
                      cbSuccess();
                    }
                  } else {
                    failureFunc("Unable to complete the editing changes to image " + respData.filename);
                  }
                }
              }
            } else {
              failureFunc(respData.message);
            }
        })
        .catch(function(err) {
          console.log('Update Image Edit Complete Error: ',err);
          failureFunc('A problem ocurred while updating the stored image with these changes');
      });
    } catch (err) {
      console.log('Update Image Edit Commit Complete Error: ',err);
      failureFunc('An unkown problem ocurred while updating the stored image with these changes');
    }
  }, [addMessage, editToken, lastSpeciesRequestId, serverURL]);

  /**
   * Calls the server to get location details for tooltips
   * @function
   * @param {int} locIdx The index of the location to get the details for
   */
  const getTooltipInfoOpen = React.useCallback((locIdx) => {
    if (curLocationFetchIdx != locIdx) {
      curLocationFetchIdx = locIdx;
      const cur_loc = locationItems[curLocationFetchIdx];
      const locationInfoUrl = serverURL + '/locationInfo?t=' + encodeURIComponent(editToken);

      const formData = new FormData();

      formData.append('id', cur_loc.idProperty);
      formData.append('name', cur_loc.nameProperty);
      formData.append('lat', cur_loc.latProperty);
      formData.append('lon', cur_loc.lngProperty);
      formData.append('ele', cur_loc.elevationProperty);
      try {
        const resp = fetch(locationInfoUrl, {
          credentials: 'include',
          method: 'POST',
          body: formData
        }).then(async (resp) => {
              if (resp.ok) {
                return resp.json();
              } else {
                throw new Error(`Failed to get location information: ${resp.status}`, {cause:resp});
              }
            })
          .then((respData) => {
              // Save tooltip information
              const locInfo = Object.assign({}, respData, {'index':curLocationFetchIdx});

              if (locIdx === curLocationFetchIdx) {
                setTooltipData(locInfo);
              }
                })
          .catch(function(err) {
            console.log('Location tooltip Error: ',err);
        });
      } catch (error) {
        console.log('Location tooltip Unknown Error: ',err);
      }
    }
  }, [curLocationFetchIdx, editToken, locationItems, serverURL, setTooltipData]);

  /**
   * Clears tooltip information when no longer needed. Ensures only the working tooltip is cleared
   * @function
   * @param {int} locIdx The index of the location to clear
   */
  function clearTooltipInfo(locIdx) {
    // Only clear the information if we're the active tooltip
    if (locIdx == curLocationFetchIdx) {
      setCurLocationInfo(null);
    }
  }

  /**
   * Sets the flag indicating the user wants to edit the upload location
   * @function
   */
  const handleEditLocation = React.useCallback(() => {
    setEditingLocation(true);
  }, [setEditingLocation]);

  /**
   * Called set the page state to a specific image for editing and performs setup functions
   * @function
   * @param {string} imageName The name of the image to edit
   */
  const handleEditingImage = React.useCallback((imageName) => {
    setCurEditState(editingStates.editImage);
    const imageIdx = curUpload.images.findIndex((item) => item.name === imageName);
    if (imageIdx >= 0) {
      setCurImageEdit(curUpload.images[imageIdx]);
      searchSetup();
      setNextImageEdit(imageIdx < curUpload.images.length - 1 ? curUpload.images[imageIdx+1] : null);
    } else {
      console.log('WARNING: attempting to edit a non-existant image', imageName);
    }
  }, [curUpload, editingStates, searchSetup, setCurEditState, setCurImageEdit]);

  // Variables to help with generating the UI
  const curHeight = totalHeight;
  const curStart = workingTop;
  const workplaceStartX = sidebarWidthLeft;

  /**
   * Generates the image tiles for the available images
   * @function
   * @param {function} clickHandler The handler for when an image tile is clicked
   * @returns {object} The rendered UI
   */
  function generateImageTiles(clickHandler) {
    // TODO: generate only the amount needed to display and override the scroll bar
    const maxTiles = curUpload.images ? Math.min(maxTilesDisplay, curUpload.images.length) : maxTilesDisplay;
    const workingImages = curUpload.images ? curUpload.images.slice(0, maxTiles) : null;
    return (
      <React.Fragment>
        <Grid id='image-edit-workspace' container direction="row" alignItems="start" justifyContent="start" rowSpacing={{xs:1}} columnSpacing={{xs:1, sm:2, md:4}}>
      { workingImages ? 
        workingImages.map((item) => {
          let imageSpecies = item.species && item.species.length > 0;
          return (
            <Grid size={{ xs: 12, sm: 4, md:3 }} key={item.name}>
              <ImageTile name={item.name} type={item.type} species={item.species} onClick={() => clickHandler(item.name)} />
            </Grid>
          )}
        )
        :
          <Grid size={{ xs: 12, sm: 12, md:12 }}>
            <Container sx={{border:'1px solid grey', borderRadius:'5px', color:'darkslategrey', background:'#E0F0E0'}}>
              <Typography variant="body" sx={{ color: 'text.secondary' }}>
                No images are available
              </Typography>
            </Container>
          </Grid>
      }
      </Grid>
      { workingImages && maxTiles < curUpload.images.length &&
          <Grid id='upload-edit-observer' size={{ xs: 12, sm: 12, md:12 }}>
            <Container sx={{border:0, color:'transparent'}}>
              <div style={{height:'10px', width:'100px'}} />
            </Container>
          </Grid>
      }
      </React.Fragment>
    );
  }

  // TODO: Make species bar on top when narrow screen
  const topbarVisiblity = curEditState === editingStates.editImage || curEditState === editingStates.listImages ? 'visible' : 'hidden';
  const imageVisibility = (curEditState === editingStates.editImage || curEditState === editingStates.listImages) && !editingLocation ? 'visible' : 'hidden';
  // Return the rendered page
  return (
    <Stack id="upload-edit" direction={{xs:'column', md:"row"}} sx={{ flexGrow: 1, top:curStart+'px', height: uiSizes.workspace.height+'px', width: uiSizes.workspace.width+'px' }} >
      <SpeciesSidebar species={speciesItems}
                      position={narrowWindow?'top':'left'}
                      speciesSidebarRef={sidebarSpeciesRef}
                      workingDim={narrowWindow?'100vw':curHeight+'px'}
                      topX={narrowWindow ? curStart + sidebarHeightTop : curStart} 
                      onKeybind={(event, speciesItem) => {onKeybindClick(event, speciesItem.name, speciesItem.keyBinding);event.preventDefault();}}
                      onZoom={(event, speciesItem) => {setSpeciesZoomName(speciesItem.name);setSpeciesKeybindName(null);event.preventDefault();}}
      />
      <Stack id="upload-edit-details" direction={{xs:"column"}} >
        <Grid id='top-sidebar' ref={sidebarTopRef} container direction='row' alignItems='center' justifyContent='center' rows='1'
            style={{ ...theme.palette.top_sidebar, minWidth:(workspaceWidth-workplaceStartX)+'px', maxWidth:(workspaceWidth-workplaceStartX)+'px',
                     position:'sticky', verticalAlignment:'middle', visibility:topbarVisiblity }} >
          <Grid>
            <Typography variant="body" sx={{ paddingLeft: '10px'}}>
              {curUpload.name}
            </Typography>
          </Grid>
          <Grid sx={{marginLeft:'auto'}}>
            <Typography variant="body" sx={{ paddingLeft: '10px', fontSize:'larger'}}>
              {curUploadLocation && curUploadLocation.nameProperty ? curUploadLocation.nameProperty : '<location>'}
            </Typography>
            <IconButton aria-label="edit" size="small" color={'lightgrey'} onClick={handleEditLocation}>
              <BorderColorOutlinedIcon sx={{fontSize:'smaller'}}/>
            </IconButton>
          </Grid>
        </Grid>
        { curEditState == editingStates.listImages || curEditState == editingStates.editImage ? 
            <Box id="image-edit-wrapper-box"
                  style={{ marginLeft:'10px',
                           marginRight:'10px',
                           paddingTop:'10px',
                           minHeight:(curHeight-sidebarHeightTop-sidebarHeightSpecies)+'px',
                           maxHeight:(curHeight-sidebarHeightTop-sidebarHeightSpecies)+'px',
                           height:(curHeight-sidebarHeightTop-sidebarHeightSpecies)+'px',
                           minWidth:(workspaceWidth-sidebarWidthLeft-(10*2))+'px',
                           maxWidth:(workspaceWidth-sidebarWidthLeft-(10*2))+'px',
                           width:(workspaceWidth-sidebarWidthLeft-(10*2))+'px', 
                           overflow:'scroll', 'visibility':imageVisibility }}
            >
              {generateImageTiles(handleEditingImage)}
            </Box>
          : null
        }
      </Stack>
      { curEditState === editingStates.editImage ?
        <Grid id='image-edit-edit' container direction="column" alignItems="center" justifyContent="center"
              style={{ paddingTop:'10px',
                       paddingLeft:'10px',
                       minHeight:curHeight+'px',
                       maxHeight:curHeight+'px', 'height':curHeight+'px',
                       left:workplaceStartX,
                       minWidth:(workspaceWidth-sidebarWidthLeft)+'px',
                       maxWidth:(workspaceWidth-sidebarWidthLeft)+'px',
                       width:(workspaceWidth-sidebarWidthLeft)+'px', 
                       position:'absolute',
                       visibility:imageVisibility,
                       backgroundColor:'rgb(0,0,0,0.7)' }}>
          <Grid id='image-edit-edit-wrapper' sx={{borderLeft:'4px solid white', borderRight:'4px solid white'}} >
            <ImageEdit url={curImageEdit.url}
                       type={curImageEdit.type}
                       name={curImageEdit.name}
                       parentId='image-edit-edit'
                       maxWidth={workspaceWidth-40}
                       maxHeight={curHeight-40} 
                       onClose={handleImageEditClose}
                       adjustments={true}
                       dropable={true}
                       navigation={{onPrev:handlePrevImage,onNext:handleNextImage}}
                       species={curImageEdit.species}
                       onSpeciesChange={(speciesName, speciesCount) => {
                                                          const requestId = Date.now();
                                                          setLastSpeciesRequestId(requestId);
                                                          handleSpeciesChange(requestId, curImageEdit.name, speciesName, speciesCount);
                                                        }
                                        }
            />
            {nextImageEdit && nextImageEdit.type === 'image' && 
                                      <img id="next-image-preload" src={nextImageEdit.url} 
                                                                  style={{position:'absolute', top:'0px', letf:'0px', display:'none', visibility:'hidden'}} />}
            {nextImageEdit && nextImageEdit.type === 'movie' && 
                                      <CardMedia id="next-image-preload" component='video' image={nextImageEdit.url}
                                                                  sx={{position:'absolute', top:'0px', letf:'0px', display:'none', visibility:'hidden'}} />}
          </Grid>
        </Grid>
        : null
      }
      { editingLocation ? 
          <Grid id='image-edit-location' container spacing={0} direction="column" alignItems="center" justifyContent="center"
                style={{ 'minHeight':curHeight+'px', 'maxHeight':curHeight+'px', 'height':curHeight+'px', 
                        'top':(curStart+sidebarHeightTop)+'px',
                         'left':workplaceStartX+'px',
                         'minWidth':(workspaceWidth-sidebarWidthLeft)+'px',
                         'maxWidth':(workspaceWidth-sidebarWidthLeft)+'px',
                         'width':(workspaceWidth-sidebarWidthLeft)+'px',
                         'position':'absolute'}}>
            <LocationSelection title={curUpload.name} locations={locationItems} defaultLocation={curUploadLocation} 
                               onTTOpen={getTooltipInfoOpen} onTTClose={clearTooltipInfo}
                               dataTT={tooltipData} onContinue={onLocationContinue}
                               onCancel={curEditState == editingStates.none ? handleCancel : () => setEditingLocation(false)}
            />
          </Grid>
        : null }
      { speciesZoomName ? 
          <Grid id='image-edit-species-image' container spacing={0} direction="column" alignItems="center" justifyContent="center"
              style={{ 'paddingTop':'10px', 'paddingLeft':'10px',
                       'minHeight':curHeight+'px', 'maxHeight':curHeight+'px', 'height':curHeight+'px',
                       'top':curStart+'px', 
                       'left':workplaceStartX,
                       'minWidth':(workspaceWidth-sidebarWidthLeft)+'px',
                       'maxWidth':(workspaceWidth-sidebarWidthLeft)+'px',
                       'width':(workspaceWidth-sidebarWidthLeft)+'px', 
                       'position':'absolute', backgroundColor:'rgb(0,0,0,0.7)' }}>
              <Grid size={{ xs: 12, sm: 12, md:12 }}>
                <ImageEdit url={speciesItems.find((item)=>item.name===speciesZoomName).speciesIconURL}
                           type='image'
                           name={speciesZoomName}
                           parentX={workplaceStartX}
                           parentId='image-edit-species-image'
                           maxWidth={workspaceWidth-40}
                           maxHeight={curHeight-40}
                           onClose={() => setSpeciesZoomName(null)}
                           adjustments={false}
                />
            </Grid>
          </Grid>
        : null
      }
      { speciesKeybindName && curEditState !== editingStates.editImage ? 
          <Grid id='image-edit-species-keybind' container spacing={0} direction="column" alignItems="center" justifyContent="center"
              style={{ 'paddingTop':'10px', 'paddingLeft':'10px',
                       'minHeight':curHeight+'px', 'maxHeight':curHeight+'px', 'height':curHeight+'px',
                       'top':curStart+'px', 
                       'left':workplaceStartX,
                       'minWidth':(workspaceWidth-sidebarWidthLeft)+'px',
                       'maxWidth':(workspaceWidth-sidebarWidthLeft)+'px',
                       'width':(workspaceWidth-sidebarWidthLeft)+'px', 
                       'position':'absolute', backgroundColor:'rgb(0,0,0,0.7)' }}>
              <SpeciesKeybind keybind={speciesItems.find((item)=>item.name===speciesKeybindName).keyBinding}
                              name={speciesKeybindName}
                              parentId='image-edit-species-image'
                              onClose={() => setSpeciesKeybindName(null)}
                              onChange={(newKey) => keybindChange(speciesKeybindName, newKey)}
              />
          </Grid>
        : null
      }
      { pendingMessage && 
            <Grid id="image-edit-pending-wrapper" container direction="row" alignItems="center" justifyContent="center"
                  sx={{position:'absolute', top:0, left:0, width:'100vw', height:'100vh', backgroundColor:'rgb(0,0,0,0.5)', zIndex:11111}}
            >
              <div style={{backgroundColor:'rgb(0,0,0,0.8)', border:'1px solid grey', borderRadius:'15px', padding:'25px 10px'}}>
                <Grid container direction="column" alignItems="center" justifyContent="center" >
                    <Typography gutterBottom variant="body2" color="lightgrey">
                      {pendingMessage}
                    </Typography>
                    <CircularProgress variant="indeterminate" />
                </Grid>
              </div>
            </Grid>
      }
    </Stack>
  );
}
