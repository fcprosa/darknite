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
 * @returns {string} Venue ID (normalized to string)
 */
export function getVenueKey(venue) {
  if (!venue) {
    throw new Error('Venue object is required');
  }
  
  if (!venue.id) {
    console.error('[getVenueKey] Venue missing ID:', venue);
    throw new Error(`Venue "${venue.name || 'unknown'}" is missing required ID field`);
  }
  
  // Normalize to string for consistency (handles both string and number IDs)
  return String(venue.id);
}

/**
 * Safe version that returns null instead of throwing
 * Normalizes venue ID to string for consistency
 * @param {Object} venue - Venue object with id property
 * @returns {string|null} Venue ID (normalized to string) or null if invalid
 */
export function getVenueKeySafe(venue) {
  try {
    return getVenueKey(venue);
  } catch (e) {
    console.error('[getVenueKeySafe] Error:', e);
    return null;
  }
}

/**
 * Infer venue type from venue name when venue_type is missing
 * @param {Object} venue - Venue object with name property
 * @returns {string} Inferred venue type: "bar" or "club"
 */
export function inferVenueType(venue) {
  if (!venue?.name) {
    return "club"; // Default to club
  }

  const name = venue.name.toLowerCase();

  // Bar indicators
  const barKeywords = ["bar", "pub", "tavern", "taproom", "brewery", "wine", "beer", "cocktail", "speakeasy", "rooftop"];
  for (const keyword of barKeywords) {
    if (name.includes(keyword)) {
      return "bar";
    }
  }

  // Club indicators
  const clubKeywords = ["club", "nightclub", "lounge", "disco", "dance"];
  for (const keyword of clubKeywords) {
    if (name.includes(keyword)) {
      return "club";
    }
  }

  // Default to club (more common in nightlife apps)
  return "club";
}

