/**
 * Validates and normalizes venue type
 * @param {string|null|undefined} venueType - The venue type to validate
 * @returns {Object} { valid: boolean, type?: string, error?: string }
 */
export function validateVenueType(venueType) {
  if (!venueType) {
    return { valid: false, error: 'Missing venue type' };
  }
  
  const normalized = venueType.trim().toLowerCase();
  
  if (normalized !== 'club' && normalized !== 'bar') {
    return { valid: false, error: `Invalid venue type: ${normalized}` };
  }
  
  return { valid: true, type: normalized };
}

/**
 * Safely determines if a venue is a bar
 * @param {string|null|undefined} venueType - The venue type
 * @returns {boolean} true if venue is a bar, false otherwise
 */
export function isBar(venueType) {
  const validation = validateVenueType(venueType);
  return validation.valid && validation.type === 'bar';
}

/**
 * Safely determines if a venue is a club
 * @param {string|null|undefined} venueType - The venue type
 * @returns {boolean} true if venue is a club, false otherwise
 */
export function isClub(venueType) {
  const validation = validateVenueType(venueType);
  return validation.valid && validation.type === 'club';
}

/**
 * Get a reliable unique key for a venue
 * @param {Object} venue - Venue object with id property
 * @throws {Error} if venue doesn't have an ID
 * @returns {string} Venue ID
 */
export function getVenueKey(venue) {
  if (!venue) {
    throw new Error('Venue object is required');
  }
  
  if (!venue.id) {
    console.error('[getVenueKey] Venue missing ID:', venue);
    throw new Error(`Venue "${venue.name || 'unknown'}" is missing required ID field`);
  }
  
  return venue.id;
}

/**
 * Safe version that returns null instead of throwing
 * @param {Object} venue - Venue object with id property
 * @returns {string|null} Venue ID or null if invalid
 */
export function getVenueKeySafe(venue) {
  try {
    return getVenueKey(venue);
  } catch (e) {
    console.error('[getVenueKeySafe] Error:', e);
    return null;
  }
}

