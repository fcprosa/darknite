import { supabase } from "../utils/supabase";
import { Alert } from "react-native";
import logger from "../utils/logger";
import * as CONSTANTS from "../constants";

const log = logger.tag("VibeService");

/**
 * Defensively attach is_verified flag from user_profiles join to vibe object.
 * Ensures is_verified is always a boolean (defaults to false if missing/null).
 * This prevents ranking score calculation from breaking on null/undefined values.
 * 
 * @param {Object|null} vibe - Vibe object (may have user_profiles nested object)
 * @returns {void} Mutates vibe in place
 */
function attachProfileVerified(vibe) {
  if (!vibe || typeof vibe !== "object") return;
  
  // Handle nested user_profiles object from Supabase join
  // Supabase returns joined tables with the table name as the key
  if (vibe.user_profiles && typeof vibe.user_profiles === "object") {
    vibe.is_verified = vibe.user_profiles.is_verified === true;
    // Clean up nested user_profiles object (no longer needed)
    delete vibe.user_profiles;
  } else {
    // Default to false if user_profiles join failed or is_verified is missing/null
    vibe.is_verified = false;
  }
  
  // Ensure is_verified is always a boolean (defensive check)
  if (typeof vibe.is_verified !== "boolean") {
    vibe.is_verified = false;
  }
}

// ✅ Single source of truth for vibe fields (matches database-schema.md)
// Includes user_profiles join for is_verified flag (defensively handled)
const VIBE_SELECT_FIELDS =
  "id, created_at, place_id, venue_id, user_id, crowd, ratio, line, cover, music, bar_type, drinks_price_tier, age_range, crowd_vibe, confidence_score, verified, user_profiles!user_id(is_verified)";

/** Resolve v2 Google place_id from vibe payload (PostVibe may send venue_id alias). */
function resolvePlaceId(vibeOrKey) {
  if (!vibeOrKey) return null;
  if (typeof vibeOrKey === "string") return vibeOrKey;
  return vibeOrKey.place_id || vibeOrKey.venue_id || null;
}

/** PostgREST filter: match place_id or legacy venue_id for the same key. */
function placeIdOrFilter(placeId) {
  const id = String(placeId).replace(/"/g, '\\"');
  return `place_id.eq."${id}",venue_id.eq."${id}"`;
}

/**
 * Fetch the latest vibe for a venue with retry logic
 * @param {string} venueKey - Venue ID
 * @param {Object} options - Configuration options
 * @param {boolean} options.showError - Show Alert on failure (default: false)
 * @param {number} options.retries - Number of retry attempts (default: 1)
 * @param {string} options.selectFields - Custom select fields (optional)
 * @returns {Promise<Object|null>} Latest vibe data or null
 */
/**
 * Fetch recent vibes for a Google place_id (v2).
 * @param {string} placeId - Google Places place_id
 * @param {Object} options - { hours, limit }
 */
export async function getVibesByPlaceId(placeId, options = {}) {
  const { hours = 12, limit = 20 } = options;

  if (!placeId || typeof placeId !== "string") {
    return [];
  }

  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  try {
    const { data, error } = await supabase
      .from("vibes")
      .select(VIBE_SELECT_FIELDS)
      .or(placeIdOrFilter(placeId))
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      log.error("Error fetching vibes by place_id:", error.message);
      return [];
    }

    if (data && Array.isArray(data)) {
      data.forEach(attachProfileVerified);
    }
    return data || [];
  } catch (error) {
    log.error("Exception fetching vibes by place_id:", error);
    return [];
  }
}

/**
 * Batch aggregate vibe counts (and latest vibe) per place_id for map markers.
 * @param {string[]} placeIds - Google place_ids
 * @returns {Promise<Object>} { [placeId]: { count, latestVibe } }
 */
