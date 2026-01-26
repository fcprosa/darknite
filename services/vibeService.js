import { supabase } from "../utils/supabase";
import { Alert } from "react-native";
import logger from "../utils/logger";
import * as CONSTANTS from "../constants";

const log = logger.tag("VibeService");

/**
 * Fetch the latest vibe for a venue with retry logic
 * @param {string} venueKey - Venue ID
 * @param {Object} options - Configuration options
 * @param {boolean} options.showError - Show Alert on failure (default: false)
 * @param {number} options.retries - Number of retry attempts (default: 1)
 * @param {string} options.selectFields - Custom select fields (optional)
 * @returns {Promise<Object|null>} Latest vibe data or null
 */
export async function getLatestVibe(venueKey, options = {}) {
  const { showError = false, retries = 1, selectFields } = options;
  
  if (!venueKey || typeof venueKey !== 'string') {
    log.error("Invalid venue key:", venueKey);
    return null;
  }

  const since = new Date(Date.now() - CONSTANTS.VIBE_RECENCY_HOURS * 60 * 60 * 1000).toISOString();

  // Default fields used by most components
  const defaultFields = "crowd, ratio, line, cover, drinks_price, drinks_price_tier, music, bar_type, age_range, created_at";
  const fields = selectFields || defaultFields;

  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { data, error } = await supabase
        .from("vibes")
        .select(fields)
        .eq("venue_id", venueKey)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        lastError = error;
        log.error(`Attempt ${attempt + 1} failed:`, error.message);
        
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
      } else {
        return data;
      }
    } catch (e) {
      lastError = e;
      log.error(`Exception on attempt ${attempt + 1}:`, e);
      
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
    }
  }

  // All retries failed
  if (showError) {
    Alert.alert(
      'Connection Error',
      'Unable to load venue data. Please check your connection and try again.',
      [{ text: 'OK' }]
    );
  }
  
  return null;
}

/**
 * Fetch recent vibes - supports two modes:
 * 1. For a specific venue: getRecentVibes(venueKey, hours)
 * 2. From all venues (Hot Now): getRecentVibes({ minutes, limit })
 * @param {string|Object} venueKeyOrOptions - Venue ID (string) or options object
 * @param {number} hours - Number of hours to look back (if venueKey is string, default: 2)
 * @returns {Promise<Array>} Array of vibe data
 */
export async function getRecentVibes(venueKeyOrOptions, hours = 2) {
  // If first param is an object, use new Hot Now mode
  if (typeof venueKeyOrOptions === 'object' && venueKeyOrOptions !== null && !Array.isArray(venueKeyOrOptions)) {
    const { minutes = 30, limit = 100 } = venueKeyOrOptions;
    const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();

    try {
      const { data, error } = await supabase
        .from("vibes")
        .select("venue_id, crowd, ratio, line, cover, drinks_price, drinks_price_tier, music, bar_type, age_range, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        log.error("Error fetching recent vibes:", error.message);
        return [];
      }

      return data || [];
    } catch (error) {
      log.error("Exception fetching recent vibes:", error);
      return [];
    }
  }

  // Original mode: fetch for a specific venue
  const venueKey = venueKeyOrOptions;
  if (!venueKey) return [];

  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  try {
    const { data, error } = await supabase
      .from("vibes")
      .select("crowd, ratio, line, cover, drinks_price, drinks_price_tier, music, bar_type, created_at")
      .eq("venue_id", venueKey)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      log.error("Error fetching recent vibes:", error.message);
      return [];
    }

    return data || [];
  } catch (error) {
    log.error("Exception fetching recent vibes:", error);
    return [];
  }
}

/**
 * Fetch vibes for "Hot Now" feed (recent vibes from multiple venues)
 * @param {number} hoursAgo - Hours to look back (default: 12)
 * @param {number} limit - Max number of vibes to fetch (default: 100)
 * @returns {Promise<Array>} Array of vibe data
 */
export async function getHotNowVibes(hoursAgo = CONSTANTS.HOT_NOW_HOURS, limit = CONSTANTS.HOT_NOW_VIBE_LIMIT) {
  const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

  try {
    const { data, error } = await supabase
      .from("vibes")
      .select("venue_id, crowd, ratio, line, cover, drinks_price, music, bar_type, age_range, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      log.error("Error fetching hot now vibes:", error.message);
      return [];
    }

    return data || [];
  } catch (error) {
    log.error("Exception fetching hot now vibes:", error);
    return [];
  }
}

/**
 * Fetch latest vibes for multiple venues in a single batch request
 * Handles string or number venue IDs, deduplicates, and chunks large requests
 * @param {Array<string|number>} venueIds - Array of venue IDs (string or number)
 * @returns {Promise<Object>} Object mapping venue_id to latest vibe { [venueId]: vibe }
 */
