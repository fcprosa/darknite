import { supabase } from "../utils/supabase";

function resolvePlaceId(placeIdOrVenueId) {
  if (!placeIdOrVenueId) return null;
  return String(placeIdOrVenueId);
}

function placeIdOrFilter(placeId) {
  const id = String(placeId).replace(/"/g, '\\"');
  return `place_id.eq."${id}",venue_id.eq."${id}"`;
}

/**
 * Create a check-in for a user at a place (Google place_id in v2).
 * Accepts placeId or legacy venueId param (same value).
 */
export async function createCheckIn({
  userId,
  venueId,
  placeId,
  lineWait = null,
  crowdLevel = null,
}) {
  try {
    const key = resolvePlaceId(placeId || venueId);
    if (!userId || !key) {
      return { data: null, error: { message: "User ID and place ID are required" } };
    }

    const { data: recentCheckIn, error: checkError } = await supabase
      .from("check_ins")
      .select("id, created_at")
      .eq("user_id", userId)
      .or(placeIdOrFilter(key))
      .gte("created_at", new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString())
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      console.error("[CheckIn] Error checking recent check-in:", checkError);
      return { data: null, error: checkError };
    }

    if (recentCheckIn) {
      const minutesAgo = Math.floor(
        (Date.now() - new Date(recentCheckIn.created_at).getTime()) / 60000
      );
      return {
        data: null,
        error: {
          message: "RATE_LIMIT_EXCEEDED",
          userMessage: `You already checked in here ${minutesAgo} minutes ago. Try again later.`,
        },
      };
    }

    const insertData = {
      user_id: userId,
      place_id: key,
      venue_id: null,
    };

    if (lineWait) {
      insertData.line_wait = lineWait;
    } else if (crowdLevel) {
      insertData.crowd_level = crowdLevel;
    }

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

export async function getCheckInCount(placeIdOrVenueId, minutes = 60) {
  try {
    const key = resolvePlaceId(placeIdOrVenueId);
    if (!key) {
      return { count: 0, error: null };
    }

    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000).toISOString();

    const { count, error } = await supabase
      .from("check_ins")
      .select("id", { count: "exact", head: true })
      .or(placeIdOrFilter(key))
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

export async function getUserRecentCheckIns(userId, minutes = 30) {
  try {
    if (!userId) {
      return { data: [], error: null };
    }

    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("check_ins")
      .select("id, place_id, venue_id, created_at, line_wait, crowd_level")
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

export async function getUserRecentCheckInForVenue(
  userId,
  placeIdOrVenueId,
  minutes = 60
) {
  try {
    const key = resolvePlaceId(placeIdOrVenueId);
    if (!userId || !key) {
      return { data: null, error: null };
    }

    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("check_ins")
      .select("id, place_id, venue_id, created_at, line_wait, crowd_level")
      .eq("user_id", userId)
      .or(placeIdOrFilter(key))
      .gte("created_at", cutoffTime)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[CheckIn] Recent check-in for place error:", error);
      return { data: null, error };
    }

    return { data: data || null, error: null };
  } catch (error) {
    console.error("[CheckIn] Unexpected error:", error);
    return { data: null, error };
  }
}

export async function getLatestLineWait(placeIdOrVenueId, minutes = 120) {
  try {
    const key = resolvePlaceId(placeIdOrVenueId);
    if (!key) {
      return { data: null, error: null };
    }

    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("check_ins")
      .select("line_wait, created_at")
      .or(placeIdOrFilter(key))
      .not("line_wait", "is", null)
      .ilike("line_wait", "%min%")
      .gte("created_at", cutoffTime)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("[CheckIn] Error fetching latest line wait:", error);
      return { data: null, error };
    }

    return { data: data || null, error: null };
  } catch (error) {
    console.error("[CheckIn] Unexpected error in getLatestLineWait:", error);
    return { data: null, error };
  }
}

export async function getRecentCheckIns(placeIdOrVenueId, hours = 24, limit = 10) {
  try {
    const key = resolvePlaceId(placeIdOrVenueId);
    if (!key) {
      return { data: [], error: null };
    }

    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("check_ins")
      .select("id, place_id, venue_id, created_at, line_wait, crowd_level")
      .or(placeIdOrFilter(key))
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

export async function getLatestBarCrowdCheckIn(
  placeIdOrVenueId,
  windowMinutes = 240
) {
  try {
    const key = resolvePlaceId(placeIdOrVenueId);
    if (!key) {
      return { data: null, error: null };
    }

    const cutoffTime = new Date(
      Date.now() - windowMinutes * 60 * 1000
    ).toISOString();

    const { data, error } = await supabase
      .from("check_ins")
      .select("crowd_level, created_at")
      .or(placeIdOrFilter(key))
      .not("crowd_level", "is", null)
      .gte("created_at", cutoffTime)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("[CheckIn] Error fetching latest bar crowd check-in:", error);
      return { data: null, error };
    }

    return { data: data || null, error: null };
  } catch (error) {
    console.error("[CheckIn] Unexpected error in getLatestBarCrowdCheckIn:", error);
    return { data: null, error };
  }
}