export async function getAggregatedVibesByPlaceIds(placeIds) {
  if (!placeIds?.length) return {};

  const validIds = [...new Set(placeIds.filter(Boolean).map(String))];
  if (validIds.length === 0) return {};

  const hoursAgo = 12;
  const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
  const CHUNK_SIZE = 50;
  const result = {};
  validIds.forEach((id) => {
    result[id] = { count: 0, latestVibe: null };
  });

  try {
    for (let i = 0; i < validIds.length; i += CHUNK_SIZE) {
      const chunk = validIds.slice(i, i + CHUNK_SIZE);
      const orFilter = chunk.map((id) => placeIdOrFilter(id)).join(",");

      const { data, error } = await supabase
        .from("vibes")
        .select(VIBE_SELECT_FIELDS)
        .or(orFilter)
        .gte("created_at", since)
        .order("created_at", { ascending: false });

      if (error) {
        log.error("Error fetching aggregated vibes chunk:", error.message);
        continue;
      }

      if (!data?.length) continue;

      for (const vibe of data) {
        attachProfileVerified(vibe);
        const key =
          vibe.place_id && result[vibe.place_id] !== undefined
            ? vibe.place_id
            : vibe.venue_id && result[vibe.venue_id] !== undefined
              ? vibe.venue_id
              : null;
        if (!key) continue;

        result[key].count += 1;
        if (!result[key].latestVibe) {
          result[key].latestVibe = vibe;
        }
      }
    }

    return result;
  } catch (error) {
    log.error("Exception in getAggregatedVibesByPlaceIds:", error);
    return result;
  }
}

