// ========== APP CONSTANTS ==========

// Preview & Guest Mode
export const PREVIEW_VENUE_LIMIT = 2; // Number of venues shown in guest preview mode

// Feed Configuration
export const HOT_NOW_HOURS = 12; // Hours to look back for "Hot Now" feed
export const HOT_NOW_VIBE_LIMIT = 100; // Max vibes to fetch for Hot Now feed
export const VIBE_RECENCY_HOURS = 24; // Hours to consider a vibe "recent"

// UI Configuration
export const FAB_BOTTOM_OFFSET = 80; // Bottom position of floating action button (px)
export const SHEET_MAX_HEIGHT_PERCENT = 0.92; // Max height of post vibe sheet (% of screen)

// Hotness Algorithm Weights
export const CROWD_SCORES = {
  Dead: 0,
  Chill: 100,
  Fun: 300,
  Packed: 500,
  Chaos: 450,
};

export const HOTNESS_THRESHOLDS = {
  VERY_RECENT_HOURS: 1,
  RECENT_HOURS: 2,
  SOMEWHAT_RECENT_HOURS: 4,
  OLD_HOURS: 12,
};

export const HOTNESS_SCORE_WEIGHTS = {
  VERY_RECENT: 1000,
  RECENT: 500,
  SOMEWHAT_RECENT: 250,
  OLD: 100,
  NO_LINE_BONUS: 100,
  CHEAP_COVER_BONUS: 50,
};

// Cache Configuration
export const VENUE_CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

