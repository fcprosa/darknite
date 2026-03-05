-- ═══════════════════════════════════════════════════════════════
-- DARKNITE — v1 App Store Compliance Migration
-- Clears fatal blockers identified in pre-launch audit
--
-- Run in: Supabase SQL Editor (as the postgres / superuser role)
-- Safe to re-run: all destructive steps use IF EXISTS guards
--
-- §1  vibe_reports   — UGC moderation reports table + RLS
-- §2  user_blocks    — User blocking table + RLS
-- §3  delete_user()  — GDPR/App Store account deletion RPC
-- §4  Harden RLS on vibes
-- §5  Harden RLS on user_profiles
-- ═══════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────
-- §1  VIBE_REPORTS
--
-- Purpose: receives "Report Vibe" submissions from users.
-- The app UI already shows the alert and calls this insert.
-- Intentionally no SELECT policy for authenticated role — users
-- cannot enumerate reports (prevents gaming / false-positive campaigns).
-- Admins review via Supabase dashboard using service_role.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vibe_reports (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id      uuid        NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
  reported_vibe_id bigint      NOT NULL REFERENCES public.vibes(id) ON DELETE CASCADE,
  reason           text        NOT NULL CHECK (
                                  reason IN (
                                    'spam',
                                    'fake_or_inaccurate',
                                    'inappropriate',
                                    'harassment',
                                    'other'
                                  )
                                ),
  details          text,                      -- optional free-text, max enforced app-side
  created_at       timestamptz NOT NULL DEFAULT now(),

  -- Prevent a user from reporting the same vibe twice
  UNIQUE (reporter_id, reported_vibe_id)
);

CREATE INDEX IF NOT EXISTS idx_vibe_reports_reported_vibe
  ON public.vibe_reports (reported_vibe_id);

CREATE INDEX IF NOT EXISTS idx_vibe_reports_reporter
  ON public.vibe_reports (reporter_id);

ALTER TABLE public.vibe_reports ENABLE ROW LEVEL SECURITY;

-- Users can submit a report (only under their own reporter_id)
DROP POLICY IF EXISTS "vibe_reports_insert_own" ON public.vibe_reports;
CREATE POLICY "vibe_reports_insert_own" ON public.vibe_reports
  FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- Users cannot read the reports table at all.
-- Admin review happens via service_role (Supabase dashboard / admin API).
-- No SELECT policy = default DENY for authenticated/anon roles.

COMMENT ON TABLE public.vibe_reports IS
  'UGC moderation: user-submitted reports on vibes. '
  'Read access is service_role-only (admin review). '
  'Required for Apple App Store UGC guideline 1.2 compliance.';


