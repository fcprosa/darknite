/**
 * feedHelpers.js
 * 
 * Deterministic helpers for feed display:
 * - Status line generation (the "money line" on each card)
 * - Chip data computation
 * - Feed sorting score
 * 
 * All functions are pure — no async, no side effects, no fetches.
 */

import { formatTimeAgo, formatVibeRecency } from "./timeHelpers";
import { mapCoverPriceToUI, mapBarTierToSymbol, mapLegacyDrinksPriceToTier, formatAgeRange } from "./priceMapping";
import { DATA_SOURCE, PRICE_LEVEL_MAP, LABEL_PREFIX } from "../constants/dataSources";

// ─── Crowd Intensity Map ────────────────────────────────────────
// Maps crowd labels to numeric intensity for scoring.
// "Dead" is low but non-zero – it's still useful signal.
const CROWD_INTENSITY = {
  Dead: 5,
  Chill: 20,
  Fun: 50,
  Packed: 85,
  Chaos: 100,
  // Legacy / alternative names
  Buzzing: 60,
};

// ─── Historical Defaults ─────────────────────────────────────────
// These stand in until you add real columns to Supabase.
// Keyed by venue_type. Override per-venue later.

const HISTORICAL_DEFAULTS = {
  club: {
    typical_peak_hour: 23.5, // 11:30 PM
    typical_peak_label: "Usually peaks around 11:30",
    typical_crowd: "Packed",
    usual_cover: "$20-30",
    usual_line: "Expect a line",
    usual_music: "Mixed",
  },
  bar: {
    typical_peak_hour: 22, // 10:00 PM
    typical_peak_label: "Usually picks up around 10",
    typical_crowd: "Fun",
    usual_cover: "Free",
    usual_line: "Walk right in",
    usual_music: "Mixed",
  },
};

// ─── Per-Venue Overrides ─────────────────────────────────────────
// REMOVED: VENUE_OVERRIDES has been migrated to Supabase venues table columns.
// Data now lives in: default_crowd_label, default_music_genre, default_peak_label,
// default_line_note, default_cover_note.
// See scripts/backfill-venue-defaults.mjs for the migration script.
//
// The VENUE_OVERRIDES object has been removed. Use getResolvedDefaults() for
// source-aware field resolution, or getDefaults() for backward compatibility
// with old column names.

