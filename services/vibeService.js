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
  const defaultFields = "crowd, ratio, line, cover, drinks_price, drinks_price_tier, music, bar_type, created_at";
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
 * Fetch recent vibes for a venue (last N hours)
 * @param {string} venueKey - Venue ID
 * @param {number} hours - Number of hours to look back (default: 2)
 * @returns {Promise<Array>} Array of recent vibe data
 */
export async function getRecentVibes(venueKey, hours = 2) {
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
      .select("venue_id, crowd, ratio, line, cover, drinks_price, music, bar_type, created_at")
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
 * Create a new vibe
 * @param {Object} vibeData - Vibe data object
 * @returns {Promise<{data: Object|null, error: Error|null, userMessage: string|null}>} Result object
 */
export async function createVibe(vibeData) {
  try {
    const { data, error } = await supabase
      .from("vibes")
      .insert([vibeData])
      .select()
      .single();

    if (error) {
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
      
      if (error.code === "23505" || error.message?.includes("Rate limit exceeded") || error.message?.includes("already posted")) {
        // Rate limit violation
        return {
          data: null,
          error: error,
          userMessage: "You've posted recently for this venue—try again in ~15 minutes."
        };
      }
      
      // Generic error
      return { data: null, error: error, userMessage: null };
    }

    log.log("Vibe created successfully");
    return { data, error: null, userMessage: null };
  } catch (error) {
    log.error("Exception creating vibe:", error);
    
    // Handle exceptions that might be RLS or rate-limit related
    if (error.message?.includes("Rate limit exceeded") || error.message?.includes("already posted")) {
      return {
        data: null,
        error: error,
        userMessage: "You've posted recently for this venue—try again in ~15 minutes."
      };
    }
    
    return { data: null, error: error, userMessage: null };
  }
}

