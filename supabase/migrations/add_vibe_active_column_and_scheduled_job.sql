-- Migration: Add vibe_active column and scheduled job for automatic expiry
-- Purpose: Track active vibes at DB level and automatically expire stale ones

-- Step 1: Add latest_vibe_created_at column to venues table (denormalized for performance)
-- This will be updated via trigger when vibes are inserted/updated
ALTER TABLE venues ADD COLUMN IF NOT EXISTS latest_vibe_created_at TIMESTAMPTZ;

-- Step 2: Add vibe_active column to venues table
ALTER TABLE venues ADD COLUMN IF NOT EXISTS vibe_active BOOLEAN DEFAULT false;

-- Step 3: Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_venues_vibe_active_created_at 
  ON venues(vibe_active, latest_vibe_created_at) 
  WHERE vibe_active = true;

-- Step 4: Create trigger to update latest_vibe_created_at when vibes are inserted/updated
CREATE OR REPLACE FUNCTION update_venue_latest_vibe()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE venues
  SET 
    latest_vibe_created_at = NEW.created_at,
    vibe_active = (NEW.created_at > NOW() - INTERVAL '90 minutes')
  WHERE id = NEW.venue_id;
  RETURN NEW;
END;
$$;

-- Drop trigger if it exists, then create it
DROP TRIGGER IF EXISTS trigger_update_venue_latest_vibe ON vibes;
CREATE TRIGGER trigger_update_venue_latest_vibe
  AFTER INSERT OR UPDATE ON vibes
  FOR EACH ROW
  EXECUTE FUNCTION update_venue_latest_vibe();

-- Step 5: Create function to expire stale vibes (runs via scheduled job)
CREATE OR REPLACE FUNCTION expire_stale_vibes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE venues
  SET vibe_active = false
  WHERE latest_vibe_created_at < NOW() - INTERVAL '90 minutes'
    AND vibe_active = true;
END;
$$;

-- Step 4: Schedule the function to run every 15 minutes using pg_cron
-- Note: pg_cron must be enabled in your Supabase project
-- If pg_cron is not available, use Supabase Edge Functions with a cron trigger instead

-- Uncomment the following if pg_cron is enabled:
-- SELECT cron.schedule(
--   'expire-stale-vibes',
--   '*/15 * * * *', -- Every 15 minutes
--   $$SELECT expire_stale_vibes()$$
-- );

-- Alternative: Use Supabase Edge Function with cron trigger
-- See: https://supabase.com/docs/guides/functions/scheduled-functions

COMMENT ON COLUMN venues.vibe_active IS 'True if venue has an active vibe (posted within last 90 minutes). Automatically set to false by scheduled job.';
COMMENT ON FUNCTION expire_stale_vibes() IS 'Expires vibe_active flag for venues with vibes older than 90 minutes. Runs every 15 minutes via pg_cron or Edge Function.';
