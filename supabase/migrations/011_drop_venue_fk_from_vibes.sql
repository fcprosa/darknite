-- Phase 3.3: Allow v2 rows without a venues.id FK (place_id is the Google key)
-- Sacred: venue_id column is NOT dropped — only nullable + FK removed.

ALTER TABLE public.vibes
  ALTER COLUMN venue_id DROP NOT NULL;

ALTER TABLE public.check_ins
  ALTER COLUMN venue_id DROP NOT NULL;

-- Drop FK constraints (names vary by project; try common patterns idempotently)
ALTER TABLE public.vibes
  DROP CONSTRAINT IF EXISTS vibes_venue_id_fkey;

ALTER TABLE public.vibes
  DROP CONSTRAINT IF EXISTS fk_vibes_venue_id;

ALTER TABLE public.check_ins
  DROP CONSTRAINT IF EXISTS check_ins_venue_id_fkey;

ALTER TABLE public.check_ins
  DROP CONSTRAINT IF EXISTS fk_check_ins_venue_id;

-- Catch-all: drop any remaining FK from vibes/check_ins → venues
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conrelid::regclass AS tbl, conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname IN ('vibes', 'check_ins')
      AND c.contype = 'f'
      AND pg_get_constraintdef(c.oid) LIKE '%venues%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', r.tbl, r.conname);
  END LOOP;
END $$;
