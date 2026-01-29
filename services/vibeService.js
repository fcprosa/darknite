import { supabase } from "../utils/supabase";
import { Alert } from "react-native";
import logger from "../utils/logger";
import * as CONSTANTS from "../constants";

const log = logger.tag("VibeService");

// ✅ Single source of truth for vibe fields (matches database-schema.md)
const VIBE_SELECT_FIELDS =
  "id, created_at, venue_id, user_id, crowd, ratio, line, cover, music, bar_type, drinks_price_tier, age_range, verified";

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

  if (!venueKey || typeof venueKey !== "string") {
    log.error("Invalid venue key:", venueKey);
    return null;
  }

  const since = new Date(
    Date.now() - CONSTANTS.VIBE_RECENCY_HOURS * 60 * 60 * 1000
  ).toISOString();

  const fields = selectFields || VIBE_SELECT_FIELDS;

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
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
      } else {
        return data || null;
      }
    } catch (e) {
      lastError = e;
      log.error(`Exception on attempt ${attempt + 1}:`, e);

      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
    }
  }

  if (showError) {
    Alert.alert(
      "Connection Error",
      "Unable to load venue data. Please check your connection and try again.",
      [{ text: "OK" }]
    );
  }

  if (lastError) {
    log.error("All retries failed:", lastError?.message || lastError);
  }

  return null;
}

/**
 * Fetch recent vibes - supports two modes:
 * 1) For a specific venue: getRecentVibes(venueKey, hours)
 * 2) From all venues (Hot Now): getRecentVibes({ minutes, limit })
 * @param {string|Object} venueKeyOrOptions - Venue ID (string) or options object
 * @param {number} hours - Number of hours to look back (if venueKey is string, default: 2)
 * @returns {Promise<Array>} Array of vibe data
 */
export async function getRecentVibes(venueKeyOrOptions, hours = 2) {
  // Hot Now mode
  if (
    typeof venueKeyOrOptions === "object" &&
    venueKeyOrOptions !== null &&
    !Array.isArray(venueKeyOrOptions)
  ) {
    const { minutes = 30, limit = 100 } = venueKeyOrOptions;
    const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();

    try {
      const { data, error } = await supabase
        .from("vibes")
        .select(VIBE_SELECT_FIELDS)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        log.error("Error fetching recent vibes (hot now):", error.message);
        return [];
      }

      return data || [];
    } catch (error) {
      log.error("Exception fetching recent vibes (hot now):", error);
      return [];
    }
  }

  // Venue-specific mode
  const venueKey = venueKeyOrOptions;
  if (!venueKey || typeof venueKey !== "string") return [];

  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  try {
    const { data, error } = await supabase
      .from("vibes")
      .select(VIBE_SELECT_FIELDS)
      .eq("venue_id", venueKey)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      log.error("Error fetching recent vibes (venue):", error.message);
      return [];
    }

    return data || [];
  } catch (error) {
    log.error("Exception fetching recent vibes (venue):", error);
    return [];
  }
}

/**
 * Fetch vibes for "Hot Now" feed (recent vibes from multiple venues)
 * @param {number} hoursAgo - Hours to look back (default: CONSTANTS.HOT_NOW_HOURS)
 * @param {number} limit - Max number of vibes to fetch (default: CONSTANTS.HOT_NOW_VIBE_LIMIT)
 * @returns {Promise<Array>} Array of vibe data
 */