/* VENUE_OVERRIDES removed - data migrated to DB (2025-02-XX)
const VENUE_OVERRIDES = {
  // ═══════════════════════════════════════════════
  // CLUBS
  // ═══════════════════════════════════════════════
  "Marquee": {
    typical_peak_hour: 24,
    typical_peak_label: "Usually peaks around midnight",
    usual_cover: "$30-40",
    usual_line: "Long line after 11",
    usual_music: "Top Hits",
    typical_crowd: "Packed",
  },
  "Gospel": {
    typical_peak_hour: 23,
    typical_peak_label: "Gets going around 11",
    usual_cover: "$20",
    usual_line: "Moderate line",
    usual_music: "Hip-Hop / R&B",
    typical_crowd: "Packed",
  },
  "Le Bain": {
    typical_peak_hour: 24.5,
    typical_peak_label: "Peaks after midnight",
    usual_cover: "$30+",
    usual_line: "Guest list helps",
    usual_music: "House / Techno",
    typical_crowd: "Buzzing",
  },
  "Harbor New York City": {
    typical_peak_hour: 23.5,
    typical_peak_label: "Busiest around 11:30",
    usual_cover: "$20-30",
    usual_line: "Expect a wait",
    usual_music: "House / Techno",
    typical_crowd: "Packed",
  },
  "Deluxx Fluxx": {
    typical_peak_hour: 23,
    typical_peak_label: "Fills up around 11",
    usual_cover: "Varies",
    usual_line: "Can get long",
    usual_music: "Mixed / EDM",
    typical_crowd: "Chaos",
  },
  "Little Sister": {
    typical_peak_hour: 23,
    typical_peak_label: "Best after 11",
    usual_cover: "$10-20",
    usual_line: "Short wait",
    usual_music: "Hip-Hop / R&B",
    typical_crowd: "Fun",
  },
  "PHD Downtown": {
    typical_peak_hour: 23,
    typical_peak_label: "Busiest around 11",
    usual_cover: "$20-30",
    usual_line: "Guest list helps",
    usual_music: "Top Hits",
    typical_crowd: "Buzzing",
  },
  "Somewhere Nowhere": {
    typical_peak_hour: 23.5,
    typical_peak_label: "Peaks around 11:30",
    usual_cover: "$20",
    usual_line: "Line after 11",
    usual_music: "Mixed / EDM",
    typical_crowd: "Fun",
  },
  "Tao Downtown": {
    typical_peak_hour: 24,
    typical_peak_label: "Late crowd, peaks midnight",
    usual_cover: "$30+",
    usual_line: "Guest list only",
    usual_music: "Top Hits",
    typical_crowd: "Packed",
  },
  "The Fleur Room": {
    typical_peak_hour: 23.5,
    typical_peak_label: "Peaks around 11:30",
    usual_cover: "$20-30",
    usual_line: "Expect a wait",
    usual_music: "R&B / Top Hits",
    typical_crowd: "Buzzing",
  },
  "Loosie's": {
    typical_peak_hour: 23,
    typical_peak_label: "Heats up around 11",
    usual_cover: "$10-15",
    usual_line: "Quick entry usually",
    usual_music: "Hip-Hop / Mixed",
    typical_crowd: "Fun",
  },
  "Lost in Paradise": {
    typical_peak_hour: 23.5,
    typical_peak_label: "Gets packed around 11:30",
    usual_cover: "$20-30",
    usual_line: "Expect a line",
    usual_music: "Latin / Reggaeton",
    typical_crowd: "Packed",
  },
  "Musica": {
    typical_peak_hour: 24,
    typical_peak_label: "Late night crowd, peaks midnight",
    usual_cover: "$20-30",
    usual_line: "Expect a wait",
    usual_music: "House / EDM",
    typical_crowd: "Packed",
  },
  "Nebula": {
    typical_peak_hour: 23.5,
    typical_peak_label: "Peaks around 11:30",
    usual_cover: "$20-30",
    usual_line: "Expect a line",
    usual_music: "EDM / House",
    typical_crowd: "Buzzing",
  },

  // ═══════════════════════════════════════════════
  // BARS
  // ═══════════════════════════════════════════════
  "Analogue": {
    typical_peak_hour: 22.5,
    typical_peak_label: "Best vibes around 10:30",
    typical_crowd: "Chill",
    usual_line: "Walk right in",
    usual_music: "Indie / Mixed",
  },
  "Banzarbar": {
    typical_peak_hour: 23,
    typical_peak_label: "Picks up late, around 11",
    typical_crowd: "Fun",
    usual_line: "No line",
    usual_music: "Afrobeats",
  },
  "Bar Kabawa": {
    typical_peak_hour: 22,
    typical_peak_label: "Lively by 10",
    typical_crowd: "Fun",
    usual_line: "Walk right in",
    usual_music: "Hip-Hop / R&B",
  },
  "Bar Snack": {
    typical_peak_hour: 21.5,
    typical_peak_label: "Starts early, around 9:30",
    typical_crowd: "Chill",
    usual_line: "No line",
    usual_music: "Indie / Jazz",
  },
  "Dante": {
    typical_peak_hour: 21,
    typical_peak_label: "Great from early evening",
    typical_crowd: "Chill",
    usual_line: "Walk right in",
    usual_music: "Jazz / Lounge",
  },
  "Ding-a-ling": {
    typical_peak_hour: 22.5,
    typical_peak_label: "Picks up around 10:30",
    typical_crowd: "Fun",
    usual_line: "No line",
    usual_music: "Mixed / Pop",
  },
  "Hi-Note": {
    typical_peak_hour: 22,
    typical_peak_label: "Lively by 10",
    typical_crowd: "Fun",
    usual_line: "Walk right in",
    usual_music: "R&B / Soul",
  },
  "Joyface": {
    typical_peak_hour: 22.5,
    typical_peak_label: "Gets fun around 10:30",
    typical_crowd: "Fun",
    usual_line: "Walk right in",
    usual_music: "Indie / Dance",
  },
  "Katana Kitten": {
    typical_peak_hour: 21.5,
    typical_peak_label: "Best early, around 9:30",
    typical_crowd: "Chill",
    usual_line: "No line",
    usual_music: "Lounge / Jazz",
  },
  "Little Branch": {
    typical_peak_hour: 22,
    typical_peak_label: "Intimate vibes by 10",
    typical_crowd: "Chill",
    usual_line: "Small space, may wait",
    usual_music: "Jazz / Classic",
  },
  "Public Arts": {
    typical_peak_hour: 23,
    typical_peak_label: "Late crowd, around 11",
    typical_crowd: "Fun",
    usual_line: "No line usually",
    usual_music: "Mixed / Electronic",
  },
  "Saint Tuesday": {
    typical_peak_hour: 22.5,
    typical_peak_label: "Picks up around 10:30",
    typical_crowd: "Fun",
    usual_line: "Walk right in",
    usual_music: "R&B / Hip-Hop",
  },
  "Schimanski": {
    typical_peak_hour: 23.5,
    typical_peak_label: "Late crowd, peaks 11:30",
    typical_crowd: "Buzzing",
    usual_line: "Can get long",
    usual_music: "House / Techno",
  },
  "Skyline Rooftop": {
    typical_peak_hour: 21.5,
    typical_peak_label: "Best at sunset, around 9:30",
    typical_crowd: "Chill",
    usual_line: "Walk right in",
    usual_music: "Top Hits / Mixed",
  },
}; */

