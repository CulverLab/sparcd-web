'use client'

/** @module settings/SettingsServerCalls */

/**
 * Check if we have admin changes stored on the server
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call if the files check is successful
 * @param {function} onFailure The function to call on failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function adminCheckChanges(serverURL, token, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const adminCheckUrl = serverURL + '/adminCheckChanges?t=' + encodeURIComponent(token);

  try {
    fetch(adminCheckUrl, {
      credentials: 'include',
      method: 'GET',
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401) {
              // User needs to log in again
              onExpiredToken();
            }
            throw new Error(`Failed to update changed settings information: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
          // Handle the result
          if (respData.success) {
            onSuccess(respData);
          } else {
            onFailure(respData.message);
          }
      })
      .catch(function(err) {
        console.log('Admin Location/Species Check Error: ',err);
        onFailure(err);
    });
  } catch (err) {
    console.log('Admin Location/Species Check Unknown Error: ',err);
    return false;
  }

  return true;
}

/**
 * Gets the user information from the server
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call if the files check is successful
 * @param {function} onFailure The function to call on failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function getUserInfo(serverURL, token, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const adminUsersUrl = serverURL + '/adminUsers?t=' + encodeURIComponent(token);

  try {
    fetch(adminUsersUrl, {
      credentials: 'include',
      method: 'GET',
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401) {
              // User needs to log in again
              onExpiredToken();
            }
            throw new Error(`Failed to get admin users: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData);
      })
      .catch(function(err) {
        console.log('Admin Users Error: ',err);
        onFailure('An error occurred when attempting to load user information');
    });
  } catch (err) {
    console.log('Admin Users Unknown Error: ',err);
    return false;
  }

  return true;
}

/**
 * Gets the master species information from the server (not the per-user species)
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call if the files check is successful
 * @param {function} onFailure The function to call on failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function getMasterSpecies(serverURL, token, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const adminSpeciesUrl = serverURL + '/adminSpecies?t=' + encodeURIComponent(token);

  try {
    fetch(adminSpeciesUrl, {
      credentials: 'include',
      method: 'GET',
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401) {
              // User needs to log in again
              onExpiredToken();
            }
            throw new Error(`Failed to get admin species: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData);
      })
      .catch(function(err) {
        console.log('Admin Species Error: ',err);
        onFailure('An error occurred when attempting to load species information');
    });
  } catch (err) {
    console.log('Admin Species Unknown Error: ',err);
    return false;
  }

  return true;
}

/**
 * Updates the collection information on the server
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {string} editingId The ID associated with the editing
 * @param {object} collectionInfo The updated collection information to save
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call if the files check is successful
 * @param {function} onFailure The function to call on failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function updateCollection(serverURL, token, editingId, collectionInfo, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const userUpdateCollUrl = serverURL + '/adminCollectionUpdate?t=' + encodeURIComponent(token);

  const formData = new FormData();

  formData.append('id', editingId);
  formData.append('name', collectionInfo.name);
  formData.append('description', collectionInfo.description);
  formData.append('email', collectionInfo.email);
  formData.append('organization', collectionInfo.organization);
  formData.append('allPermissions', JSON.stringify(collectionInfo.allPermissions));

  try {
    fetch(userUpdateCollUrl, {
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
            throw new Error(`Failed to update collection information: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
          // Set the species data
          if (respData.success) {
            onSuccess(respData);
          } else {
            onFailure(respData.message);
          }
      })
      .catch(function(err) {
        console.log('Admin Update Collection Error: ',err);
        onFailure('An error occurred when attempting to update collection information');
    });
  } catch (err) {
    console.log('Admin Update Collection Unknown Error: ',err);
    return false;
  }

  return true;
}

/**
 * Creates a new collection on the server
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {object} collectionInfo The new collection information to save
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call if the files check is successful
 * @param {function} onFailure The function to call on failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function newCollection(serverURL, token, collectionInfo, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const userUpdateCollUrl = serverURL + '/adminCollectionAdd?t=' + encodeURIComponent(token);

  const formData = new FormData();

  formData.append('name', collectionInfo.name);
  formData.append('description', collectionInfo.description);
  formData.append('email', collectionInfo.email);
  formData.append('organization', collectionInfo.organization);
  formData.append('allPermissions', JSON.stringify(collectionInfo.allPermissions));

  try {
    fetch(userUpdateCollUrl, {
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
            throw new Error(`Failed to update collection information: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
          // Set the collection data
          if (respData.success) {
            onSuccess(respData);
          } else {
            onFailure(respData.message);
          }
      })
      .catch(function(err) {
        console.log('Admin Update Collection Error: ',err);
        onFailure('An error occurred when attempting to update collection information');
    });
  } catch (err) {
    console.log('Admin Update Collection Unknown Error: ',err);
    return false;
  }

  return true;
}

/**
 * Updates the user information
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {string} oldName The previous user's name
 * @param {object} userInfo The updated user information to save
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call if the files check is successful
 * @param {function} onFailure The function to call on failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function updateUser(serverURL, token, oldName, userInfo, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const userUpdateUrl = serverURL + '/adminUserUpdate?t=' + encodeURIComponent(token);

  const formData = new FormData();

  formData.append('oldName', oldName);
  formData.append('newEmail', userInfo.email);
  formData.append('admin', userInfo.admin);

  try {
    fetch(userUpdateUrl, {
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
            throw new Error(`Failed to update user information: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
          // Set the species data
          if (respData.success) {
            onSuccess(respData);
          } else {
            onFailure(respData.message);
          }
      })
      .catch(function(err) {
        console.log('Admin Update User Error: ',err);
        onFailure('An error occurred when attempting to update user information');
    });
  } catch (err) {
    console.log('Admin Update User Unknown Error: ',err);
    return false;
  }

  return true;
}

/**
 * Handles updating the species information
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {string} [oldScientificName] The old scientific name if it exists
 * @param {object} newInfo The updated species information to save
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call if the files check is successful
 * @param {function} onFailure The function to call on failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function updateSpecies(serverURL, token, oldScientificName, newInfo, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const speciesUpdateUrl = serverURL + '/adminSpeciesUpdate?t=' + encodeURIComponent(token);

  const formData = new FormData();

  formData.append('newName', newInfo.name);
  if (oldScientificName) {
    formData.append('oldScientific', oldScientificName);
  }
  formData.append('newScientific', newInfo.scientificName);
  formData.append('keyBinding', newInfo.keyBinding);
  formData.append('iconURL', newInfo.speciesIconURL);

  try {
    fetch(speciesUpdateUrl, {
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
            throw new Error(`Failed to update species information: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
          // Set the species data
          if (respData.success) {
            onSuccess(respData);
          } else {
            onFailure(respData.message);
          }
      })
      .catch(function(err) {
        console.log('Admin Update Species Error: ',err);
        onFailure('An error occurred when attempting to update species information');
    });
  } catch (err) {
    console.log('Admin Update Species Unknown Error: ',err);
    return false;
  }

  return true;

}

/**
 * Handles updating the location information
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {string} editingId The ID associated with this edit
 * @param {number} [oldLat] The old latitude of the location
 * @param {number} [oldLon] The old longitude of the location
 * @param {object} newInfo The updated location information to save
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call if the files check is successful
 * @param {function} onFailure The function to call on failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function updateLocation(serverURL, token, editingId, oldLat, oldLon, newInfo, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const locationsUpdateUrl = serverURL + '/adminLocationUpdate?t=' + encodeURIComponent(token);

  const formData = new FormData();

  formData.append('name', newInfo.nameProperty);
  formData.append('id', editingId);
  formData.append('active', newInfo.activeProperty);
  formData.append('measure', newInfo.measure);
  formData.append('elevation', newInfo.elevationProperty);
  formData.append('coordinate', newInfo.coordinate);
  formData.append('new_lat', newInfo.latProperty);
  formData.append('new_lon', newInfo.lngProperty);
  if (oldLat) {
    formData.append('old_lat', oldLat);
  }
  if (oldLon) {
    formData.append('old_lon', oldLon);
  }
  formData.append('utm_zone', newInfo.utm_zone);
  formData.append('utm_letter', newInfo.utm_letter);
  formData.append('utm_x', newInfo.utm_x);
  formData.append('utm_y', newInfo.utm_y);
  formData.append('description', newInfo.descriptionProperty);

  try {
    fetch(locationsUpdateUrl, {
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
            throw new Error(`Failed to update location information: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
          // Set the species data
          if (respData.success) {
            onSuccess(respData);
          } else {
            onFailure(respData.message);
          }
      })
      .catch(function(err) {
        console.log('Admin Update Location Error: ',err);
        onFailure('An error occurred when attempting to update location information');
    });
  } catch (err) {
    console.log('Admin Update Location Unknown Error: ',err);
    return false;
  }

  return true;
}

/**
 * Handles the commit of any species or location changes
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call if the files check is successful
 * @param {function} onFailure The function to call on failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function handleSaveChanges(serverURL, token, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const adminCompleteUrl = serverURL + '/adminCompleteChanges?t=' + encodeURIComponent(token);

  try {
    fetch(adminCompleteUrl, {
      credentials: 'include',
      method: 'PUT',
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401) {
              // User needs to log in again
              onExpiredToken();
            }
            throw new Error(`Failed to update changed settings information: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess()
      })
      .catch(function(err) {
        console.log('Admin Save Location/Species Error: ',err);
        onFailure('An error occurred when attempting to complete saving the changed settings information');
    });
  } catch (err) {
    console.log('Admin Save Location/Species Unknown Error: ',err);
    return false;
  }

  return true;
}

/**
 * Handles the abandonment of any species or location changes
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call if the files check is successful
 * @param {function} onFailure The function to call on failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function handleAbandonChanges(serverURL, token, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const adminCompleteUrl = serverURL + '/adminAbandonChanges?t=' + encodeURIComponent(token);

  try {
    fetch(adminCompleteUrl, {
      credentials: 'include',
      method: 'PUT',
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401) {
              // User needs to log in again
              onExpiredToken();
            }
            throw new Error(`Failed to abandon changed settings information: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData);
      })
      .catch(function(err) {
        console.log('Admin Abandon Location/Species Error: ',err);
        onFailure('An error occurred when attempting to abandon the changed settings information');
    });
  } catch (err) {
    console.log('Admin Abandon Location/Species Unknown Error: ',err);
    return false;
  }

  return true;

}

/**
 * Handles the new collection button press
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {object} [collection] The collection object to edit or falsy if a new collection is wanted
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call if the files check is successful
 * @param {function} onFailure The function to call on failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function handleCollectionEdit(serverURL, token, collection, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const adminCollectionUrl = serverURL + '/adminCollectionDetails?t=' + encodeURIComponent(token);
  const formData = new FormData();

  formData.append('bucket', collection.bucket);

  try {
    fetch(adminCollectionUrl, {
      credentials: 'include',
      method: 'POST',
      body: formData,
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401) {
              // User needs to log in again
              onExpiredToken();
            }
            throw new Error(`Failed to get collection details information: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
          // Handle the result
          onSuccess(respData);
      })
      .catch(function(err) {
        console.log('Admin Collection Details Error: ',err);
        onFailure('An error occurred when attempting to get collection details');
    });
  } catch (err) {
    console.log('Admin Collection Details Unknown Error: ',err);
    return false;
  }

  return true;
}


/**
 * Handles the new location button press
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {object} locationId The location ID of the edit
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call if the files check is successful
 * @param {function} onFailure The function to call on failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function handleLocationEdit(serverURL, token, locationId, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  // Get the location details from the server before editing
  const adminLocationnUrl = serverURL + '/adminLocationDetails?t=' + encodeURIComponent(token);
  const formData = new FormData();

  formData.append('id', locationId);

  try {
    fetch(adminLocationnUrl, {
      credentials: 'include',
      method: 'POST',
      body: formData,
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401) {
              // User needs to log in again
              onExpiredToken();
            }
            throw new Error(`Failed to get location details information: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData);
      })
      .catch(function(err) {
        console.log('Admin Location Details Error: ',err);
        onFailure('An error occurred when attempting to get location details');
    });
  } catch (err) {
    console.log('Admin Location Details Unknown Error: ',err);
    return false;
  }

  return true;

}


/**
 * Performs the check for incomplete uploads
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {Array} collections The collection to check upon
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call if the files check is successful
 * @param {function} onFailure The function to call on failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function continueCheckIncomplete(serverURL, token, collections, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const checkIncompleteUrl = serverURL + '/adminCheckIncomplete?t=' + encodeURIComponent(token);

  const formData = new FormData();
  formData.append('collections', JSON.stringify(collections));

  try {
    fetch(checkIncompleteUrl, {
      credentials: 'include',
      method: 'POST',
      body: formData,
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401) {
              // User needs to log in again
              onExpiredToken();
            }
            throw new Error(`Failed to update changed settings information: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData);
      })
      .catch(function(err) {
        console.log('Admin Save Location/Species Error: ',err);
        onFailure('An error occurred when attempting to complete saving the changed settings information');
    });
  } catch (err) {
    console.log('Admin Save Location/Species Unknown Error: ',err);
    return false;
  }

  return true;
}


/**
 * Checks if the user is an admin
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call if the files check is successful
 * @param {function} onFailure The function to call on failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function checkIfAdmin(serverURL, token, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const isAdminUrl = serverURL + '/adminCheck?t=' + encodeURIComponent(token)

  try {
    fetch(isAdminUrl, {
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
            throw new Error(`Failed checked to see if user is an admin: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData);
      })
      .catch(function(err) {
        console.log('Check For Admin Error: ', err);
        onFailure("An error occurred while logging in for administration purposes");
    });
  } catch (err) {
    console.log('Check For Admin Unknown Error: ',err);
    return false;
  }

  return true;
}

/**
 * Handles updating the collection information
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {string} editingId The editing ID for updating the collection
 * @param {object} collectionInfo The updated collection information to save
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call if the files check is successful
 * @param {function} onFailure The function to call on failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function ownerUpdateCollection(serverURL, token, editingId, collectionInfo, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const userUpdateCollUrl = serverURL + '/ownerCollectionUpdate?t=' + encodeURIComponent(token);

  const formData = new FormData();

  formData.append('id', editingId);
  formData.append('name', collectionInfo.name);
  formData.append('description', collectionInfo.description);
  formData.append('email', collectionInfo.email);
  formData.append('organization', collectionInfo.organization);
  formData.append('allPermissions', JSON.stringify(collectionInfo.allPermissions));

  try {
    fetch(userUpdateCollUrl, {
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
            throw new Error(`Failed to update collection information: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData);
      })
      .catch(function(err) {
        console.log('Admin Update Collection Error: ',err);
        onFailure('An error occurred when attempting to update collection information');
    });
  } catch (err) {
    console.log('Admin Update Collection Unknown Error: ',err);
    return false;
  }

  return true;
}

/**
 * Handles the new collection button press
 * @function
 * @param {string} serverURL The URL to the server
 * @param {string} token The authorization token
 * @param {string} editingId The editing ID for updating the collection
 * @param {object} bucket The bucket to edit or falsy if a new collection is wanted
 * @param {function} onExpiredToken Function to call when we get an expired token return
 * @param {function} onSuccess The function to call if the files check is successful
 * @param {function} onFailure The function to call on failure
 * @return {boolean} Returns true if the call was successfullly made, false if not
 */
export function ownerCollectionsEdit(serverURL, token, bucket, onExpiredToken, onSuccess, onFailure) {
  onExpiredToken ||= () => {};
  onSuccess ||= () => {};
  onFailure ||= () => {};

  const adminCollectionUrl = serverURL + '/ownerCollectionDetails?t=' + encodeURIComponent(token);
  const formData = new FormData();

  formData.append('bucket', bucket);

  try {
    fetch(adminCollectionUrl, {
      credentials: 'include',
      method: 'POST',
      body: formData,
    }).then(async (resp) => {
          if (resp.ok) {
            return resp.json();
          } else {
            if (resp.status === 401) {
              // User needs to log in again
              onExpiredToken();
            }
            throw new Error(`Failed to get collection details information: ${resp.status}: ${await resp.text()}`);
          }
        })
      .then((respData) => {
        onSuccess(respData)
      })
      .catch(function(err) {
        console.log('Admin Collection Details Error: ',err);
        onFailure('An error occurred when attempting to get collection details');
    });
  } catch (err) {
    console.log('Admin Collection Details Unknown Error: ',err);
    return false;
  }

  return true;

}