export async function getHotNowVibes(
  hoursAgo = CONSTANTS.HOT_NOW_HOURS,
  limit = CONSTANTS.HOT_NOW_VIBE_LIMIT
) {
  const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

  try {
    const { data, error } = await supabase
      .from("vibes")
      .select(VIBE_SELECT_FIELDS)
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
 * Deduplicates and chunks large requests
 * @param {Array<string|number>} venueIds - Array of venue IDs
 * @returns {Promise<Object>} Object mapping venue_id to latest vibe { [venueId]: vibe }
 */
export async function getLatestVibesBatch(venueIds) {
  if (!venueIds || !Array.isArray(venueIds) || venueIds.length === 0) {
    return {};
  }

  const validVenueIds = venueIds
    .filter((id) => id !== null && id !== undefined && id !== "")
    .map((id) => String(id));

  if (validVenueIds.length === 0) {
    return {};
  }

  const uniqueIds = [...new Set(validVenueIds)];

  const hoursAgo = 12;
  const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

  const CHUNK_SIZE = 300;
  const chunks = [];
  for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
    chunks.push(uniqueIds.slice(i, i + CHUNK_SIZE));
  }

  const allVibesMap = {};

  try {
    for (const chunk of chunks) {
      const { data, error } = await supabase
        .from("vibes")
        .select(VIBE_SELECT_FIELDS)
        .in("venue_id", chunk)
        .gte("created_at", since)
        .order("created_at", { ascending: false });

      if (error) {
        log.error("Error fetching latest vibes batch chunk:", error.message);
        continue;
      }

      if (!data || data.length === 0) continue;

      for (const vibe of data) {
        const venueId = String(vibe.venue_id);
        if (!allVibesMap[venueId]) {
          allVibesMap[venueId] = vibe;
        }
      }
    }

    log.log(
      `getLatestVibesBatch: fetched ${Object.keys(allVibesMap).length} latest vibes from ${uniqueIds.length} venues`
    );
    return allVibesMap;
  } catch (error) {
    log.error("Exception fetching latest vibes batch:", error);
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
      .select(VIBE_SELECT_FIELDS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      log.error("Error fetching user vibes:", error.message);
      return [];
    }

    // Attach venue details (optional convenience)
    if (data && data.length > 0) {
      const venueIds = [...new Set(data.map((v) => v.venue_id))];
      const { data: venues } = await supabase
        .from("venues")
        .select("id, name, neighborhood, venue_type")
        .in("id", venueIds);

      if (venues) {
        const venueMap = {};
        venues.forEach((v) => {
          venueMap[v.id] = v;
        });

        return data.map((vibe) => ({
          ...vibe,
          venue: venueMap[vibe.venue_id] || {
            name: vibe.venue_id,
            neighborhood: "Unknown",
            venue_type: null,
          },
        }));
      }
    }

    return data || [];
  } catch (error) {
    log.error("Exception fetching user vibes:", error);
    return [];
  }
}

/**
 * Validate vibe data before insertion
 * Matches database-schema.md constraints (only validate what is truly constrained)
 */
function validateVibeData(vibeData) {
  if (!vibeData || typeof vibeData !== "object") {
    return { valid: false, error: "Invalid vibe data" };
  }

  if (!vibeData.venue_id || typeof vibeData.venue_id !== "string") {
    return { valid: false, error: "venue_id is required and must be a string" };
  }

  if (!vibeData.user_id || typeof vibeData.user_id !== "string") {
    return { valid: false, error: "user_id is required and must be a string" };
  }

  // ✅ crowd is constrained in your schema/app
  // Clubs use: Dead, Chill, Fun, Packed, Chaos
  // Bars use: Dead, Chill, Buzzing, Packed
  const validCrowdValues = ["Dead", "Chill", "Fun", "Buzzing", "Packed", "Chaos"];
  if (vibeData.crowd && !validCrowdValues.includes(vibeData.crowd)) {
    return { valid: false, error: "Invalid crowd value" };
  }

  // ✅ cover stored as "$", "$$", "$$$", "$$$$" (or null)
  const validCoverValues = ["$", "$$", "$$$", "$$$$"];
  if (
    vibeData.cover !== null &&
    vibeData.cover !== undefined &&
    vibeData.cover !== "" &&
    !validCoverValues.includes(vibeData.cover)
  ) {
    return { valid: false, error: "Invalid cover value" };
  }

  // ✅ bar_type must match DB constraint values you showed
  const validBarTypeValues = ["cocktail", "dive", "speakeasy", "sports", "wine"];
  if (vibeData.bar_type && !validBarTypeValues.includes(vibeData.bar_type)) {
    return { valid: false, error: "Invalid bar_type value" };
  }

  // ✅ drinks_price_tier must match database-schema.md
  const validDrinksPriceTierValues = ['cheap', 'moderate', 'pricey', 'expensive'];
  if (
    vibeData.drinks_price_tier &&
    !validDrinksPriceTierValues.includes(vibeData.drinks_price_tier)
  ) {
    return { valid: false, error: "Invalid drinks_price_tier value" };
  }

  // ✅ age_range values from your schema
  const validAgeRangeValues = ["18–25", "25–30", "30–35", "35+", "Mixed"];
  if (vibeData.age_range && !validAgeRangeValues.includes(vibeData.age_range)) {
    return { valid: false, error: "Invalid age_range value" };
  }

  // ✅ avoid crazy long strings (music/ratio/line are text without strict constraints)
  const maxStringLength = 200;
  const textFields = ["music", "ratio", "line"];
  for (const field of textFields) {
    if (
      vibeData[field] &&
      typeof vibeData[field] === "string" &&
      vibeData[field].length > maxStringLength
    ) {
      return { valid: false, error: `${field} exceeds maximum length` };
    }
  }

  return { valid: true, error: null };
}

/**
 * Create a new vibe
 * @param {Object} vibeData - Vibe data object
 * @returns {Promise<{data: Object|null, error: Error|null, userMessage: string|null}>}
 */
export async function createVibe(vibeData) {
  try {
    const validation = validateVibeData(vibeData);
    if (!validation.valid) {
      log.error("Vibe validation failed:", validation.error);
      return {
        data: null,
        error: new Error(validation.error),
        userMessage: "Invalid vibe data. Please try again.",
      };
    }

    const { data, error } = await supabase
      .from("vibes")
      .insert([vibeData])
      .select(VIBE_SELECT_FIELDS)
      .single();

    if (error) {
      const isRateLimitError =
        error.message?.includes("RATE_LIMIT_EXCEEDED") ||
        (error.code === "23505" && error.message?.includes("Rate limit exceeded"));

      if (isRateLimitError) {
        log.info("Rate limit exceeded for vibe creation:", {
          venue_id: vibeData.venue_id,
        });
        return {
          data: null,
          error,
          userMessage: "You've posted recently for this venue — try again in ~60 minutes.",
        };
      }

      log.error("Error creating vibe:", error);

      if (
        error.code === "42501" ||
        error.code === "PGRST301" ||
        error.message?.includes("permission denied")
      ) {
        return {
          data: null,
          error,
          userMessage: "Please sign in to post a vibe.",
        };
      }

      return { data: null, error, userMessage: null };
    }

    log.log("Vibe created successfully");
    return { data, error: null, userMessage: null };
  } catch (error) {
    const isRateLimitError =
      error.message?.includes("RATE_LIMIT_EXCEEDED") ||
      error.message?.includes("Rate limit exceeded");

    if (isRateLimitError) {
      log.info("Rate limit exceeded (exception) for vibe creation");
      return {
        data: null,
        error,
        userMessage: "You've posted recently for this venue — try again in ~60 minutes.",
      };
    }

    log.error("Exception creating vibe:", error);
    return { data: null, error, userMessage: null };
  }
}
