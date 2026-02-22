/**
 * Format a timestamp into a relative time string for crowd labels.
 * 
 * @param {string|null} isoTimestamp - ISO date string or null
 * @returns {string|null} Formatted time string or null if expired/invalid
 * 
 * Rules:
 * - Under 60 min: return "{n}m ago"
 * - 60-1440 min: return "{n}h ago"
 * - Over 1440 min: return null (treat as expired)
 * - Null timestamp → return null
 * - Future timestamp (clock skew) → treat as 0m ago
 * - Timestamp > 90 minutes → return null (inactive state)
 */
export function formatRelativeTime(isoTimestamp) {
  if (!isoTimestamp) return null;
  
  const now = Date.now();
  const then = new Date(isoTimestamp).getTime();
  
  // Handle invalid date
  if (isNaN(then)) return null;
  
  // Handle future timestamp (clock skew) - treat as 0m ago
  if (then > now) {
    return "0m ago";
  }
  
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  
  // Over 45 minutes → inactive, return null (hard decay)
  if (diffMin > 45) return null;
  
  // Under 60 min: return "{n}m ago"
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  
  // 60-1440 min: return "{n}h ago"
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs <= 24) {
    return `${diffHrs}h ago`;
  }
  
  // Over 1440 min (24 hours) → expired, return null
  return null;
}

/**
 * Format a timestamp into a stale crowd string for expired vibes (45-90 minutes old).
 * Uses "Was x · time" format instead of "Last seen:" prefix.
 *
 * @param {string|null} isoTimestamp - ISO date string or null
 * @param {string|null} crowdLabel - Crowd level label (e.g., "Packed", "Fun")
 * @returns {string|null} Formatted stale string or null if outside window
 */
export function formatLastSeenTime(isoTimestamp, crowdLabel) {
  if (!isoTimestamp || !crowdLabel) return null;

  const now = Date.now();
  const then = new Date(isoTimestamp).getTime();

  if (isNaN(then)) return null;
  if (then > now) return null;

  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);

  // Only format if between 45-90 minutes (expired but still showable)
  if (diffMin > 45 && diffMin <= 90) {
    const diffHrs = Math.floor(diffMin / 60);
    const timeStr = diffHrs >= 1 ? `${diffHrs}h ago` : `${diffMin}m ago`;
    return `Was ${crowdLabel.toLowerCase()} \u00B7 ${timeStr}`;
  }

  return null;
}
