import { supabase } from "../utils/supabase";
import logger from "../utils/logger";

const log = logger.tag("MoveService");

/**
 * Create a new move (user intent declaration)
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {string} params.venueId - Venue ID
 * @param {string} params.timeBand - One of: 'early', 'prime', 'late', 'spontaneous'
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export async function createMove({ userId, venueId, timeBand }) {
  try {
    if (!userId || !venueId || !timeBand) {
      const error = { message: "User ID, Venue ID, and time band are required" };
      log.error("Invalid params:", { userId: !!userId, venueId: !!venueId, timeBand: !!timeBand });
      return { data: null, error };
    }

    // Validate time band
    const validTimeBands = ["early", "prime", "late", "spontaneous"];
    if (!validTimeBands.includes(timeBand)) {
      const error = { message: `Invalid time band. Must be one of: ${validTimeBands.join(", ")}` };
      log.error("Invalid time band:", timeBand);
      return { data: null, error };
    }

    // Cancel any existing active move for this user
    const { error: cancelError } = await supabase
      .from("moves")
      .update({ status: "canceled" })
      .eq("user_id", userId)
      .eq("status", "active");

    if (cancelError) {
      log.error("Error canceling existing moves:", cancelError);
      // Continue anyway - not critical
    }

    // Create new move
    const { data, error } = await supabase
      .from("moves")
      .insert({
        user_id: userId,
        venue_id: venueId,
        time_band: timeBand,
        status: "active",
        expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 hours from now
      })
      .select()
      .single();

    if (error) {
      log.error("Error creating move:", error);
      return { data: null, error };
    }

    log.info("Move created:", data.id);
    return { data, error: null };
  } catch (error) {
    log.error("Unexpected error creating move:", error);
    return { data: null, error };
  }
}

/**
 * Get move counts for all venues (batch query)
 * Returns a map: { venueId: count }
 * @returns {Promise<{data: Object, error: Object|null}>}
 */
export async function getMoveCounts() {
  try {
    const now = new Date().toISOString();

    // Fetch all active moves that haven't expired
    const { data, error } = await supabase
      .from("moves")
      .select("venue_id")
      .eq("status", "active")
      .gte("expires_at", now);

    if (error) {
      log.error("Error fetching move counts:", error);
      return { data: {}, error };
    }

    // Aggregate counts client-side
    // Normalize venue_id to string to match getVenueKeySafe format
    const counts = {};
    for (const row of data || []) {
      const venueKey = String(row.venue_id); // Normalize to string for consistency
      counts[venueKey] = (counts[venueKey] || 0) + 1;
    }

    return { data: counts, error: null };
  } catch (error) {
    log.error("Unexpected error fetching move counts:", error);
    return { data: {}, error };
  }
}

/**
 * Get active move counts for multiple venues.
 * Returns a map: { venueId: count }
 * @param {string[]} venueIds - array of venue IDs
 * @returns {Object} { venueId: number }
 */
export async function getActiveMoveCounts(venueIds) {
  try {
    if (!venueIds || venueIds.length === 0) return {};

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("moves")
      .select("venue_id")
      .in("venue_id", venueIds)
      .eq("status", "active")
      .gte("expires_at", now);

    if (error) {
      log.error("Error fetching active move counts:", error);
      return {};
    }

    // Count moves per venue
    // Normalize venue_id to string to match getVenueKeySafe format
    const counts = {};
    for (const move of data || []) {
      const venueKey = String(move.venue_id);
      counts[venueKey] = (counts[venueKey] || 0) + 1;
    }

    return counts;
  } catch (error) {
    log.error("Unexpected error fetching active move counts:", error);
    return {};
  }
}

/**
 * Get user's active move (if any)
 * @param {string} userId - User ID
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export async function getMyActiveMove(userId) {
  try {
    if (!userId) {
      return { data: null, error: null };
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("moves")
      .select("id, venue_id, time_band, created_at, expires_at")
      .eq("user_id", userId)
      .eq("status", "active")
      .gte("expires_at", now)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      // PGRST116 means no rows found, which is fine
      log.error("Error fetching active move:", error);
      return { data: null, error };
    }

    return { data: data || null, error: null };
  } catch (error) {
    log.error("Unexpected error fetching active move:", error);
    return { data: null, error };
  }
}

/**
 * Cancel user's active move
 * @param {string} userId - User ID
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export async function cancelMyMove(userId) {
  try {
    if (!userId) {
      return { data: null, error: { message: "User ID is required" } };
    }

    const { data, error } = await supabase
      .from("moves")
      .update({ status: "canceled" })
      .eq("user_id", userId)
      .eq("status", "active")
      .select()
      .limit(1)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      log.error("Error canceling move:", error);
      return { data: null, error };
    }

    return { data: data || null, error: null };
  } catch (error) {
    log.error("Unexpected error canceling move:", error);
    return { data: null, error };
  }
}
