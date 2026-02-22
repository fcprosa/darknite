import { supabase } from "../utils/supabase";
import logger from "../utils/logger";

const log = logger.tag("ProfileService");

/**
 * Get user profile by user ID
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Profile object or null
 */
export async function getUserProfile(userId) {
  if (!userId) return null;
  
  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("username, preferred_scene, favorite_genres, favorite_neighborhoods, going_out_days, reminders_enabled")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      log.error("Error fetching user profile:", error.message);
      return null;
    }

    return data;
  } catch (error) {
    log.error("Exception fetching user profile:", error);
    return null;
  }
}

/**
 * Get user profile with username only (for validation)
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Profile object with username or null
 */
export async function getUserProfileUsername(userId) {
  if (!userId) return null;
  
  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("username")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      log.error("Error fetching username:", error.message);
      return null;
    }

    return data;
  } catch (error) {
    log.error("Exception fetching username:", error);
    return null;
  }
}

/**
 * Check if username is available
 * @param {string} username - Username to check
 * @returns {Promise<{available: boolean, error: string|null}>} Availability result
 */
export async function checkUsernameAvailability(username) {
  const normalized = username.trim().toLowerCase();
  
  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("username")
      .eq("username", normalized)
      .maybeSingle();

    if (error) {
      log.error("Error checking username availability:", error);
      return { available: false, error: error.message };
    }

    return { available: !data, error: null };
  } catch (error) {
    log.error("Exception checking username availability:", error);
    return { available: false, error: error.message };
  }
}

/**
 * Create user profile
 * @param {Object} profileData - Profile data object
 * @returns {Promise<{data: Object|null, error: Error|null}>} Result object
 */
export async function createProfile(profileData) {
  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .insert(profileData)
      .select()
      .single();

    if (error) {
      log.error("Error creating profile:", error);
      return { data: null, error };
    }

    log.log("Profile created successfully");
    return { data, error: null };
  } catch (error) {
    log.error("Exception creating profile:", error);
    return { data: null, error };
  }
}

/**
 * Sanitize profile data by removing null/undefined values
 * Ensures username is never null/undefined
 * @param {Object} profileData - Raw profile data
 * @returns {Object} Sanitized profile data
 */
function sanitizeProfileData(profileData) {
  const sanitized = {};
  
  for (const [key, value] of Object.entries(profileData)) {
    // Skip null and undefined values (but allow empty strings and false)
    if (value === null || value === undefined) {
      continue;
    }
    
    // Special handling for username: only include if it's a non-empty string
    if (key === "username") {
      if (typeof value === "string" && value.trim().length > 0) {
        sanitized[key] = value.trim().toLowerCase();
      }
      // Skip username if it's empty/null/undefined
      continue;
    }
    
    sanitized[key] = value;
  }
  
  return sanitized;
}

/**
 * Update user profile (upsert)
 * @param {Object} profileData - Profile data object (must include id)
 * @returns {Promise<{data: Object|null, error: Error|null}>} Result object
 */
export async function updateProfile(profileData) {
  if (!profileData || !profileData.id) {
    const error = new Error("Profile data must include id");
    log.error("Invalid profile data:", error);
    return { data: null, error };
  }

  try {
    const userId = profileData.id;
    
    // Check if profile exists
    const exists = await profileExists(userId);
    
    // Sanitize payload: remove null/undefined values
    const sanitized = sanitizeProfileData(profileData);
    
    // If profile exists, use UPDATE (safer - won't try to insert without username)
    if (exists) {
      // If username is missing from payload, fetch existing username to preserve it
      if (!sanitized.username) {
        const existingProfile = await getUserProfileUsername(userId);
        if (existingProfile?.username) {
          sanitized.username = existingProfile.username;
          log.log("Preserving existing username in update");
        } else {
          log.error("Profile exists but username is missing - cannot update without username");
          return {
            data: null,
            error: new Error("Cannot update profile: username is required"),
          };
        }
      }
      
      // Log payload (without sensitive data)
      log.log("Updating profile:", {
        id: sanitized.id,
        hasUsername: !!sanitized.username,
        fields: Object.keys(sanitized).filter(k => k !== "id" && k !== "username"),
      });
      
      const { data, error } = await supabase
        .from("user_profiles")
        .update(sanitized)
        .eq("id", userId)
        .select()
        .single();

      if (error) {
        log.error("Error updating profile:", error);
        return { data: null, error };
      }

      log.log("Profile updated successfully");
      return { data, error: null };
    } else {
      // Profile doesn't exist - this is an insert, username is REQUIRED
      if (!sanitized.username || typeof sanitized.username !== "string" || sanitized.username.trim().length === 0) {
        log.error("Cannot create profile without username");
        return {
          data: null,
          error: new Error("Cannot create profile: username is required"),
        };
      }
      
      // Log payload for insert
      log.log("Creating profile:", {
        id: sanitized.id,
        hasUsername: !!sanitized.username,
        fields: Object.keys(sanitized).filter(k => k !== "id" && k !== "username"),
      });
      
      const { data, error } = await supabase
        .from("user_profiles")
        .insert(sanitized)
        .select()
        .single();

      if (error) {
        log.error("Error creating profile:", error);
        return { data: null, error };
      }

      log.log("Profile created successfully");
      return { data, error: null };
    }
  } catch (error) {
    log.error("Exception updating profile:", error);
    return { data: null, error };
  }
}

/**
 * Check if profile exists
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if profile exists
 */
export async function profileExists(userId) {
  if (!userId) return false;

  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") { // PGRST116 = no rows returned
      log.error("Error checking profile existence:", error);
      return false;
    }

    return !!data;
  } catch (error) {
    log.error("Exception checking profile existence:", error);
    return false;
  }
}

/**
 * Check if vibe reminders are enabled for a user
 * Reads from notification_settings JSON column
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if vibe reminders are enabled (default: true)
 */
export async function areVibeRemindersEnabled(userId) {
  if (!userId) return true; // Default to enabled

  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("notification_settings")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      log.error("Error checking vibe reminders setting:", error.message);
      return true; // Default to enabled on error
    }

    // Read from notification_settings JSON, default to true if not set
    return data?.notification_settings?.vibeRemindersEnabled ?? true;
  } catch (error) {
    log.error("Exception checking vibe reminders setting:", error);
    return true; // Default to enabled on error
  }
}