// ─── Genre Display Names ─────────────────────────────────────────
// Shortened versions of genre labels for chip display.
// Keeps chips readable without truncation on most screen widths.
const GENRE_SHORT = {
  "Hip-Hop / R&B": "Hip-Hop/R&B",
  "House / Techno": "House/Techno",
  "Latin / Reggaeton": "Latin/Reggaeton",
  "Mixed / EDM": "Mixed/EDM",
  "Mixed / Electronic": "Electronic",
  "Mixed / Pop": "Pop/Mixed",
  "R&B / Top Hits": "R&B/Top Hits",
  "R&B / Hip-Hop": "R&B/Hip-Hop",
  "R&B / Soul": "R&B/Soul",
  "Indie / Mixed": "Indie/Mixed",
  "Indie / Rock": "Indie/Rock",
  "Indie / Jazz": "Indie/Jazz",
  "Indie / Dance": "Indie/Dance",
  "Jazz / Lounge": "Jazz/Lounge",
  "Jazz / Classic": "Jazz/Classic",
  "Top Hits / Mixed": "Top Hits",
  "Hip-Hop / Mixed": "Hip-Hop/Mix",
  "House / EDM": "House/EDM",
  "EDM / House": "EDM/House",
};

function shortenGenre(genre) {
  if (!genre) return genre;
  return GENRE_SHORT[genre] || genre;
}

/**
 * Get emoji for line wait status
 * @param {string|null} line - Line wait value (e.g., "No line", "Short wait", "Long line", "Not worth it")
 * @returns {string} Emoji for the line status
 */
function getLineEmoji(line) {
  if (!line) return "⏱️";
  const lineLower = line.toLowerCase();
  if (lineLower.includes("no line") || lineLower.includes("walk")) return "✅";
  if (lineLower.includes("short") || lineLower.includes("5-10")) return "⏱️";
  if (lineLower.includes("long") || lineLower.includes("15+")) return "😤";
  if (lineLower.includes("not worth") || lineLower.includes("elsewhere")) return "🚫";
  return "⏱️";
}

// ─── Field Resolution Engine ────────────────────────────────────────
// Replaces VENUE_OVERRIDES with source-aware resolution system

/**
 * Resolves a single display field with source tracking.
 * @param {string} fieldType - 'crowd'|'music'|'price'|'peak'|'line'|'cover'
 * @param {object} opts
 * @param {string|null} opts.liveValue - Real-time value from active vibes
 * @param {string|null} opts.dbValue - Value from venues table column
 * @param {string|null} opts.liveRecency - e.g. "12m ago", "just now"
 * @returns {{ value: string|null, source: string, label: string|null, visible: boolean, recency: string|null }}
 */
export function resolveField(fieldType, { liveValue = null, dbValue = null, liveRecency = null } = {}) {
  // Priority 1: LIVE
  if (liveValue) {
    const prefix = LABEL_PREFIX[fieldType]?.LIVE ?? '';
    return {
      value: liveValue,
      source: DATA_SOURCE.LIVE,
      label: `${prefix}${liveValue}`,
      visible: true,
      recency: liveRecency || 'right now',
    };
  }

  // Priority 2: HISTORICAL_DB
  if (dbValue) {
    const prefix = LABEL_PREFIX[fieldType]?.HISTORICAL_DB ?? '';
    return {
      value: dbValue,
      source: DATA_SOURCE.HISTORICAL_DB,
      label: `${prefix}${dbValue}`,
      visible: true,
      recency: null,
    };
  }

  // Priority 3: GENERIC_FALLBACK — HIDE
  return {
    value: null,
    source: DATA_SOURCE.GENERIC_FALLBACK,
    label: null,
    visible: false,
    recency: null,
  };
}

/**
 * Resolves all display fields for a venue.
 * @param {object} venue - Venue object from Supabase (with new columns)
 * @param {object} liveData - Optional live vibe data { crowd, music, line, cover, recency }
 * @returns {object} Map of fieldType → resolved field object
 */
