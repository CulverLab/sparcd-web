'use client'

/** @module components/FolderUpload */

import * as React from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import { allTimezones, useTimezoneSelect } from "react-timezone-select"

import { Level } from './Messages';
import LocationItem from './LocationItem'
import { meters2feet } from '../utils';
import ProgressWithLabel from './ProgressWithLabel'
import { AddMessageContext, AllowedImageMime, BaseURLContext, CollectionsInfoContext, LocationsInfoContext,
                SizeContext, TokenContext, UserSettingsContext } from '../serverInfo'


const MAX_FILE_SIZE = 80 * 1000 * 1024; // Number of bytes before a file is too large
const MIN_COMMENT_LEN = 10; // Minimum allowable number of characters for a comment
const MAX_CHUNKS = 8; // Maximum number of chunks to break file uploads into
const MAX_FILES_UPLOAD_SPLIT = 5; // Maximum number of files to upload at one time

const prevUploadCheckState = {
  noCheck: null,
  checkReset: 1,
  checkNew: 2,
  checkAbandon: 3,
};

/**
 * Renders the UI for uploading a folder of images
 * @function
 * @param {boolean} loadingCollections Flag indicating collections are being loaded and not available
 * @param {function} onCompleted The function to call when an upload is completed
 * @param {function} onCancel The function to call when the user cancels the upload
 * @returns {object} The rendered UI
 */