-- ─────────────────────────────────────────────────────────────
-- §2  USER_BLOCKS
--
-- Purpose: allows users to block another user so their vibes
-- are filtered from the blocked user's feed. Blocks are
-- keyed on auth.users.id so they survive profile updates.
-- Blocker can read and delete their own blocks (unblock).
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_user_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (blocker_id, blocked_user_id),
  -- A user cannot block themselves
  CHECK (blocker_id <> blocked_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker
  ON public.user_blocks (blocker_id);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked
  ON public.user_blocks (blocked_user_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- Users can see their own block list (needed to filter vibes client-side)
DROP POLICY IF EXISTS "user_blocks_select_own" ON public.user_blocks;
CREATE POLICY "user_blocks_select_own" ON public.user_blocks
  FOR SELECT
  USING (auth.uid() = blocker_id);

-- Users can block someone (only as themselves)
DROP POLICY IF EXISTS "user_blocks_insert_own" ON public.user_blocks;
CREATE POLICY "user_blocks_insert_own" ON public.user_blocks
  FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

-- Users can unblock (delete their own blocks only)
DROP POLICY IF EXISTS "user_blocks_delete_own" ON public.user_blocks;
CREATE POLICY "user_blocks_delete_own" ON public.user_blocks
  FOR DELETE
  USING (auth.uid() = blocker_id);

COMMENT ON TABLE public.user_blocks IS
  'User block list. Blocker can INSERT/SELECT/DELETE their own rows. '
  'The app filters vibes from blocked users client-side on load. '
  'Required for Apple App Store UGC guideline 1.2 compliance.';


-- ─────────────────────────────────────────────────────────────
-- §3  DELETE_USER() RPC
--
-- Called by: AuthContext.js → supabase.rpc('delete_user')
-- Required by: Apple App Store Review Guideline 5.1.1(v) — apps
--   must provide a mechanism to delete accounts and associated data.
--
-- Security model:
--   SECURITY DEFINER + SET search_path = public prevents search-path
--   injection. The caller's identity is always auth.uid() — no spoofing.
--   The function is owned by the postgres role (run in SQL Editor),
--   so it has permission to DELETE from auth.users directly.
--
-- Deletion order (respects FK dependencies):
--   1. vibe_reports    — FK → auth.users (reporter_id)
--   2. user_blocks     — FK → auth.users (both columns)
--   3. moves           — FK → auth.users (user_id)
--   4. vibes           — FK → user_profiles (user_id)
--   5. check_ins       — FK → user_profiles (user_id)
--   6. user_points     — FK → user_profiles (user_id)
--   7. user_profiles   — FK → auth.users (id)
--   8. auth.users      — hard delete (cascades anything we missed)
--
-- NOTE: Steps 1-7 are belt-and-suspenders. If all FKs have ON DELETE
-- CASCADE pointing to auth.users, step 8 alone would suffice. We do
-- the explicit deletes first to guarantee data removal regardless of
-- how the FKs were created, and to allow auditing each step.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- ── Auth guard ─────────────────────────────────────────────
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required — must be signed in to delete account'
      USING ERRCODE = '42501';
  END IF;

  -- ── 1. Delete UGC moderation rows keyed to auth.users ──────
  DELETE FROM public.vibe_reports
    WHERE reporter_id = v_user_id;

  DELETE FROM public.user_blocks
    WHERE blocker_id = v_user_id
       OR blocked_user_id = v_user_id;

  -- ── 2. Delete moves (FK → auth.users) ──────────────────────
  DELETE FROM public.moves
    WHERE user_id = v_user_id;

  -- ── 3. Delete content (FK → user_profiles) ─────────────────
  --    These must come before user_profiles so FK constraints are
  --    satisfied if ON DELETE CASCADE is not set on those FKs.
  DELETE FROM public.vibes
    WHERE user_id = v_user_id;

  DELETE FROM public.check_ins
    WHERE user_id = v_user_id;

  DELETE FROM public.user_points
    WHERE user_id = v_user_id;

  -- ── 4. Delete public profile ────────────────────────────────
  DELETE FROM public.user_profiles
    WHERE id = v_user_id;

  -- ── 5. Hard-delete from auth.users ─────────────────────────
  --    Requires this function to be owned by the postgres role.
  --    Run this migration in the Supabase SQL Editor (postgres role)
  --    to ensure ownership is correct.
  --    This call cascades to any FK referencing auth.users that we
  --    may have missed above.
  DELETE FROM auth.users
    WHERE id = v_user_id;

END;
$$;

-- Restrict execution: only authenticated users can call this
REVOKE ALL ON FUNCTION public.delete_user() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.delete_user() TO authenticated;

COMMENT ON FUNCTION public.delete_user() IS
  'Deletes the calling user''s account and all associated data. '
  'Required by Apple App Store Review Guideline 5.1.1(v). '
  'Owned by postgres for auth.users DELETE permission. '
  'Called from AuthContext.js via supabase.rpc(''delete_user'').';


-- ─────────────────────────────────────────────────────────────
-- §4  HARDEN RLS ON vibes
--
-- Current state (from schema doc): RLS may be enabled in the
-- Supabase dashboard, but it is not committed to migrations.
-- This section makes the state explicit and idempotent.
--
-- Policy intent:
--   SELECT  — public (feed is the core product, anon users can browse)
--   INSERT  — BLOCKED by RLS. All inserts must go through the
--             submit_venue_vibe RPC (SECURITY DEFINER bypasses RLS),
--             which enforces rate limiting. Direct client inserts
--             are denied, eliminating rate-limit bypass.
--   UPDATE  — owner only (auth.uid() = user_id)
--   DELETE  — owner only (auth.uid() = user_id)
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.vibes ENABLE ROW LEVEL SECURITY;

-- SELECT: anyone (including anon) can read vibes
DROP POLICY IF EXISTS "vibes_select_public" ON public.vibes;
CREATE POLICY "vibes_select_public" ON public.vibes
  FOR SELECT
  USING (true);

-- INSERT: explicitly denied for all roles.
-- The submit_venue_vibe RPC is SECURITY DEFINER and bypasses this.
-- Any direct supabase.from('vibes').insert() call from the client
-- will now be rejected, closing the rate-limit bypass vulnerability.
DROP POLICY IF EXISTS "vibes_insert_rpc_only" ON public.vibes;
-- (No INSERT policy = default DENY. We DROP any old permissive one.)

-- UPDATE: owner only
DROP POLICY IF EXISTS "vibes_update_own"   ON public.vibes;
DROP POLICY IF EXISTS "vibes_update_owner" ON public.vibes;
CREATE POLICY "vibes_update_own" ON public.vibes
  FOR UPDATE
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: owner only
DROP POLICY IF EXISTS "vibes_delete_own"   ON public.vibes;
DROP POLICY IF EXISTS "vibes_delete_owner" ON public.vibes;
CREATE POLICY "vibes_delete_own" ON public.vibes
  FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.vibes IS
  'User-submitted venue vibes. '
  'INSERT is RLS-denied for all client roles — use submit_venue_vibe RPC. '
  'UPDATE/DELETE restricted to row owner.';


-- ─────────────────────────────────────────────────────────────
-- §5  HARDEN RLS ON user_profiles
--
-- Current state: policies exist in dashboard per schema doc.
-- Making explicit and idempotent here.
--
-- Policy intent:
--   SELECT  — public (usernames visible on leaderboards/vibes)
--   INSERT  — owner only (user creates their own profile on signup)
--   UPDATE  — owner only
--   DELETE  — explicitly denied; deletion cascades from auth.users
--             via delete_user() RPC above
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: anyone can read profiles (username shown on vibes feed)
DROP POLICY IF EXISTS "user_profiles_select_public" ON public.user_profiles;
DROP POLICY IF EXISTS "profiles_select_all"         ON public.user_profiles;
CREATE POLICY "user_profiles_select_public" ON public.user_profiles
  FOR SELECT
  USING (true);

-- INSERT: user can only create their own profile (id must match auth.uid())
DROP POLICY IF EXISTS "user_profiles_insert_own"  ON public.user_profiles;
DROP POLICY IF EXISTS "profiles_insert_own"        ON public.user_profiles;
CREATE POLICY "user_profiles_insert_own" ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- UPDATE: owner only
DROP POLICY IF EXISTS "user_profiles_update_own"  ON public.user_profiles;
DROP POLICY IF EXISTS "profiles_update_own"        ON public.user_profiles;
CREATE POLICY "user_profiles_update_own" ON public.user_profiles
  FOR UPDATE
  USING      (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- DELETE: explicitly denied for all client roles.
-- Deletion is handled exclusively by delete_user() RPC (SECURITY DEFINER).
-- No DELETE policy = default DENY.
DROP POLICY IF EXISTS "user_profiles_delete_own" ON public.user_profiles;
DROP POLICY IF EXISTS "profiles_delete_own"       ON public.user_profiles;

COMMENT ON TABLE public.user_profiles IS
  'Public user profiles. SELECT is public. INSERT/UPDATE owner-only. '
  'DELETE is RLS-denied for clients — use delete_user() RPC.';


-- ─────────────────────────────────────────────────────────────
-- VERIFICATION QUERIES
-- Run these after applying the migration to confirm the state.
-- ─────────────────────────────────────────────────────────────

-- 1. Confirm RLS is enabled on all critical tables:
--    SELECT tablename, rowsecurity FROM pg_tables
--    WHERE schemaname = 'public'
--    AND tablename IN ('vibes','user_profiles','vibe_reports','user_blocks','moves');
--    Expected: rowsecurity = true for all five.

-- 2. Confirm all policies:
--    SELECT tablename, policyname, cmd, qual, with_check
--    FROM pg_policies
--    WHERE schemaname = 'public'
--    ORDER BY tablename, cmd;

-- 3. Confirm delete_user function exists and is SECURITY DEFINER:
--    SELECT proname, prosecdef, proowner::regrole
--    FROM pg_proc
--    WHERE proname = 'delete_user';
--    Expected: prosecdef = true, proowner = 'postgres' (or supabase superuser).