export function getResolvedDefaults(venue, liveData = {}) {
  // Calculate recency for live data using the canonical formatter (never "just now", never "0m ago")
  let liveRecency = null;
  if (liveData.recency) {
    liveRecency = liveData.recency;
  } else if (liveData.created_at) {
    liveRecency = formatVibeRecency(liveData.created_at);
  }

  return {
    crowd: resolveField('crowd', {
      liveValue: liveData.crowd || null,
      dbValue: venue?.default_crowd_label || null,
      liveRecency,
    }),
    music: resolveField('music', {
      liveValue: liveData.music || null,
      dbValue: venue?.default_music_genre || null,
      liveRecency,
    }),
    price: resolveField('price', {
      // Price is never live-reported; only from DB
      liveValue: null,
      dbValue: venue?.google_price_level
        ? PRICE_LEVEL_MAP[venue.google_price_level] || null
        : null,
    }),
    peak: resolveField('peak', {
      liveValue: null,
      dbValue: venue?.default_peak_label || null,
    }),
    line: resolveField('line', {
      liveValue: liveData.line || null,
      dbValue: venue?.default_line_note || null,
      liveRecency,
    }),
    cover: resolveField('cover', {
      liveValue: liveData.cover || null,
      dbValue: venue?.default_cover_note || null,
      liveRecency,
    }),
  };
}

export function getDefaults(venue) {
  const type = venue?.venue_type?.toLowerCase();
  const typeDefaults = type === "club" ? HISTORICAL_DEFAULTS.club : HISTORICAL_DEFAULTS.bar;
  
  // Layer 1: Type defaults (bar or club)
  // Layer 2: Supabase venue columns (from Google Places seeding, manual entry, or backfilled defaults)
  // NOTE: VENUE_OVERRIDES has been removed. Data now lives in DB columns:
  // - default_crowd_label (replaces typical_crowd from overrides)
  // - default_music_genre (replaces usual_music from overrides)
  // - default_peak_label (replaces typical_peak_label from overrides)
  // - default_line_note (replaces usual_line from overrides)
  // - default_cover_note (replaces usual_cover from overrides)
  
  const dbOverrides = {};
  
  // Use new default_* columns if available, fallback to old typical_*/usual_* columns for backward compatibility
  if (venue?.typical_peak_hour != null) dbOverrides.typical_peak_hour = venue.typical_peak_hour;
  if (venue?.default_peak_label) dbOverrides.typical_peak_label = venue.default_peak_label;
  else if (venue?.typical_peak_label) dbOverrides.typical_peak_label = venue.typical_peak_label;
  
  if (venue?.default_crowd_label) dbOverrides.typical_crowd = venue.default_crowd_label;
  else if (venue?.typical_crowd) dbOverrides.typical_crowd = venue.typical_crowd;
  
  if (venue?.default_cover_note) dbOverrides.usual_cover = venue.default_cover_note;
  else if (venue?.usual_cover) dbOverrides.usual_cover = venue.usual_cover;
  
  if (venue?.default_line_note) dbOverrides.usual_line = venue.default_line_note;
  else if (venue?.usual_line) dbOverrides.usual_line = venue.usual_line;
  
  if (venue?.default_music_genre) dbOverrides.usual_music = venue.default_music_genre;
  else if (venue?.usual_music) dbOverrides.usual_music = venue.usual_music;
  
  // Map Google price_level to drinks display if no explicit override
  if (!dbOverrides.usual_drinks && venue?.google_price_level != null) {
    const priceMap = { 0: "$", 1: "$", 2: "$$", 3: "$$$", 4: "$$$$" };
    dbOverrides.usual_drinks = priceMap[venue.google_price_level] || "$$";
  }
  
  return { ...typeDefaults, ...dbOverrides };
}

// ─── Generic Peak Label Detection ────────────────────────────────
// Rejects peak labels that are generic type-level defaults (backfill artifacts).
// These create repetitive copy when many venues share the same fallback.
const GENERIC_PEAK_PATTERNS = [
  'usually picks up around 10',
  'picks up around 10',
  'usually peaks around 11:30',
  'peaks around 11:30',
];

function isGenericPeakLabel(label) {
  if (!label) return true;
  const lower = label.toLowerCase();
  return GENERIC_PEAK_PATTERNS.some(p => lower.includes(p));
}

/**
 * Get the best static subtitle for a venue with no live vibe.
 * Returns null if no unique data worth showing (card will show name + neighborhood only).
 * Exported for use by VenueCardCompact.
 */
export function getStaticSubtitle(venue, resolved) {
  const peakLabel = resolved?.peak?.value;

  // Priority 1: venue-specific peak label (not generic)
  if (peakLabel && !isGenericPeakLabel(peakLabel)) {
    return peakLabel;
  }

  // Priority 2: music genre
  if (resolved?.music?.visible && resolved?.music?.value) {
    return `Known for ${resolved.music.value}`;
  }

  // No unique data — return null, card shows name + neighborhood only
  return null;
}

