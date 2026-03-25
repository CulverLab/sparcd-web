/** @module landing/useChunkUpload */

import * as React from 'react';
import { useTimezoneSelect, allTimezones } from 'react-timezone-select';

import { Level } from '../components/Messages';
import * as Server from './LandingServerCalls';
import { AddMessageContext, BaseURLContext, DisableIdleCheckFuncContext, TokenContext, TokenExpiredFuncContext } from '../serverInfo';

const MAX_CHUNKS = 8; // Maximum number of chunks to break file uploads into
const MAX_FILES_UPLOAD_SPLIT = 5; // Maximum number of files to upload at one time

const SLOW_FILE_THRESHOLD_SEC = 7.0; // Files taking longer than this trigger batch size reduction

const GET_COUNTS_CHECK_INTERVAL_MS = 5 * 1000;    // Number of seconds converted to milliseconds

// Uploading state enum — re-exported so consumers don't need to redefine it
export const uploadingState = Object.freeze({
  none: 0,
  uploading: 10,
  haveFailed: 20,
  retryingFailed: 30,
  uploadFailure: 31,
  error: 40,
});

/**
 * Checks if we're in a low memory situation.
 * @returns {boolean} True if memory is low
 */
function haveLowMemory() {
  if (window.performance?.memory) {
    return performance.memory.usedJSHeapSize > performance.memory.jsHeapSizeLimit * 0.8;
  }
  return false;
}

/**
 * Custom hook that encapsulates chunked folder upload logic.
 *
 * @param {string} selectedTimezone  IANA timezone string (e.g. from useTimezoneSelect)
 * @returns {{
 *   uploadState: number,
 *   uploadingFileCounts: {total: number, uploaded: number},
 *   uploadPercentComplete: number,
 *   workingUploadId: string|null,
 *   uploadFolder: (files: File[], uploadId: string) => void,
 *   restartFailedUploads: (uploadId: string, uploadFiles: File[], onSuccess: function, onFailed: function) => void,
 *   setUploadState: React.Dispatch,
 *   setUploadingFileCount: (totalCount?: number) => void,
 * }}
 */
