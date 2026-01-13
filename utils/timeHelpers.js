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