export async function getLatestVibe(venueKey, options = {}) {
  const { showError = false, retries = 1, selectFields } = options;

  const placeKey = resolvePlaceId(venueKey);
  if (!placeKey || typeof placeKey !== "string") {
    log.error("Invalid place key:", venueKey);
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
        .or(placeIdOrFilter(placeKey))
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
        if (data) attachProfileVerified(data);
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

      if (data && Array.isArray(data)) {
        data.forEach(attachProfileVerified);
      }
      return data || [];
    } catch (error) {
      log.error("Exception fetching recent vibes (hot now):", error);
      return [];
    }
  }

  // Venue-specific mode
  const placeKey = resolvePlaceId(venueKeyOrOptions);
  if (!placeKey || typeof placeKey !== "string") return [];

  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  try {
    const { data, error } = await supabase
      .from("vibes")
      .select(VIBE_SELECT_FIELDS)
      .or(placeIdOrFilter(placeKey))
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20);

      if (error) {
        log.error("Error fetching recent vibes (venue):", error.message);
        return [];
      }

      if (data && Array.isArray(data)) {
        data.forEach(attachProfileVerified);
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

      if (data && Array.isArray(data)) {
        data.forEach(attachProfileVerified);
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
  const aggregated = await getAggregatedVibesByPlaceIds(venueIds);
  const allVibesMap = {};
  for (const [placeId, entry] of Object.entries(aggregated)) {
    if (entry.latestVibe) {
      allVibesMap[placeId] = entry.latestVibe;
    }
  }
  log.log(
    `getLatestVibesBatch: ${Object.keys(allVibesMap).length} places from ${venueIds?.length || 0} ids`
  );
  return allVibesMap;
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

      if (data && Array.isArray(data)) {
        data.forEach(attachProfileVerified);
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
 * Check if a user has submitted a vibe for a venue tonight (last 8 hours).
 * Used to toggle CTA between "I'm here" and "Update Vibe".
 * @param {string} userId - User ID
 * @param {string} venueId - Venue ID
 * @returns {Promise<boolean>}
 */
export async function hasUserVibeTonight(userId, venueId) {
  const placeId = resolvePlaceId(venueId);
  if (!userId || !placeId) return false;

  try {
    const windowStart = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from("vibes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .or(placeIdOrFilter(placeId))
      .gte("created_at", windowStart);

    if (error) {
      log.error("Error checking user vibe tonight:", error.message);
      return false;
    }
    return (count || 0) > 0;
  } catch (error) {
    log.error("Exception checking user vibe tonight:", error);
    return false;
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

  const placeId = resolvePlaceId(vibeData);
  if (!placeId || typeof placeId !== "string") {
    return { valid: false, error: "place_id is required and must be a string" };
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
 * Fetch a single vibe by ID with user_profiles join for is_verified
 * Used by realtime handler to get full vibe data after INSERT event
 * @param {number|string} vibeId - Vibe ID
 * @returns {Promise<Object|null>} Full vibe object with is_verified or null
 */
export async function fetchVibeWithProfile(vibeId) {
  if (!vibeId) return null;

  try {
    const { data, error } = await supabase
      .from("vibes")
      .select(VIBE_SELECT_FIELDS)
      .eq("id", vibeId)
      .maybeSingle();

    if (error) {
      log.error("Error fetching vibe with profile:", error.message);
      return null;
    }

    if (data) {
      attachProfileVerified(data);
    }

    return data || null;
  } catch (error) {
    log.error("Exception fetching vibe with profile:", error);
    return null;
  }
}

/**
 * Create a new vibe via the server-side submit_venue_vibe RPC.
 *
 * The RPC enforces two rate limits (30-min per-venue, 15/12h global) and
 * handles the upsert internally, so the client only sends data and reads the
 * result.
 *
 * Return shape:
 *   { data, error, userMessage, rateLimitType, minutesRemaining }
 *
 *   rateLimitType: 'venue' | 'global' | null
 *   minutesRemaining: number (only set when rateLimitType === 'venue')
 *
 * @param {Object} vibeData - Vibe data object
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
        rateLimitType: null,
        minutesRemaining: null,
      };
    }

    const placeId = resolvePlaceId(vibeData);

    const { data: rpcResult, error } = await supabase.rpc(
      "submit_venue_vibe",
      {
        p_place_id:          placeId,
        p_crowd:             vibeData.crowd             ?? null,
        p_music:             vibeData.music             ?? null,
        p_line:              vibeData.line              ?? null,
        p_cover:             vibeData.cover             ?? null,
        p_drinks_price_tier: vibeData.drinks_price_tier ?? null,
        p_crowd_vibe:        vibeData.crowd_vibe        ?? null,
        p_age_range:         vibeData.age_range         ?? null,
        p_confidence_score:  vibeData.confidence_score  ?? null,
      }
    );

    if (error) {
      // ── Rate limit: global speed limit (any venue, 10 min) ──
      if (error.code === "P0001" && error.message === "rate_limit_speed") {
        const match = error.details?.match(/minutes_remaining=(\d+)/);
        const minutesRemaining = match ? parseInt(match[1], 10) : 10;
        log.info("Global speed limit hit:", { minutesRemaining });
        return {
          data: null,
          error,
          userMessage: null,
          rateLimitType: "speed",
          minutesRemaining,
        };
      }

      // ── Rate limit: per-venue cooldown ──
      if (error.code === "P0001" && error.message === "rate_limit_venue") {
        const match = error.details?.match(/minutes_remaining=(\d+)/);
        const minutesRemaining = match ? parseInt(match[1], 10) : 30;
        log.info("Per-place rate limit hit:", { place_id: placeId, minutesRemaining });
        return {
          data: null,
          error,
          userMessage: null,
          rateLimitType: "venue",
          minutesRemaining,
        };
      }

      // ── Rate limit: global nightly cap ──
      if (error.code === "P0001" && error.message === "rate_limit_global") {
        log.info("Global rate limit hit for user");
        return {
          data: null,
          error,
          userMessage: null,
          rateLimitType: "global",
          minutesRemaining: null,
        };
      }

      // ── Auth error ──
      if (
        error.code === "42501" ||
        error.code === "PGRST301" ||
        error.message?.includes("permission denied") ||
        error.message?.includes("Authentication required")
      ) {
        return {
          data: null,
          error,
          userMessage: "Please sign in to post a vibe.",
          rateLimitType: null,
          minutesRemaining: null,
        };
      }

      log.error("Error from submit_venue_vibe RPC:", error);
      return {
        data: null,
        error,
        userMessage: null,
        rateLimitType: null,
        minutesRemaining: null,
      };
    }

    // RPC returns SETOF vibes — take first row
    const rawVibe = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;

    if (!rawVibe) {
      log.warn("submit_venue_vibe returned no rows — treating as success with null data");
      return { data: null, error: null, userMessage: null, rateLimitType: null, minutesRemaining: null };
    }

    attachProfileVerified(rawVibe);
    log.log("Vibe submitted via RPC, id:", rawVibe.id);

    return { data: rawVibe, error: null, userMessage: null, rateLimitType: null, minutesRemaining: null };
  } catch (err) {
    log.error("Exception in createVibe:", err);
    return {
      data: null,
      error: err,
      userMessage: null,
      rateLimitType: null,
      minutesRemaining: null,
    };
  }
}
