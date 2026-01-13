import { CROWD_SCORES, HOTNESS_THRESHOLDS, HOTNESS_SCORE_WEIGHTS } from "../constants";

/**
 * Calculate hotness score for ranking venues in feed
 * @param {Object} latestVibe - Latest vibe data for the venue
 * @returns {number} - Hotness score (higher = hotter)
 */
export function getHotnessScore(latestVibe) {
  if (!latestVibe || !latestVibe.created_at) {
    return -1000; // Place venues without vibes at bottom
  }

  let score = 0;

  // Recency: newer vibes rank higher
  const now = new Date();
  const vibeTime = new Date(latestVibe.created_at);
  const diffMs = now - vibeTime;
  const diffHours = diffMs / (1000 * 60 * 60);
  
  if (diffHours < HOTNESS_THRESHOLDS.VERY_RECENT_HOURS) {
    score += HOTNESS_SCORE_WEIGHTS.VERY_RECENT;
  } else if (diffHours < HOTNESS_THRESHOLDS.RECENT_HOURS) {
    score += HOTNESS_SCORE_WEIGHTS.RECENT;
  } else if (diffHours < HOTNESS_THRESHOLDS.SOMEWHAT_RECENT_HOURS) {
    score += HOTNESS_SCORE_WEIGHTS.SOMEWHAT_RECENT;
  } else if (diffHours < HOTNESS_THRESHOLDS.OLD_HOURS) {
    score += HOTNESS_SCORE_WEIGHTS.OLD;
  } else {
    score += Math.max(0, 50 - diffHours * 2);
  }

  // Crowd level scoring
  score += CROWD_SCORES[latestVibe.crowd] || -50;

  // Bonus: No line
  if (latestVibe.line === "No line") {
    score += HOTNESS_SCORE_WEIGHTS.NO_LINE_BONUS;
  }

  // Bonus: Free or cheap cover
  if (latestVibe.cover === "Free" || latestVibe.cover === "< $10") {
    score += HOTNESS_SCORE_WEIGHTS.CHEAP_COVER_BONUS;
  }

  return score;
}

