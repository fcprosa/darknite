import { supabase } from "../utils/supabase";

/**
 * Create a check-in for a user at a venue
 * Awards +1 point automatically via database trigger
 *
 * For CLUBS: lineWait should be provided (e.g., "No line!", "Chill (5-15 min)", etc.)
 * For BARS: crowdLevel should be provided (e.g., "Dead", "Chill", "Buzzing", "Packed")
 */
export async function createCheckIn({ userId, venueId, lineWait = null, crowdLevel = null }) {
  try {
    if (!userId || !venueId) {
      return { data: null, error: { message: "User ID and Venue ID are required" } };
    }

    // Check for duplicate check-in (prevent spam)
    const { data: recentCheckIn, error: checkError } = await supabase
      .from("check_ins")
      .select("id, created_at")
      .eq("user_id", userId)
      .eq("venue_id", venueId)
      .gte("created_at", new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()) // Last 3 hours
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      console.error("[CheckIn] Error checking recent check-in:", checkError);
      return { data: null, error: checkError };
    }

    if (recentCheckIn) {
      const minutesAgo = Math.floor((Date.now() - new Date(recentCheckIn.created_at).getTime()) / 60000);
      return {
        data: null,
        error: {
          message: "RATE_LIMIT_EXCEEDED",
          userMessage: `You already checked in here ${minutesAgo} minutes ago. Try again later.`,
        },
      };
    }

    // Store data in correct columns based on venue type
    // For CLUBS: line_wait contains the line wait time
    // For BARS: crowd_level contains the crowd status
    const insertData = {
      user_id: userId,
      venue_id: venueId,
    };

    // Set line_wait for clubs, crowd_level for bars
    if (lineWait) {
      // Club check-in: store line wait time
      insertData.line_wait = lineWait;
    } else if (crowdLevel) {
      // Bar check-in: store crowd level
      insertData.crowd_level = crowdLevel;
    }

    // Create check-in
    const { data, error } = await supabase
      .from("check_ins")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("[CheckIn] Insert error:", error);
      return { data: null, error };
    }

    console.log("[CheckIn] Check-in created:", data.id);
    return { data, error: null };
  } catch (error) {
    console.error("[CheckIn] Unexpected error:", error);
    return { data: null, error };
  }
}

/**
 * Get check-in count for a venue in last N minutes
 */
export async function getCheckInCount(venueId, minutes = 60) {
  try {
    if (!venueId) {
      return { count: 0, error: null };
    }

    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000).toISOString();

    const { count, error } = await supabase
      .from("check_ins")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId)
      .gte("created_at", cutoffTime);

    if (error) {
      console.error("[CheckIn] Count error:", error);
      return { count: 0, error };
    }

    return { count: count || 0, error: null };
  } catch (error) {
    console.error("[CheckIn] Unexpected error:", error);
    return { count: 0, error };
  }
}

/**
 * Get user's recent check-ins (for triggering vibe reminder)
 */
export async function getUserRecentCheckIns(userId, minutes = 30) {
  try {
    if (!userId) {
      return { data: [], error: null };
    }

    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("check_ins")
      .select("id, venue_id, created_at, line_wait, crowd_level")
      .eq("user_id", userId)
      .gte("created_at", cutoffTime)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[CheckIn] Recent check-ins error:", error);
      return { data: [], error };
    }

    return { data: data || [], error: null };
  } catch (error) {
    console.error("[CheckIn] Unexpected error:", error);
    return { data: [], error };
  }
}

