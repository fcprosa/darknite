import { supabase } from "./supabase";

/**
 * Validate username format
 * Rules: 3-20 chars, lowercase only, alphanumeric + underscore
 */
export function validateUsername(username) {
  if (!username || username.trim().length === 0) {
    return { valid: false, error: "Username is required" };
  }

  const trimmed = username.trim();

  if (trimmed.length < 3) {
    return { valid: false, error: "Username must be at least 3 characters" };
  }

  if (trimmed.length > 20) {
    return { valid: false, error: "Username must be 20 characters or less" };
  }

  // Must be lowercase only
  if (trimmed !== trimmed.toLowerCase()) {
    return { valid: false, error: "Username must be lowercase only" };
  }

  // Must contain only letters, numbers, and underscore
  const validPattern = /^[a-z0-9_]+$/;
  if (!validPattern.test(trimmed)) {
    return { valid: false, error: "Username can only contain letters, numbers, and underscore" };
  }

  return { valid: true, error: null };
}

/**
 * Check if username is available (unique)
 */
export async function checkUsernameAvailability(username) {
  const normalized = username.trim().toLowerCase();
  
  const { data, error } = await supabase
    .from("user_profiles")
    .select("username")
    .eq("username", normalized)
    .maybeSingle();

  if (error) {
    console.error("[Username] Check availability error:", error);
    return { available: false, error: error.message };
  }

  return { available: !data, error: null };
}

/**
 * Suggest username variants if username is taken
 * Returns array of suggested usernames (e.g., danielrosa_2, danielrosa_3)
 */
export function suggestUsernameVariants(username) {
  const base = username.trim().toLowerCase().replace(/_\d+$/, ""); // Remove trailing _number
  const variants = [];
  
  for (let i = 2; i <= 10; i++) {
    variants.push(`${base}_${i}`);
  }
  
  return variants;
}

