import { Alert } from "react-native";
import { supabase } from "./supabase";

/**
 * Convert ratio label to percentages
 * @param {string} ratioLabel - Ratio label ("Mostly guys", "Balanced", "Mostly girls")
 * @returns {Object} Object with guys and girls percentages
 */
export function mapRatioToPercent(ratioLabel) {
  switch (ratioLabel) {
    case "Mostly guys":
      return { guys: 70, girls: 30 };
    case "Balanced":
      return { guys: 50, girls: 50 };
    case "Mostly girls":
      return { guys: 30, girls: 70 };
    default:
      return { guys: 50, girls: 50 };
  }
}

/**
 * Get display ratio for venue cards
 * @param {Object} venue - Venue object with venue_type, default_guys, default_girls
 * @param {Object|null} latestVibe - Latest vibe object with ratio property
 * @returns {Object} { show: boolean, guys: number, girls: number, isDefault: boolean }
 */
export function getDisplayRatio(venue, latestVibe) {
  // If latestVibe has a ratio, convert it to percentages
  if (latestVibe?.ratio) {
    const ratioPercent = mapRatioToPercent(latestVibe.ratio);
    return {
      show: true,
      guys: ratioPercent.guys,
      girls: ratioPercent.girls,
      isDefault: false,
    };
  }

  // For clubs: always show ratio, use venue defaults or fallback to 50/50
  if (venue?.venue_type === 'club') {
    const guys = typeof venue.default_guys === 'number' ? venue.default_guys : 50;
    const girls = typeof venue.default_girls === 'number' ? venue.default_girls : 50;
    return {
      show: true,
      guys,
      girls,
      isDefault: true,
    };
  }

  // For bars: don't show ratio
  return {
    show: false,
    guys: 50,
    girls: 50,
    isDefault: false,
  };
}

/**
 * Fetches the latest vibe for a venue with retry logic and optional error feedback
 * @param {string} venueKey - Venue ID (must be valid string ID, not name)
 * @param {Object} options - Configuration options
 * @param {boolean} options.showError - Show Alert on failure (default: false)
 * @param {number} options.retries - Number of retry attempts (default: 1)
 * @param {string} options.selectFields - Custom select fields (optional, defaults to standard fields)
 * @returns {Promise<Object|null>} Latest vibe data or null
 */
export async function fetchLatestVibe(venueKey, options = {}) {
  const { showError = false, retries = 1, selectFields } = options;
  
  if (!venueKey || typeof venueKey !== 'string') {
    console.error('[fetchLatestVibe] Invalid venue key:', venueKey);
    return null;
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

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
        console.error(`[fetchLatestVibe] Attempt ${attempt + 1} failed:`, error.message);
        
        // Wait before retry
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
      } else {
        return data;
      }
    } catch (e) {
      lastError = e;
      console.error(`[fetchLatestVibe] Exception on attempt ${attempt + 1}:`, e);
      
      // Wait before retry on exception too
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
export async function fetchRecentVibes(venueKey, hours = 2) {
  if (!venueKey) return [];

  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("vibes")
    .select("crowd, ratio, line, cover, drinks_price, drinks_price_tier, music, bar_type, created_at")
    .eq("venue_id", venueKey)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.log("Error fetching recent vibes:", error.message);
    return [];
  }

  return data || [];
}