export async function getLatestVibesBatch(venueIds) {
  if (!venueIds || !Array.isArray(venueIds) || venueIds.length === 0) {
    return {};
  }

  // Filter and normalize venue IDs (handle both string and number)
  const validVenueIds = venueIds
    .filter(id => id !== null && id !== undefined && id !== '')
    .map(id => String(id)); // Normalize to strings for consistency

  if (validVenueIds.length === 0) {
    return {};
  }

  // Deduplicate IDs
  const uniqueIds = [...new Set(validVenueIds)];

  // Use 12 hours for filtering recent vibes (as specified)
  const hoursAgo = 12;
  const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
  
  // Default fields used by most components
  const fields = "venue_id, crowd, ratio, line, cover, drinks_price, drinks_price_tier, music, bar_type, created_at";

  // Chunk large requests (300 IDs per batch to avoid URL length limits)
  const CHUNK_SIZE = 300;
  const chunks = [];
  for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
    chunks.push(uniqueIds.slice(i, i + CHUNK_SIZE));
  }

  const allVibesMap = {};

  try {
    // Process each chunk
    for (const chunk of chunks) {
      const { data, error } = await supabase
        .from("vibes")
        .select(fields)
        .in("venue_id", chunk)
        .gte("created_at", since)
        .order("created_at", { ascending: false });

      if (error) {
        log.error("Error fetching latest vibes batch chunk:", error.message);
        // Continue with other chunks even if one fails
        continue;
      }

      if (!data || data.length === 0) {
        continue;
      }

      // Process in-memory: keep only the newest vibe per venue_id
      // Data is already sorted by created_at DESC, so first occurrence is newest
      for (const vibe of data) {
        const venueId = String(vibe.venue_id); // Normalize to string
        if (!allVibesMap[venueId]) {
          // First vibe for this venue (already sorted by created_at desc)
          allVibesMap[venueId] = vibe;
        }
        // If we already have a vibe for this venue, skip (we only want the latest)
      }
    }

    log.log(`getLatestVibesBatch: fetched ${Object.keys(allVibesMap).length} latest vibes from ${uniqueIds.length} venues`);
    return allVibesMap;
  } catch (error) {
    log.error("Exception fetching latest vibes batch:", error);
    // Return whatever we've collected so far, don't crash UI
    return allVibesMap;
  }
}

/**
 * Fetch user's vibes
 * @param {string} userId - User ID
 * @param {number} limit - Max number of vibes to fetch (default: 10)
 * @returns {Promise<Array>} Array of user's vibe data
 */
export async function getUserVibes(userId, limit = 10) {
  if (!userId) return [];
  
  try {
    const { data, error } = await supabase
      .from("vibes")
      .select("venue_id, crowd, ratio, music, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      log.error("Error fetching user vibes:", error.message);
      return [];
    }

    return data || [];
  } catch (error) {
    log.error("Exception fetching user vibes:", error);
    return [];
  }
}

/**
 * Validate vibe data before insertion
 * @param {Object} vibeData - Vibe data object to validate
 * @returns {{ valid: boolean, error: string|null }} Validation result
 */
