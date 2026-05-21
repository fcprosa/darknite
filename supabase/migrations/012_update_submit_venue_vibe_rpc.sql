-- Phase 3.3.5: submit_venue_vibe uses Google place_id (v2)
-- Rate limits unchanged; per-venue checks match place_id OR legacy venue_id.
--
-- Postgres cannot rename p_venue_id → p_place_id via CREATE OR REPLACE (42P13).
-- Drop all overloads of the legacy function first.

DROP FUNCTION IF EXISTS public.submit_venue_vibe(
  text, text, text, text, text, text, text, text, double precision
);

DROP FUNCTION IF EXISTS public.submit_venue_vibe(
  text, text, text, text, text, text, text, text, real
);

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'submit_venue_vibe'
  LOOP
    EXECUTE format(
      'DROP FUNCTION IF EXISTS public.submit_venue_vibe(%s)',
      r.args
    );
  END LOOP;
END $$;

CREATE FUNCTION submit_venue_vibe(
  p_place_id          text,
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
  ADMIN_UUID           CONSTANT uuid := 'b668ed54-5379-4ac7-b798-b9589a99442b';

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
  IF p_place_id IS NULL OR trim(p_place_id) = '' THEN
    RAISE EXCEPTION 'place_id is required'
      USING ERRCODE = '22023';
  END IF;

  v_user_id  := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  v_is_admin := (v_user_id = ADMIN_UUID);

  -- 1. Global speed limit: 10 minutes between ANY submission
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

  -- 2. Per-place cooldown: 30 minutes (place_id or legacy venue_id)
  IF NOT v_is_admin THEN
    SELECT created_at INTO v_last_vibe_at
    FROM   vibes
    WHERE  user_id = v_user_id
      AND  (place_id = p_place_id OR venue_id = p_place_id)
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

  -- 3. Global cap: 15 vibes per 12-hour window
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

  -- 4. Upsert within 4 hours at same place
  SELECT id INTO v_existing_vibe_id
  FROM   vibes
  WHERE  user_id = v_user_id
    AND  (place_id = p_place_id OR venue_id = p_place_id)
    AND  created_at > NOW() - INTERVAL '4 hours'
  ORDER  BY created_at DESC
  LIMIT  1;

  IF v_existing_vibe_id IS NOT NULL THEN
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
    INSERT INTO vibes (
      place_id, venue_id, user_id,
      crowd, music, line, cover,
      drinks_price_tier, crowd_vibe, age_range, confidence_score
    ) VALUES (
      p_place_id, NULL, v_user_id,
      p_crowd, p_music, p_line, p_cover,
      p_drinks_price_tier, p_crowd_vibe, p_age_range, p_confidence_score
    )
    RETURNING * INTO v_result;
  END IF;

  RETURN NEXT v_result;
END;
$$;

REVOKE ALL ON FUNCTION submit_venue_vibe FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION submit_venue_vibe TO authenticated;

COMMENT ON FUNCTION submit_venue_vibe IS
  'v2: Submits vibe by Google place_id. venue_id NULL for new rows. Rate limits: 10min global speed, 30min per place, 15/12h cap.';
