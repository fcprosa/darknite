-- ═══════════════════════════════════════════════════════════
-- VENUES TABLE — Historical intelligence columns
-- ═══════════════════════════════════════════════════════════

-- Peak hour (decimal, e.g. 23.5 = 11:30pm, 24.5 = 12:30am)
ALTER TABLE venues ADD COLUMN IF NOT EXISTS typical_peak_hour numeric;

-- Human-readable peak label shown when no live data
ALTER TABLE venues ADD COLUMN IF NOT EXISTS typical_peak_label text;

-- Typical crowd level for historical fallback
ALTER TABLE venues ADD COLUMN IF NOT EXISTS typical_crowd text;

-- Typical cover, line, music for chip defaults
ALTER TABLE venues ADD COLUMN IF NOT EXISTS usual_cover text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS usual_line text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS usual_music text;

-- Venue type (bar/club) — may already exist
ALTER TABLE venues ADD COLUMN IF NOT EXISTS venue_type text DEFAULT 'bar';

-- Google Places price level (0-4) from seeding script
ALTER TABLE venues ADD COLUMN IF NOT EXISTS google_price_level integer;

COMMENT ON COLUMN venues.typical_peak_hour IS 'Decimal hour of typical peak. 23.5 = 11:30pm. Used by feedScore historical component.';
COMMENT ON COLUMN venues.venue_type IS 'bar or club. Determines I''m Here flow variant and chip layout.';

-- ═══════════════════════════════════════════════════════════
-- VIBES TABLE — New fields for I'm Here flow + future V1.1
-- ═══════════════════════════════════════════════════════════

-- Crowd vibe (ratio proxy): mostly_guys, mostly_girls, good_mix, couples
ALTER TABLE vibes ADD COLUMN IF NOT EXISTS crowd_vibe text;

-- Age range: young, mixed, older
ALTER TABLE vibes ADD COLUMN IF NOT EXISTS age_range text;

-- V1.1 PREP: Confidence score (0-1). Computed on write. NULL for V1.
-- When a new vibe agrees with the previous (same crowd level ±1 step),
-- confidence = min(1, prev_confidence + 0.2). When it diverges, confidence resets to 0.5.
-- This column is NOT used by feedHelpers in V1. It's populated on insert for future use.
ALTER TABLE vibes ADD COLUMN IF NOT EXISTS confidence_score numeric;

COMMENT ON COLUMN vibes.crowd_vibe IS 'Crowd gender vibe: mostly_guys, mostly_girls, good_mix, couples';
COMMENT ON COLUMN vibes.age_range IS 'Perceived age range: young, mixed, older';
COMMENT ON COLUMN vibes.confidence_score IS 'V1.1: Agreement score 0-1. NULL in V1. Future use for vibe conflict resolution.';

-- ═══════════════════════════════════════════════════════════
-- USER_PROFILES TABLE — Founder/verified user flag
-- ═══════════════════════════════════════════════════════════

-- is_verified: founders and trusted seeders get 1.2x weight on their vibes
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;

COMMENT ON COLUMN user_profiles.is_verified IS 'Founder/trusted seeder. Vibes from verified users get 1.2x weight in feed ranking.';

-- Set founder accounts as verified (replace with actual user IDs)
UPDATE user_profiles
SET is_verified = true
WHERE id IN ('4fd367d0-9ea8-47c4-9309-816ac7622086');

-- ═══════════════════════════════════════════════════════════
-- INDEX: Fast vibe lookups for tonight's vibes per venue
-- ═══════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_vibes_venue_recent
  ON vibes (venue_id, created_at DESC);

