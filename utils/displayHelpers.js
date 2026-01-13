/**
 * Standard placeholder for missing/unavailable data
 */
export const MISSING_DATA_PLACEHOLDER = "—";

/**
 * Get display value with consistent placeholder for missing data
 * @param {*} value - The value to display
 * @param {string} placeholder - Custom placeholder (defaults to MISSING_DATA_PLACEHOLDER)
 * @returns {string} The value or placeholder if value is missing
 */
export function getDisplayValue(value, placeholder = MISSING_DATA_PLACEHOLDER) {
  if (value === null || value === undefined || value === "") {
    return placeholder;
  }
  return value;
}