// ─── Day-Aware Peak Label ────────────────────────────────────────

function getDayAwarePeakLabel(venue, now = new Date()) {
  const defaults = getDefaults(venue);
  const day = now.getDay();
  const hour = now.getHours();
  const peakLabel = venue.typical_peak_label || defaults.typical_peak_label;

  // If it's a going-out night (Thu/Fri/Sat) and past 5pm, use "tonight" instead of day name
  const isGoingOutNight = day === 4 || day === 5 || day === 6;
  if (isGoingOutNight && hour >= 17) {
    return `${peakLabel} tonight`;
  }

  // Otherwise use day name for context
  const dayNames = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
  return `${peakLabel} on ${dayNames[day]}`;
}

// ─── Status Line ("Money Line") ──────────────────────────────────
// Priority: live vibe > moves > historical prediction

/**
 * Compute trend direction from recent vibes.
 * Requires at least 2 vibes to determine trend.
 * @param {Object[]} recentVibes - sorted newest-first
 * @returns {{ direction: 'heating'|'cooling'|'stable', arrow: string, color: string }|null}
 */
function computeTrend(recentVibes) {
  if (!recentVibes || recentVibes.length < 2) return null;
  const ENERGY_MAP = { 'chaos': 5, 'packed': 4, 'buzzing': 3, 'fun': 3, 'chill': 2, 'dead': 1 };
  const sorted = [...recentVibes].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const latest = ENERGY_MAP[sorted[0].crowd?.toLowerCase()] ?? 0;
  const previous = ENERGY_MAP[sorted[1].crowd?.toLowerCase()] ?? 0;
  if (latest > previous) return { direction: 'heating', arrow: '↑', color: '#FF6B35' };
  if (latest < previous) return { direction: 'cooling', arrow: '↓', color: '#60A5FA' };
  return null; // stable — no indicator
}

/**
 * Compute the single status line for a venue card.
 *
 * @param {Object} venue - venue object
 * @param {Object|null} latestVibe - from latestVibesByVenueId
 * @param {number} moveCount - active move count for this venue (default 0)
 * @param {Date} now - current time (injectable for testing)
 * @param {Object[]} recentVibes - recent vibes for trend computation (default [])
 * @returns {{ text: string, type: 'live' | 'moves' | 'historical', isStale?: boolean, trend?: Object|null }}
 */
export function computeStatusLine(venue, latestVibe, moveCount = 0, now = new Date(), recentVibes = []) {
  // 1. Live vibe (posted in last 2 hours)
  if (latestVibe?.created_at) {
    const ageMs = now.getTime() - new Date(latestVibe.created_at).getTime();
    const ageMin = ageMs / 60000;

    if (ageMin < 120 && latestVibe.crowd) {
      const emojiMap = {
        "Chaos": "🔥",
        "Packed": "🔥",
        "Buzzing": "⚡",
        "Fun": "😎",
        "Chill": "🧊",
        "Dead": "💤",
      };
      const timeLabel = formatVibeRecency(latestVibe.created_at);
      const emoji = emojiMap[latestVibe.crowd] || "📍";
      const trend = computeTrend(recentVibes);

      // Special handling for dead venues with peak label context
      if (latestVibe.crowd === 'Dead' && venue?.default_peak_label) {
        return {
          text: `💤 Dead • ${timeLabel} — ${venue.default_peak_label}`,
          type: "live",
          trend,
        };
      }

      return {
        text: `${emoji} ${latestVibe.crowd} • ${timeLabel}`,
        type: "live",
        trend,
      };
    }

    // Stale vibe (2–6 hours old): surface last known crowd with time context.
    // Better than "No vibes yet tonight" — gives real signal from earlier tonight.
    if (ageMin < 360 && latestVibe.crowd) {
      return {
        text: `Last seen: ${latestVibe.crowd} · ${formatVibeRecency(latestVibe.created_at)}`,
        type: "stale",
      };
    }
    // >6h: treat as expired, fall through to moves/historical
  }

  // 2. Moves (if any active) - only show if 3+ people
  if (moveCount >= 3) {
    return {
      text: `${moveCount} people heading here tonight`,
      type: "moves",
    };
  }
  // If 1-2 people, fall through to historical (don't show moves status)

  // 3. Historical fallback — only if we have venue-specific data
  const peakLabel = getDayAwarePeakLabel(venue, now);
  const rawPeak = venue?.default_peak_label || getDefaults(venue).typical_peak_label;

  // If peak label is generic, try music genre instead
  if (isGenericPeakLabel(rawPeak)) {
    const musicGenre = venue?.default_music_genre;
    if (musicGenre) {
      return {
        text: `Known for ${musicGenre}`,
        type: "historical",
      };
    }
    // No unique data — return null text so the card can hide the status line
    return {
      text: null,
      type: "historical",
    };
  }

  return {
    text: peakLabel,
    type: "historical",
  };
}

