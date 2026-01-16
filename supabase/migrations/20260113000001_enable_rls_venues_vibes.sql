-- Enable RLS on venues and vibes tables
-- This migration enables Row Level Security and sets up policies

-- ============================================
-- VENUES TABLE
-- ============================================

-- Enable RLS on venues
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "venues_select_public" ON venues;
DROP POLICY IF EXISTS "venues_insert_admin_only" ON venues;
DROP POLICY IF EXISTS "venues_update_admin_only" ON venues;
DROP POLICY IF EXISTS "venues_delete_admin_only" ON venues;

-- Allow SELECT for everyone (public read)
CREATE POLICY "venues_select_public" ON venues
  FOR SELECT
  USING (true);

-- Deny INSERT/UPDATE/DELETE for all users (only service-role/admin can bypass RLS)
-- In Supabase, service-role bypasses RLS, so we don't need explicit policies
-- We just don't create policies that allow INSERT/UPDATE/DELETE for authenticated/anonymous

-- ============================================
-- VIBES TABLE
-- ============================================

-- Enable RLS on vibes
ALTER TABLE vibes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "vibes_select_public" ON vibes;
DROP POLICY IF EXISTS "vibes_insert_authenticated" ON vibes;
DROP POLICY IF EXISTS "vibes_update_denied" ON vibes;
DROP POLICY IF EXISTS "vibes_delete_denied" ON vibes;

-- Allow SELECT for everyone (public read)
CREATE POLICY "vibes_select_public" ON vibes
  FOR SELECT
  USING (true);

-- Allow INSERT only for authenticated users, and only for their own user_id
CREATE POLICY "vibes_insert_authenticated" ON vibes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE and DELETE policies
-- Note: No UPDATE or DELETE policies are created, which means these operations are denied by default (RLS default behavior)
-- This ensures vibes are immutable once created - users cannot modify or delete their posted vibes
-- If update/delete functionality is needed in the future, explicit policies should be created with appropriate authorization checks

