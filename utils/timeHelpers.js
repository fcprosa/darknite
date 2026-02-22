/**
 * Format a timestamp into a human-readable "time ago" string
 * @param {string} dateString - ISO date string
 * @param {boolean} compact - Use compact format (e.g., "5m ago" vs "5 minutes ago")
 * @returns {string} Formatted time string
 */
export function formatTimeAgo(dateString, compact = false) {
  if (!dateString) return "";
  
  const now = new Date();
  const then = new Date(dateString);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  
  if (compact) {
    // Compact format for cards and lists
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } else {
    // Verbose format for detail screens
    if (diffMins < 60) {
      return `about ${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
    }
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return `about ${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
    }
    const diffDays = Math.floor(diffHours / 24);
    return `about ${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }
}

/**
 * Format a timestamp into a compact "time ago" string
 * Convenience wrapper for formatTimeAgo with compact=true
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted time string (e.g., "5m ago", "2h ago")
 */
export function formatTimeAgoCompact(dateString) {
  return formatTimeAgo(dateString, true);
}

/**
 * Format vibe timestamp for Feed + Venue screens.
 * < 60 sec → "right now"
 * >= 60 sec → "Xm ago" (never "0m ago")
 * 60+ min → "Xh ago" (compact)
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted time string (e.g., "right now", "1m ago", "2h ago")
 */
export function formatVibeRecency(dateString) {
  if (!dateString) return "";
  const now = Date.now();
  const then = new Date(dateString).getTime();

  if (isNaN(then)) return "";

  // Clamp future timestamps (clock skew / device clock drift) to "right now"
  const diffMs = Math.max(0, now - then);
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffMs / 60000);

  // Never show "0m ago" - use "right now" for < 60 seconds
  if (diffSec < 60) return "right now";
  // Use compact format: "1m ago", "2m ago", etc. (not "1 min ago")
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}
