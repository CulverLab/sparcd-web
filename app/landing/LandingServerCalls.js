'use client'

/** @module landing/LandingServerCalls */

const LIMIT_FORM_FILE_CHUNK = 5000;  // Maximum number of files to put into a form at one time

/**
 * Returns whether or not this is a new upload or a continuation of a previous one
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {string} path The path of the upload
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call upon success
 * @param {function} onFailure The function to call upon failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function checkPreviousUpload(serverURL, token, path, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const sandboxPrevUrl = serverURL + '/sandboxPrev?t=' + encodeURIComponent(token);
  const formData = new FormData();

  formData.append('path', path);

  try {
    fetch(sandboxPrevUrl, {
      credentials: 'include',
      method: 'POST',
      body: formData
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401) {
              // User needs to log in again
              onExpiredToken();
            }
            throw new Error(`Failed to check previousupload: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData);
      })
      .catch(function(err) {
        console.log('Previous Upload Error: ',err);
        onFailure(err);

    });
  } catch (err) {
    console.log('Prev Upload Unknown Error: ',err);
    return false;
  }

  return true;
}


/**
 * Updates a recovery attempt with the new information
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {string} collId The recovery collection ID
 * @param {string} locId The location ID of the upload
 * @param {string} uploadKey The recovery upload key
 * @param {string} path The path of the upload
 * @param {Array} files The list of files to upload
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call upon success
 * @param {function} onFailure The function to call upon failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function updateUploadRecovery(serverURL, token, collId, locId, uploadKey, path, files, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const sandboxRecoveryUrl = serverURL + '/sandboxRecoveryUpdate?t=' + encodeURIComponent(token);
  const formData = new FormData();

  formData.append('id', collId);
  formData.append('key', uploadKey);
  formData.append('loc', locId);
  formData.append('path', path);

  try {
    fetch(sandboxRecoveryUrl, {
      credentials: 'include',
      method: 'POST',
      body: formData
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401) {
              // User needs to log in again
              onExpiredToken();
            }
            throw new Error(`Failed to recover upload: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        const missingFiles = files.filter((item) => respData.files.filter((name) => item.webkitRelativePath.includes(name))[0]);
        onSuccess(respData, missingFiles);
      })
      .catch(function(err) {
        console.log('Previous Upload Error: ',err);
        onFailure(err)
    });
  } catch (err) {
    console.log('Prev Upload Unknown Error: ',err);
    return false;
  }

  return true;
}


/**
 * Creates a new sandbox ready for uploaded files
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {string} collectionId The ID of the collection
 * @param {string} locationId The ID of the location
 * @param {string} path The path the upload is loaded from
 * @param {string} comment The upload comment
 * @param {Array} files The files being uploaded
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call upon success
 * @param {function} onFailure The function to call upon failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function continueNewUpload(serverURL, token, collectionId, locationId, path, comment, files, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  // Add the upload to the server letting the UI to update
  const sandboxNewUrl = serverURL + '/sandboxNew?t=' + encodeURIComponent(token);
  const formData = new FormData();

  formData.append('collection', collectionId);
  formData.append('location', locationId);
  formData.append('path', path);
  formData.append('comment', comment);
  formData.append('ts', new Date().toISOString());
  formData.append('tz', Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Break the upload into pieces if it's too large
  if (files.length < LIMIT_FORM_FILE_CHUNK) {
    formData.append('files', JSON.stringify(files.map((item) => item.webkitRelativePath)));
  } else {
    formData.append('files', JSON.stringify(files.slice(0,LIMIT_FORM_FILE_CHUNK).map((item) => item.webkitRelativePath)));
    let index = 1;
    let start = LIMIT_FORM_FILE_CHUNK;
    while (start < files.length) {
      let end = Math.min(start + LIMIT_FORM_FILE_CHUNK, files.length);
      formData.append('files'+index, JSON.stringify(files.slice(start,end).map((item) => item.webkitRelativePath)));
      start += LIMIT_FORM_FILE_CHUNK;
      index += 1;
    };
  }

  try {
    fetch(sandboxNewUrl, {
      credentials: 'include',
      method: 'POST',
      body: formData
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401) {
              // User needs to log in again
              onExpiredToken();
            }
            throw new Error(`Failed to add new sandbox upload: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
          onSuccess(respData);
      })
      .catch(function(err) {
        console.log('New Sandbox Error: ',err);
        onFailure(err);
    });
  } catch (err) {
    console.log('New Upload Unknown Error: ',err);
    return false;
  }

  return true;
}

/**
 * Handles restarting an upload from the beginning
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {string} uploadId The identifier of the upload
 * @param {Array} files Array of files to upload
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call upon success
 * @param {function} onFailure The function to call upon failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function prevUploadResetContinue(serverURL, token, uploadId, files, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  // Reset the upload on the server and then restart the upload
  const sandboxResetUrl = serverURL + '/sandboxReset?t=' + encodeURIComponent(token);
  const formData = new FormData();

  formData.append('id', uploadId);
  formData.append('files', JSON.stringify(files.map((item) => item.webkitRelativePath)));

  try {
    fetch(sandboxResetUrl, {
      credentials: 'include',
      method: 'POST',
      body: formData
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401) {
              // User needs to log in again
              onExpiredToken();
            }
            throw new Error(`Failed to reset sandbox upload: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData);
      })
      .catch(function(err) {
        console.log('Reset Sandbox Error: ',err);
        onFailure(err);
    });
  } catch (err) {
    console.log('Reset Upload Unknown Error: ',err);
    return false;
  }

  return true;
}

/**
 * Handles abandoning an upload
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {string} uploadId The ID of the upload to continue
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call upon success
 * @param {function} onFailure The function to call upon failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function prevUploadAbandonContinue(serverURL, token, uploadId, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  // Abandon the upload on the server
  const sandboxAbandonUrl = serverURL + '/sandboxAbandon?t=' + encodeURIComponent(token);
  const formData = new FormData();

  formData.append('id', uploadId);

  try {
    fetch(sandboxAbandonUrl, {
      credentials: 'include',
      method: 'POST',
      body: formData
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401) {
              // User needs to log in again
              onExpiredToken();
            }
            throw new Error(`Failed to abandoning sandbox upload: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData);
      })
      .catch(function(err) {
        console.log('Abandon Sandbox Error: ',err);
        onFailure(err);
    });
  } catch (err) {
    console.log('Abandon Upload Unknown Error: ',err);
    return false;
  }

  return true;
}

/**
 * Handles checking that an failed upload that's continuing appears to have the same files now as before
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {string} uploadId The ID associated with the upload
 * @param {Array} files The list of files to check the upload validity of
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call if the files check is successful
 * @param {function} onFailure The function to call on failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function checkUploadedFiles(serverURL, token, uploadId, files, onExpiredToken, onSuccess, onFailure)  {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  // If we have nothing to check, we are successful
  if (files.length <= 0) {
    onSuccess(null);
    return true;
  }

  const sandboxCheckUrl = serverURL + '/sandboxCheckContinueUpload?t=' + encodeURIComponent(token);
  const formData = new FormData();

  formData.append('id', uploadId);
  formData.append(files[0].name, files[0]);

  try {
    fetch(sandboxCheckUrl, {
      credentials: 'include',
      method: 'POST',
      body: formData
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401) {
              // User needs to log in again
              onExpiredToken();
            }
            throw new Error(`Failed to check upload: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData);
      })
      .catch(function(err) {
        console.log('Check Prev Upload Images Error: ',err);
        onFailure(err);
    });
  } catch (err) {
    console.log('Check Prev Upload Images Unknown Error: ',err);
    return false;
  }

  return true;
}

/**
 * Handles failed uploaded files
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {string} uploadId The ID of the upload that's in progress
 * @param {Array} uploadedFiles The files that were being uploaded
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call if the files check is successful
 * @param {function} onFailure The function to call on failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function handleFailedUploads (serverURL, token, uploadId, uploadedFiles, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const failedUploadsUrl = serverURL + '/sandboxUnloadedFiles?t=' + encodeURIComponent(token) +
                                                            '&i=' + encodeURIComponent(uploadId);

  try {
    fetch(failedUploadsUrl, {
      credentials: 'include',
      method: 'GET'
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401) {
              // User needs to log in again
              onExpiredToken();
            }
            throw new Error(`Failed to get failed files for upload: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData)
      })
      .catch(function(err) {
        console.log('Getting Failed Files For Upload Error: ', err);
        onFailure(err);
    });
  } catch (err) {
    console.log('Getting Failed Files For Upload  Unknown Error: ',err);
    return false;
  }

  return true;
}

/**
 * Function that gets the counts of an upload
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {string} uploadId The ID of the upload that's in progress
 * @param {Array} uploadFiles The array of files that are being uploaded
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call if the files check is successful
 * @param {function} onFailure The function to call on failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function getUploadCounts(serverURL, token, uploadId, uploadFiles, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const sandboxCountsUrl = serverURL + '/sandboxCounts?t=' + encodeURIComponent(token) + 
                                                            '&i=' + encodeURIComponent(uploadId);

  try {
    fetch(sandboxCountsUrl, {
      credentials: 'include',
      method: 'GET'
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401) {
              // User needs to log in again
              onExpiredToken();
            }
            throw new Error(`Failed to get uploaded files count: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData);
      })
      .catch(function(err) {
        console.log('Upload Images Counts Error: ', err);
        onFailure(err);
    });
  } catch (err) {
    console.log('Upload Images Counts Unknown Error: ',err);
    return false;
  }

  return true;
}


/**
 * Sends the completion status to the server
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {string} uploadId The ID of the upload that's in progress
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call if the files check is successful
 * @param {function} onFailure The function to call on failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function uploadCompleted(serverURL, token, uploadId, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const sandboxCompleteUrl = serverURL + '/sandboxCompleted?t=' + encodeURIComponent(token);
  const formData = new FormData();

  formData.append('id', uploadId);

  try {
    fetch(sandboxCompleteUrl, {
      credentials: 'include',
      method: 'POST',
      body: formData
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401) {
              // User needs to log in again
              onExpiredToken();
            }
            throw new Error(`Failed to mark upload as completed: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
          // Process the results
          onSuccess(respData);
      })
      .catch(function(err) {
        console.log('Upload Images Completed Error: ', err);
        onFailure(err);
    });
  } catch (err) {
    console.log('Upload Images Completed Unknown Error: ',err);
    return false;
  }

  return true;
}


/**
 * Uploads chunks of files from the list
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {Array} fileChunk The array of files to upload
 * @param {string} uploadId The ID of the upload
 * @param {number} numFiles The number of images to send
 * @param {object} tzInfo The timezone information
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call if the files check is successful
 * @param {function} onFailure The function to call on failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function uploadChunk(serverURL, token, fileChunk, uploadId, numFiles, tzInfo, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const sandboxFileUrl = serverURL + '/sandboxFile?t=' + encodeURIComponent(token);
  const formData = new FormData();

  formData.append('id', uploadId);
  formData.append('tz_off', tzInfo);

  for (let idx = 0; idx < numFiles && idx < fileChunk.length; idx++) {
    formData.append(fileChunk[idx].name, fileChunk[idx]);
  }

  try {
    fetch(sandboxFileUrl, {
      credentials: 'include',
      method: 'POST',
      body: formData
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401) {
              // User needs to log in again
              onExpiredToken();
            }
            throw new Error(`Failed to upload files: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData);
      })
      .catch(function(err) {
        console.log('Upload File Error: ',err);
        onFailure(err);
    });
  } catch (err) {
    console.log('Upload Images Unknown Error: ',err);
    return false;
  }

  return true;
}
