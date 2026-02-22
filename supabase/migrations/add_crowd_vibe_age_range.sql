-- Add crowd vibe and age range columns to vibes table
ALTER TABLE vibes ADD COLUMN IF NOT EXISTS crowd_vibe text;
ALTER TABLE vibes ADD COLUMN IF NOT EXISTS age_range text;

COMMENT ON COLUMN vibes.crowd_vibe IS 'Crowd gender vibe: mostly_guys, mostly_girls, good_mix, couples';
COMMENT ON COLUMN vibes.age_range IS 'Perceived age range: young, mixed, older';
