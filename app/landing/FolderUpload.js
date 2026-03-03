'use client'

/** @module landing/FolderUpload */

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import { allTimezones, useTimezoneSelect } from "react-timezone-select";

import FolderNewUpload from './FolderNewUpload';
import FolderSelectionProgress from './FolderSelectionProgress';
import FolderUploadConfirm from './FolderUploadConfirm';
import FolderUploadContinue from './FolderUploadContinue';
import FolderUploadForm from './FolderUploadForm';
import { Level } from '../components/Messages';
import LocationItem from '../components/LocationItem';
import { meters2feet } from '../utils';
import ProgressWithLabel from '../components/ProgressWithLabel';
import * as Server from './LandingServerCalls';
import { AddMessageContext, AllowedImageMime, AllowedMovieMime, BaseURLContext, CollectionsInfoContext, 
          DisableIdleCheckFuncContext, TokenExpiredFuncContext, LocationsInfoContext,SizeContext, TokenContext,
          UserSettingsContext } from '../serverInfo';


const MAX_FILE_SIZE = 80 * 1000 * 1024; // Number of bytes before a file is too large
const MIN_COMMENT_LEN = 10; // Minimum allowable number of characters for a comment
const MAX_CHUNKS = 8; // Maximum number of chunks to break file uploads into
const MAX_FILES_UPLOAD_SPLIT = 5; // Maximum number of files to upload at one time

const MAX_FORM_FILE_CHUNK = 5000;  // Maximum number of files to put into a form at one fime

// Used to indicate the state of checking for a previous upload and what to so about it
const prevUploadCheckState = {
  noCheck: null,
  checkReset: 1,
  checkNew: 2,
  checkAbandon: 3,
};

// Used to manage the state of an active upload
const uploadingState = {
  none: 0,
  uploading: 10,
  haveFailed: 20,
  retryingFailed: 30,
  uploadFailure: 31,
  error: 40,
};


/**
 * Checks if we're in a low memory sitation. If not supported by browser, false is returned
 * @function
 * @return {boolean} A value of true if we're in a low memory situation, otherwise false
 */
function haveLowMemory() {
  if (window.performance && window.performance.memory) {
    const memUsed = performance.memory.usedJSHeapSize;
    const memMax = performance.memory.jsHeapSizeLimit;

    // Return whether we have enough available memory
    console.log('HACK: MEMORY: ', memMax / (1024*1024), memUsed / (1024*1024), (memMax * 0.8) / (1024*1024));
    return memUsed > memMax * 0.8;  // True if we're low on memory
  }

  return false;
}


// Be sure to add new known upload types to the parameter definition below
/**
 * Renders the UI for uploading a folder of images
 * @function
 * @param {boolean} loadingCollections Flag indicating collections are being loaded and not available
 * @param {string} type One of the known upload types ('images', 'movies')
 * @param {object} {recovery} Recovery information when recovering a failed upload
 * @param {function} onCompleted The function to call when an upload is completed
 * @param {function} onCancel The function to call when the user cancels the upload
 * @returns {object} The rendered UI
 */
