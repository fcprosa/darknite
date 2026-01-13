-- Migration: Ensure all venues have unique IDs and vibes reference valid venue IDs
-- Run this migration in your Supabase SQL editor

-- Step 1: Ensure all venues have IDs (if needed, generate UUIDs for any null IDs)
-- Note: This assumes your venues table already has an id column
-- If some venues have null IDs, you'll need to update them first:
-- UPDATE venues SET id = gen_random_uuid() WHERE id IS NULL;

-- Step 2: Make ID NOT NULL and unique
ALTER TABLE venues ALTER COLUMN id SET NOT NULL;
ALTER TABLE venues ADD CONSTRAINT venues_id_unique UNIQUE (id);

-- Step 3: Ensure vibes always reference valid venue IDs with foreign key constraint
-- First, clean up any orphaned vibes (vibes referencing non-existent venues)
-- DELETE FROM vibes WHERE venue_id NOT IN (SELECT id FROM venues);

-- Then add the foreign key constraint
ALTER TABLE vibes 
  ADD CONSTRAINT fk_vibes_venue 
  FOREIGN KEY (venue_id) 
  REFERENCES venues(id) 
  ON DELETE CASCADE;

-- Verify the constraints
SELECT 
  constraint_name, 
  constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'venues' AND constraint_type IN ('UNIQUE', 'NOT NULL');

SELECT 
  constraint_name, 
  constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'vibes' AND constraint_type = 'FOREIGN KEY';
