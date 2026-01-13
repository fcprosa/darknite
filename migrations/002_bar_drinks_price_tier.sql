-- Migration: Add drinks_price_tier column for bars and update constraints
-- Run this migration in your Supabase SQL editor

-- Step 1: Add the new drinks_price_tier column
ALTER TABLE vibes 
  ADD COLUMN IF NOT EXISTS drinks_price_tier TEXT 
  CHECK (drinks_price_tier IS NULL OR drinks_price_tier IN ('cheap', 'normal', 'expensive', 'crazy'));

-- Step 2: Migrate existing bar vibes from drinks_price to drinks_price_tier
-- This maps the old range-based system to the new tier system:
-- "$" (< $10) -> "cheap"
-- "$$" ($10-20) -> "normal"  
-- "$$$" ($20-30) -> "expensive"
-- "$$$$" ($30+) -> "crazy"
UPDATE vibes
SET drinks_price_tier = CASE
  WHEN drinks_price = '$' THEN 'cheap'
  WHEN drinks_price = '$$' THEN 'normal'
  WHEN drinks_price = '$$$' THEN 'expensive'
  WHEN drinks_price = '$$$$' THEN 'crazy'
  ELSE NULL
WHERE drinks_price IS NOT NULL 
  AND drinks_price_tier IS NULL
  -- Only migrate bars (venues with bar_type set, or we can identify by venue_type if available)
  -- Adjust this condition based on your schema:
  AND (bar_type IS NOT NULL OR EXISTS (
    SELECT 1 FROM venues 
    WHERE venues.id = vibes.venue_id 
    AND venues.venue_type = 'bar'
  ));

-- Step 3: Update existing constraint on drinks_price if it exists
-- Drop old constraint if it prevents bars from having NULL drinks_price
DO $$
BEGIN
  -- Check if constraint exists and drop it
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'vibes_drinks_price_check'
    AND table_name = 'vibes'
  ) THEN
    ALTER TABLE vibes DROP CONSTRAINT vibes_drinks_price_check;
  END IF;
END $$;

-- Step 4: Add new constraint that allows NULL drinks_price for bars
-- (bars will use drinks_price_tier instead)
-- Clubs can still use drinks_price for cover charges
ALTER TABLE vibes
  ADD CONSTRAINT vibes_drinks_price_format 
  CHECK (
    drinks_price IS NULL 
    OR drinks_price IN ('$', '$$', '$$$', '$$$$')
  );

-- Step 5: Create index for faster filtering by tier
CREATE INDEX IF NOT EXISTS idx_vibes_drinks_price_tier 
  ON vibes(drinks_price_tier) 
  WHERE drinks_price_tier IS NOT NULL;

-- Verify the changes
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'vibes' 
  AND column_name IN ('drinks_price', 'drinks_price_tier');

SELECT 
  drinks_price_tier, 
  COUNT(*) as count
FROM vibes
WHERE drinks_price_tier IS NOT NULL
GROUP BY drinks_price_tier;