export function useChunkUpload(selectedTimezone) {
  const addMessage        = React.useContext(AddMessageContext);
  const serverURL         = React.useContext(BaseURLContext);
  const disableIdleCheck  = React.useContext(DisableIdleCheckFuncContext);
  const uploadToken       = React.useContext(TokenContext);
  const tokenExpiredFunc  = React.useContext(TokenExpiredFuncContext);

  const { options } = useTimezoneSelect({ labelStyle: 'altName', allTimezones });

  const [uploadState,          setUploadState]          = React.useState(uploadingState.none);
  const [uploadingFileCounts,  setUploadingFileCounts]  = React.useState({ total: 0, uploaded: 0 });
  const [workingUploadId,      setWorkingUploadId]      = React.useState(null);

  const cancelledRef = React.useRef(false);                   // Used to detect component unmount
  const pollingActiveRef = React.useRef(false);               // Used to make sure polling for counts is started only once
  const uploadStateRef = React.useRef(uploadingState.none);   // The working state reference

  // Keep a ref in sync so async callbacks always see the latest value
  React.useEffect(() => { uploadStateRef.current = uploadState; }, [uploadState]);

  // Store completeness percentage as it changes
  const uploadPercentComplete = React.useMemo(() => {
    // We assume 100% until we know better
    return uploadingFileCounts.total
      ? Math.floor((uploadingFileCounts.uploaded / uploadingFileCounts.total) * 100)
      : 100;
  }, [uploadingFileCounts]);

  // Store timezone info
  const tzInfo = React.useMemo(() => {
    return options.find((item) => item.value === selectedTimezone)?.value ?? selectedTimezone;
  }, [options, selectedTimezone]);

  // Use to check unmounted components
  React.useEffect(() => {
    cancelledRef.current = false;
    return () => { cancelledRef.current = true; }; // cleanup on unmount
  }, []);

  /**
   * Keeps the upload state variables consistent
   * @function
   * @param {number} newState The new state to set
   */
  const uploadStateUpdate = React.useCallback((newState) => {
    uploadStateRef.current = newState;
    setUploadState(newState);
  }, []);


  /**
   * Slices the next batch of files to upload and calculates an adaptive
   * batch size based on per-file upload time and available memory.
   * @function
   * @param {array} files The files to remove a leading count from
   * @param {number} count The integer number of files already uploaded which is removed from the front of the files
   * @param {number} startTimestamp The starting timestamp value used to calculate how much time it takes to load a single file
   * @return  {{
   *            files: File[],
   *            count: number
   *          }}  Array of all remaining files to upload and the count of files to upload next (size of next chunk)
   */
  const getNextUploadChunk = React.useCallback((files, count, startTimestamp) => {
    const remainingFiles = files.slice(count);
    if (remainingFiles.length <= 0) return { files: remainingFiles, count: 0 };

    const perFileSec = ((Date.now() - startTimestamp) / 1000.0) / (count || 1);
    const curUploadCount = haveLowMemory()
      ? 1
      : Math.max(1, MAX_FILES_UPLOAD_SPLIT - Math.round(perFileSec / SLOW_FILE_THRESHOLD_SEC));

    return { files: remainingFiles, count: curUploadCount };
  }, []);

  /**
   * Recursively uploads a chunk of files, retrying on failure and
   * advancing to the next chunk on success.
   *
   * @param {File[]} fileChunk   Remaining files starting from the current position
   * @param {string} uploadId    Server-assigned upload identifier
   * @param {number} numFiles    How many files from the front of fileChunk to send this call
   * @param {number} attempts    Remaining retry attempts for this chunk
   */
  const uploadChunk = React.useCallback((fileChunk, uploadId, numFiles = 1, attempts = 3) => {
    const maxAttempts = attempts;
    const startTs     = Date.now();

    const success = Server.uploadChunk(serverURL, uploadToken, fileChunk, uploadId, numFiles, tzInfo, tokenExpiredFunc,
      (respData) => {       // Success
        // Advance to the next chunk on success
        const next = getNextUploadChunk(fileChunk, numFiles, startTs);
        // If we have no more files to upload, we are done
        if (next.files.length > 0) {
          window.setTimeout(() => uploadChunk(next.files, uploadId, next.count), 10);
        }
      },
      (err) => {            // Failure
        // Try uploading this chunk a few times
        attempts--;
        if (attempts > 0) {
          // Back-off and retry the same chunk (possibly split down to 1 file)
          window.setTimeout(() => uploadChunk(fileChunk, uploadId, numFiles, attempts), 5000 * (maxAttempts - attempts),
          );
        } else {
          // Give up on this chunk; skip ahead so remaining files still upload. We will catch the skipped files later after
          // the counts of uploaded files has stabilized
          const next = getNextUploadChunk(fileChunk, numFiles, startTs);
          if (next.files.length > 0) {
            window.setTimeout(() => uploadChunk(next.files, uploadId), 10);
          }
        }
      },
    );

    if (!success) {
      console.error('uploadChunk: unknown error');
      addMessage(Level.Error, 'An unknown problem occurred while uploading images');
    }
  }, [addMessage, getNextUploadChunk, serverURL, tokenExpiredFunc, tzInfo, uploadToken]);

  /**
   * Queries the server for files that failed to upload, then re-queues
   * them via uploadChunk.  Calls onComplete when nothing remains,
   * onFail when the server cannot identify any re-uploadable files.
   * @function
   * @param {string} uploadId The ID of the upload that's in progress
   * @param {Array} uploadedFiles The files that were being uploaded
   * @param {function} onComplete The function to call if all files are successfully uploaded
   * @param {function} onFail The function to call on failure
   * @param {number} numRetries The number of retry attempts made
   * @returns {boolean} Returns true if the function was able to start the upload and false if there's a problem
   */
  const handleFailedUploads = React.useCallback(( uploadId, uploadedFiles, onComplete, onFail, numRetries = 0) => {

    const success = Server.handleFailedUploads(serverURL, uploadToken, uploadId, uploadedFiles,
      (respData) => {     // Success
        // Build up list of files to retry
        if (respData.length > 0) {
          const failedFiles = uploadedFiles.filter((item) => respData.findIndex(
                                        (name) => name.toLowerCase() === item.webkitRelativePath.toLowerCase() ) !== -1
                              );
          failedFiles.length > 0 ? window.setTimeout(() => uploadChunk(failedFiles, uploadId), 200) : onFail?.();
        } else {
          onComplete?.();
        }
      },
      (err) => {        // Failure
        if (cancelledRef.current) {   // Check if we're unloaded
          return;
        }

        if (numRetries >= 6) {
          const msg = `A problem occurred getting failed files for upload ID: ${uploadId}`;
          console.error('handleFailedUploads:', msg);
          addMessage(Level.Error, msg);
          uploadStateUpdate(uploadingState.error);
        } else {
          window.setTimeout(() => handleFailedUploads(uploadId, uploadedFiles, onComplete, onFail, numRetries + 1), 10_000 * (numRetries + 1));
        }
      },
    );

    if (!success) {
      const msg = `Unknown problem getting failed files for upload ID: ${uploadId}`;
      console.error('handleFailedUploads:', msg);
      addMessage(Level.Error, msg);
      uploadStateUpdate(uploadingState.error);
    }

    return success;
  }, [addMessage, serverURL, uploadChunk, uploadToken]);

  /**
   * Handles success when getting upload counts
   * @function
   * @param {object} respData The response data
   * @param {string} uploadId The ID of the upload that's in progress
   * @param {Array} uploadFiles The array of files that are being uploaded
   * @param {function} onSuccess Function to call upon success
   * @param {function} onFailed Function to call upon failure
   * @param {number} [numRetries] The number of retries we've attempted
   * @param {number} [prevUploadCount] The number of uploaded files used when uploads are failing.
   * @param {number} [startTs] The timestamp of when the prevUploadCount last changed
   */
  const getUploadCounts = React.useCallback((uploadId, uploadFiles, onSuccess, onFailed, numRetries = 0, prevUploadCount = null, startTs = null) => {
    // Stop calling if we're unloaded
    if (cancelledRef.current) {
      return;
    }
    pollingActiveRef.current = true;

    // Get the counts and handle the results
    const success = Server.getUploadCounts(serverURL, uploadToken, uploadId, uploadFiles, tokenExpiredFunc,
      (respData) => {     // Success
        setUploadingFileCounts(respData);

        if (respData.uploaded === respData.total) {
          pollingActiveRef.current = false;
          uploadStateUpdate(uploadingState.none);
          disableIdleCheck(false);
          onSuccess?.();
          return;
        }

        const countChanged = respData.uploaded !== prevUploadCount || !startTs;
        if (countChanged) {
          window.setTimeout(() => getUploadCounts(uploadId, uploadFiles, onSuccess, onFailed, 0, respData.uploaded, Date.now()), GET_COUNTS_CHECK_INTERVAL_MS);
          if (uploadStateRef.current !== uploadingState.retryingFailed && uploadStateRef.current !== uploadingState.error) {
            uploadStateUpdate(uploadingState.uploading);
          }
        } else {
          const elapsedSec = Math.trunc((Date.now() - startTs) / 1000);

          // Check for displaying a message
          if (elapsedSec >= 1 * 60) {
            // Only if we're not retrying
            if (uploadStateRef.current !== uploadingState.retryingFailed && uploadStateRef.current !== uploadingState.error) {
              uploadStateUpdate(uploadingState.haveFailed);
            }
          }

          // Check for if we're ready for retrying
          if (elapsedSec >= 3 * 60) {
            // Retry only if we're not already retrying
            if (uploadStateRef.current !== uploadingState.retryingFailed) {
              let retryCompleted = false;
              const retrySuccess = () => {
                      retryCompleted = true;
                      uploadStateUpdate(uploadingState.none);
                      disableIdleCheck(false);
                      pollingActiveRef.current = false;
                      onSuccess?.();
              };
              const retryFailed = () => {
                      retryCompleted = true;
                      console.log('ERROR: Unable to find failed files in list of files to upload');
                      addMessage(Level.Error, 'An error occurred fetching failed files from server');
                      uploadStateUpdate(uploadingState.uploadFailure);
                      disableIdleCheck(false);
                      pollingActiveRef.current = false;
                      onFailed?.();
              };
              uploadStateUpdate(uploadingState.retryingFailed);
              handleFailedUploads(uploadId, uploadFiles, retrySuccess, retryFailed);
              if (!retryCompleted) {
                window.setTimeout(() => getUploadCounts(uploadId, uploadFiles, onSuccess, onFailed), GET_COUNTS_CHECK_INTERVAL_MS);
              }
            } else if (uploadStateRef.current !== uploadingState.uploadFailure) {
              uploadStateUpdate(uploadingState.uploadFailure);
              disableIdleCheck(false);
              pollingActiveRef.current = false;
              onFailed?.();
            }
          } else {
            window.setTimeout(() => getUploadCounts(uploadId, uploadFiles, onSuccess, onFailed, 0, respData.uploaded, startTs), GET_COUNTS_CHECK_INTERVAL_MS);
          }
        }
      },
      (err) => {          // Failure
        if (numRetries >= 6) {
          const msg = `Problem checking upload counts. Upload ID: ${uploadId}`;
          console.error('getUploadCounts:', msg);
          addMessage(Level.Error, msg);
          uploadStateUpdate(uploadingState.error);
          disableIdleCheck(false);
          pollingActiveRef.current = false;
          onFailed?.();
        } else {
          window.setTimeout(() => getUploadCounts(uploadId, uploadFiles, onSuccess, onFailed, numRetries + 1), 7000 * (numRetries + 1));
          uploadStateUpdate(uploadingState.uploading);
        }
      },
    );

    if (!success) {
      const msg = `Unknown problem checking upload counts. Upload ID: ${uploadId}`;
      console.error('getUploadCounts:', msg);
      addMessage(Level.Error, msg);
      uploadStateUpdate(uploadingState.error);
      disableIdleCheck(false);
      pollingActiveRef.current = false;
    }
  }, [addMessage, disableIdleCheck, handleFailedUploads, serverURL, tokenExpiredFunc, uploadToken]);

  /**
   * Kicks off a parallel chunked upload for all files in the array,
   * then begins polling the server for completion counts.
   *
   * @param {File[]} uploadFiles  Full list of files to upload
   * @param {string} uploadId     Server-assigned upload identifier
   * @param {function} onSuccess Function to call upon success
   * @param {function} onFailed Function to call upon failure
   */
  const uploadFolder = React.useCallback((uploadFiles, uploadId, onSuccess, onFailed) => {

    const curSuccess = () => {
                              pollingActiveRef.current = false;
                              onSuccess?.();
                            };
    const curFailed = () => {
                              pollingActiveRef.current = false;
                              onFailed?.();
                            };


    if (!uploadFiles?.length) {
      console.log('All files were uploaded', uploadId);
      addMessage(Level.Information, 'All files have been uploaded');
      setWorkingUploadId(uploadId);
      if (pollingActiveRef.current === false) {
        getUploadCounts(uploadId, uploadFiles, curSuccess, curFailed);
      }
      return;
    }

    disableIdleCheck(true);
    uploadStateUpdate(uploadingState.uploading);
    setWorkingUploadId(uploadId);

    // Split into up to MAX_CHUNKS parallel streams
    const numStreams = Math.min(uploadFiles.length, MAX_CHUNKS);
    const chunkSize  = Math.ceil(uploadFiles.length / numStreams);

    for (let idx = 0; idx < uploadFiles.length; idx += chunkSize) {
      const chunk = uploadFiles.slice(idx, idx + chunkSize);
      window.setTimeout(() => uploadChunk(chunk, uploadId), 10);
    }

    window.setTimeout(() => getUploadCounts(uploadId, uploadFiles, curSuccess, curFailed), 1000);
  }, [addMessage, disableIdleCheck, getUploadCounts, uploadChunk]);

  /**
   * Independently used to restart a failed upload
   * @function
   * @param {string} uploadId The ID of the upload that's in progress
   * @param {Array} uploadedFiles The files that were being uploaded
   * @param {function} onSuccess The function to call if all files are successfully uploaded
   * @param {function} onFailed The function to call on failure
   */
  const restartFailedUploads = React.useCallback((uploadId, uploadFiles, onSuccess, onFailed) => {
    // Check for component unload
    if (cancelledRef.current) {
      return false;
    }

    let completed = false;

    const curSuccess = () => {
                              completed = true;
                              pollingActiveRef.current = false;
                              onSuccess?.();
                            };
    const curFailed = () => {
                              completed = true;
                              pollingActiveRef.current = false;
                              onFailed?.();
                            };

    if (handleFailedUploads(uploadId, uploadFiles, curSuccess, curFailed)) {
      if (!completed && pollingActiveRef.current === false) {
        getUploadCounts(uploadId, uploadFiles, curSuccess, curFailed);
      }
    }
  }, [handleFailedUploads, getUploadCounts]);

  /**
   * Forces a reset of the upload count information
   * @function
   * @param {number} [totalCount] The total expected image count to use
   */
  const setUploadingFileCount = React.useCallback((totalCount=0) => {
    setUploadingFileCounts({total:totalCount, uploaded:0});
  }, []);

  // ─── public API ───────────────────────────────────────────────────────────

  return {
    uploadState,
    uploadingFileCounts,
    uploadPercentComplete,
    workingUploadId,
    uploadFolder,
    restartFailedUploads,
    setUploadingFileCount,
    setUploadState,
  };
}
