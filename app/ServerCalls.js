/** @module ServerCalls */


/**
 * Logs onto the server
 * @function
 * @param {string} serverURL The URL to the server
 * @param {object} formData The form data to send to the server
 * @param {function} onSuccess The function to call upon success
 * @param {function} onFailure The function to call upon failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function login(serverURL, formData, onSuccess, onFailure) {
  onSuccess ||= () => {};
  onFailure ||= () => {};
    
  const loginUrl = serverURL + '/login';
  try {
    const resp = fetch(loginUrl, {
      credentials: 'include',
      method: 'POST',
      body: formData
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            throw new Error(`Failed to log in: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData);
      })
      .catch(function(err) {
        console.log('Login Error: ', err);
        onFailure(err);
    });
  } catch (err) {
    console.log('Login Unknown Error: ', err);
    return false;
  }

  return true;
}

/**
 * Checks the user's permissions for administrative functionality
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {string} pw The password to authorize administration funcitonality
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call upon success
 * @param {function} onFailure The function to call upon failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function settingsAdminCheck(serverURL, token, pw, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};
    

  // Check that the password is accurate and belongs to an administrator
  const settingsCheckUrl = serverURL + '/settingsAdmin?t=' + encodeURIComponent(token);

  const formData = new FormData();

  formData.append('value', pw);

  try {
    const resp = fetch(settingsCheckUrl, {
      credentials: 'include',
      method: 'POST',
      body: formData
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401) {
              // User needs to log in again
              onExpiredToken(true);
            }
            throw new Error(`Failed to check admin permissions: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData);
      })
      .catch(function(err) {
        console.log('Admin Settings Error: ', err);
        onFailure(err);
    });
  } catch (err) {
    console.log('Admin Settings Unknown Error: ', err);
    return false;
  }

  return true;
}

/**
 * Checks the user's permissions for collection ownership functionality
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {string} pw The password to authorize administration funcitonality
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call upon success
 * @param {function} onFailure The function to call upon failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function settingsOwnerCheck(serverURL, token, pw, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  // Check that the password is accurate and belongs to an administrator
  const settingsCheckUrl = serverURL + '/settingsOwner?t=' + encodeURIComponent(token);

  const formData = new FormData();

  formData.append('value', pw);

  try {
    const resp = fetch(settingsCheckUrl, {
      credentials: 'include',
      method: 'POST',
      body: formData
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401) {
              // User needs to log in again
              onExpiredToken(true);
            }
            throw new Error(`Failed to check owner permissions: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData);
      })
      .catch(function(err) {
        console.log('Owner Settings Error: ', err);
        onFailure(err);
    });
  } catch (err) {
    console.log('Owner Settings Unknown Error: ', err);
    return false;
  }


  return true;
}

/**
 * Fetches collections from the server
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call upon success
 * @param {function} onFailure The function to call upon failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function collections(serverURL, token, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};
    
  const collectionUrl =  serverURL + '/collections?t=' + encodeURIComponent(token)
  try {
    const resp = fetch(collectionUrl, {
      credentials: 'include',
      method: 'GET'
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401) {
              // User needs to log in again
              onExpiredToken(true);
            }
            throw new Error(`Failed to get collections: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData);
      })
      .catch((err) => {
        console.log('Collections Error: ', err);
        onFailure(err);
    });
  } catch (err) {
    console.log('Collections Unknown Error: ', err);
    return false;
  }

  return true;
}

/**
 * Fetches sandbox information from the server
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call upon success
 * @param {function} onFailure The function to call upon failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function sandbox(serverURL, token, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};
    
  const sandboxUrl =  serverURL + '/sandbox?t=' + encodeURIComponent(token)
  try {
    const resp = fetch(sandboxUrl, {
      credentials: 'include',
      method: 'GET'
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401) {
              // User needs to log in again
              onExpiredToken(true);
            }
            throw new Error(`Failed to get sandbox: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData);
      })
      .catch((err) => {
        console.log('Sandbox Error: ', err);
        onFailure(err);
    });
  } catch (err) {
    console.log('Sandbox Unknown Error: ', err);
    return false;
  }

  return true;
}

/**
 * Fetches location information from the server
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call upon success
 * @param {function} onFailure The function to call upon failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function locations(serverURL, token, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const locationsUrl =  serverURL + '/locations?t=' + encodeURIComponent(token)
  try {
    const resp = fetch(locationsUrl, {
      credentials: 'include',
      method: 'GET'
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401) {
              // User needs to log in again
              onExpiredToken(true);
            }
            throw new Error(`Failed to get locations: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData);
      })
      .catch((err) => {
        console.log('Locations Error: ', err);
        onFailure(err);
    });
  } catch (err) {
    console.log('Locations Error: ', err);
    return false;
  }

  return true;
}

/**
 * Fetches species information from the server
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call upon success
 * @param {function} onFailure The function to call upon failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function species(serverURL, token, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const speciesUrl =  serverURL + '/species?t=' + encodeURIComponent(token)
  try {
    const resp = fetch(speciesUrl, {
      credentials: 'include',
      method: 'GET'
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401) {
              // User needs to log in again
              onExpiredToken(true);
            }
            throw new Error(`Failed to get species: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData);
      })
      .catch((err) => {
        console.log('Species Error: ', err);
        onFailure(err);
    });
  } catch (err) {
    console.log('Unknown Species Error: ', err);
    return false;
  }

  return true;
}

/**
 * Fetches non-standard species information from the server
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call upon success
 * @param {function} onFailure The function to call upon failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function speciesOther(serverURL, token, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const othersUrl =  serverURL + '/speciesOther?t=' + encodeURIComponent(token)
  try {
    const resp = fetch(othersUrl, {
      credentials: 'include',
      method: 'GET'
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401) {
              // User needs to log in again
              onExpiredToken(true);
            }
            throw new Error(`Failed to get additional species: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData);
      })
      .catch((err) => {
        console.log('Other Species Error: ', err);
        onFailure(err);
    });
  } catch (err) {
    console.log('Unknown Other Species Error: ', err);
    return false;
  }

  return true;
}

/**
 * Gets the user's messages from the server
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call upon success
 * @param {function} onFailure The function to call upon failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function messages(serverURL, token, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const messagesUrl =  serverURL + '/messageGet?t=' + encodeURIComponent(token)
  try {
    const resp = fetch(messagesUrl, {
      credentials: 'include',
      method: 'GET'
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401 || resp.status === 404) {
              // User needs to log in again
              onExpiredToken(true);
            }
            throw new Error(`Failed to get messages: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData);
      })
      .catch((err) => {
        console.log('Fetch Message Error: ',err);
        onFailure(err);
    });
  } catch (err) {
    console.log('Message Fetch Unknown Error: ', err);
    return false;
  }

  return true;
}

/**
 * Adds a message
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {string} recipients The comma separated list of recipients
 * @param {string} subject The subject of the message
 * @param {string} message The message itself
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call upon success
 * @param {function} onFailure The function to call upon failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function messageAdd(serverURL, token, recipients, subject, message, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const newMessagesUrl = serverURL + '/messageAdd?t=' + encodeURIComponent(token);

  const formData = new FormData();

  formData.append('receiver', recipients.split(',').map((item) => item.trim()) );
  formData.append('subject', subject);
  formData.append('message', message);

  try {
    const resp = fetch(newMessagesUrl, {
      credentials: 'include',
      method: 'POST',
      body: formData
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401) {
              // User needs to log in again
              onExpiredToken(true);
            }
            throw new Error(`Failed to add new message: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData);
      })
      .catch(function(err) {
        console.log('Add Message Error: ',err);
        onFailure(err);
    });
  } catch (err) {
    console.log('Add Message Unknown Error: ',err);
    return false;
  }

  return true;
}

/**
 * Marks messages as read
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {Array} msgIds The array of message IDs to mark as read
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call upon success
 * @param {function} onFailure The function to call upon failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function messageRead(serverURL, token, msgIds, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const readMessagesUrl = serverURL + '/messageRead?t=' + encodeURIComponent(token);

  const formData = new FormData();

  formData.append('ids', JSON.stringify(msgIds));

  try {
    const resp = fetch(readMessagesUrl, {
      credentials: 'include',
      method: 'POST',
      body: formData
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401) {
              // User needs to log in again
              onExpiredToken(true);
            }
            throw new Error(`Failed to mark messages as read: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData);
      })
      .catch(function(err) {
        console.log('Read Messages Error: ',err);
        onFailure(err);
    });
  } catch (err ) {
    console.log('Read Messages Unknown Error: ',err);
    return false;
  }

  return true;
}


/**
 * Marks messages as deleted
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {Array} msgIds The array of message IDs to mark as deleted
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call upon success
 * @param {function} onFailure The function to call upon failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function messageDelete(serverURL, token, msgIds, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const delMessagesUrl = serverURL + '/messageDelete?t=' + encodeURIComponent(token);

  const formData = new FormData();

  formData.append('ids', JSON.stringify(msgIds));

  try {
    const resp = fetch(delMessagesUrl, {
      credentials: 'include',
      method: 'POST',
      body: formData
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401) {
              // User needs to log in again
              onExpiredToken(true);
            }
            throw new Error(`Failed to delete messages: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData);
      })
      .catch(function(err) {
        console.log('Delete Messages Error: ', err);
        onFailure(err);
    });
  } catch (err) {
    console.log('Delete Messages Unknown Error: ', err);
    return false;
  }

  return true;
}

/**
 * Gets the images for an upload
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {string} collectionId The ID of the collection the upload is in
 * @param {string} uploadId The ID of the upload to fetch the images for
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call upon success
 * @param {function} onFailure The function to call upon failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function uploadImages(serverURL, token, collectionId, uploadId, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const uploadUrl = serverURL + '/uploadImages?t=' + encodeURIComponent(token);
  const formData = new FormData();

  formData.append('id', collectionId);
  formData.append('up', uploadId);

  // Get the information on the upload
  try {
    const resp = fetch(uploadUrl, {
      credentials: 'include',
      method: 'POST',
      body: formData
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401) {
              // User needs to log in again
              onExpiredToken(true);
            }
            throw new Error(`Failed to log in: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData);
      })
      .catch(function(err) {
        console.log('Species Other Error: ', err);
        onFailure(err);
    });
  } catch (err) {
    console.log('Species Other Unknown Error: ', err);
    return false;
  }

  return true;
}

/**
 * Sets the settings for the user
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {object} newSettings The new settings for the user
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call upon success
 * @param {function} onFailure The function to call upon failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function userSettings(serverURL, token, newSettings, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const setSettingsUrl = serverURL + '/settings?t=' + encodeURIComponent(token);

  const formData = new FormData();

  formData.append('autonext', newSettings.autonext);
  formData.append('dateFormat', newSettings.dateFormat);
  formData.append('measurementFormat', newSettings.measurementFormat);
  formData.append('sandersonDirectory', newSettings.sandersonDirectory);
  formData.append('sandersonOutput', newSettings.sandersonOutput);
  formData.append('timeFormat', newSettings.timeFormat);
  formData.append('coordinatesDisplay', newSettings.coordinatesDisplay);
  formData.append('email', newSettings.email);

  try {
    const resp = fetch(setSettingsUrl, {
      credentials: 'include',
      method: 'POST',
      body: formData
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401) {
              // User needs to log in again
              onExpiredToken(true);
            }
            throw new Error(`Failed to set settings: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData);
      })
      .catch(function(err) {
        console.log('Settings Error: ',err);
        onFailure(err)
    });
  } catch (err) {
    console.log('Settings Unknown Error: ', err);
    return false;
  }

  return true;
}

/**
 * Handles sending the query to the server
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {object} formData The data to POST to the server
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call upon success
 * @param {function} onFailure The function to call upon failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function query(serverURL, token, formData, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  // TODO: Make "i" parameter the actual interval
  const queryUrl = serverURL + '/query?t=' + encodeURIComponent(token) + "&i=" + "60";

  // Make the query
  try {
    fetch(queryUrl, {
      credentials: 'include',
      method: 'POST',
      body: formData
    })
    .then(async (resp) => {
        if (resp.ok) {
          return resp.json();
        } else {
          if (resp.status === 401) {
            // User needs to log in again
            onExpiredToken();
          }
          throw new Error(`Failed to complete query: ${resp.status}: ${await resp.text()}`);
        }
    })
    .then((respData) => {
      onSuccess(respData);
    })
    .catch(function(err) {
      console.log('Query Error: ',err);
      onFailure(err);
    });
  } catch (err) {
    console.log('Query Unknown Error:', err);
    return false;
  }

  return true;
}

/**
 * Handles sending an image's single species change to the server
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {string} timestamp The ISO timestamp of this change
 * @param {string} collectionId The collection ID of the image
 * @param {string} uploadId The upload ID of the image
 * @param {string} path The path to the image
 * @param {string} commonName The common name of the species
 * @param {string} scientificName The scientific name of the species
 * @param {string} count The new count of the species
 * @param {string} requestId The request ID associated with the image editing session
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call upon success
 * @param {function} onFailure The function to call upon failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function imageSpecies(serverURL, token, timestamp, collectionId, uploadId, path, commonName, scientificName,
                              count, requestId, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const speciesUrl = serverURL + '/imageSpecies?t=' + encodeURIComponent(token);
  const formData = new FormData();

  formData.append('timestamp', timestamp);
  formData.append('collection', collectionId);
  formData.append('upload', uploadId);
  formData.append('path', path);
  formData.append('common', commonName);
  formData.append('species', scientificName);
  formData.append('count', count);
  formData.append('reqid', requestId);

  try {
    fetch(speciesUrl, {
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
            throw new Error(`Failed to update image species: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
          // Mark that something has changed
        onSuccess(respData);
      })
      .catch(function(err) {
        console.log('Update Species Count Error: ',err);
        onFailure(err);
    });
  } catch (err) {
    console.log('Update Species Count Unknown Error: ',err);
    return false;
  }

  return true;
}

/**
 * Checks for upload changes stored on the server
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {string} collectionId The ID of the collection to check
 * @param {string} uploadName The name of the upload within the collection
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call upon success
 * @param {function} onFailure The function to call upon failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function checkChanges(serverURL, token, collectionId, uploadName, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const checkChangesUrl = serverURL + '/checkChanges?t=' + encodeURIComponent(token);
  const formData = new FormData();

  formData.append('id', collectionId);
  formData.append('up', uploadName);

  try {
    fetch(checkChangesUrl, {
      credentials: 'include',
      method: 'POST',
      body: formData
    })
    .then(async (resp) => {
        if (resp.ok) {
          return resp.json();
        } else {
          if (resp.status === 401) {
            // User needs to log in again
            onExpiredToken();
          }
          throw new Error(`Failed to check for update server changes: ${resp.status}: ${await resp.text()}`);
        }
    })
    .then((respData) => {
      onSuccess(respData);
    })
    .catch(function(err) {
      console.log('Check Changes Error: ', err);
      onFailure(err);
    });
  } catch (err) {
    console.log('Check Changes Unknown Error: ', err);
    return false;
  }

  return true;
}


/**
 * Updates the location for an upload
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {string} timestamp The timestamp associated with this change
 * @param {string} collectionId The collection ID of the upload
 * @param {string} uploadId The ID of the upload to change
 * @param {string} locId The ID of the location
 * @param {string} locName The name of the location
 * @param {string} locElevation The elevation of the location
 * @param {string} locLat The latitude of the location
 * @param {string} locLon The longitude of the location
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call upon success
 * @param {function} onFailure The function to call upon failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function uploadLocation(serverURL, token, timestamp, collectionId, uploadId, locId, locName, locElevation, locLat, locLon, 
                                onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const updateLocationUrl = serverURL + '/uploadLocation?t=' + encodeURIComponent(token);
  const formData = new FormData();

  formData.append('timestamp', timestamp);
  formData.append('collection', collectionId);
  formData.append('upload', uploadId);
  formData.append('locId', locId);
  formData.append('locName', locName);
  formData.append('locElevation', locElevation);
  formData.append('locLat', locLat);
  formData.append('locLon', locLon);

  try {
    fetch(updateLocationUrl, {
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
            throw new Error(`Failed to upload location: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData);
      })
      .catch(function(err) {
        console.log('Update Location Error: ',err);
        onFailure(err);
    });
  } catch (err) {
    console.log('Update Location Unknown Error: ',err);
    return false;
  }

  return true;
}


/**
 * Saves a new keybinding for a species
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {string} commonName The common name of the keybound species
 * @param {string} scientificName The scientific name of the keybound species
 * @param {string} keybind The keybinding character
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call upon success
 * @param {function} onFailure The function to call upon failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function speciesKeybind(serverURL, token, commonName, scientificName, keybind, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const keybindUrl = serverURL + '/speciesKeybind?t=' + encodeURIComponent(token);
  const formData = new FormData();

  formData.append('common', commonName);
  formData.append('scientific', scientificName);
  formData.append('key', keybind);

  try {
    fetch(keybindUrl, {
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
            throw new Error(`Failed to update species keybind: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
          onSuccess(respData);
      })
      .catch(function(err) {
        console.log('Update Keybinding Error: ',err);
        onFailure(err);
    });
  } catch (err) {
    console.log('Update Keybinding Unknown Error: ',err);
    return false;
  }

  return true;
}

/**
 * Lets the server know that all image editing changes have been completed
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {string} collectionId The collection ID containing the upload
 * @param {string} uploadName The name of the upload
 * @param {string} lastRequestId The last request ID
 * @param {string} timestamp The timestamp associated with this change
 * @param {boolean} force Tell the server to force changes
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call upon success
 * @param {function} onFailure The function to call upon failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function imagesAllEdited(serverURL, token, collectionId, uploadName, lastRequestId, timestamp, force, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const allEditedUrl = serverURL + '/imagesAllEdited?t=' + encodeURIComponent(token);
  const formData = new FormData();

  formData.append('collection', collectionId);
  formData.append('upload', uploadName);
  if (lastRequestId !== null) {
    formData.append('requestId', lastRequestId);
  }
  formData.append('timestamp', timestamp);
  if (force === true) {
    formData.append('force', true);
  }

  try {
    fetch(allEditedUrl, {
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
            throw new Error(`Failed to finish all image editing changes: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData);
      })
      .catch(function(err) {
        console.log('Finish Images Edit Error: ',err);
        onFailure(err);
    });
  } catch (err) {
    console.log('Finish Images Edit Commit Unknown Error: ',err);
    return false;
  }

  return true;
}

/**
 * Lets the server know that one image has completed editing
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {string} collectionId The collection ID of the image
 * @param {string} uploadName The name of the upload the image is in
 * @param {string} imagePath The path to the image
 * @param {string} lastRequestId The editing request ID
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call upon success
 * @param {function} onFailure The function to call upon failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function imageEditComplete(serverURL, token, collectionId, uploadName, imagePath, lastRequestId, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const completedUrl = serverURL + '/imageEditComplete?t=' + encodeURIComponent(token);
  const formData = new FormData();

  formData.append('collection', collectionId);
  formData.append('upload', uploadName);
  formData.append('path', imagePath);
  formData.append('lastReqid', lastRequestId);

  try {
    fetch(completedUrl, {
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
            throw new Error(`Failed to update image with editing changes: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData);
      })
      .catch(function(err) {
        console.log('Update Image Edit Complete Error: ',err);
        onFailure(err);
    });
  } catch (err) {
    console.log('Update Image Edit Complete Unknown Error: ',err);
    return false;
  }

  return true;
}

/**
 * Requests location information from the server
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {string} locId The ID of the location
 * @param {string} locName The name of the location
 * @param {string} locLat The latitude of the location
 * @param {string} locLon The longitude of the location
 * @param {string} locElevation The elevation of the location
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call upon success
 * @param {function} onFailure The function to call upon failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function locationInfo(serverURL, token, locId, locName, locLat, locLon, locElevation, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const locationInfoUrl = serverURL + '/locationInfo?t=' + encodeURIComponent(token);

  const formData = new FormData();

  formData.append('id', locId);
  formData.append('name', locName);
  formData.append('lat', locLat);
  formData.append('lon', locLon);
  formData.append('ele', locElevation);
  try {
    fetch(locationInfoUrl, {
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
            throw new Error(`Failed to get location information: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData);
      })
      .catch(function(err) {
        console.log('Location tooltip Error: ',err);
        onFailure(err);
    });
  } catch (err) {
    console.log('Location tooltip Unknown Error: ',err);
    return false;
  }

  return true;
}
