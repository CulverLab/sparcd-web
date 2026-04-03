'use client'

/** @module utils */

/**
 * Returns the base portion of the URL
 * @function
 * @returns The base portion of the URL
 */
export function getServer() {
  let curUrl = '';
  if (typeof window !== "undefined") {
    // Conditional upon what version we're running
    if (process.env.NODE_ENV === 'development')
      curUrl = 'http://127.0.0.1:5000'
    else
      curUrl = window.location.origin;
  }

  // modify as needed
  return curUrl;
}

/**
 * Pads a value to the specifies length. Pre-format the value to a string if
 * you need specialized formatting. Values that are longer than the specified length
 * are not changed and are returned "as is"
 * @function
 * @param {object} value A value converted to a string using default functionality
 * @param {int} length The length of the string to pad to
 * @param {string} padding the padding character. Defaults to a space
 * @param {boolean} left Left pads the string when set to true or not specified. Otherwise right pads
 * @return {string} Returns the padded string
 */
export function pad(value, length, padding, left) {
  if (value === null || length === null) {
    return '';
  }

  let pad_value = '' + value;
  let pad_length = length === null || length === undefined ? 0 : Number(length);
  let pad_padding = padding === null || padding === undefined ? ' ' : '' + padding;
  let left_padding = left === null || left === undefined ? true: left;

  if (pad_value.length < length) {
    const padding_len = pad_length - pad_value.length;
    const padding = '0'.repeat(padding_len);
    if (left_padding)
      return padding + pad_value;
    else
      return pad_value + padding;
  }

  return pad_value;
}

/**
 * Converts meters to feet
 * @function
 * @param {number} meters The meters to convert
 * @return {string} The feet equivelent of the meters value
 */
export function meters2feet(meters) {
  return Math.round((meters * 3.28084 + Number.EPSILON) * 100) / 100;
}

/**
 * Function to compare two uploads for reverse sorting by date (newest on top)
 * @function
 */
export function compareUploadDates(first, second) {
  const toMs = ({ date: { date, time } }) =>
    new Date(
      date.year, date.month - 1, date.day,
      time.hour, time.minute, time.second,
      Math.floor(time.nano / 1e6)
    ).getTime();

  return toMs(second) - toMs(first); // Newest first
};

/**
 * Converts the passed in value to boolean type
 * @function
 */
export function coerceBool(value, defaultValue = false) {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === 'boolean') return value;
  return String(value).toLowerCase() === 'true';
}