/**
 * Get user's most recent check-in for a specific venue
 * @param {string} userId - User ID
 * @param {string} venueId - Venue ID
 * @param {number} minutes - Time window in minutes (default: 60)
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export async function getUserRecentCheckInForVenue(userId, venueId, minutes = 60) {
  try {
    if (!userId || !venueId) {
      return { data: null, error: null };
    }

    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("check_ins")
      .select("id, venue_id, created_at, line_wait, crowd_level")
      .eq("user_id", userId)
      .eq("venue_id", venueId)
      .gte("created_at", cutoffTime)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[CheckIn] Recent check-in for venue error:", error);
      return { data: null, error };
    }

    return { data: data || null, error: null };
  } catch (error) {
    console.error("[CheckIn] Unexpected error:", error);
    return { data: null, error };
  }
}

/**
 * Get the latest line wait time for a club venue from check_ins
 * Filters for valid line strings (contains "min" or matches expected buckets)
 * @param {string} venueId - Venue ID
 * @param {number} minutes - Time window in minutes (default: 120, i.e., 2 hours)
 * @returns {Promise<{data: {line_wait: string, created_at: string}|null, error: Object|null}>}
 */
export async function getLatestLineWait(venueId, minutes = 120) {
  try {
    if (!venueId) {
      return { data: null, error: null };
    }

    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000).toISOString();

    // Fetch latest valid line wait for clubs
    // Filter: line_wait IS NOT NULL AND contains "min" (or matches expected patterns)
    const { data, error } = await supabase
      .from("check_ins")
      .select("line_wait, created_at")
      .eq("venue_id", venueId)
      .not("line_wait", "is", null)
      .ilike("line_wait", "%min%") // Matches "0–5 min", "5–15 min", "30+ min", etc.
      .gte("created_at", cutoffTime)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      // PGRST116 means no rows found, which is fine
      console.error("[CheckIn] Error fetching latest line wait:", error);
      return { data: null, error };
    }

    return { data: data || null, error: null };
  } catch (error) {
    console.error("[CheckIn] Unexpected error in getLatestLineWait:", error);
    return { data: null, error };
  }
}

/**
 * Get recent check-ins for a venue (for Recent Vibes section)
 * Returns check-ins from the last N hours
 * @param {string} venueId - Venue ID
 * @param {number} hours - Time window in hours (default: 24)
 * @param {number} limit - Max number of check-ins to return (default: 10)
 * @returns {Promise<{data: Array, error: Object|null}>}
 */
export async function getRecentCheckIns(venueId, hours = 24, limit = 10) {
  try {
    if (!venueId) {
      return { data: [], error: null };
    }

    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("check_ins")
      .select("id, venue_id, created_at, line_wait, crowd_level")
      .eq("venue_id", venueId)
      .gte("created_at", cutoffTime)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[CheckIn] Recent check-ins error:", error);
      return { data: [], error };
    }

    return { data: data || [], error: null };
  } catch (error) {
    console.error("[CheckIn] Unexpected error in getRecentCheckIns:", error);
    return { data: [], error };
  }
}

/**
 * Get the latest bar crowd check-in for a venue
 * Used for displaying headline badge on bar venue cards
 * @param {string} venueId - Venue ID
 * @param {number} windowMinutes - Time window in minutes (default: 240, i.e., 4 hours)
 * @returns {Promise<{data: {crowd_level: string, created_at: string}|null, error: Object|null}>}
 */
export async function getLatestBarCrowdCheckIn(venueId, windowMinutes = 240) {
  try {
    if (!venueId) {
      return { data: null, error: null };
    }

    const cutoffTime = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

    // Fetch latest check-in with crowd_level for bars
    // Filter: crowd_level IS NOT NULL
    const { data, error } = await supabase
      .from("check_ins")
      .select("crowd_level, created_at")
      .eq("venue_id", venueId)
      .not("crowd_level", "is", null)
      .gte("created_at", cutoffTime)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      // PGRST116 means no rows found, which is fine
      console.error("[CheckIn] Error fetching latest bar crowd check-in:", error);
      return { data: null, error };
    }

    return { data: data || null, error: null };
  } catch (error) {
    console.error("[CheckIn] Unexpected error in getLatestBarCrowdCheckIn:", error);
    return { data: null, error };
  }
}