export default function FolderUpload({loadingCollections, type, recovery, onCompleted, onCancel}) {
  const theme = useTheme();
  const addMessage = React.useContext(AddMessageContext); // Function adds messages for display
  const collectionInfo = React.useContext(CollectionsInfoContext);
  const disabledIdleCheckFunc = React.useContext(DisableIdleCheckFuncContext);
  const locationItems = React.useContext(LocationsInfoContext);
  const tokenExpiredFunc = React.useContext(TokenExpiredFuncContext);
  const serverURL = React.useContext(BaseURLContext);
  const uiSizes = React.useContext(SizeContext);
  const uploadToken = React.useContext(TokenContext);
  const userSettings = React.useContext(UserSettingsContext);  // User display settings
  const disableUploadDetailsRef = React.useRef(false); // Used to lock out multiple clicks
  const disableUploadPrevRef = React.useRef(false); // Used to lock out multiple clicks
  const disableUploadCheckRef = React.useRef(false); // Used to lock out multiple clicks (resets next time page is redrawn)
  const folderCancelRef = React.useRef(false); // Folder cancel button
  const folderSelectRef = React.useRef(false); // Folder upload control
  const folderUploadRef = React.useRef(false); // Folder upload button
  const uploadStateRef = React.useRef(uploadingState.none);  // Used to keep upload state up to date for functions
  const [collectionSelection, setCollectionSelection] = React.useState(null);
  const [comment, setComment] = React.useState(null);
  const [continueUploadInfo, setContinueUploadInfo] = React.useState(null); // Used when continuing a previous upload
  const [disableDetails, setDisableDetails] = React.useState(false); // Used to disable buttons
  const [filesSelected, setFilesSelected] = React.useState(0);
  const [finishingUpload, setFinishingUpload] = React.useState(false); // Used when finishing up an upload
  const [forceRedraw, setForceRedraw] = React.useState(0);
  const [haveFailedUpload, setHaveFailedUpload] = React.useState(false); // Used to flag that some files didn't get uploaded successfully
  const [inputSize, setInputSize] = React.useState({'width':252,'height':21}); // Updated when UI rendered
  const [locationSelection, setLocationSelection] = React.useState(null);
  const [newUpload, setNewUpload] = React.useState(false); // Used to indicate that we have  a new upload
  const [newUploadFiles, setNewUploadFiles] = React.useState(null); // The list of files to upload
  const [notificationMessage, setNotificationMessage] = React.useState(null); // Used to display a notification message to user
  const [uploadState, setUploadState] = React.useState(uploadingState.none); // Used to indicate the state of an active upload
  const [prevUploadCheck, setPrevUploadCheck] = React.useState(prevUploadCheckState.noCheck); // Used to check if the user wants to perform a reset or new upload
  const [uploadPath, setUploadPath] = React.useState(null);
  const [uploadCompleted, setUploadCompleted] = React.useState(false); // Uploads are done
  const [uploadingFiles, setUploadingFiles] = React.useState(false);
  const [uploadingFileCounts, setUploadingFileCounts] = React.useState({total:0, uploaded:0});
  const [workingUploadFiles, setWorkingUploadFiles] = React.useState(null); // Contains the latest/last set of files for upload
  const [workingUploadId, setWorkingUploadId] = React.useState(null); // The active upload ID

  const { options, parseTimezone } = useTimezoneSelect({ labelStyle:'altName', allTimezones });
  const [selectedTimezone, setSelectedTimezone] = React.useState(Intl.DateTimeFormat().resolvedOptions().timeZone);

  const uploadPercentComplete = React.useMemo(() => {
    // We assume 100% until we know better
    return uploadingFileCounts.total ? Math.floor((uploadingFileCounts.uploaded / uploadingFileCounts.total) * 100) : 100;
  }, [uploadingFileCounts]);

  let displayCoordSystem = 'LATLON';
  if (userSettings['coordinatesDisplay']) {
    displayCoordSystem = userSettings['coordinatesDisplay'];
  }

  // Used to keep the upload state reference up to date
  React.useEffect(() => {
    uploadStateRef.current = uploadState;
  }, [uploadState]);

  // Calculate the size of the file loading control to use as sizing
  React.useLayoutEffect(() => {
    if (!folderSelectRef.current) {
      return;
    }

    const {width, height} = folderSelectRef.current.getBoundingClientRect();

    // Set the input size if it's changed, otherwise keep what we have so it doesn't trigger a redraw
    setInputSize((prev) => {
      if ((prev.width !== width) || (prev.height !== height)) {
        return {width, height};
      }

      return prev;
    });
  }, []);

  /**
   * Handles failed uploaded files
   * @function
   * @param {string} uploadId The ID of the upload that's in progress
   * @param {object} uploadedFiles The files that were being uploaded
   * @param {function} cbComplete The function to call if all files are successfully uploaded
   * @param {function} cbFail The function to call on failure
   * @param {number} numRetries The number of retry attempts made
   */
  const handleFailedUploads = React.useCallback((uploadId, uploadedFiles, cbComplete, cbFail, numRetries = 0) => {
    cbComplete ||= () => {};
    cbFail ||= () => {};

    const success = Server.handleFailedUploads(serverURL, uploadToken, uploadId, uploadedFiles,
      (respData) => { // Success
          // Build up list of files to retry
          if (respData.length > 0) {
            const failedFiles = uploadedFiles.filter((item) => respData.findIndex((oneName) => oneName.toLowerCase() === item.webkitRelativePath.toLowerCase()) !== -1 )
            if (failedFiles.length > 0) {
              window.setTimeout(() => uploadChunk(failedFiles, uploadId), 200);
            } else {
              cbFail()
            }
          } else {
            cbComplete()
          }
      },
      (err) => {      // Failure
          if (numRetries >= 6) {
            addMessage(Level.Error, 'A problem ocurred while getting failed files for the upload');
            setUploadState(uploadingState.error);
          } else {
            numRetries++;
            window.setTimeout(() => handleFailedUploads(uploadId, uploadedFiles, cbComplete, cbFail, numRetries), 10000 * numRetries);
          }
      }
    );

    // Check for a problem
    if (!success) {
      addMessage(Level.Error, 'An unknown problem ocurred while getting failed files for the upload');
      setUploadState(uploadingState.error);
    }
  }, [addMessage, setUploadState]);

  /**
   * Handles success when getting upload counts
   * @function
   * @param {object} respData The response data
   * @param {string} uploadId The ID of the upload that's in progress
   * @param {object} uploadFiles The arraay of files that are being uploaded
   * @param {number} prevUploadCount The number of uploaded files used when uploads are failing.
   * @param {number} startTs The timestamp of when the prevUploadCount last changed
   */
  function haveGetUploadCountsSuccess(respData, uploadId, uploadFiles, prevUploadCount, startTs) {
    // Process the results
    setUploadingFileCounts(respData);
    if (respData.uploaded === respData.total) {
      // We are done uploading
      setUploadCompleted(true);
      setUploadState(uploadingState.none);
      disabledIdleCheckFunc(false);       // Enable idle checking
    } else {
      // We have failed uploads. Keep track of what we have so that we can retry when
      // the uploads have stabilized (the ones that could succeed, have succeeded)
      if (respData.uploaded !== prevUploadCount || !startTs) {
        // Something updated, we're not ready to get the failed images
        window.setTimeout(() => internalGetUploadCounts(uploadId, uploadFiles, 0, respData.uploaded, Date.now()), 2000);
        if (uploadStateRef.current !== uploadingState.retryingFailed) {
          setUploadState(uploadingState.uploading);
        }
      } else {
        // We haven't had a change in the number of successful uploads
        const elapsedSec = Math.trunc((Date.now() - startTs) / 1000);
        // Check if we're ready to display a pending message
        if (elapsedSec >= 1 * 60) {    // 1 minutes
          // Only if we're not retrying
          if (uploadStateRef.current !== uploadingState.retryingFailed) {
            setUploadState(uploadingState.haveFailed);
          }
        }
        if (elapsedSec >= 3 * 60) {    // 3 minutes
          // Retry only if we're not already retrying
          if (uploadStateRef.current !== uploadingState.retryingFailed) {
            setUploadState(uploadingState.retryingFailed);
            handleFailedUploads(uploadId, uploadFiles, 
                () => {   // Success function
                      setUploadState(uploadingState.none);
                      disabledIdleCheckFunc(false);    // Enable checking for idle
                      },
                () => {   // Failure function
                      console.log('ERROR: Unable to find failed files in list of files to upload');
                      addMessage(Level.Error, 'An error ocurred while trying to fetch list of failed files from the server');
                      setUploadState(uploadingState.uploadFailure);
                      disabledIdleCheckFunc(false);    // Enable checking for idle
                      }
              );
            window.setTimeout(() => internalGetUploadCounts(uploadId, uploadFiles), 2000);
          } else {
            setUploadState(uploadingState.uploadFailure);
            disabledIdleCheckFunc(false);    // Enable checking for idle
          }
        } else {
          // Not ready to do take any action yet
          window.setTimeout(() => internalGetUploadCounts(uploadId, uploadFiles, 0, respData.uploaded, startTs), 2000);
        }
      }
    }   
  }

  /**
   * Internal function that gets the counts of an upload
   * @function
   * @param {string} uploadId The ID of the upload that's in progress
   * @param {object} uploadFiles The arraay of files that are being uploaded
   * @param {number} numRetries The working number of retries when called recursively during error handling.
   * @param {number} prevUploadCount The number of uploaded files used when uploads are failing.
   * @param {number} startTs The timestamp of when the prevUploadCount last changed
   */
  const internalGetUploadCounts = React.useCallback((uploadId, uploadFiles, numRetries = 0, prevUploadCount = null, startTs = null) => {

    let success = Server.getUploadCounts(serverURL, uploadToken, uploadId, uploadFiles, tokenExpiredFunc,
      (respData) => { // Success
        haveGetUploadCountsSuccess(respData, uploadId, uploadFiles, prevUploadCount, startTs)
      },
      (err) => {      // Failure
        if (numRetries >= 6) {
          addMessage(Level.Error, 'A problem ocurred while checking upload image counts');
          setUploadState(uploadingState.error);
          disabledIdleCheckFunc(false);    // Enable checking for idle
        } else {
          numRetries++;
          window.setTimeout(() => internalGetUploadCounts(uploadId, uploadFiles, numRetries), 7000 * numRetries);
          setUploadState(uploadingState.uploading);
        }
      }
    );

    // Check for an error
    if (!success) {
      addMessage(Level.Error, 'An unknown problem ocurred while checking upload image counts');
      setUploadState(uploadingState.error);
      disabledIdleCheckFunc(false);    // Enable checking for idle
    }

  }, [addMessage, disabledIdleCheckFunc, setUploadingFileCounts, setUploadCompleted, setUploadState, uploadStateRef])

  /**
   * Gets the counts of an upload
   * @function
   * @param {string} uploadId The ID of the upload that's in progress
   * @param {object} uploadFiles The arraay of files that are being uploaded
   */
  const getUploadCounts = React.useCallback((uploadId, uploadFiles) => {
    internalGetUploadCounts(uploadId, uploadFiles);
  }, [internalGetUploadCounts]);
  

  /**
   * Sends the completion status to the server
   * @function
   * @param {string} uploadId The uploadID to mark complete
   * @param {function} {onSuccess} Function to call upon success
   * @param {function} {onFailure} Function to call upon failure
   */
  function serverUploadCompleted(uploadId, onSuccess, onFailure) {
    onSuccess ||= () => {};
    onFailure ||= () => {};

    let success = Server.uploadCompleted(serverURL, uploadToken, uploadId, tokenExpiredFunc,
      (respData) => { // Success
        onSuccess(uploadId, respData);
      },
      (err) => {      // Failure
        addMessage(Level.Error, 'A problem ocurred while completing image upload');
        onFailure(uploadId);
      }
    );

    // Check for an error
    if (!success) {
      addMessage(Level.Error, 'An unknown problem ocurred while completing image upload');
      onFailure(uploadId);
    }
  }

  /**
   * Returns the remaining set of files of files and upload count of files to send
   * @function
   * @param {array} files The files to remove a leading count from
   * @param {number} count The integer number of files already uploaded which is removed from the front of the files
   * @param {number} prevTimestamp The starting timestamp value used to calculate how much time it takes to load a single file
   * @return {object} The remaining files to upload and the calculated upload count
   */
  function getNextUploadChunk(files, count, startTimestamp) {
      const remainingFiles = files.slice(count);
      if (remainingFiles.length <= 0) {
        return {files:remainingFiles, count: 0};
      }

      // Figure out how many files to upload next
      let curUploadCount = MAX_FILES_UPLOAD_SPLIT;
      const perFileSec = ((Date.now() - startTimestamp) / 1000.0) / count;
      // Check if we have low memory (only works on Chrome-like browsers)
      if (!haveLowMemory()) {
        curUploadCount = Math.max(1, MAX_FILES_UPLOAD_SPLIT - Math.round(perFileSec / 7.0)); // Checking against 7.0 seconds (aka magic number)
      } else {
        curUploadCount = 1
      }

      return {files:remainingFiles, count:curUploadCount};
  }

  /**
   * Uploads chunks of files from the list
   * @function
   * @param {object} fileChunk The array of files to upload
   * @param {string} uploadId The ID of the upload
   * @param {number} numFiles The number of images to send
   * @param {number} attempts The remaining number of attempts to try
   */
  const uploadChunk = React.useCallback((fileChunk, uploadId, numFiles = 1, attempts = 3) => {
    const maxAttempts = attempts;
    const tzinfo = options.find((item) => item.value === selectedTimezone);
    const startTs = Date.now();

    const success = Server.uploadChunk(serverURL, uploadToken, fileChunk, uploadId, numFiles, tzinfo, tokenExpiredFunc,
      (respData) => { // Success
        // Process the results
        const nextFiles = getNextUploadChunk(fileChunk, numFiles, startTs);
        // If we have no more files to upload, we are done
        if (nextFiles.files.length > 0) {
          window.setTimeout(() => uploadChunk(nextFiles.files, uploadId, nextFiles.count), 10);
        }
      },
      (err) => {      // Failure
          // Try uploading this chunk a few times
          attempts--;
          if (attempts > 0) {
            // Split this chunk into single uploads (if not already) in case the problem is with one or more files
            window.setTimeout(uploadChunk(fileChunk, uploadId, numFiles, attempts), 5000 * (maxAttempts - attempts));
          } else {
            // Tell the database about the failed files
            // After several failures to upload, move on - we will catch them later and try again
            const nextFiles = getNextUploadChunk(fileChunk, numFiles, startTs);
            setHaveFailedUpload(true);
            if (nextFiles.files.length > 0) {
              window.setTimeout(() => uploadChunk(nextFiles.files, uploadId), 10);
            }
          }
      }
    );

    // Check for a problem making the call
    if (!success) {
      console.log('Upload Images Unknown Error: ',err);
      addMessage(Level.Error, 'An unknown problem ocurred while uploading images');
    }
  }, [addMessage, options, selectedTimezone, serverURL, setHaveFailedUpload, uploadToken]);

  /**
   * Handles uploading a folder of files
   * @function
   * @param {array} uploadFiles The list of files to upload
   * @param {string} uploadId The ID associated with the upload
   */
  const uploadFolder = React.useCallback((uploadFiles, uploadId) => {
    // Check that we have something to upload
    if (!uploadFiles || uploadFiles.length <= 0) {
      // TODO: Make the message part of the displayed window?
      // TODO: Change to editing upload page after marking as complete
      addMessage(Level.Information, 'All files have been uploaded');
      console.log('All files were uploaded', uploadId);
      setWorkingUploadId(uploadId);
      getUploadCounts(uploadId, uploadFiles);
      return;
    }

    disabledIdleCheckFunc(true);    // Disable the checks for idle until we're done
    setUploadingFiles(true);
    setHaveFailedUpload(false);
    setUploadState(uploadingState.uploading);

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

    window.setTimeout(() => getUploadCounts(uploadId, uploadFiles), 1000);

    setWorkingUploadId(uploadId);
  }, [addMessage, getUploadCounts, haveFailedUpload, setHaveFailedUpload, setWorkingUploadId, setUploadingFiles, uploadChunk]);

  /**
   * Calls the cancelation function when the user clicks cancel
   * @function
   */
  const cancelUpload = React.useCallback(() => {
    // Enable buttons
    if (folderUploadRef.current) {
      folderUploadRef.current.disabled = false;
    }
    if (folderCancelRef.current) {
      folderCancelRef.current.disabled = false;
    }

    onCancel();
  }, [onCancel]);

  /**
   * Handle successful result when checking for a previous upload
   * @function
   * @param {object} respData The response data from the call
   */
  const havePrevUploadSuccess = React.useCallback((respData, path, files) => {
      if (folderUploadRef.current) {
        folderUploadRef.current.disabled = false;
      }
      if (folderCancelRef.current) {
        folderCancelRef.current.disabled = false;
      }

    // Process the results
    if (respData.exists === false) {
      setNewUpload(true);
      setNewUploadFiles(files);
      setUploadPath(path);
      setWorkingUploadFiles(files);
    } else {
      setUploadPath(path);

      // Acknowledge that upload should continue or be restarted or as a new one
      const notLoadedFiles = files.filter((item) => !respData.uploadedFiles.includes(item.webkitRelativePath));
      const loadedFiles = files.filter((item) => respData.uploadedFiles.includes(item.webkitRelativePath));
      setWorkingUploadFiles(notLoadedFiles);
      setContinueUploadInfo({files: notLoadedFiles,
                             loadedFiles: loadedFiles,
                             elapsedSec: parseInt(respData.elapsed_sec),
                             allFiles: files,
                             id:respData.id})
    }
  }, [setContinueUploadInfo, setNewUpload, setNewUploadFiles, setUploadPath, setWorkingUploadFiles]);

  /**
   * Handle successful result when checking for a previous upload
   * @function
   * @param {object} respData The response data from the call
   * @param {object} files The list of files to upload
   */
  const haveUploadRecoverySuccess = React.useCallback((respData, files) => {
      if (folderUploadRef.current) {
        folderUploadRef.current.disabled = false;
      }
      if (folderCancelRef.current) {
        folderCancelRef.current.disabled = false;
      }

    if (respData.success) {
      setNewUpload(false);
      window.setTimeout(() => uploadFolder(files, respData.id), 10);
    } else {
      console.log('Didn\'t find recovery upload');
      addMessage(Level.Warning, respData.message);
      setUploadState(uploadingState.none);
      cancelUpload();
    }
  }, [addMessage, cancelUpload, setNewUpload, setUploadState, uploadFolder]);

  /**
   * Handles the user wanting to upload files
   * @function
   * @param {object} event The event
   */
  const filesUpload = React.useCallback((event) => {
    // Disable buttons
    if (folderUploadRef.current) {
      folderUploadRef.current.disabled = true;
    }
    if (folderCancelRef.current) {
      folderCancelRef.current.disabled = true;
    }

    // Reset any uploaded counts
    setUploadingFileCounts({total:0, uploaded:0});

    // Return if there's nothing to do
    if (!folderSelectRef.current || !folderSelectRef.current.files || !folderSelectRef.current.files.length) {
      addMessage(Level.Information, 'Please choose a folder with files to upload');
      if (folderUploadRef.current) {
        folderUploadRef.current.disabled = false;
      }
      if (folderCancelRef.current) {
        folderCancelRef.current.disabled = false;
      }
      return;
    }

    const allFiles = folderSelectRef.current.files;

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
      if (folderUploadRef.current) {
        folderUploadRef.current.disabled = false;
      }
      if (folderCancelRef.current) {
        folderCancelRef.current.disabled = false;
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
      if (folderUploadRef.current) {
        folderUploadRef.current.disabled = false;
      }
      if (folderCancelRef.current) {
        folderCancelRef.current.disabled = false;
      }
      return;
    }
    relativePath = relativePath.substr(0, relativePath.length - allowedFiles[0].name.length - 1);

    if (!recovery) {
      const success = Server.checkPreviousUpload(serverURL, uploadToken, relativePath, tokenExpiredFunc, 
                        (respData) => {havePrevUploadSuccess(respData, relativePath, allowedFiles)},     // Success
                        (err) => {  // Failure
                          if (folderUploadRef.current) {
                            folderUploadRef.current.disabled = false;
                          }
                          if (folderCancelRef.current) {
                            folderCancelRef.current.disabled = false;
                          }
                          addMessage(Level.Error, 'A problem ocurred while preparing for upload');
                          setUploadState(uploadingState.error);
                        }
        );

      // Check for an error
      if (!success) {
        addMessage(Level.Error, 'An unknown problem ocurred while preparing for upload');
        setUploadState(uploadingState.error);
      }
    } else {
      setUploadingFileCounts({total:allowedFiles.length, uploaded:0});
      setDisableDetails(true);
      window.setTimeout(() => {
                  const success = Server.updateUploadRecovery(serverURL,
                                                    uploadToken,
                                                    recovery.coll_info.id,
                                                    recovery.upload_info.location,
                                                    recovery.upload_info.key,
                                                    relativePath,
                                                    allowedFiles,
                                                    tokenExpiredFunc,
                                                    (respData) => {haveUploadRecoverySuccess(respData, allowedFiles)}, // Success
                                                    (err) => {    // Failure
                                                      if (folderUploadRef.current) {
                                                        folderUploadRef.current.disabled = false;
                                                      }
                                                      if (folderCancelRef.current) {
                                                        folderCancelRef.current.disabled = false;
                                                      }
                                                      addMessage(Level.Error, 'A problem ocurred while preparing for upload');
                                                      setUploadState(uploadingState.error);
                                                      cancelUpload();
                                                    });
                  // Check for an error
                  if (!success) {
                    addMessage(Level.Error, 'An unknown problem ocurred while preparing for recovery of an upload');
                    setUploadState(uploadingState.error);
                    cancelUpload();
                  }
      }, 100);
    }
  }, [addMessage, setDisableDetails, setNewUpload, setUploadingFileCounts, setUploadState]);

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
   * Handles the user wanting to ignore the failed uploads for now
   * @function
   */
  const failedIgnore = React.useCallback(() => {
    const curUploadId = workingUploadId;
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
  }, [onCompleted, setCollectionSelection, setComment, setContinueUploadInfo, setLocationSelection, setNewUpload, 
      setNewUploadFiles, setUploadCompleted, setUploadingFileCounts, setUploadingFiles, workingUploadId]);

  /**
   * Handles the user wanting to retry sending the failed uploads
   * @function
   */
  const failedRetry = React.useCallback(() => {
    setUploadState(uploadingState.uploading);
    uploadFolder(workingUploadFiles, workingUploadId);
  }, [workingUploadFiles, workingUploadId]);

  /**
   * Mark the failed upload as completed
   * @function
   */
  const failedDone =  React.useCallback(() => {
    setUploadState(uploadingState.none);
    doneUpload();
  }, [doneUpload, setUploadState]);

  /**
   * Handles the user cancelling the current upload
   * @function
   */
  const cancelDetails = React.useCallback(() => {
    // Set to disable multiple clicks
    if (disableUploadDetailsRef.current === true) {
      return;
    }
    disableUploadDetailsRef.current = true;

    setNewUpload(false);
    setNewUploadFiles(null);
    disableUploadDetailsRef.current = false;
  }, [disableUploadDetailsRef, setNewUpload, setNewUploadFiles]);

  /**
   * Handles when the user wants to continue a new upload
   * @function
   */
  const handleNewUpload = React.useCallback(() => {
    // Set to disable multiple clicks
    if (disableUploadDetailsRef.current === true) {
      return;
    }
    disableUploadDetailsRef.current = true;
    setUploadingFileCounts({total:newUploadFiles.length, uploaded:0});
    setDisableDetails(true);

    // Add the upload to the server letting the UI to update
    window.setTimeout(() => {
        const success = Server.continueNewUpload(serverURL, 
                          uploadToken,
                          collectionSelection.id,
                          locationSelection.idProperty,
                          uploadPath,
                          comment,
                          newUploadFiles,
                          tokenExpiredFunc,
                          (respData) => {   // Success
                            setDisableDetails(false);
                            setNewUpload(false);
                            window.setTimeout(() => uploadFolder(newUploadFiles, respData.id), 10);
                          },
                          (err) => {   // Failure
                            setDisableDetails(false);
                            addMessage(Level.Error, 'An problem ocurred while preparing for new sandbox upload');
                          }
                        );
        // Check for an error
        if (!success) {
          setDisableDetails(false);
          addMessage(Level.Error, 'An unknown problem ocurred while preparing for new sandbox upload');
        }
    }, 100);
  }, [addMessage, collectionSelection, comment, disableUploadDetailsRef, locationSelection, newUploadFiles, setDisableDetails, 
      setNewUpload, setUploadingFileCounts, uploadPath]);

  /**
   * Continues a previous upload of images
   * @function
   */
  const prevUploadContinue = React.useCallback(() => {
    // Used to prevent multiple clicks
    if (disableUploadPrevRef.current === true) {
      return;
    }
    disableUploadPrevRef.current = true;
    setUploadingFileCounts({total:continueUploadInfo.files.length, uploaded:0});

    setUploadingFiles(true);

    // Check that the continuing upload attempt has the same files as the previous attempt
    let success = Server.checkUploadedFiles(serverURL, uploadToken, continueUploadInfo.id, continueUploadInfo.files,  tokenExpiredFunc,
        (respData) => {     // Success
            if (!respData || respData.success) {
              uploadFolder(continueUploadInfo.files, continueUploadInfo.id); // Success - continue uploading
            } else if (respData.missing) {
                setUploadingFiles(false);
                setNotificationMessage({message:respData.message, action:() => {cancelUpload();failedIgnore();} });
            } else {
                setUploadingFiles(false);
                setNotificationMessage({message:respData.message, action:() => {cancelUpload();failedIgnore();} });
            }
        },
        (err) => {        // Failure
            setUploadingFiles(false);
            setNotificationMessage({message:'An error ocurred while trying to continue the upload', action:() => {cancelUpload();failedIgnore();} });
        }
    );

    // Check for an error
    if (!success) {
      addMessage(Level.Error, 'An unknown problem ocurred while confirming continuation of upload');
      setNotificationMessage({message, action:cancelUpload});
    }

    setContinueUploadInfo(null);

  }, [continueUploadInfo, cancelUpload, disableUploadPrevRef, setContinueUploadInfo, setUploadingFiles, setUploadingFileCounts, 
      uploadFolder]);

  /**
   * Restarts a folder upload
   * @function
   */
  const prevUploadRestart = React.useCallback(() => {
    // Used to prevent multiple clicks
    if (disableUploadPrevRef.current === true) {
      return;
    }
    disableUploadPrevRef.current = true;

    setPrevUploadCheck(prevUploadCheckState.checkReset);
    disableUploadPrevRef.current = false;
  }, [disableUploadPrevRef, prevUploadCheckState, setPrevUploadCheck]);

  /**
   * Restarts a folder upload
   * @function
   */
  const prevUploadAbandon = React.useCallback(() => {
    // Used to prevent multiple clicks
    if (disableUploadPrevRef.current === true) {
      return;
    }
    disableUploadPrevRef.current = true;

    setPrevUploadCheck(prevUploadCheckState.abandon);
    disableUploadPrevRef.current = false;
  }, [disableUploadPrevRef, prevUploadCheckState, setPrevUploadCheck]);

  /**
   * Handles restarting an upload from the beginning
   * @function
   */
  const handlePrevUploadResetContinue = React.useCallback(() => {
    // Used to prevent multiple clicks
    if (disableUploadCheckRef.current === true) {
      return;
    }
    disableUploadCheckRef.current = true;
    setUploadingFileCounts({total:continueUploadInfo.files.length, uploaded:0});

    // Reset the upload on the server and then restart the upload
    const success = Server.prevUploadResetContinue(serverURL, uploadToken, continueUploadInfo.id, continueUploadInfo.files, tokenExpiredFunc,
                              (respData) => {    // Success
                                  disableUploadCheckRef.current = false;
                                  const curFiles = continueUploadInfo.files;
                                  const upload_id = continueUploadInfo.id;
                                  setPrevUploadCheck(prevUploadCheckState.noCheck);
                                  setContinueUploadInfo(null);
                                  window.setTimeout(() => uploadFolder(curFiles, upload_id), 10);
                              },
                              (err) => {
                                  disableUploadCheckRef.current = false;
                                  addMessage(Level.Error, 'A problem ocurred while preparing for reset sandbox upload');
                              }
                            );

    // Check for an error
    if (!success) {
      addMessage(Level.Error, 'An unknown problem ocurred while preparing for reset sandbox upload');
    }
  }, [addMessage, continueUploadInfo, disableUploadCheckRef, prevUploadCheckState, setContinueUploadInfo, setPrevUploadCheck,
      setUploadingFileCounts, uploadFolder]);

  /**
   * Handles abandoning an upload
   * @function
   */
  const handlePrevUploadAbandonContinue = React.useCallback(() => {
    // Used to prevent multiple clicks
    if (disableUploadCheckRef.current === true) {
      return;
    }
    disableUploadCheckRef.current = true;

    const success = Server.prevUploadAbandonContinue(serverURL, uploadToken, continueUploadInfo.id, tokenExpiredFunc,
                              (respData) => {   // Success
                                  disableUploadCheckRef.current = false;
                                  setUploadingFileCounts({total:continueUploadInfo.files.length, uploaded:0});
                                  setPrevUploadCheck(prevUploadCheckState.noCheck);
                                  setContinueUploadInfo(null);
                                  setCollectionSelection(null);
                                  setLocationSelection(null);
                                  setComment(null);
                                  setNewUpload(false);
                                  onCompleted();
                                  addMessage(Level.Info,'Unable to complete removal of previously started upload from the storage server. Please contact your administrator to complete removal');
                              },
                              (err) => {   // Failure
                                  disableUploadCheckRef.current = false;
                                  addMessage(Level.Error, 'A problem ocurred while preparing for abandoning sandbox upload');
                              }
                          );

    // Check for an error
    if (!success) {
      addMessage(Level.Error, 'An unknown problem ocurred while preparing for abandoning sandbox upload');
    }
  }, [addMessage, continueUploadInfo, newUploadFiles, onCompleted, prevUploadCheckState, setCollectionSelection,
      setComment, setContinueUploadInfo, setLocationSelection, setNewUpload, setPrevUploadCheck, setUploadingFileCounts, tokenExpiredFunc]);

  /**
   * Creates a new upload for these files
   * @function
   */
  const prevUploadCreateNew = React.useCallback(() => {
    // Used to prevent multiple clicks
    if (disableUploadPrevRef.current === true) {
      return;
    }
    disableUploadPrevRef.current = true;

    setPrevUploadCheck(prevUploadCheckState.checkNew);
    disableUploadPrevRef.current = false;
  }, [disableUploadPrevRef, prevUploadCheckState, setPrevUploadCheck]);

/**
   * Cancel the upload for these files
   * @function
   */
  const prevUploadCancel = React.useCallback(() => {
    setContinueUploadInfo(null)
    disableUploadPrevRef.current = false;
  }, [disableUploadPrevRef, setContinueUploadInfo]);

  /**
   * Handles creating a new upload separate from an existing one
   * @function
   */
  const prevUploadCreateNewContinue = React.useCallback(() => {
    // Used to prevent multiple clicks
    if (disableUploadCheckRef.current === true) {
      return;
    }
    disableUploadCheckRef.current = true;

    serverUploadCompleted(continueUploadInfo.id,
      () => { // Success
          const uploadFiles = continueUploadInfo.files;
          setUploadingFileCounts({total:uploadFiles.length, uploaded:0});
          setContinueUploadInfo(null);
          setCollectionSelection(null);
          setLocationSelection(null);
          setComment(null);
          setNewUpload(true);
          setNewUploadFiles(uploadFiles);
          disableUploadCheckRef.current = true;
      }
    )
  }, [continueUploadInfo, disableUploadCheckRef, serverUploadCompleted, setCollectionSelection, setComment,
      setContinueUploadInfo, setLocationSelection, setNewUpload, setNewUploadFiles, setUploadingFileCounts]);

  /**
   * Handles cancelling both when asked to continue creating a new upload, or resetting an upload
   * @function
   */
  const prevUploadResetCreateCancel = React.useCallback(() => {
    setPrevUploadCheck(prevUploadCheckState.noCheck);
  }, [prevUploadCheckState, setPrevUploadCheck]);

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
  }, [comment, forceRedraw, locationSelection, setCollectionSelection, setForceRedraw]);

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
  }, [collectionSelection, comment, forceRedraw, setForceRedraw, setLocationSelection]);

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
  }, [forceRedraw, collectionSelection, locationSelection, setComment, setForceRedraw]);

  /**
   * Function to return the correct uploading state message
   * @function
   * @param {object} state The state to get the message for
   * @return {string} The message string
   */
  function getUploadStateString(state) {
    switch (state) {
      case uploadingState.uploading:
        return "Uploading files";
      case uploadingState.none:
        return "No upload at this time";
      case uploadingState.haveFailed:
        return "Some files failed to upload, waiting before attempting to retry";
      case uploadingState.retryingFailed:
        return "Retrying failed images";
      case uploadingState.uploadFailure:
        return "Failed to upload all files";
      default:
        return "<INVALID UPLOAD STATE STRING REQUEST>";
    }
  }

  /**
   * Function to determine if we can show the upload confirmation window
   * @function
   */
  function canShowUploadConfirm() {
    return continueUploadInfo !== null && prevUploadCheck !== prevUploadCheckState.noCheck;
  }

  /**
   * Renders the UI based upon how many images have been uploaded
   * @function
   * @return {object} The UI to render
   */
  function renderInputControls() {
    // TODO: adjust upload percent to include already uploaded images when continued upload restarts
    return (
      <Grid id='uploading-wrapper' container direction='row' sx={{alignItems:'flex-start', justifyContent:'center'}}>
        <Stack id='uploading-grid' display='flex' flexDirection='column' alignItems='center' justifyContent='center'
              sx={{minWidth:inputSize.width, minHeight:inputSize.height}}
        >
          <Typography gutterBottom variant="body3" noWrap>
            {uploadingFileCounts.uploaded} of {uploadingFileCounts.total} uploaded
          </Typography>
          <ProgressWithLabel value={uploadPercentComplete}/>
          <Typography gutterBottom variant="body">
            { getUploadStateString(uploadState) }
          </Typography>
        </Stack>
      </Grid>
    );
  }

  /**
   * Returns the controls for actions when not a new upload
   * @function
   */
  function renderUploadingActions() {
      if (!uploadingFiles && continueUploadInfo === null) {
        return (
          <React.Fragment>
            <Button id="folder_upload" ref={folderUploadRef} sx={{'flex':'1'}} size="small" onClick={filesUpload}
                    disabled={filesSelected > 0 ? false : true}>Upload</Button>
            <Button id="folder_cancel" ref={folderCancelRef} sx={{'flex':'1'}} size="small" onClick={cancelUpload}>Cancel</Button>
          </React.Fragment>
        );
      }
      if (uploadCompleted) {
        return (
          <React.Fragment>
            <Button id="folder_upload_continue" sx={{'flex':'1'}} size="small" onClick={doneUpload}>Done</Button>
            <Button id="folder_upload_another" sx={{'flex':'1'}} size="small" onClick={anotherUpload}>Upload Another</Button>
          </React.Fragment>
        );
      }
      if (uploadState === uploadingState.uploadFailure) {
        return (
          <React.Fragment>
            <Button id="folder_upload_fail_retry" sx={{'flex':'1'}} size="small" onClick={failedRetry}>Retry Now</Button>
            <Button id="folder_upload_fail_ignore" sx={{'flex':'1'}} size="small" onClick={failedIgnore}>Retry Later</Button>
            <Button id="folder_upload_fail_done" sx={{'flex':'1', whiteSpace:"nowrap"}} size="small" onClick={failedDone}>Mark Completed</Button>
          </React.Fragment>
        );
      }

      return (null);
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
              <FolderSelectionProgress type={type} 
                        subTitle={!uploadingFiles ? "Select folder to upload" : !uploadCompleted ? "Uploading selected files" : "Upload complete"}
                        stepNumber={!uploadingFiles ? '1' : '3'}
                        stepTotal={'3'}
                        content={uploadingFiles ? 
                                        renderInputControls()
                                      : <Stack display='flex' flexDirection='column' alignItems='center' justifyContent='center'>
                                          <Button variant="contained" component="label">
                                          Upload Folder
                                          <input id="folder_select" hidden ref={folderSelectRef} type="file" name="file" webkitdirectory="" 
                                                  directory="" onChange={selectionChanged}
                                          />
                                        </Button>
                                      </Stack>
                                }
                        actions={renderUploadingActions()}
              />
        :
          <FolderNewUpload 
                        stepNumber={'2'}
                        stepTotal={'3'}
                        content={renderUploadDetails()}
                        actionInfo={[{label:'Continue', onClick:handleNewUpload, disabled:details_continue_enabled ? false : true},
                                  {label:'Cancel', onClick:cancelDetails, disabled:false}
                                ]}
          />
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
   { canShowUploadConfirm() &&
      <FolderUploadConfirm title={prevUploadCheck === prevUploadCheckState.checkReset ? "Restart Upload" :
                                    prevUploadCheck === prevUploadCheckState.checkNew ? "Create New Upload" :
                                    prevUploadCheck === prevUploadCheckState.abandon ? "Abandon Upload" : ""
                                }
                            onConfirm={prevUploadCheck === prevUploadCheckState.checkReset ? handlePrevUploadResetContinue :
                                        prevUploadCheck === prevUploadCheckState.checkNew ? prevUploadCreateNewContinue :
                                        prevUploadCheck === prevUploadCheckState.abandon ? handlePrevUploadAbandonContinue : () => {}
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
        <div style={{backgroundColor:'rgb(212, 230, 241, 0.95)', border:'1px solid grey', borderRadius:'15px', padding:'25px 10px'}}>
          <Grid container direction="column" alignItems="center" justifyContent="center" >
              <Typography gutterBottom variant="body2" color="lightgrey">
                Please wait while the upload finishes up ...
              </Typography>
              <CircularProgress variant="indeterminate" />
          </Grid>
        </div>
      </Grid>
    }
    { notificationMessage && 
      <Grid id="query-running-query-wrapper" container direction="row" alignItems="center" justifyContent="center" 
            sx={{...theme.palette.screen_overlay, backgroundColor:'rgb(0,0,0,0.5)', zIndex:11111}}
      >
        <div style={{backgroundColor:'rgb(212, 230, 241, 0.95)', border:'1px solid grey', borderRadius:'15px', padding:'25px 10px'}}>
          <Grid container direction="column" alignItems="center" justifyContent="center" >
              <Typography gutterBottom variant="body2" color="black">
                {notificationMessage.message}
              </Typography>
              <Button size="small" onClick={() => {setNotificationMessage(null);notificationMessage.action();} }
                      sx={{paddingTop:'20px'}}
              >
                Done
              </Button>
          </Grid>
        </div>
      </Grid>
    }
    </React.Fragment>
  );
}