// ─── Chip Data (venue-type-specific priority) ────────────────────────────────
// Shows up to 3 chips per venue card with venue-type-specific priority:
// - BAR: 1. Music, 2. Drinks Price, 3. Age Range
// - CLUB: 1. Line, 2. Cover, 3. Age Range
//
// CRITICAL DATA RULE:
// If a live vibe exists (< 60 min), chips MUST use values from that SAME vibe object.
// This prevents the bug where status line says "Chaos" but chip says "Chill"
// because they were reading from different data sources (latestVibe vs latestBarCrowd).

/**
 * Compute up to 3 chips for a venue feed card with venue-type priority.
 *
 * BAR priority: Music → Drinks Price → Age Range
 * CLUB priority: Line → Cover → Age Range
 *
 * @param {Object} venue - venue object
 * @param {Object|null} latestVibe - the SAME vibe used by computeStatusLine
 * @param {Date} now - current time (injectable for testing)
 * @returns {Array<{ id: string, emoji: string, value: string, isLive: boolean }>}
 */
export function computeChips(venue, latestVibe, now = new Date()) {
  const chips = [];
  const isClub = venue?.venue_type?.toLowerCase() === "club";
  const isBar = !isClub;

  // Determine if the vibe is live (< 60 min old)
  let isLive = false;
  let liveRecency = null;
  if (latestVibe?.created_at) {
    const ageMs = Math.max(0, now.getTime() - new Date(latestVibe.created_at).getTime());
    isLive = ageMs < 60 * 60 * 1000; // 60 minutes
    if (isLive) {
      // Use canonical formatter — never "just now", never "0m ago"
      liveRecency = formatVibeRecency(latestVibe.created_at);
    }
  }

  // Use resolution engine for source-aware field resolution
  const liveData = isLive ? {
    crowd: latestVibe?.crowd || null,
    music: latestVibe?.music || null,
    line: latestVibe?.line || null,
    cover: latestVibe?.cover || null,
    created_at: latestVibe?.created_at,
    recency: liveRecency,
  } : {};

  const resolved = getResolvedDefaults(venue, liveData);

  // ── BAR priority: Music → Drinks Price → Age Range ──
  if (isBar) {
    // 1. Music
    if (resolved.music.visible) {
      chips.push({
        id: "music",
        emoji: "🎵",
        value: shortenGenre(resolved.music.label),
        isLive: resolved.music.source === DATA_SOURCE.LIVE,
        source: resolved.music.source,
        recency: resolved.music.recency,
      });
    }

    // 2. Drinks Price (from live vibe drinks_price_tier)
    if (isLive && latestVibe?.drinks_price_tier) {
      const priceSymbol = mapBarTierToSymbol(latestVibe.drinks_price_tier);
      if (priceSymbol) {
        chips.push({
          id: "drinks_price",
          emoji: "💵",
          value: priceSymbol,
          isLive: true,
          source: DATA_SOURCE.LIVE,
          recency: liveRecency,
        });
      }
    }

    // 3. Age Range
    if (isLive && latestVibe?.age_range) {
      const ageLabel = formatAgeRange(latestVibe.age_range);
      if (ageLabel) {
        chips.push({
          id: "age_range",
          emoji: "👥",
          value: ageLabel,
          isLive: true,
          source: DATA_SOURCE.LIVE,
          recency: liveRecency,
        });
      }
    }
  }

  // ── CLUB priority: Line → Cover → Age Range ──
  if (isClub) {
    // 1. Line
    if (resolved.line.visible) {
      chips.push({
        id: "line",
        emoji: getLineEmoji(resolved.line.value),
        value: resolved.line.label,
        isLive: resolved.line.source === DATA_SOURCE.LIVE,
        source: resolved.line.source,
        recency: resolved.line.recency,
      });
    }

    // 2. Cover
    if (resolved.cover.visible) {
      chips.push({
        id: "cover",
        emoji: "💵",
        value: resolved.cover.label,
        isLive: resolved.cover.source === DATA_SOURCE.LIVE,
        source: resolved.cover.source,
        recency: resolved.cover.recency,
      });
    }

    // 3. Age Range
    if (isLive && latestVibe?.age_range) {
      const ageLabel = formatAgeRange(latestVibe.age_range);
      if (ageLabel) {
        chips.push({
          id: "age_range",
          emoji: "👥",
          value: ageLabel,
          isLive: true,
          source: DATA_SOURCE.LIVE,
          recency: liveRecency,
        });
      }
    }
  }

  // Return max 3 chips (priority order)
  return chips.slice(0, 3);
}

