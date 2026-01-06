-- Migration SQL for Supabase vibes table
-- Run this in Supabase SQL Editor

-- Add new columns to vibes table
ALTER TABLE vibes
ADD COLUMN IF NOT EXISTS music TEXT,
ADD COLUMN IF NOT EXISTS stay_duration TEXT,
ADD COLUMN IF NOT EXISTS comment TEXT,
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add constraint to make music required (NOT NULL)
-- Note: This will fail if there are existing rows. 
-- If you have existing data, either:
-- 1. Set a default value first: UPDATE vibes SET music = 'Mixed' WHERE music IS NULL;
-- 2. Or make it nullable for now and add NOT NULL constraint later
ALTER TABLE vibes
ALTER COLUMN music SET NOT NULL;

-- Add check constraint for music values (optional, but recommended)
ALTER TABLE vibes
ADD CONSTRAINT vibes_music_check CHECK (
  music IN (
    'Hip-Hop / R&B',
    'Afrobeats',
    'House / Techno',
    'Reggaeton',
    'Top Hits',
    'Mixed'
  )
);

-- If the check constraint fails because of existing data, you can:
-- 1. First update invalid values: UPDATE vibes SET music = 'Mixed' WHERE music NOT IN (...);
-- 2. Or skip the check constraint for now and enforce it at application level

