-- Add historical intelligence columns to venues table
-- These store seeded data from Google Places + manual curation
-- Used by feedHelpers.js to show per-venue defaults when no live vibes exist

ALTER TABLE venues ADD COLUMN IF NOT EXISTS typical_peak_hour numeric;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS typical_peak_label text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS typical_crowd text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS usual_cover text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS usual_line text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS usual_music text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS google_price_level integer;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS google_rating numeric;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS google_place_id text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS popular_times_friday jsonb;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS popular_times_saturday jsonb;

COMMENT ON COLUMN venues.typical_peak_hour IS 'Decimal hour of typical peak (e.g. 23.5 = 11:30 PM). Derived from Google Popular Times.';
COMMENT ON COLUMN venues.typical_peak_label IS 'Human-readable peak time label (e.g. "Usually peaks around 11:30"). Used on feed cards.';
COMMENT ON COLUMN venues.typical_crowd IS 'Expected crowd level at peak (Dead/Chill/Fun/Packed/Chaos). Manual curation.';
COMMENT ON COLUMN venues.usual_cover IS 'Typical cover charge (e.g. "$20-30", "Free"). Manual curation.';
COMMENT ON COLUMN venues.usual_line IS 'Typical line situation (e.g. "Expect a line", "Walk right in"). Manual curation.';
COMMENT ON COLUMN venues.usual_music IS 'Primary music genre (e.g. "Hip-Hop / R&B", "House / Techno"). Manual curation.';
COMMENT ON COLUMN venues.google_price_level IS 'Google Places price_level (0-4). 0=free, 1=$, 2=$$, 3=$$$, 4=$$$$.';
COMMENT ON COLUMN venues.google_rating IS 'Google Places rating (1.0-5.0).';
COMMENT ON COLUMN venues.google_place_id IS 'Google Places ID for future API lookups.';
COMMENT ON COLUMN venues.popular_times_friday IS 'Google Popular Times data for Friday as JSON array of hourly busyness (0-100).';
COMMENT ON COLUMN venues.popular_times_saturday IS 'Google Popular Times data for Saturday as JSON array of hourly busyness (0-100).';