// ─── Feed Sorting Score v2 ───────────────────────────────────────
// Exponential decay ranking. Higher score = higher in feed.
//
// Formula: feedScore = (Wl × L × freshness) + (Wm × M × moveDecay) + (Wh × H) + venueBoost
//
// L = Live Vibe Score: crowdIntensity × vibeCountMultiplier × freshness(λ=0.025)
// M = Move Score: step function based on move count × linear decay over 6h from 6pm
// H = Historical Score: nightRelevance × peakProximity
// venueBoost = bonus when venue has BOTH vibes AND moves (cross-confirmation)
//
// Weights: Wl=1.0 (live dominates), Wm=0.6, Wh=0.3
// Founder vibes get 1.2x multiplier on Wl.
//
// Decay half-life: ~28 minutes (λ=0.025). A vibe loses half its value every 28 min.
// This means: 5min ago → 88%, 30min → 47%, 60min → 22%, 2h → 5%

/**
 * Compute the feed ranking score for a venue.
 *
 * @param {Object} venue - venue object from Supabase
 * @param {Object|null} latestVibe - most recent vibe for this venue
 *   (may include is_verified from joined profile)
 * @param {number} moveCount - active moves for this venue (default 0)
 * @param {Date} now - current time (injectable for testing)
 * @param {Object} options - additional scoring inputs
 * @param {number} options.vibeCount - number of vibes in last 2 hours (default 1 if latestVibe exists)
 * @param {number} options.dayOfWeek - 0=Sun..6=Sat (default: derived from now)
 * @returns {number} score (higher = rank higher in feed)
 */
export function computeFeedScore(
  venue,
  latestVibe,
  moveCount = 0,
  now = new Date(),
  options = {}
) {
  const Wl = 1.0; // Live vibe weight (highest priority)
  const Wm = 0.6; // Moves weight
  const Wh = 0.3; // Historical weight
  const LAMBDA = 0.025; // Decay rate: half-life ≈ 28 minutes

  const currentHour = now.getHours() + now.getMinutes() / 60;
  const dayOfWeek = options.dayOfWeek ?? now.getDay();
  const defaults = getDefaults(venue);
  const peakHour = venue.typical_peak_hour || defaults.typical_peak_hour;

  // ═══════════════════════════════════════════════
  // L — LIVE VIBE COMPONENT (0-150)
  // ═══════════════════════════════════════════════
  let L = 0;
  let founderMultiplier = 1.0;

  if (latestVibe?.created_at) {
    const minutesAgo =
      (now.getTime() - new Date(latestVibe.created_at).getTime()) / 60000;

    // Only score vibes from last 2 hours (after that, freshness → ~5%, negligible)
    if (minutesAgo < 120) {
      // Crowd intensity: maps crowd level to numeric value
      const crowdIntensity = CROWD_INTENSITY[latestVibe.crowd] || 20;

      // Vibe count multiplier: consensus from multiple reporters
      const vibeCount = options.vibeCount ?? 1;
      const countMultiplier =
        vibeCount >= 3 ? 1.5 : vibeCount === 2 ? 1.3 : 1.0;

      // Exponential decay: e^(-λ × minutes)
      const freshness = Math.exp(-LAMBDA * minutesAgo);

      L = crowdIntensity * countMultiplier * freshness;

      // Founder/verified user boost: 1.2x weight on live component
      // Defensive: is_verified defaults to false if missing/null
      if (latestVibe.is_verified === true) {
        founderMultiplier = 1.2;
      }
    }
  }

  // ═══════════════════════════════════════════════
  // M — MOVE COMPONENT (0-50)
  // ═══════════════════════════════════════════════
  let M = 0;

  if (moveCount > 0) {
    // Step function: diminishing returns after 6 moves
    let moveScore;
    if (moveCount >= 11) moveScore = 50;
    else if (moveCount >= 6) moveScore = 40;
    else if (moveCount >= 3) moveScore = 25;
    else moveScore = 10;

    // Linear decay: moves lose value over 6 hours from 6pm
    // At 6pm (hour 18) → freshness = 1.0
    // At 9pm (hour 21) → freshness = 0.5
    // At midnight (hour 24) → freshness = 0.0
    const hoursSince6pm = currentHour >= 18 ? currentHour - 18 : currentHour + 6;
    const moveFreshness = Math.max(0, 1 - hoursSince6pm / 6);

    M = moveScore * moveFreshness;
  }

  // ═══════════════════════════════════════════════
  // H — HISTORICAL COMPONENT (0-30)
  // ═══════════════════════════════════════════════

  // Night relevance: how relevant is this venue type on this day?
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Fri=5, Sat=6
  const isThursday = dayOfWeek === 4;
  const isClub = venue?.venue_type?.toLowerCase() === "club";

  let nightRelevance = 5; // weekday default
  if (isWeekend) nightRelevance = isClub ? 30 : 25;
  else if (isThursday) nightRelevance = isClub ? 20 : 15;

  // Peak proximity: 1.0 at peak, 0.0 at ±3 hours
  let hoursFromPeak = Math.abs(peakHour - currentHour);
  if (hoursFromPeak > 12) hoursFromPeak = 24 - hoursFromPeak;
  const peakProximity = Math.max(0, 1 - hoursFromPeak / 3);

  const H = nightRelevance * peakProximity;

  // ═══════════════════════════════════════════════
  // VENUE BOOST — Cross-signal confirmation
  // ═══════════════════════════════════════════════
  let venueBoost = 0;

  // Has both live vibes AND moves = high confidence
  if (L > 0 && moveCount > 0) venueBoost += 10;

  // ═══════════════════════════════════════════════
  // FINAL SCORE
  // ═══════════════════════════════════════════════
  const score =
    Wl * founderMultiplier * L +
    Wm * M +
    Wh * H +
    venueBoost;

  // Round to 2 decimal places for stability
  return Math.round(score * 100) / 100;
}

