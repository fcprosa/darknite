-- Add default venue display fields for VENUE_OVERRIDES migration
-- These columns store curated/editorial values that replace hardcoded overrides
-- Source of truth moves from feedHelpers.js VENUE_OVERRIDES to Supabase venues table

ALTER TABLE venues ADD COLUMN IF NOT EXISTS default_crowd_label TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS default_music_genre TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS default_peak_label TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS default_line_note TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS default_cover_note TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS defaults_source TEXT DEFAULT 'backfill_v1';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS defaults_updated_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN venues.default_crowd_label IS 'Curated crowd level label (Dead/Chill/Fun/Packed/Chaos). Replaces VENUE_OVERRIDES.typical_crowd.';
COMMENT ON COLUMN venues.default_music_genre IS 'Curated primary music genre (e.g. "Hip-Hop / R&B", "House / Techno"). Replaces VENUE_OVERRIDES.usual_music.';
COMMENT ON COLUMN venues.default_peak_label IS 'Curated peak time label (e.g. "Usually peaks around midnight"). Replaces VENUE_OVERRIDES.typical_peak_label.';
COMMENT ON COLUMN venues.default_line_note IS 'Curated line situation note (e.g. "Expect a line", "Walk right in"). Replaces VENUE_OVERRIDES.usual_line.';
COMMENT ON COLUMN venues.default_cover_note IS 'Curated cover charge note (e.g. "$20-30", "Free"). Replaces VENUE_OVERRIDES.usual_cover.';
COMMENT ON COLUMN venues.defaults_source IS 'Source tag for defaults (e.g. "backfill_v1", "manual_edit"). Used for rollback safety.';
COMMENT ON COLUMN venues.defaults_updated_at IS 'Timestamp when defaults were last updated.';
