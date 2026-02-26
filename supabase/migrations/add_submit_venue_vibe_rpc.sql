-- ═══════════════════════════════════════════════════════════════
-- submit_venue_vibe RPC — Server-authoritative vibe submission
--
-- Enforces two rate limits before accepting a new vibe:
--   1. rate_limit_venue  — 1 vibe per venue per 30 minutes (per user)
--   2. rate_limit_global — max 15 vibes in a rolling 12-hour window (per user)
--
-- After passing both checks it applies an upsert strategy:
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
  v_user_id            uuid;
  v_last_vibe_at       timestamptz;
  v_minutes_since_last float;
  v_minutes_remaining  int;
  v_global_count       int;
  v_existing_vibe_id   bigint;
  v_result             vibes%ROWTYPE;
BEGIN
  -- ── Auth guard ────────────────────────────────────────────
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  -- ── 1. Per-venue cooldown: 30 minutes ────────────────────
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

  -- ── 2. Global cap: 15 vibes per 12-hour window ───────────
  SELECT COUNT(*) INTO v_global_count
  FROM   vibes
  WHERE  user_id    = v_user_id
    AND  created_at > NOW() - INTERVAL '12 hours';

  IF v_global_count >= 15 THEN
    RAISE EXCEPTION 'rate_limit_global'
      USING DETAIL  = 'count=' || v_global_count,
            ERRCODE = 'P0001';
  END IF;

  -- ── 3. Upsert: UPDATE within 4 h, otherwise INSERT ───────
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