export default function FolderUpload({loadingCollections, onCompleted, onCancel}) {
  const theme = useTheme();
  const addMessage = React.useContext(AddMessageContext); // Function adds messages for display
  const collectionInfo = React.useContext(CollectionsInfoContext);
  const locationItems = React.useContext(LocationsInfoContext);
  const serverURL = React.useContext(BaseURLContext);
  const uiSizes = React.useContext(SizeContext);
  const uploadToken = React.useContext(TokenContext);
  const userSettings = React.useContext(UserSettingsContext);  // User display settings
  const [collectionSelection, setCollectionSelection] = React.useState(null);
  const [comment, setComment] = React.useState(null);
  const [continueUploadInfo, setContinueUploadInfo] = React.useState(null); // Used when continuing a previous upload
  const [curLocationInfo, setCurLocationInfo] = React.useState(null);   // Working location when fetching tooltip
  const [filesSelected, setFilesSelected] = React.useState(0);
  const [finishingUpload, setFinishingUpload] = React.useState(false); // Used when finishing up an upload
  const [forceRedraw, setForceRedraw] = React.useState(0);
  const [inputSize, setInputSize] = React.useState({'width':252,'height':21}); // Updated when UI rendered
  const [locationSelection, setLocationSelection] = React.useState(null);
  const [newUpload, setNewUpload] = React.useState(false); // Used to indicate that we have  a new upload
  const [newUploadFiles, setNewUploadFiles] = React.useState(null); // The list of files to upload
  const [prevUploadCheck, setPrevUploadCheck] = React.useState(prevUploadCheckState.noCheck); // Used to check if the user wants to perform a reset or new upload
  const [uploadPath, setUploadPath] = React.useState(null);
  const [tooltipData, setTooltipData] = React.useState(null);       // Data for tooltip
  const [uploadCompleted, setUploadCompleted] = React.useState(false); // Uploads are done
  const [uploadingFiles, setUploadingFiles] = React.useState(false);
  const [uploadingFileCounts, setUploadingFileCounts] = React.useState({total:0, uploaded:0});
  const [workingUploadId, setWorkingUploadId] = React.useState(null); // The active upload ID

  const { options, parseTimezone } = useTimezoneSelect({ labelStyle:'altName', allTimezones });
  const [selectedTimezone, setSelectedTimezone] = React.useState(Intl.DateTimeFormat().resolvedOptions().timeZone);

  let curLocationFetchIdx = -1; // Working index of location data to fetch
  let cancelUploadCountCheck = false; // Used to stop the checks for upload counts (which would go until the counts match)
  let disableUploadDetails = false; // Used to lock out multiple clicks
  let disableUploadPrev = false; // Used to lock out multiple clicks
  let disableUploadCheck = false; // Used to lock out multiple clicks (resets next time page is redrawn)

  let displayCoordSystem = 'LATLON';
  if (userSettings['coordinatesDisplay']) {
    displayCoordSystem = userSettings['coordinatesDisplay'];
  }

  /**
   * Calls the server to get location details for tooltips
   * @function
   * @param {int} locIdx The index of the location to get the details for
   */
  const getTooltipInfo = React.useCallback((locIdx) => {
    if (curLocationFetchIdx != locIdx) {
      curLocationFetchIdx = locIdx;
      const cur_loc = locationItems[curLocationFetchIdx];
      const locationInfoUrl = serverURL + '/locationInfo?t=' + encodeURIComponent(uploadToken);

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
  }, [curLocationFetchIdx, locationItems, serverURL, setTooltipData, uploadToken]);

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
   * Returns whether or not this is a new upload or a continuation of a previous one
   * @function
   * @param {string} path The path of the upload
   * @param {array} files The list of files to upload
   * @returns {array} An array of files that have not been uploaded (if a continuation) or a false truthiness value 
   *          for a new upload
   */
  function checkPreviousUpload(path, files) {
    const sandboxPrevUrl = serverURL + '/sandboxPrev?t=' + encodeURIComponent(uploadToken);
    const formData = new FormData();

    formData.append('path', path);

    try {
      const resp = fetch(sandboxPrevUrl, {
        method: 'POST',
        body: formData
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              throw new Error(`Failed to check upload: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
            // Process the results
            if (respData.exists === false) {
              setNewUpload(true);
              setNewUploadFiles(files);
              setUploadPath(path);
            } else {
              setUploadPath(path);

              // Acknowledge that upload should continue or be restarted or as a new one
              const notLoadedFiles = files.filter((item) => !respData.uploadedFiles.includes(item.webkitRelativePath));
              setContinueUploadInfo({files: notLoadedFiles,
                                     elapsedSec: parseInt(respData.elapsed_sec),
                                     allFiles: files,
                                     id:respData.id})
            }
        })
        .catch(function(err) {
          console.log('Previous Upload Error: ',err);
          addMessage(Level.Error, 'A problem ocurred while preparing for upload');
      });
    } catch (error) {
      console.log('Prev Upload Unknown Error: ',err);
      addMessage(Level.Error, 'An unkown problem ocurred while preparing for upload');
    }
  }

  /**
   * Gets the counts of an upload
   * @function
   * @param {string} uploadId The ID of the upload that's completed
   */
  const getUploadCounts = React.useCallback((uploadId) => {
    const sandboxCountsUrl = serverURL + '/sandboxCounts?t=' + encodeURIComponent(uploadToken) + 
                                                              '&i=' + encodeURIComponent(uploadId);
    let numRetries = 0;

    try {
      const resp = fetch(sandboxCountsUrl, {
        method: 'GET'
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              throw new Error(`Failed to mark upload as completed: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
            // Process the results
            setUploadingFileCounts(respData);
            if (cancelUploadCountCheck) {
              // Do Nothing except reset the flag
              cancelUploadCountCheck = false;
            } if (respData.uploaded === respData.total) {
              setUploadCompleted(true);
            } else {
              numRetries = 0;
              window.setTimeout(() => getUploadCounts(uploadId), 2000);
            }
        })
        .catch(function(err) {
          if (numRetries >= 3) {
            console.log('Upload Images Counts Error: ', err);
            addMessage(Level.Error, 'A problem ocurred while checking upload image counts');
          } else {
            numRetries++;
            window.setTimeout(() => getUploadCounts(uploadId), 7000 * numRetries);
          }
      });
    } catch (error) {
      console.log('Upload Images Counts Unknown Error: ',err);
      addMessage(Level.Error, 'An unkown problem ocurred while checking upload image counts');
    }
  }, [serverURL, uploadToken, setUploadingFileCounts, setUploadCompleted, addMessage])

  /**
   * Sends the completion status to the server
   * @function
   * @param {string} uploadId The uploadID to mark complete
   * @param {function} {onSuccess} Function to call upon success
   * @param {function} {onFailure} Function to call upon failure
   */
  function serverUploadCompleted(uploadId, onSuccess, onFailure) {
    const sandboxCompleteUrl = serverURL + '/sandboxCompleted?t=' + encodeURIComponent(uploadToken);
    const formData = new FormData();

    formData.append('id', uploadId);

    try {
      const resp = fetch(sandboxCompleteUrl, {
        method: 'POST',
        body: formData
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              throw new Error(`Failed to mark upload as completed: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
            // Process the results
            if (typeof(onSuccess) === 'function') {
              onSuccess(uploadId, respData);
            }
        })
        .catch(function(err) {
          console.log('Upload Images Completed Error: ', err);
          addMessage(Level.Error, 'A problem ocurred while completing image upload');
          if (typeof(onFailure) === 'function') {
            onFailure(uploadId);
          }
      });
    } catch (error) {
      console.log('Upload Images Completed Unknown Error: ',err);
      addMessage(Level.Error, 'An unkown problem ocurred while completing image upload');
      if (typeof(onFailure) === 'function') {
        onFailure(uploadId);
      }
    }
  }

  /**
   * Uploads chunks of files from the list
   * @function
   * @param {object} fileChunk The array of files to upload
   * @param {string} uploadId The ID of the upload
   * @param {number} numFiles The number of images to send
   * @param {number} attempts The remaining number of attempts to try
   */
  function uploadChunk(fileChunk, uploadId, numFiles = 1, attempts = 3) {
    const sandboxFileUrl = serverURL + '/sandboxFile?t=' + encodeURIComponent(uploadToken);
    const formData = new FormData();
    const maxAttempts = attempts;
    const tzinfo = options.find((item) => item.value === selectedTimezone);
    const startTs = Date.now();

    formData.append('id', uploadId);
    formData.append('tz_off', tzinfo ? tzinfo.offset : selectedTimezone);
    for (let idx = 0; idx < numFiles && idx < fileChunk.length; idx++) {
      formData.append(fileChunk[idx].name, fileChunk[idx]);
    }

    try {
      const resp = fetch(sandboxFileUrl, {
        method: 'POST',
        body: formData
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              throw new Error(`Failed to check upload: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
            // Process the results
            const nextChunk = fileChunk.slice(numFiles);
            if (nextChunk.length > 0) {
              let curUploadCount = MAX_FILES_UPLOAD_SPLIT;
              const perFileSec = ((Date.now() - startTs) / 1000.0) / numFiles;
              curUploadCount = Math.max(1, MAX_FILES_UPLOAD_SPLIT - Math.round(perFileSec / 7.0));
              window.setTimeout(() => uploadChunk(nextChunk, uploadId, curUploadCount), 10);
            }
        })
        .catch(function(err) {
          if (attempts == 3) {
            console.log('Upload File Error: ',err);
          }
          attempts--;
          if (attempts > 0) {
            window.setTimeout(uploadChunk(fileChunk, uploadId, numFiles, attempts), 5000 * (maxAttempts - attempts));
          } else {
            // TODO: Make this a single instance
            addMessage(Level.Error, 'A problem ocurred while uploading images');
          }
      });
    } catch (error) {
      console.log('Upload Images Unknown Error: ',err);
      addMessage(Level.Error, 'An unkown problem ocurred while uploading images');
    }
  }

  /**
   * Handles uploading a folder of files
   * @function
   * @param {array} uploadFiles The list of files to upload
   * @param {string} uploadId The ID associated with the upload
   */
  function uploadFolder(uploadFiles, uploadId) {
    // Check that we have something to upload
    if (!uploadFiles || uploadFiles.length <= 0) {
      // TODO: Make the message part of the displayed window?
      // TODO: Change to editing upload page after marking as complete
      addMessage(Level.Information, 'All files have been uploaded');
      console.log('All files were uploaded', uploadId);
      setWorkingUploadId(uploadId);
      getUploadCounts(uploadId);
      return;
    }

    setUploadingFiles(true);

    // Figure out how many instances we want sending data
    const numInstance = uploadFiles.length < MAX_CHUNKS ? uploadFiles.length : MAX_CHUNKS;

    const chunkSize = Math.ceil(uploadFiles.length / (numInstance * 1.0));
    let splitFiles = [];
    for (let idx = 0; idx < uploadFiles.length; idx += chunkSize) {
      splitFiles.push(uploadFiles.slice(idx, idx + chunkSize));
    }

    for (const one_upload of splitFiles) {
      window.setTimeout(() => uploadChunk(one_upload, uploadId), 10);
    }

    window.setTimeout(() => getUploadCounts(uploadId), 1000);

    setWorkingUploadId(uploadId);
  }

  /**
   * Handles the user wanting to upload files
   * @function
   * @param {object} event The event
   */
  function uploadFiles(event) {
    // Disable buttons
    let el = document.getElementById('folder_upload');
    if (el) {
      el.disabled = true;
    }
    el = document.getElementById('folder_cancel');
    if (el) {
      el.disabled = true;
    }

    // Continue processing
    el = document.getElementById('folder_select');

    // Reset any uploaded counts
    setUploadingFileCounts({total:0, uploaded:0});

    // Return if there's nothing to do
    if (!el.files || !el.files.length) {
      addMessage(Level.Information, 'Please choose a folder with files to upload');
      return;
    }

    const allFiles = el.files;

    // Ensure that they aren't too large and that they're an acceptable image type
    let haveUnknown = 0;
    let tooLarge = 0;
    let allowedFiles = [];
    for (const one_file of allFiles) {
      if (one_file.size === undefined || one_file.type === undefined) {
        haveUnknown++;
      }
      if (one_file.type) {
        if (AllowedImageMime.find((item) => item.toLowerCase === one_file.type.toLowerCase) !== undefined) {
          if (!one_file.size || one_file.size <= MAX_FILE_SIZE) {
            allowedFiles.push(one_file);
          } else if (one_file.size && one_file.size > MAX_FILE_SIZE) {
            tooLarge++;
          }
        }
      }
    }

    // Let the user know if we have no more files left, or if we have some allowed files that are too large
    if (allowedFiles.length <= 0) {
      addMessage(Level.Information, 'No acceptable image files were found. Please choose another folder')
      console.log('No files left to upload: start count:', allFiles.length, ' unknown:',haveUnknown, ' too large:', tooLarge);
      return;
    }
    if (tooLarge > 0) {
      const maxMB = Math.round(MAX_FILE_SIZE / (1000.0 * 1024.0) * 100) / 100.0;
      addMessage(Level.Information, `Found ${tooLarge} files that are too large and won't be uploaded. Max size: ${maxMB}MB`);
    }

    // Check for a previous upload
    let relativePath = allowedFiles[0].webkitRelativePath;
    if (!relativePath) {
      addMessage(Level.Error, 'Unable to determine the source path. Please contact the developer of this site');
      console.log('ERROR: Missing relative path');
      console.log(allowedFiles[0]);
      return;
    }
    relativePath = relativePath.substr(0, relativePath.length - allowedFiles[0].name.length - 1);

    checkPreviousUpload(relativePath, allowedFiles);
  }

  /**
   * Handles the user changing the selected folder to upload
   * @function
   * @param {object} event The event
   */
  function selectionChanged(event) {
    const el = event.target;

    if (el.files && el.files.length != null) {
      setFilesSelected(el.files.length);
    } else {
      setFilesSelected(0);
    }
  }

  /**
   * Handles the user being done with an upload
   * @function
   */
  function doneUpload() {
    const curUploadId = workingUploadId;
    setFinishingUpload(true);
    window.setTimeout(() => {
      serverUploadCompleted(curUploadId,
                            () => { // Success
                              setFinishingUpload(false);
                              onCompleted();
                            });
    }, 10);
  }

  /**
   * Resets the UI to allow another upload
   * @function
   */
  function anotherUpload() {
    const curUploadId = workingUploadId;
    serverUploadCompleted(curUploadId,
      () => { // Success
        setContinueUploadInfo(null);
        setCollectionSelection(null);
        setLocationSelection(null);
        setComment(null);
        setNewUpload(false);
        setNewUploadFiles(null);
        setUploadingFiles(false);
        setUploadCompleted(false);
        setUploadingFileCounts({total:0, uploaded:0});
        onCompleted();
      });
  }

  /**
   * Calls the cancelation function when the user clicks cancel
   * @function
   */
  function cancelUpload() {
    onCancel();
  }

  /**
   * Handles the user cancelling the current upload
   * @function
   */
  function cancelDetails() {
    // Set to disable multiple clicks
    if (disableUploadDetails === true) {
      return;
    }
    disableUploadDetails = true;

    setNewUpload(false);
    setNewUploadFiles(null);
  }

  /**
   * Handles when the user wants to continue a new upload
   * @function
   */
  function continueNewUpload() {
    // Set to disable multiple clicks
    if (disableUploadDetails === true) {
      return;
    }
    disableUploadDetails = true;
    setUploadingFileCounts({total:newUploadFiles.length, uploaded:0});

    // Add the upload to the server
    const sandboxNewUrl = serverURL + '/sandboxNew?t=' + encodeURIComponent(uploadToken);
    const formData = new FormData();

    formData.append('collection', collectionSelection.id);
    formData.append('location', locationSelection.idProperty);
    formData.append('path', uploadPath);
    formData.append('comment', comment);
    formData.append('files', JSON.stringify(newUploadFiles.map((item) => item.webkitRelativePath)));
    formData.append('ts', new Date().toISOString());
    formData.append('tz', Intl.DateTimeFormat().resolvedOptions().timeZone);

    try {
      const resp = fetch(sandboxNewUrl, {
        method: 'POST',
        body: formData
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              throw new Error(`Failed to add new sandbox upload: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
            // Process the results
            setNewUpload(false);
            window.setTimeout(() => uploadFolder(newUploadFiles, respData.id), 10);
        })
        .catch(function(err) {
          console.log('New Sandbox Error: ',err);
          addMessage(Level.Error, 'A problem ocurred while preparing for new sandbox upload');
      });
    } catch (error) {
      console.log('New Upload Unknown Error: ',err);
      addMessage(Level.Error, 'An unkown problem ocurred while preparing for new sandbox upload');
    }
  }

  /**
   * Continues a previous upload of images
   * @function
   */
  function prevUploadContinue() {
    // Used to prevent multiple clicks
    if (disableUploadPrev === true) {
      return;
    }
    disableUploadPrev = true;
    setUploadingFileCounts({total:continueUploadInfo.files.length, uploaded:0});

    setUploadingFiles(true);
    uploadFolder(continueUploadInfo.files, continueUploadInfo.id);
    setContinueUploadInfo(null);
  }

  /**
   * Restarts a folder upload
   * @function
   */
  function prevUploadRestart() {
    // Used to prevent multiple clicks
    if (disableUploadPrev === true) {
      return;
    }
    disableUploadPrev = true;

    setPrevUploadCheck(prevUploadCheckState.checkReset);
  }

  /**
   * Restarts a folder upload
   * @function
   */
  function prevUploadAbandon() {
    // Used to prevent multiple clicks
    if (disableUploadPrev === true) {
      return;
    }
    disableUploadPrev = true;

    setPrevUploadCheck(prevUploadCheckState.abandon);
  }

  /**
   * Handles restarting an upload from the beginning
   * @function
   */
  function prevUploadResetContinue() {
    // Used to prevent multiple clicks
    if (disableUploadCheck === true) {
      return;
    }
    disableUploadCheck = true;
    setUploadingFileCounts({total:continueUploadInfo.files.length, uploaded:0});

    // Reset the upload on the server and then restart the upload
    const sandboxResetUrl = serverURL + '/sandboxReset?t=' + encodeURIComponent(uploadToken);
    const formData = new FormData();

    formData.append('id', continueUploadInfo.id);
    formData.append('files', JSON.stringify(continueUploadInfo.files.map((item) => item.webkitRelativePath)));

    try {
      const resp = fetch(sandboxResetUrl, {
        method: 'POST',
        body: formData
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              throw new Error(`Failed to reset sandbox upload: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
            // Process the results
            const curFiles = continueUploadInfo.files;
            const upload_id = continueUploadInfo.id;
            setPrevUploadCheck(prevUploadCheckState.noCheck);
            setContinueUploadInfo(null);
            window.setTimeout(() => uploadFolder(curFiles, upload_id), 10);
        })
        .catch(function(err) {
          console.log('Reset Sandbox Error: ',err);
          addMessage(Level.Error, 'A problem ocurred while preparing for reset sandbox upload');
      });
    } catch (error) {
      console.log('Reset Upload Unknown Error: ',err);
      addMessage(Level.Error, 'An unkown problem ocurred while preparing for reset sandbox upload');
    }
  }

  /**
   * Handles abandoning an upload
   * @function
   */
  function prevUploadAbandonContinue() {
    // Used to prevent multiple clicks
    if (disableUploadCheck === true) {
      return;
    }

    // Reset the upload on the server and then restart the upload
    const sandboxAbandonUrl = serverURL + '/sandboxAbandon?t=' + encodeURIComponent(uploadToken);
    const formData = new FormData();

    formData.append('id', continueUploadInfo.id);

    try {
      const resp = fetch(sandboxAbandonUrl, {
        method: 'POST',
        body: formData
      }).then(async (resp) => {
            if (resp.ok) {
              return resp.json();
            } else {
              throw new Error(`Failed to abandoning sandbox upload: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
            // Process the results
            setUploadingFileCounts({total:uploadFiles.length, uploaded:0});
            setPrevUploadCheck(prevUploadCheckState.noCheck);
            setContinueUploadInfo(null);
            setCollectionSelection(null);
            setLocationSelection(null);
            setComment(null);
            setNewUpload(false);
            onCompleted();
            addMessage(Level.Warning, 'Unable to complete removal of previously started upload from the storage server. Please contact your administrator to complete removal');
        })
        .catch(function(err) {
          console.log('Abandon Sandbox Error: ',err);
          addMessage(Level.Error, 'A problem ocurred while preparing for abandoning sandbox upload');
      });
    } catch (error) {
      console.log('Abandon Upload Unknown Error: ',err);
      addMessage(Level.Error, 'An unkown problem ocurred while preparing for abandoning sandbox upload');
    }
  }

  /**
   * Creates a new upload for these files
   * @function
   */
  function prevUploadCreateNew() {
    // Used to prevent multiple clicks
    if (disableUploadPrev === true) {
      return;
    }
    disableUploadPrev = true;

    setPrevUploadCheck(prevUploadCheckState.checkNew);
  }

/**
   * Cancel the upload for these files
   * @function
   */
  function prevUploadCancel() {
    // Used to prevent multiple clicks
    if (disableUploadPrev === true) {
      return;
    }
    disableUploadPrev = true;

    setContinueUploadInfo(null)
  }

  /**
   * Handles creating a new upload separate from an existing one
   * @function
   */
  function prevUploadCreateNewContinue() {
    // Used to prevent multiple clicks
    if (disableUploadCheck === true) {
      return;
    }
    disableUploadCheck = true;

    serverUploadCompleted(continueUploadInfo.id,
      () => { // Success
          const uploadFiles = continueUploadInfo.allFiles;
          setUploadingFileCounts({total:uploadFiles.length, uploaded:0});
          setContinueUploadInfo(null);
          setCollectionSelection(null);
          setLocationSelection(null);
          setComment(null);
          setNewUpload(true);
          setNewUploadFiles(uploadFiles);

      }
    )
  }

  /**
   * Handles cancelling both when asked to continue creating a new upload, or resetting an upload
   * @function
   */
  function prevUploadResetCreateCancel() {
    // Used to prevent multiple clicks
    if (disableUploadCheck === true) {
      return;
    }
    disableUploadCheck = true;

    setPrevUploadCheck(prevUploadCheckState.noCheck);
  }

  /**
   * Keeps track of a new user collection selection
   * @function
   * @param {object} event The event object
   * @param {object} value The selected collection
   */
  function handleCollectionChange(event, value) {
    setCollectionSelection(value);
    if (locationSelection !== null && comment != null && comment.length > MIN_COMMENT_LEN) {
      setForceRedraw(forceRedraw + 1);
    }
  }

  /**
   * Keeps track of a new user location selection
   * @function
   * @param {object} event The event object
   * @param {object} value The selected location
   */
  function handleLocationChange(event, value) {
    setLocationSelection(value);
    if (collectionSelection !== null && comment != null && comment.length > MIN_COMMENT_LEN) {
      setForceRedraw(forceRedraw + 1);
    }
  }

  /**
   * Handles the user changing the comment
   * @function
   * @param {object} event The triggering event
   */
  function handleCommentChange(event) {
    setComment(event.target.value);
    if (event.target.value != null && event.target.value.length > MIN_COMMENT_LEN && collectionSelection != null && locationSelection != null) {
      setForceRedraw(forceRedraw + 1);
    }
  }

  /**
   * Generates elapsed time string based upon the number of seconds specified
   * @function
   * @param {number} seconds The number of seconds to format
   * @return {string} The formatted string
   */
  function generateSecondsElapsedText(seconds) {
    let results = '';
    let remain_seconds = seconds;

    // Days
    let cur_num = Math.floor(remain_seconds / (24 * 60 * 60));
    if (cur_num > 0) {
      results += `${cur_num} hours `;
      remain_seconds -= cur_num * (24 * 60 * 60);
    }

    // Hours
    cur_num = Math.floor(remain_seconds / (60 * 60));
    if (results.length > 0 || cur_num > 0) {
      results += `${cur_num} hours `;
      remain_seconds -= cur_num * (60 * 60);
    }

    // Minutes
    cur_num = Math.floor(remain_seconds / 60);
    if (results.length > 0 || cur_num > 0) {
      results += `${cur_num} minutes `;
      remain_seconds -= cur_num * 60;
    }

    // Seconds
    if (results.length > 0 || remain_seconds > 0) {
      results += `${remain_seconds} seconds `;
    }

    return results;
  }

  /**
   * Renders the UI based upon how many images have been uploaded
   * @function
   * @return {object} The UI to render
   */
  function renderInputControls() {
    const el = document.getElementById('folder_select');
    let curWidth = inputSize.width;
    let curHeight = inputSize.height;
    if (el) {
      const parentEl = el.parentNode;
      const elSize = el.getBoundingClientRect();

      if (inputSize.width != elSize.width || inputSize.height != elSize.height) {
        setInputSize({'width':elSize.width,'height':elSize.height});
        curWidth = elSize.width;
        curHeight = elSize.height;
      }
    }

    if (uploadingFiles) {
      // TODO: adjust upload percent to include already uploaded images
      let uploadCount = uploadingFileCounts.uploaded;
      let percentComplete = uploadingFileCounts.total ? Math.floor((uploadCount / uploadingFileCounts.total) * 100) : 100;

      return (
        <Grid id="grid" container direction="column" alignItems="center" justifyContent="center" sx={{minWidth: curWidth+'px', minHeight: curHeight+'px'}}>
          <Typography gutterBottom variant="body3" noWrap="true">
          {uploadingFileCounts.uploaded} of {uploadingFileCounts.total} uploaded
          </Typography>
          <ProgressWithLabel value={percentComplete}/>
        </Grid>
      );
    }

    return (
      <input id="folder_select" type="file" name="file" webkitdirectory="true" 
             directory="true" onChange={selectionChanged}></input>
    );
  }

  /**
   * Renders the details controls for a new upload
   * @function
   * @return {object} The UI to render
   */
  function renderUploadDetails() {
    // Let the user know collections are still being loaded
    if (loadingCollections === true) {
      return (
        <Grid id='folder-upload-details-wrapper' container direction="column" alignItems="center" justifyContent="start" gap={2}>
          <Typography gutterBottom variant="body2">
            Loading collections, please wait...
          </Typography>
          <CircularProgress variant="indeterminate" />
          <Typography gutterBottom variant="body2">
            This may take a while
          </Typography>
        </Grid>
      );
    }

    return (
      <Grid id='folder-upload-details-wrapper' container direction="column" alignItems="center" justifyContent="start" gap={2}>
        <FormControl fullWidth>
          <Autocomplete
            options={collectionInfo}
            id="folder-upload-collections"
            autoHighlight
            onChange={handleCollectionChange}
            defaultValue={null}
            getOptionLabel={(option) => option.name}
            getOptionKey={(option) => option.name+option.id}
            renderOption={(props, col) => {
              const { key, ...optionProps } = props;
              return (
                  <MenuItem id={col.id+'-'+key} value={col.name} key={key} {...optionProps}>
                    {col.name}
                  </MenuItem> 
              );
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Collection"
                required={true}
                slotProps={{
                  htmlInput: {
                    ...params.inputProps,
                    autoComplete: 'new-password', // disable autocomplete and autofill
                  },
                }}
              />
            )}
          >
          </Autocomplete>
        </FormControl>
        <FormControl fullWidth>
          <Autocomplete
            options={locationItems}
            id="folder-upload-location"
            autoHighlight
            onChange={handleLocationChange}
            defaultValue={null}
            getOptionLabel={(option) => option.idProperty}
            getOptionKey={(option) => option.idProperty+option.latProperty+option.lngProperty}
            renderOption={(props, loc) => {
              const { key, ...optionProps } = props;
              return (
                  <MenuItem id={loc.idProperty+'-'+key} value={loc.idProperty} key={key} {...optionProps}>
                    <LocationItem shortName={loc.idProperty} longName={loc.nameProperty}
                                  lat={displayCoordSystem === 'LATLON' ? loc.latProperty : loc.utm_x} 
                                  lng={displayCoordSystem === 'LATLON' ? loc.lngProperty: loc.utm_y} 
                                  elevation={userSettings['measurementFormat'] === 'feet' ? meters2feet(loc.elevationProperty) + 'ft' : loc.elevationProperty}
                                  coordType={displayCoordSystem === 'LATLON' ? undefined : loc.utm_code}
                                  onTTOpen={getTooltipInfo} onTTClose={clearTooltipInfo}
                                  dataTT={tooltipData} propsTT={props}
                     />
                  </MenuItem> 
              );
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Location"
                required={true}
                slotProps={{
                  htmlInput: {
                    ...params.inputProps,
                    autoComplete: 'new-password', // disable autocomplete and autofill
                  },
                }}
              />
            )}
          >
          </Autocomplete>
        </FormControl>
        <FormControl fullWidth>
          <Grid container direction="column" alignContent="start" justifyContent="start" sx={{paddingTop:"10px"}} >
            <Typography gutterBottom variant="body">
              Mountain Range - Site Name - No. of images collected - Date Uploaded - Date collected
            </Typography>
            <Typography gutterBottom variant="body2">
              (e.g.: Santa Rita Mountains - SAN06 - 39 images - uploaded 04-10-2020 - collected 03-28-2000)
            </Typography>
            <TextField required fullWidth id="folder-upload-comment" label="Comment" onChange={handleCommentChange} />
          </Grid>
        </FormControl>
        <FormControl fullWidth={true}>
          <Grid container direction="row" alignItems="center" justifyContent="space-between" sx={{paddingTop:"10px"}} >
            <Typography gutterBottom variant="body">
              Timezone of images
            </Typography>
            <Select id="landing-page-upload-timezone" value={selectedTimezone} onChange={(event) => setSelectedTimezone(parseTimezone(event.target.value))}>
              {options.map((option) => 
                <MenuItem key={option.value} value={option.value} selected={selectedTimezone === option.value} >
                  <Typography gutterBottom variant="body2">
                    {option.label}
                  </Typography>
                </MenuItem>
              )}
            </Select>
          </Grid>
        </FormControl>
      </Grid>
    );
  }

  // Render the UI
  const details_continue_enabled = locationSelection != null && collectionSelection != null && comment != null && comment.length > MIN_COMMENT_LEN;
  return (
    <React.Fragment>
      <Box id='landing-page-upload-wrapper' sx={{ ...theme.palette.screen_disable }} >
        <Grid
          container
          spacing={0}
          direction="column"
          alignItems="center"
          justifyContent="center"
          sx={{ minHeight: uiSizes.workspace.height + 'px' }}
        >
        { newUpload === false ?
          <Card id='folder-upload-select' variant="outlined" sx={{ ...theme.palette.folder_upload }} >
            <CardHeader sx={{ textAlign: 'center' }}
               title={
                <Typography gutterBottom variant="h6" component="h4">
                  Upload Folder
                </Typography>
               }
               subheader={
                <React.Fragment>
                  <Typography gutterBottom variant="body">
                    {!uploadingFiles ? "Select folder to upload" : !uploadCompleted ? "Uploading selected files" : "Upload complete"}
                  </Typography>
                  <br />
                  <Typography gutterBottom variant="body2">
                    Step {!uploadingFiles ? '1' : '3'} of 3
                  </Typography>
                </React.Fragment>
                }
             />
            <CardContent>
              {renderInputControls()}
            </CardContent>
            <CardActions>
            { !uploadingFiles && continueUploadInfo === null && 
              <React.Fragment>
                <Button id="folder_upload" sx={{'flex':'1'}} size="small" onClick={uploadFiles}
                        disabled={filesSelected > 0 ? false : true}>Upload</Button>
                <Button id="folder_cancel" sx={{'flex':'1'}} size="small" onClick={cancelUpload}>Cancel</Button>
              </React.Fragment>
            }
            { uploadCompleted &&
              <React.Fragment>
                <Button id="folder_upload_continue" sx={{'flex':'1'}} size="small" onClick={doneUpload}>Done</Button>
                <Button id="folder_upload_another" sx={{'flex':'1'}} size="small" onClick={anotherUpload}>Upload Another</Button>
              </React.Fragment>
            }
            </CardActions>
          </Card>
        :
           <Card id='folder-upload-details' variant="outlined" sx={{ ...theme.palette.folder_upload, minWidth:(uiSizes.workspace.width * 0.8) + 'px' }} >
            <CardHeader sx={{ textAlign: 'center' }}
               title={
                <Typography gutterBottom variant="h6" component="h4">
                  New Upload Details
                </Typography>
               }
               subheader={
                <React.Fragment>
                  <Typography gutterBottom variant="body">
                    Select Collection and Location to proceed
                  </Typography>
                  <br />
                  <Typography gutterBottom variant="body2">
                    Step 2 of 3
                  </Typography>
                </React.Fragment>
                }
             />
            <CardContent>
              {renderUploadDetails()}
            </CardContent>
            <CardActions>
              <Button id="sandbox-upload-details-continue" sx={{'flex':'1'}} size="small" onClick={continueNewUpload}
                      disabled={details_continue_enabled ? false : true}>Continue</Button>
              <Button id="sandbox-upload-details-cancel" sx={{'flex':'1'}} size="small" onClick={cancelDetails}>Cancel</Button>
            </CardActions>
          </Card>
        }
        </Grid>
      </Box>
    { continueUploadInfo !== null && 
      <Box id='landing-page-upload-continue-wrapper' sx={{ ...theme.palette.screen_overlay }} >
        <Grid
          container
          spacing={0}
          direction="column"
          alignItems="center"
          justifyContent="center"
          sx={{ minHeight: uiSizes.workspace.height + 'px' }}
        >
        <Card id='folder-upload-continue' variant="outlined" sx={{ ...theme.palette.folder_upload, minWidth:(uiSizes.workspace.width * 0.8) + 'px' }} >
          <CardHeader sx={{ textAlign: 'center' }}
             title={
              <Typography gutterBottom variant="h6" component="h4">
                Upload Already Started
              </Typography>
             }
            />
          <CardContent>
            <Typography gutterBottom variant="body">
              An incomplete upload from '{uploadPath}' has been detected. How would you like to proceed?
            </Typography>
            <Typography gutterBottom variant="body2">
              {continueUploadInfo.allFiles.length-continueUploadInfo.files.length} out of {continueUploadInfo.allFiles.length} files have been uploaded
            </Typography>
            <Typography gutterBottom variant="body2">
              Uploaded created {generateSecondsElapsedText(continueUploadInfo.elapsedSec)} ago
            </Typography>
            <Grid id="landing-page-upload-continue-options-wrapper" container direction="row" rowSpacing={1} alignItems="center" justifyContent="flex-start"
                  sx={{paddingTop:'10px'}}>
              <Grid id="landing-page-upload-continue-options-continue" container direction="row" alignItems="start" justifyContent="flex-start"
                  sx={{border:'1px solid #c3c3d2', borderRadius:'5px', width:'100%', backgroundColor:'#eaeaf9', padding:'50x 0px'}}>
                <Button id="sandbox-upload-continue-continue" size="small" onClick={prevUploadContinue}>Resume Upload</Button>
                <Typography gutterBottom variant="body2" component='div' sx={{width:'70%', marginLeft:'auto'}}>
                  The upload continues from where it left off and will upload the remaining files. This is helpful when the files to upload haven't changed
                </Typography>
              </Grid>
              <Grid id="landing-page-upload-continue-options-restart" container direction="row" alignItems="start" justifyContent="flex-start"
                  sx={{border:'1px solid #c3c3d2', borderRadius:'5px', width:'100%', backgroundColor:'#eaeaf9', padding:'50x 0px'}}>
                <Button id="sandbox-upload-continue-restart" size="small" onClick={prevUploadRestart}>Restart Upload</Button>
                <Typography gutterBottom variant="body2" component='div' sx={{width:'70%', marginLeft:'auto'}} >
                  Restart the entire upload starting from the first image until the last. This is helpful if previously loaded images were changed, replaced, 
                  or added to
                </Typography>
              </Grid>
              <Grid id="landing-page-upload-continue-options-create" container direction="row" alignItems="start" justifyContent="flex-start"
                  sx={{border:'1px solid #c3c3d2', borderRadius:'5px', width:'100%', backgroundColor:'#eaeaf9', padding:'50x 0px'}}>
                <Button id="sandbox-upload-continue-create" size="small" onClick={prevUploadCreateNew}>Create New Upload</Button>
                <Typography gutterBottom variant="body2" component='div' sx={{width:'70%', marginLeft:'auto'}} >
                  Remove the previous upload attempt and create a new upload. This is helpful if the previous upload was incomplete or incorrect
                  and you want to restart the whole process
                </Typography>
              </Grid>
              <Grid id="landing-page-upload-continue-options-abandon" container direction="row" alignItems="start" justifyContent="flex-start"
                  sx={{border:'1px solid #c3c3d2', borderRadius:'5px', width:'100%', backgroundColor:'#eaeaf9', padding:'50x 0px'}}>
                <Button id="sandbox-upload-continue-abandon" size="small" onClick={prevUploadAbandon}>Abandon Upload</Button>
                <Typography gutterBottom variant="body2" component='div' sx={{width:'70%', marginLeft:'auto'}} >
                  Will abandon the previous upload attempt and not try to upload anything else. This is helpful if the upload is no longer needed or
                  wanted
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
          <CardActions>
            <Button id="sandbox-upload-continue-cancel" sx={{'flex':'1'}} size="small" onClick={prevUploadCancel}>Cancel</Button>
          </CardActions>
        </Card>
        </Grid>
      </Box>
   }
   { (continueUploadInfo !== null && prevUploadCheck !== prevUploadCheckState.noCheck) &&
      <Box id='landing-page-upload-reset-wrapper' sx={{ ...theme.palette.screen_overlay }} >
        <Grid
          container
          spacing={0}
          direction="column"
          alignItems="center"
          justifyContent="center"
          sx={{ minHeight: uiSizes.workspace.height + 'px' }}
        >
          <Card id='folder-upload-reset' variant="outlined" sx={{ ...theme.palette.folder_upload, minWidth:(uiSizes.workspace.width * 0.8) + 'px' }} >
            <CardHeader sx={{ textAlign: 'center' }}
               title={
                <Typography gutterBottom variant="h6" component="h4">
                  {prevUploadCheck === prevUploadCheckState.checkReset && "Restart Upload"}
                  {prevUploadCheck === prevUploadCheckState.checkNew && "Create New Upload"}
                  {prevUploadCheck === prevUploadCheckState.abandon && "Abandon Upload"}
                </Typography>
               }
              />
            <CardContent>
              <Typography gutterBottom variant="body">
                {prevUploadCheck === prevUploadCheckState.checkReset && "Are you sure you want to delete the previous uploaded files and restart?"}
                {prevUploadCheck === prevUploadCheckState.checkNew && "Are you sure you want to abandon the previous uploaded and create a new one?"}
                {prevUploadCheck === prevUploadCheckState.abandon && "Are you sure you want to abandon the previous uploaded?"}
              </Typography>
            </CardContent>
            <CardActions>
              {prevUploadCheck === prevUploadCheckState.checkReset &&
                <Button id="sandbox-upload-continue-reset" sx={{'flex':'1'}} size="small" onClick={prevUploadResetContinue}>Yes</Button>
              }
              {prevUploadCheck === prevUploadCheckState.checkNew &&
                <Button id="sandbox-upload-continue-yes" sx={{'flex':'1'}} size="small" onClick={prevUploadCreateNewContinue}>Yes</Button>
              }
              {prevUploadCheck === prevUploadCheckState.abandon &&
                <Button id="sandbox-upload-continue-yes" sx={{'flex':'1'}} size="small" onClick={prevUploadAbandonContinue}>Yes</Button>
              }
              <Button id="sandbox-upload-continue-no" sx={{'flex':'1'}} size="small" onClick={prevUploadResetCreateCancel}>No</Button>
            </CardActions>
            </Card>
        </Grid>
      </Box>
   }
    { finishingUpload && 
      <Grid id="query-running-query-wrapper" container direction="row" alignItems="center" justifyContent="center" 
            sx={{...theme.palette.screen_overlay, backgroundColor:'rgb(0,0,0,0.5)', zIndex:11111}}
      >
        <div style={{backgroundColor:'rgb(0,0,0,0.8)', border:'1px solid grey', borderRadius:'15px', padding:'25px 10px'}}>
          <Grid container direction="column" alignItems="center" justifyContent="center" >
              <Typography gutterBottom variant="body2" color="lightgrey">
                Please wait while the upload finishes up ...
              </Typography>
              <CircularProgress variant="indeterminate" />
          </Grid>
        </div>
      </Grid>
    }
    </React.Fragment>
  );
}