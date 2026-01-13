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
      .select("username, preferred_scene, favorite_genres, favorite_neighborhoods")
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
 * Update user profile (upsert)
 * @param {Object} profileData - Profile data object (must include id)
 * @returns {Promise<{data: Object|null, error: Error|null}>} Result object
 */
export async function updateProfile(profileData) {
  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .upsert(profileData, {
        onConflict: "id"
      })
      .select()
      .single();

    if (error) {
      log.error("Error updating profile:", error);
      return { data: null, error };
    }

    log.log("Profile updated successfully");
    return { data, error: null };
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

