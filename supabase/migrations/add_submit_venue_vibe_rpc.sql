-- ═══════════════════════════════════════════════════════════════
-- submit_venue_vibe RPC — Server-authoritative vibe submission
--
-- Enforces three rate limits before accepting a new vibe:
--   1. rate_limit_speed  — 10 minutes between ANY submission (any venue)
--   2. rate_limit_venue  — 30 minutes between submissions at the SAME venue
--   3. rate_limit_global — max 15 vibes in a rolling 12-hour window
--
-- Admin bypass: if auth.uid() matches ADMIN_UUID all three checks are
-- skipped entirely. This allows cold-start data seeding without hitting
-- any caps. The 4-hour upsert window still applies so repeated calls for
-- the same venue UPDATE rather than INSERT duplicate rows.
--
-- After passing the checks (or bypassing them) it applies an upsert strategy:
--   • If the user posted at this venue within the last 4 hours → UPDATE that row
--   • Otherwise → INSERT a new row
--
-- SECURITY DEFINER + SET search_path prevents search-path injection.
-- The authenticated user ID is always taken from auth.uid() — the caller
-- cannot forge a different user_id through function parameters.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION submit_venue_vibe(
  p_venue_id          text,
  p_crowd             text    DEFAULT NULL,
  p_music             text    DEFAULT NULL,
  p_line              text    DEFAULT NULL,
  p_cover             text    DEFAULT NULL,
  p_drinks_price_tier text    DEFAULT NULL,
  p_crowd_vibe        text    DEFAULT NULL,
  p_age_range         text    DEFAULT NULL,
  p_confidence_score  float   DEFAULT NULL
)
RETURNS SETOF vibes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- ⚠️  PASTE YOUR UUID BETWEEN THE SINGLE QUOTES BELOW
  --     Find it in: Supabase Dashboard → Authentication → Users → your row → User UID
  ADMIN_UUID           CONSTANT uuid := '00000000-0000-0000-0000-000000000000';

  v_user_id            uuid;
  v_is_admin           boolean;
  v_last_any_vibe_at   timestamptz;
  v_last_vibe_at       timestamptz;
  v_minutes_since_last float;
  v_minutes_remaining  int;
  v_global_count       int;
  v_existing_vibe_id   bigint;
  v_result             vibes%ROWTYPE;
BEGIN
  -- ── Auth guard ────────────────────────────────────────────
  v_user_id  := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  v_is_admin := (v_user_id = ADMIN_UUID);

  -- ── 1. Global speed limit: 10 minutes between ANY submission (skipped for admin) ──
  IF NOT v_is_admin THEN
    SELECT created_at INTO v_last_any_vibe_at
    FROM   vibes
    WHERE  user_id = v_user_id
    ORDER  BY created_at DESC
    LIMIT  1;

    IF v_last_any_vibe_at IS NOT NULL THEN
      v_minutes_since_last :=
        EXTRACT(EPOCH FROM (NOW() - v_last_any_vibe_at)) / 60.0;

      IF v_minutes_since_last < 10 THEN
        v_minutes_remaining := CEIL(10 - v_minutes_since_last)::int;
        RAISE EXCEPTION 'rate_limit_speed'
          USING DETAIL  = 'minutes_remaining=' || v_minutes_remaining,
                ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  -- ── 2. Per-venue cooldown: 30 minutes (skipped for admin) ─
  IF NOT v_is_admin THEN
    SELECT created_at INTO v_last_vibe_at
    FROM   vibes
    WHERE  user_id  = v_user_id
      AND  venue_id = p_venue_id
    ORDER  BY created_at DESC
    LIMIT  1;

    IF v_last_vibe_at IS NOT NULL THEN
      v_minutes_since_last :=
        EXTRACT(EPOCH FROM (NOW() - v_last_vibe_at)) / 60.0;

      IF v_minutes_since_last < 30 THEN
        v_minutes_remaining := CEIL(30 - v_minutes_since_last)::int;
        RAISE EXCEPTION 'rate_limit_venue'
          USING DETAIL  = 'minutes_remaining=' || v_minutes_remaining,
                ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  -- ── 3. Global cap: 15 vibes per 12-hour window (skipped for admin) ──
  IF NOT v_is_admin THEN
    SELECT COUNT(*) INTO v_global_count
    FROM   vibes
    WHERE  user_id    = v_user_id
      AND  created_at > NOW() - INTERVAL '12 hours';

    IF v_global_count >= 15 THEN
      RAISE EXCEPTION 'rate_limit_global'
        USING DETAIL  = 'count=' || v_global_count,
              ERRCODE = 'P0001';
    END IF;
  END IF;

  -- ── 4. Upsert: UPDATE within 4 h, otherwise INSERT ───────
  --    (applies to everyone including admin — prevents duplicate rows
  --     when tweaking the same venue multiple times in a seeding session)
  SELECT id INTO v_existing_vibe_id
  FROM   vibes
  WHERE  user_id    = v_user_id
    AND  venue_id   = p_venue_id
    AND  created_at > NOW() - INTERVAL '4 hours'
  ORDER  BY created_at DESC
  LIMIT  1;

  IF v_existing_vibe_id IS NOT NULL THEN
    -- UPDATE: COALESCE preserves existing values for skipped fields
    UPDATE vibes SET
      crowd             = COALESCE(p_crowd,             crowd),
      music             = COALESCE(p_music,             music),
      line              = COALESCE(p_line,              line),
      cover             = COALESCE(p_cover,             cover),
      drinks_price_tier = COALESCE(p_drinks_price_tier, drinks_price_tier),
      crowd_vibe        = COALESCE(p_crowd_vibe,        crowd_vibe),
      age_range         = COALESCE(p_age_range,         age_range),
      confidence_score  = COALESCE(p_confidence_score,  confidence_score),
      created_at        = NOW()
    WHERE id = v_existing_vibe_id
    RETURNING * INTO v_result;
  ELSE
    -- INSERT fresh vibe row
    INSERT INTO vibes (
      venue_id, user_id,
      crowd, music, line, cover,
      drinks_price_tier, crowd_vibe, age_range, confidence_score
    ) VALUES (
      p_venue_id, v_user_id,
      p_crowd, p_music, p_line, p_cover,
      p_drinks_price_tier, p_crowd_vibe, p_age_range, p_confidence_score
    )
    RETURNING * INTO v_result;
  END IF;

  RETURN NEXT v_result;
END;
$$;

-- Grant execute to authenticated users only
REVOKE ALL ON FUNCTION submit_venue_vibe FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION submit_venue_vibe TO authenticated;
