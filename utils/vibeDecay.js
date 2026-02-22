/**
 * vibeDecay.js
 * 
 * Client-side vibe decay weight and active flag logic.
 * Determines if a vibe is still "active" and calculates its visual weight.
 * 
 * Active window: 90 minutes
 * Weight decay:
 * - 0-15 min: 1.0 (full weight)
 * - 15-30 min: 0.85
 * - 30-60 min: 0.65
 * - 60-90 min: 0.40
 * - >90 min: 0 (inactive)
 */

const DECAY_WINDOW_MS = 90 * 60 * 1000; // 90 minutes

/**
 * Check if a vibe is active (posted within last 90 minutes)
 * @param {string|null} createdAt - ISO timestamp string
 * @returns {boolean} True if vibe is active
 */
export function isVibeActive(createdAt) {
  if (!createdAt) return false;
  
  const now = Date.now();
  const then = new Date(createdAt).getTime();
  
  // Handle invalid date
  if (isNaN(then)) return false;
  
  // Handle future timestamp (clock skew) - treat as active
  if (then > now) return true;
  
  const age = now - then;
  return age < DECAY_WINDOW_MS;
}

/**
 * Get the visual weight of a vibe based on its age.
 * Used for border opacity, glow intensity, etc.
 * @param {string|null} createdAt - ISO timestamp string
 * @returns {number} Weight between 0.0 and 1.0
 */
export function getVibeWeight(createdAt) {
  if (!createdAt) return 0;
  
  const now = Date.now();
  const then = new Date(createdAt).getTime();
  
  // Handle invalid date
  if (isNaN(then)) return 0;
  
  // Handle future timestamp (clock skew) - clamp to 1.0
  if (then > now) return 1.0;
  
  const ageMin = (now - then) / 60000;
  
  if (ageMin <= 15) return 1.0;
  if (ageMin <= 30) return 0.85;
  if (ageMin <= 60) return 0.65;
  if (ageMin <= 90) return 0.40;
  
  return 0;
}

/**
 * Get border opacity based on vibe freshness.
 * Fine-grained decay for visual distinction between fresh and stale vibes.
 * @param {string|null} createdAt - ISO timestamp string
 * @returns {number} Opacity between 0.0 and 1.0
 */
export function getBorderOpacity(createdAt) {
  if (!createdAt) return 0;

  const now = Date.now();
  const then = new Date(createdAt).getTime();

  if (isNaN(then)) return 0;
  if (then > now) return 1.0;

  const ageMin = (now - then) / 60000;

  if (ageMin <= 10) return 1.0;
  if (ageMin <= 20) return 0.85;
  if (ageMin <= 30) return 0.70;
  if (ageMin <= 45) return 0.50;
  if (ageMin <= 60) return 0.30;
  if (ageMin <= 90) return 0.15;
  return 0; // expired — no border
}

/**
 * Get the age of a vibe in minutes
 * @param {string|null} createdAt - ISO timestamp string
 * @returns {number|null} Age in minutes, or null if invalid
 */
export function getVibeAgeMinutes(createdAt) {
  if (!createdAt) return null;
  
  const now = Date.now();
  const then = new Date(createdAt).getTime();
  
  if (isNaN(then)) return null;
  if (then > now) return 0; // Future timestamp = 0 minutes old
  
  return Math.floor((now - then) / 60000);
}

/**
 * Live for UI highlight: vibe updated within last 5 minutes.
 * Used for yellow border only. Separate from isVibeActive (90 min).
 * @param {string|null} createdAt - ISO timestamp string
 * @returns {boolean} True if vibe is live for border highlight
 */
export function isVibeLiveForBorder(createdAt) {
  if (!createdAt) return false;
  const ageMs = Date.now() - new Date(createdAt).getTime();
  if (isNaN(ageMs)) return false;
  if (ageMs < 0) return true; // Future timestamp = treat as live
  return ageMs < 5 * 60 * 1000; // 5 minutes
}
