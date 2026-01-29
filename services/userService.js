import { supabase } from "../utils/supabase";
import logger from "../utils/logger";
import { getLevelFromPoints } from "../utils/profileHelpers";

const log = logger.tag("UserService");

/**
 * Get user points and stats
 */
export async function getUserPoints(userId) {
  try {
    if (!userId) {
      return { data: null, error: { message: "User ID required" } };
    }

    const { data, error } = await supabase
      .from("user_points")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      log.error("Get points error:", error);
      return { data: null, error };
    }

    // Return default if no record exists yet
    if (!data) {
      return {
        data: {
          user_id: userId,
          total_points: 0,
          checkin_count: 0,
          vibe_count: 0,
        },
        error: null,
      };
    }

    return { data, error: null };
  } catch (error) {
    log.error("Unexpected error:", error);
    return { data: null, error };
  }
}

/**
 * Get user check-ins
 * @param {string} userId - User ID
 * @param {number} limit - Max number of check-ins to fetch (default: 100)
 * @returns {Promise<{data: Array, error: Object|null}>}
 */
export async function getUserCheckIns(userId, limit = 100) {
  try {
    if (!userId) {
      return { data: [], error: null };
    }

    const { data, error } = await supabase
      .from("check_ins")
      .select("id, venue_id, created_at, line_wait, crowd_level")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      log.error("Error fetching user check-ins:", error);
      return { data: [], error };
    }

    return { data: data || [], error: null };
  } catch (error) {
    log.error("Unexpected error:", error);
    return { data: [], error };
  }
}

/**
 * Get comprehensive user stats for profile page
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Stats object
 */
export async function getUserStats(userId) {
  try {
    if (!userId) {
      return {
        vibeCount: 0,
        checkInCount: 0,
        streak: 0,
        nightsOut: 0,
        points: 0,
        level: 1,
        uniqueNeighborhoods: 0,
        uniqueMusicTypes: 0,
        weekendStreak: 0,
        userRank: 9999,
      };
    }

    // Fetch vibes and check-ins in parallel
    const [vibesResult, checkInsResult] = await Promise.all([
      supabase
        .from("vibes")
        .select("venue_id, music, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("check_ins")
        .select("venue_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ]);

    // Check for errors in parallel queries
    if (vibesResult.error) {
      log.error("Error fetching vibes for stats:", vibesResult.error);
    }
    if (checkInsResult.error) {
      log.error("Error fetching check-ins for stats:", checkInsResult.error);
    }

    // Safely extract data with fallback to empty arrays
    const vibes = vibesResult?.data || [];
    const checkIns = checkInsResult?.data || [];

    // Calculate unique neighborhoods (need venue data)
    const venueIds = [...new Set([...vibes.map(v => v.venue_id), ...checkIns.map(c => c.venue_id)])];
    let uniqueNeighborhoods = 0;
    if (venueIds.length > 0) {
      const { data: venues } = await supabase
        .from("venues")
        .select("neighborhood")
        .in("id", venueIds);
      
      if (venues) {
        uniqueNeighborhoods = new Set(venues.map(v => v.neighborhood)).size;
      }
    }

    // Calculate unique music types
    const uniqueMusicTypes = new Set(vibes.filter(v => v.music).map(v => v.music)).size;

    // Calculate streak (simplified - consecutive days with any activity)
    const allActivities = [
      ...vibes.map(v => ({ created_at: v.created_at, type: 'vibe' })),
      ...checkIns.map(c => ({ created_at: c.created_at, type: 'checkin' })),
    ];
    
    let streak = 0;
    if (allActivities.length > 0) {
      const sorted = allActivities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      let currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);
      
      for (const activity of sorted) {
        const activityDate = new Date(activity.created_at);
        activityDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor((currentDate - activityDate) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === streak) {
          streak++;
          currentDate = new Date(activityDate);
        } else if (daysDiff > streak) {
          break;
        }
      }
    }

    // Calculate nights out (unique dates)
    const uniqueDates = new Set();
    for (const checkIn of checkIns) {
      const date = new Date(checkIn.created_at);
      date.setHours(0, 0, 0, 0);
      uniqueDates.add(date.toISOString());
    }
    const nightsOut = uniqueDates.size;

    // Calculate points
    const points = checkIns.length * 1 + vibes.length * 3;

    // Calculate level from points
    const levelInfo = getLevelFromPoints(points);

    // Get user rank (simplified - count users with more points)
    // This is a simplified version; in production, you'd want a more efficient query
    const { count: totalUsers } = await supabase
      .from("vibes")
      .select("user_id", { count: "exact", head: true });
    
    // For MVP, we'll estimate rank based on points
    // In production, you'd query a user_points table or calculate this server-side
    const userRank = 9999; // Placeholder

    return {
      vibeCount: vibes.length,
      checkInCount: checkIns.length,
      streak,
      nightsOut,
      points,
      level: levelInfo.level,
      uniqueNeighborhoods,
      uniqueMusicTypes,
      weekendStreak: 0, // Placeholder - would need to calculate weekend check-ins
      userRank,
    };
  } catch (error) {
    log.error("Error fetching user stats:", error);
    return {
      vibeCount: 0,
      checkInCount: 0,
      streak: 0,
      nightsOut: 0,
      points: 0,
      level: 1,
      uniqueNeighborhoods: 0,
      uniqueMusicTypes: 0,
      weekendStreak: 0,
      userRank: 9999,
    };
  }
}

/**
 * Get user profile (username, etc)
 */
export async function getUserProfile(userId) {
  try {
    if (!userId) {
      return { data: null, error: { message: "User ID required" } };
    }

    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("[UserService] Get profile error:", error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error("[UserService] Unexpected error:", error);
    return { data: null, error };
  }
}