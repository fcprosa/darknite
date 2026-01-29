-- Migration: Update drinks_price_tier values from old to new schema
-- Run this once to migrate existing data

-- 1. Remove old constraint
ALTER TABLE vibes DROP CONSTRAINT IF EXISTS vibes_drinks_price_tier_check;

-- 2. Migrate existing data
UPDATE vibes SET drinks_price_tier = 'moderate' WHERE drinks_price_tier = 'normal';
UPDATE vibes SET drinks_price_tier = 'pricey' WHERE drinks_price_tier = 'crazy';

-- 3. Add new constraint with updated values
ALTER TABLE vibes 
ADD CONSTRAINT vibes_drinks_price_tier_check 
CHECK (drinks_price_tier IN ('cheap', 'moderate', 'pricey', 'expensive'));