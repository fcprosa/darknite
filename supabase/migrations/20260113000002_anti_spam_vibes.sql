-- Anti-spam trigger for vibes table
-- Prevents users from posting multiple vibes for the same venue within 15 minutes

-- Drop function if it exists (for idempotency)
DROP FUNCTION IF EXISTS check_vibe_rate_limit() CASCADE;

-- Create function to check rate limit
CREATE OR REPLACE FUNCTION check_vibe_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  -- Check if user has posted a vibe for this venue in the last 15 minutes
  SELECT COUNT(*)
  INTO recent_count
  FROM vibes
  WHERE user_id = auth.uid()
    AND venue_id = NEW.venue_id
    AND created_at > NOW() - INTERVAL '15 minutes';

  -- If there's a recent vibe (excluding the current insert), block it
  IF recent_count > 0 THEN
    RAISE EXCEPTION 'Rate limit exceeded: You have already posted a vibe for this venue recently. Please wait 15 minutes before posting again.'
      USING ERRCODE = '23505'; -- Use unique_violation error code
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS vibe_rate_limit_trigger ON vibes;

-- Create trigger that runs BEFORE INSERT
CREATE TRIGGER vibe_rate_limit_trigger
  BEFORE INSERT ON vibes
  FOR EACH ROW
  EXECUTE FUNCTION check_vibe_rate_limit();

