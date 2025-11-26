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

import { allTimezones, useTimezoneSelect } from "react-timezone-select";

import FolderUploadConfirm from './FolderUploadConfirm';
import FolderUploadContinue from './FolderUploadContinue';
import FolderUploadForm from './FolderUploadForm';
import { Level } from '../components/Messages';
import LocationItem from '../components/LocationItem';
import { meters2feet } from '../utils';
import ProgressWithLabel from '../components/ProgressWithLabel';
import { AddMessageContext, AllowedImageMime, AllowedMovieMime, BaseURLContext, CollectionsInfoContext, 
          LocationsInfoContext,SizeContext, TokenContext, UserSettingsContext } from '../serverInfo';


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

// Be sure to add new known upload types to the parameter definition below
/**
 * Renders the UI for uploading a folder of images
 * @function
 * @param {boolean} loadingCollections Flag indicating collections are being loaded and not available
 * @param {string} type One of the known upload types ('images', 'movies')
 * @param {function} onCompleted The function to call when an upload is completed
 * @param {function} onCancel The function to call when the user cancels the upload
 * @returns {object} The rendered UI
 */
export default function FolderUpload({loadingCollections, type, onCompleted, onCancel}) {
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
  const [disableDetails, setDisableDetails] = React.useState(false); // Used to disable buttons
  const [filesSelected, setFilesSelected] = React.useState(0);
  const [finishingUpload, setFinishingUpload] = React.useState(false); // Used when finishing up an upload
  const [forceRedraw, setForceRedraw] = React.useState(0);
  const [inputSize, setInputSize] = React.useState({'width':252,'height':21}); // Updated when UI rendered
  const [locationSelection, setLocationSelection] = React.useState(null);
  const [newUpload, setNewUpload] = React.useState(false); // Used to indicate that we have  a new upload
  const [newUploadFiles, setNewUploadFiles] = React.useState(null); // The list of files to upload
  const [prevUploadCheck, setPrevUploadCheck] = React.useState(prevUploadCheckState.noCheck); // Used to check if the user wants to perform a reset or new upload
  const [uploadPath, setUploadPath] = React.useState(null);
  const [uploadCompleted, setUploadCompleted] = React.useState(false); // Uploads are done
  const [uploadingFiles, setUploadingFiles] = React.useState(false);
  const [uploadingFileCounts, setUploadingFileCounts] = React.useState({total:0, uploaded:0});
  const [workingUploadId, setWorkingUploadId] = React.useState(null); // The active upload ID

  const { options, parseTimezone } = useTimezoneSelect({ labelStyle:'altName', allTimezones });
  const [selectedTimezone, setSelectedTimezone] = React.useState(Intl.DateTimeFormat().resolvedOptions().timeZone);

  let cancelUploadCountCheck = false; // Used to stop the checks for upload counts (which would go until the counts match)
  let disableUploadDetails = false; // Used to lock out multiple clicks
  let disableUploadPrev = false; // Used to lock out multiple clicks
  let disableUploadCheck = false; // Used to lock out multiple clicks (resets next time page is redrawn)

  let displayCoordSystem = 'LATLON';
  if (userSettings['coordinatesDisplay']) {
    displayCoordSystem = userSettings['coordinatesDisplay'];
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
            // TODO: Split this chunk into single uploads (if not already) in case the problem one or more files
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
  const filesUpload = React.useCallback((event) => {
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
      if (one_file.type && one_file.name && one_file.name[0] !== '.') {
        if (type === 'image'  && AllowedImageMime.find((item) => item.toLowerCase() === one_file.type.toLowerCase()) !== undefined) {
          if (!one_file.size || one_file.size <= MAX_FILE_SIZE) {
            allowedFiles.push(one_file);
          } else if (one_file.size && one_file.size > MAX_FILE_SIZE) {
            tooLarge++;
          }
        } else if (type === 'movie'  && AllowedMovieMime.find((item) => item.toLowerCase() === one_file.type.toLowerCase()) !== undefined) {
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
      addMessage(Level.Information, `No acceptable ${type} files were found. Please choose another folder`)
      console.log('No files left to upload: start count:', allFiles.length, ' unknown:',haveUnknown, ' too large:', tooLarge);
      // Enable buttons
      let el = document.getElementById('folder_upload');
      if (el) {
        el.disabled = false;
      }
      el = document.getElementById('folder_cancel');
      if (el) {
        el.disabled = false;
      }
      return;
    }
    if (tooLarge > 0) {
      const maxMB = Math.round(MAX_FILE_SIZE / (1000.0 * 1024.0) * 100) / 100.0;
      addMessage(Level.Information, `Found ${tooLarge} files that are too large and won't be uploaded. Max size: ${maxMB}MB`);
    }

    // Check for a previous upload
    let relativePath = allowedFiles[0].webkitRelativePath;
    if (!relativePath) {
      addMessage(Level.Error, 'Unable to determine the source path. Please contact the developer of this app');
      console.log('ERROR: Missing relative path');
      console.log(allowedFiles[0]);
      // Enable buttons
      let el = document.getElementById('folder_upload');
      if (el) {
        el.disabled = false;
      }
      el = document.getElementById('folder_cancel');
      if (el) {
        el.disabled = false;
      }
      return;
    }
    relativePath = relativePath.substr(0, relativePath.length - allowedFiles[0].name.length - 1);

    checkPreviousUpload(relativePath, allowedFiles);
  }, [addMessage, checkPreviousUpload]);

  /**
   * Handles the user changing the selected folder to upload
   * @function
   * @param {object} event The event
   */
  const selectionChanged = React.useCallback((event) => {
    const el = event.target;

    if (el.files && el.files.length != null) {
      setFilesSelected(el.files.length);
    } else {
      setFilesSelected(0);
    }
  }, [setFilesSelected]);

  /**
   * Handles the user being done with an upload
   * @function
   */
  const doneUpload = React.useCallback(() => {
    const curUploadId = workingUploadId;
    setFinishingUpload(true);
    window.setTimeout(() => {
      serverUploadCompleted(curUploadId,
                            () => { // Success
                              setFinishingUpload(false);
                              onCompleted();
                            });
    }, 10);
  }, [onCompleted, serverUploadCompleted, setFinishingUpload, workingUploadId]);

  /**
   * Resets the UI to allow another upload
   * @function
   */
  const anotherUpload = React.useCallback(() => {
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
  }, [onCompleted, serverUploadCompleted, setCollectionSelection, setComment, setContinueUploadInfo, setLocationSelection, setNewUpload, 
      setNewUploadFiles, setUploadCompleted, setUploadingFileCounts, setUploadingFiles, workingUploadId]);

  /**
   * Calls the cancelation function when the user clicks cancel
   * @function
   */
  const cancelUpload = React.useCallback(() => {
    // Enable buttons
    let el = document.getElementById('folder_upload');
    if (el) {
      el.disabled = false;
    }
    el = document.getElementById('folder_cancel');
    if (el) {
      el.disabled = false;
    }

    onCancel();
  }, [onCancel]);

  /**
   * Handles the user cancelling the current upload
   * @function
   */
  const cancelDetails = React.useCallback(() => {
    // Set to disable multiple clicks
    if (disableUploadDetails === true) {
      return;
    }
    disableUploadDetails = true;

    setNewUpload(false);
    setNewUploadFiles(null);
    disableUploadDetails = false;
  }, [disableUploadDetails, setNewUpload, setNewUploadFiles]);

  /**
   * Handles when the user wants to continue a new upload
   * @function
   */
  const continueNewUpload = React.useCallback(() => {
    // Set to disable multiple clicks
    if (disableUploadDetails === true) {
      return;
    }
    disableUploadDetails = true;
    setUploadingFileCounts({total:newUploadFiles.length, uploaded:0});
    setDisableDetails(true);

    // Add the upload to the server letting the UI to update
    window.setTimeout(() => {
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
              setDisableDetails(false);
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
        setDisableDetails(false);
        console.log('New Upload Unknown Error: ',err);
        addMessage(Level.Error, 'An unkown problem ocurred while preparing for new sandbox upload');
      }
    }, 100);
  }, [addMessage, collectionSelection, comment, disableUploadDetails, locationSelection, newUploadFiles, serverURL, setDisableDetails, 
      setNewUpload, setUploadingFileCounts, uploadPath, uploadToken]);

  /**
   * Continues a previous upload of images
   * @function
   */
  const prevUploadContinue = React.useCallback(() => {
    // Used to prevent multiple clicks
    if (disableUploadPrev === true) {
      return;
    }
    disableUploadPrev = true;
    setUploadingFileCounts({total:continueUploadInfo.files.length, uploaded:0});

    setUploadingFiles(true);
    uploadFolder(continueUploadInfo.files, continueUploadInfo.id);
    setContinueUploadInfo(null);
  }, [continueUploadInfo, disableUploadPrev, setContinueUploadInfo, setUploadingFiles, setUploadingFileCounts, uploadFolder]);

  /**
   * Restarts a folder upload
   * @function
   */
  const prevUploadRestart = React.useCallback(() => {
    // Used to prevent multiple clicks
    if (disableUploadPrev === true) {
      return;
    }
    disableUploadPrev = true;

    setPrevUploadCheck(prevUploadCheckState.checkReset);
    disableUploadPrev = false;
  }, [disableUploadPrev, prevUploadCheckState, setPrevUploadCheck]);

  /**
   * Restarts a folder upload
   * @function
   */
  const prevUploadAbandon = React.useCallback(() => {
    // Used to prevent multiple clicks
    if (disableUploadPrev === true) {
      return;
    }
    disableUploadPrev = true;

    setPrevUploadCheck(prevUploadCheckState.abandon);
    disableUploadPrev = false;
  }, [disableUploadPrev, prevUploadCheckState, setPrevUploadCheck]);

  /**
   * Handles restarting an upload from the beginning
   * @function
   */
  const prevUploadResetContinue = React.useCallback(() => {
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
            disableUploadCheck = false;
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
  }, [addMessage, continueUploadInfo, disableUploadCheck, Level, prevUploadCheckState, serverURL, setContinueUploadInfo, setPrevUploadCheck,
      setUploadingFileCounts, uploadFolder, uploadToken]);

  /**
   * Handles abandoning an upload
   * @function
   */
  const prevUploadAbandonContinue = React.useCallback(() => {
    // Used to prevent multiple clicks
    if (disableUploadCheck === true) {
      return;
    }
    disableUploadCheck = true;

    // Reset the upload on the server and then restart the upload
    const sandboxAbandonUrl = serverURL + '/sandboxAbandon?t=' + encodeURIComponent(uploadToken);
    const formData = new FormData();

    formData.append('id', continueUploadInfo.id);

    try {
      const resp = fetch(sandboxAbandonUrl, {
        method: 'POST',
        body: formData
      }).then(async (resp) => {
            disableUploadCheck = false;
            if (resp.ok) {
              return resp.json();
            } else {
              throw new Error(`Failed to abandoning sandbox upload: ${resp.status}`, {cause:resp});
            }
          })
        .then((respData) => {
            // Process the results
            setUploadingFileCounts({total:newUploadFiles.length, uploaded:0});
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
  }, [addMessage, continueUploadInfo, disableUploadCheck, newUploadFiles, onCompleted, prevUploadCheckState, serverURL, setCollectionSelection,
      setComment, setContinueUploadInfo, setLocationSelection, setNewUpload, setPrevUploadCheck, setUploadingFileCounts, uploadToken]);

  /**
   * Creates a new upload for these files
   * @function
   */
  const prevUploadCreateNew = React.useCallback(() => {
    // Used to prevent multiple clicks
    if (disableUploadPrev === true) {
      return;
    }
    disableUploadPrev = true;

    setPrevUploadCheck(prevUploadCheckState.checkNew);
    disableUploadPrev = false;
  }, [disableUploadPrev, prevUploadCheckState, setPrevUploadCheck]);

/**
   * Cancel the upload for these files
   * @function
   */
  const prevUploadCancel = React.useCallback(() => {
    setContinueUploadInfo(null)
    disableUploadPrev = false;
  }, [disableUploadPrev, setContinueUploadInfo]);

  /**
   * Handles creating a new upload separate from an existing one
   * @function
   */
  const prevUploadCreateNewContinue = React.useCallback(() => {
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
          disableUploadCheck = true;
      }
    )
  }, [continueUploadInfo, disableUploadCheck, serverUploadCompleted, setCollectionSelection, setComment,
      setContinueUploadInfo, setLocationSelection, setNewUpload, setNewUploadFiles, setUploadingFileCounts]);

  /**
   * Handles cancelling both when asked to continue creating a new upload, or resetting an upload
   * @function
   */
  const prevUploadResetCreateCancel = React.useCallback(() => {
    setPrevUploadCheck(prevUploadCheckState.noCheck);
  }, [disableUploadCheck, prevUploadCheckState, setPrevUploadCheck]);

  /**
   * Keeps track of a new user collection selection
   * @function
   * @param {object} event The event object
   * @param {object} value The selected collection
   */
  const handleCollectionChange = React.useCallback((event, value) => {
    setCollectionSelection(value);
    if (locationSelection !== null && comment != null && comment.length > MIN_COMMENT_LEN) {
      setForceRedraw(forceRedraw + 1);
    }
  }, [comment, forceRedraw, locationSelection, setCollectionSelection, setForceRedraw, MIN_COMMENT_LEN]);

  /**
   * Keeps track of a new user location selection
   * @function
   * @param {object} event The event object
   * @param {object} value The selected location
   */
  const handleLocationChange = React.useCallback((event, value) => {
    setLocationSelection(value);
    if (collectionSelection !== null && comment != null && comment.length > MIN_COMMENT_LEN) {
      setForceRedraw(forceRedraw + 1);
    }
  }, [collectionSelection, comment, forceRedraw, setForceRedraw, setLocationSelection, MIN_COMMENT_LEN]);

  /**
   * Handles the user changing the comment
   * @function
   * @param {object} event The triggering event
   */
  const handleCommentChange = React.useCallback((event) => {
    setComment(event.target.value);
    if (event.target.value != null && event.target.value.length > MIN_COMMENT_LEN && collectionSelection != null && locationSelection != null) {
      setForceRedraw(forceRedraw + 1);
    }
  }, [forceRedraw, collectionSelection, locationSelection, setComment, setForceRedraw, MIN_COMMENT_LEN]);

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
    const waitingMessage = loadingCollections === true ? "Loading collections, please wait..." : "Preparing upload...";
    const patienceMessage = loadingCollections === true ? "This may take a while" : "One moment please";
    // Let the user know collections are still being loaded
    if (loadingCollections === true || disableDetails === true) {
      return (
        <Grid id='folder-upload-details-wrapper' container direction="column" alignItems="center" justifyContent="start" gap={2}>
          <Typography gutterBottom variant="body2">
            {waitingMessage}
          </Typography>
          <CircularProgress variant="indeterminate" />
          <Typography gutterBottom variant="body2">
            {patienceMessage}
          </Typography>
        </Grid>
      );
    }

    return (
      <FolderUploadForm displayCoordSystem={displayCoordSystem} measurementFormat={userSettings['measurementFormat']}
                        collectionInfo={collectionInfo} locationItems={locationItems}
                        onCollectionChange={handleCollectionChange} onCommentChange={handleCommentChange} onLocationChange={handleLocationChange} 
                        onTimezoneChange={setSelectedTimezone}
      />
    );
  }

  // Render the UI
  const details_continue_enabled = locationSelection != null && collectionSelection != null && comment != null &&
                                      comment.length > MIN_COMMENT_LEN && disableDetails === false;
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
                  Upload {String(type).charAt(0).toUpperCase() + String(type).slice(1)} Folder
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
                <Button id="folder_upload" sx={{'flex':'1'}} size="small" onClick={filesUpload}
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
              <Button id="sandbox-upload-details-cancel" sx={{'flex':'1'}} size="small" onClick={cancelDetails}
                      disabled={disableDetails ? true : false}>Cancel</Button>
            </CardActions>
          </Card>
        }
        </Grid>
      </Box>
    { continueUploadInfo !== null && 
      <FolderUploadContinue uploadPath={uploadPath}
                            totalFileCount={continueUploadInfo.allFiles.length} 
                            remainingFileCount={continueUploadInfo.allFiles.length-continueUploadInfo.files.length}
                            elapsedSeconds={continueUploadInfo.elapsedSec}
                            onContinue={prevUploadContinue}
                            onRestart={prevUploadRestart}
                            onCreateNew={prevUploadCreateNew}
                            onAbandon={prevUploadAbandon}
                            onCancel={prevUploadCancel}
      />
   }
   { (continueUploadInfo !== null && prevUploadCheck !== prevUploadCheckState.noCheck) &&
      <FolderUploadConfirm title={prevUploadCheck === prevUploadCheckState.checkReset ? "Restart Upload" :
                                    prevUploadCheck === prevUploadCheckState.checkNew ? "Create New Upload" :
                                    prevUploadCheck === prevUploadCheckState.abandon ? "Abandon Upload" : ""
                                }
                            onConfirm={prevUploadCheck === prevUploadCheckState.checkReset ? prevUploadResetContinue :
                                        prevUploadCheck === prevUploadCheckState.checkNew ? prevUploadCreateNewContinue :
                                        prevUploadCheck === prevUploadCheckState.abandon ? prevUploadAbandonContinue : () => {}
                                }
                            onCancel={prevUploadResetCreateCancel}
      >
        <Typography gutterBottom variant="body">
          {prevUploadCheck === prevUploadCheckState.checkReset && "Are you sure you want to delete the previous uploaded files and restart?"}
          {prevUploadCheck === prevUploadCheckState.checkNew && "Are you sure you want to abandon the previous uploaded and create a new one?"}
          {prevUploadCheck === prevUploadCheckState.abandon && "Are you sure you want to abandon the previous uploaded?"}
        </Typography>
      </FolderUploadConfirm>
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