function validateVibeData(vibeData) {
  if (!vibeData || typeof vibeData !== 'object') {
    return { valid: false, error: 'Invalid vibe data' };
  }

  // Validate required fields
  if (!vibeData.venue_id || typeof vibeData.venue_id !== 'string') {
    return { valid: false, error: 'venue_id is required and must be a string' };
  }

  if (!vibeData.user_id || typeof vibeData.user_id !== 'string') {
    return { valid: false, error: 'user_id is required and must be a string' };
  }

  // Validate enum fields if provided
  const validCrowdValues = ['Dead', 'Chill', 'Fun', 'Packed', 'Chaos'];
  if (vibeData.crowd && !validCrowdValues.includes(vibeData.crowd)) {
    return { valid: false, error: 'Invalid crowd value' };
  }

  const validRatioValues = ['Mostly guys', 'Balanced', 'Mostly girls'];
  if (vibeData.ratio && !validRatioValues.includes(vibeData.ratio)) {
    return { valid: false, error: 'Invalid ratio value' };
  }

  const validLineValues = ['No line', 'Short', '30+ min'];
  if (vibeData.line && !validLineValues.includes(vibeData.line)) {
    return { valid: false, error: 'Invalid line value' };
  }

  // Cover values are stored as DB format: "$", "$$", "$$$", "$$$$" (or null for Free)
  // This matches what mapCoverPriceToDB() returns
  const validCoverValues = ['$', '$$', '$$$', '$$$$'];
  if (vibeData.cover !== null && vibeData.cover !== undefined && !validCoverValues.includes(vibeData.cover)) {
    return { valid: false, error: 'Invalid cover value' };
  }

  const validMusicValues = ['Hip-Hop / R&B', 'Afrobeats', 'House / Techno', 'Reggaeton', 'Top Hits', 'Mixed'];
  if (vibeData.music && !validMusicValues.includes(vibeData.music)) {
    return { valid: false, error: 'Invalid music value' };
  }

  const validBarTypeValues = ['cocktail', 'sports', 'dive', 'wine', 'speakeasy'];
  if (vibeData.bar_type && !validBarTypeValues.includes(vibeData.bar_type)) {
    return { valid: false, error: 'Invalid bar_type value' };
  }

  const validDrinksPriceTierValues = ['cheap', 'normal', 'expensive', 'crazy'];
  if (vibeData.drinks_price_tier && !validDrinksPriceTierValues.includes(vibeData.drinks_price_tier)) {
    return { valid: false, error: 'Invalid drinks_price_tier value' };
  }

  const validAgeRangeValues = ['18–25', '25–30', '30–35', '35+', 'Mixed'];
  if (vibeData.age_range && !validAgeRangeValues.includes(vibeData.age_range)) {
    return { valid: false, error: 'Invalid age_range value' };
  }

  // Validate string length limits (prevent extremely long strings)
  const maxStringLength = 500;
  const stringFields = ['comment', 'stay_duration'];
  for (const field of stringFields) {
    if (vibeData[field] && typeof vibeData[field] === 'string' && vibeData[field].length > maxStringLength) {
      return { valid: false, error: `${field} exceeds maximum length` };
    }
  }

  // Validate array fields
  if (vibeData.tags && !Array.isArray(vibeData.tags)) {
    return { valid: false, error: 'tags must be an array' };
  }

  return { valid: true, error: null };
}

/**
 * Create a new vibe
 * @param {Object} vibeData - Vibe data object
 * @returns {Promise<{data: Object|null, error: Error|null, userMessage: string|null}>} Result object
 */
export async function createVibe(vibeData) {
  try {
    // Validate input data before insertion
    const validation = validateVibeData(vibeData);
    if (!validation.valid) {
      log.error("Vibe validation failed:", validation.error);
      return {
        data: null,
        error: new Error(validation.error),
        userMessage: "Invalid vibe data. Please try again."
      };
    }

    // Select the same fields that getLatestVibe returns for consistency
    const defaultFields = "venue_id, crowd, ratio, line, cover, drinks_price, drinks_price_tier, music, bar_type, age_range, created_at";
    const { data, error } = await supabase
      .from("vibes")
      .insert([vibeData])
      .select(defaultFields)
      .single();

    if (error) {
      // Check for RATE_LIMIT_EXCEEDED error (60-minute rate limit) - treat as expected validation
      const isRateLimitError = error.message?.includes("RATE_LIMIT_EXCEEDED") || (error.code === "23505" && error.message?.includes("Rate limit exceeded"));
      
      if (isRateLimitError) {
        // Rate limit violation (60 minutes) - log as info, not error
        log.info("Rate limit exceeded for vibe creation:", { venue_id: vibeData.venue_id });
        return {
          data: null,
          error: error,
          userMessage: "You've posted recently for this venue — try again in ~60 minutes."
        };
      }
      
      // Other errors - log as error
      log.error("Error creating vibe:", error);
      
      // Handle RLS and rate-limit errors with user-friendly messages
      if (error.code === "42501" || error.code === "PGRST301" || error.message?.includes("permission denied")) {
        // RLS policy violation (401/403)
        return {
          data: null,
          error: error,
          userMessage: "Please sign in to post a vibe."
        };
      }
      
      // Generic error
      return { data: null, error: error, userMessage: null };
    }

    log.log("Vibe created successfully");
    return { data, error: null, userMessage: null };
  } catch (error) {
    // Check for RATE_LIMIT_EXCEEDED error - treat as expected validation
    const isRateLimitError = error.message?.includes("RATE_LIMIT_EXCEEDED") || error.message?.includes("Rate limit exceeded");
    
    if (isRateLimitError) {
      // Rate limit violation - log as info, not error
      log.info("Rate limit exceeded (exception) for vibe creation");
      return {
        data: null,
        error: error,
        userMessage: "You've posted recently for this venue — try again in ~60 minutes."
      };
    }
    
    // Other exceptions - log as error
    log.error("Exception creating vibe:", error);
    return { data: null, error: error, userMessage: null };
  }
}

