/**
 * Data Sources Constants
 * 
 * Defines data source types and labeling rules for venue display fields.
 * Used by the resolution engine to determine field visibility and labeling.
 */

export const DATA_SOURCE = Object.freeze({
  LIVE: 'LIVE',                     // Real-time user-generated vibe/check-in
  HISTORICAL_DB: 'HISTORICAL_DB',   // Curated/editorial value stored in Supabase venues table
  GENERIC_FALLBACK: 'GENERIC_FALLBACK', // Category-level guess (hide field)
});

/**
 * Maps Google Places price_level (1-4) to display string
 */
export const PRICE_LEVEL_MAP = {
  1: '$',
  2: '$$',
  3: '$$$',
  4: '$$$$',
};

/**
 * Prefix rules per source per field type
 * Applied when formatting labels for display
 */
export const LABEL_PREFIX = {
  crowd:  { HISTORICAL_DB: 'Usually ',  LIVE: '' },
  music:  { HISTORICAL_DB: 'Known for ', LIVE: '' },
  price:  { HISTORICAL_DB: '',           LIVE: '' },
  peak:   { HISTORICAL_DB: 'Usually ',   LIVE: '' },
  line:   { HISTORICAL_DB: 'Usually ',   LIVE: '' },
  cover:  { HISTORICAL_DB: 'Typically ', LIVE: '' },
};
