/**
 * feedRanker.js
 *
 * Weighted ranking for venues based on vibe recency, volume, trend, and proximity.
 * Active venues (per isVibeActive) always rank above inactive ones.
 */

import { isVibeActive, getVibeAgeMinutes } from "./vibeDecay";

/**
 * Compute distance between two lat/lng pairs using the Haversine formula.
 * Returns distance in kilometers.
 */
export function haversineKm(lat1, lon1, lat2, lon2) {
  if (
    lat1 == null ||
    lon1 == null ||
    lat2 == null ||
    lon2 == null
  ) {
    return null;
  }

  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Rank a venue for feed ordering.
 *
 * @param {Object} venue
 * @param {string|null} venue.latest_update_created_at - ISO timestamp of latest vibe
 * @param {number} venue.update_count_tonight - total updates tonight (0+)
 * @param {number} venue.recent_update_count - updates in last 30 minutes (0+)
 * @param {number} [venue.latitude]
 * @param {number} [venue.longitude]
 * @param {number} [userLat]
 * @param {number} [userLng]
 * @returns {number} ranking score (inactive venues return -1)
 */
export function rankVenue(
  venue,
  userLat,
  userLng
) {
  const latestTs = venue?.latest_update_created_at || null;
  const moveCountTonight = venue?.move_count_tonight || 0;

  // Inactive venues: if no moves, return -1
  if (!isVibeActive(latestTs) && moveCountTonight === 0) return -1;

  let score = 0;

  // No-vibe but moves present: don't bury it completely
  if (!isVibeActive(latestTs) && moveCountTonight >= 1) {
    score = Math.max(score, 10);
  }

  // Age component
  const ageMin = getVibeAgeMinutes(latestTs);
  if (ageMin != null) {
    if (ageMin <= 15) score += 100;
    else if (ageMin <= 30) score += 75;
    else if (ageMin <= 60) score += 50;
    else if (ageMin <= 90) score += 25;
  }

  // Volume tonight (cap at 50)
  const tonightCount = Math.max(0, venue?.update_count_tonight || 0);
  score += Math.min(tonightCount * 10, 50);

  // Trending boost: 3+ recent updates in last 30 min
  const recentCount = Math.max(0, venue?.recent_update_count || 0);
  if (recentCount >= 3) {
    score += 40;
  }

  // Move momentum (MOVE 11)
  score += Math.min(moveCountTonight * 8, 40);
  if (moveCountTonight >= 3) score += 25;

  // Proximity bonus (if user + venue coordinates available)
  if (
    userLat != null &&
    userLng != null &&
    venue?.latitude != null &&
    venue?.longitude != null
  ) {
    const dist = haversineKm(
      userLat,
      userLng,
      venue.latitude,
      venue.longitude
    );
    if (dist != null) {
      if (dist < 1) score += 30;
      else if (dist < 2) score += 15;
    }
  }

  return score;
}

