'use client'

/** @module checkLogin */

import { createContext } from 'react';

const URL_REGEX = /[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)?/i;

// Default login values state
export const DefaultLoginValid = {url: null, user: null, password: null, valid: false};
// Context for login validity
export const LoginValidContext = createContext(DefaultLoginValid);

/**
 * Check the URL for correctness
 * @function
 * @param {string} url The URL to check
 * @return {boolean} Returns true if the URL matches the valid format
 */
export function LoginCheckURL(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }

  const urlRegex = /[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)?/gi;
  return URL_REGEX.test(url);
}

/**
 * Checks that the user name is valid
 * @function
 * @param {string} user The username to check
 * @returns {boolean} Returns true if the user name appears to be valid
 */
export function LoginCheckUser(user) {
  return typeof user === 'string' && user.trim() !== '';
}

/**
 * Checks that the password is valid
 * @function
 * @param {string} password The password to check
 * @returns {boolean} Returns true if the password appears to be valid
 */
export function LoginCheckPassword(password) {
  return typeof password === 'string' && password.trim() !== '';
}

/**
 * Checks that the login credentials appear to be valid
 * @function
 * @param {string} url The URL to check
 * @param {string} user The username to check
 * @param {string} password The password to check
 * @returns {object} Returns the validity of each parameter, and overall validity
 */
export function LoginCheck(url, user, password) {
  const urlValid = LoginCheckURL(url);
  const userValid = LoginCheckUser(user);
  const passwordValid = LoginCheckPassword(password);

  return {
    url: urlValid,
    user: userValid,
    password: passwordValid,
    valid: urlValid && userValid && passwordValid
  };
}
