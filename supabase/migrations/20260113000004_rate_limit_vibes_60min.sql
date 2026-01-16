-- Rate limit trigger for vibes table
-- Enforces: each authenticated user can post only one vibe per venue every 60 minutes
-- This replaces the previous 15-minute rate limit

-- Drop old 15-minute trigger and function if they exist (superseded by 60-min limit)
DROP TRIGGER IF EXISTS vibe_rate_limit_trigger ON public.vibes;
DROP FUNCTION IF EXISTS check_vibe_rate_limit() CASCADE;

-- Drop 60-minute trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS vibe_rate_limit_60min_trigger ON public.vibes;

-- Drop 60-minute function if it exists (for idempotency)
DROP FUNCTION IF EXISTS check_vibe_rate_limit_60min() CASCADE;

-- Create function to check 60-minute rate limit
CREATE OR REPLACE FUNCTION check_vibe_rate_limit_60min()
RETURNS TRIGGER AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  -- Check if user has posted a vibe for this venue in the last 60 minutes
  SELECT COUNT(*)
  INTO recent_count
  FROM public.vibes
  WHERE user_id = auth.uid()
    AND venue_id = NEW.venue_id
    AND created_at > NOW() - INTERVAL '60 minutes';

  -- If there's a recent vibe (excluding the current insert), block it
  IF recent_count > 0 THEN
    RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED: You have already posted a vibe for this venue in the last 60 minutes.'
      USING ERRCODE = '23505'; -- Use unique_violation error code
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that runs BEFORE INSERT
CREATE TRIGGER vibe_rate_limit_60min_trigger
  BEFORE INSERT ON public.vibes
  FOR EACH ROW
  EXECUTE FUNCTION check_vibe_rate_limit_60min();
