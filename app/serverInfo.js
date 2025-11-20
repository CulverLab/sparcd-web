'use client'

/** @module serverInfo */

import { createContext } from 'react';

/** React context for geographic coordinate choices */
export const geographicCoordinates = [
  {"label":"UTM", "value":"UTM"},
  {"label":"Latitude & Longitude", "value":"LATLON"},
];

/** React context for adding messages */
export const AddMessageContext = createContext(false);
/** React context for base URL */
export const BaseURLContext = createContext(null);
/** React context for Collections information */
export const CollectionsInfoContext = createContext(null);
/** React context for locations information */
export const LocationsInfoContext = createContext(null);
/** React context for running on a mobile device */
export const MobileDeviceContext = createContext(false);
/** React context for narrow windows */
export const NarrowWindowContext = createContext(false);
/** React context for sandbox uploaded folders */
export const SandboxInfoContext = createContext(null);
/** React context for sizing of pages */
export const SizeContext = createContext(null);
/** React context for species information */
export const SpeciesInfoContext = createContext(null);
/** React context for user login token */
export const TokenContext = createContext(null);
/** React context for the current upload edit */
export const UploadEditContext = createContext(null);
/** React context for user name */
export const UserNameContext = createContext(null);
/** React context for user settings */
export const UserSettingsContext = createContext(null);

/** The default species icon image URL */
export const DefaultImageIconURL = 'https://i.imgur.com/4qz5mI0.png';

/** Allowed image types **/
export const AllowedImageMime = [
  'image/jpeg',
];

/** Allowed movie types **/
export const AllowedMovieMime = [
  'video/mp4'
];