// ─── Smart Vibe Merging ──────────────────────────────────────────
// Combines fields from multiple recent vibes into a single "merged" view.
// Solves the problem of partial vibes overwriting complete ones.
//
// Rules:
// - crowd, line: ALWAYS from the most recent vibe (last-write-wins, these change fast)
// - music, drinks_price_tier, cover, crowd_vibe, age_range: most recent NON-NULL value
// - created_at, user_id, id, is_verified: from the most recent vibe
// - _mergedFromCount: how many vibes contributed to this merged view

/**
 * Merge recent vibes for a venue into a single composite view.
 * 
 * @param {Object[]} recentVibes - Array of vibes sorted by created_at DESC (newest first).
 *   Typically the last 2-5 vibes within 2 hours.
 *   If only 1 vibe exists, returns it as-is (no merge needed).
 * @param {number} maxAgeMinutes - Max age of vibes to consider (default: 120 = 2 hours)
 * @returns {Object|null} Merged vibe object, or null if no valid vibes
 */
export function mergeRecentVibes(recentVibes, maxAgeMinutes = 120) {
  if (!recentVibes || recentVibes.length === 0) return null;
  if (recentVibes.length === 1) return recentVibes[0];

  const now = Date.now();
  const cutoff = maxAgeMinutes * 60 * 1000;

  // Filter to only vibes within the time window
  const validVibes = recentVibes.filter((v) => {
    if (!v?.created_at) return false;
    const age = now - new Date(v.created_at).getTime();
    return age < cutoff;
  });

  if (validVibes.length === 0) return null;
  if (validVibes.length === 1) return validVibes[0];

  // Start with the most recent vibe as the base
  const newest = validVibes[0];

  // Fields that are ALWAYS last-write-wins (time-sensitive state)
  // These come from the newest vibe, even if null
  const lastWriteWinsFields = ["crowd", "line"];

  // Fields that MERGE (use most recent non-null value)
  // These are stable facts about the venue tonight
  const mergeableFields = [
    "music",
    "drinks_price_tier",
    "drinks_price",    // legacy field
    "cover",
    "crowd_vibe",
    "age_range",
    "bar_type",
    "ratio",
  ];

  // Build the merged vibe
  const merged = {
    // Identity fields from newest vibe
    id: newest.id,
    venue_id: newest.venue_id,
    user_id: newest.user_id,
    created_at: newest.created_at,
    is_verified: newest.is_verified,
    verified: newest.verified,
    // Preserve isRecent flag from newest vibe
    isRecent: newest.isRecent,
    _recentUntil: newest._recentUntil,
  };

  // Last-write-wins fields: take from newest regardless of null
  for (const field of lastWriteWinsFields) {
    merged[field] = newest[field];
  }

  // Mergeable fields: find most recent non-null value
  for (const field of mergeableFields) {
    merged[field] = null;
    for (const vibe of validVibes) {
      if (vibe[field] != null && vibe[field] !== "") {
        merged[field] = vibe[field];
        break; // Found the most recent non-null, stop looking
      }
    }
  }

  // Metadata: how many vibes contributed
  merged._mergedFromCount = validVibes.length;
  merged._isMerged = validVibes.length > 1;

  return merged;
}