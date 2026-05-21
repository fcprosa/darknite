-- Phase 4.1: Gamification tables (XP, streaks, badges, events)

CREATE TABLE IF NOT EXISTS public.user_xp (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  total_xp    INTEGER DEFAULT 0 NOT NULL,
  level       INTEGER DEFAULT 1 NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.user_streaks (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  current_streak  INTEGER DEFAULT 0 NOT NULL,
  longest_streak  INTEGER DEFAULT 0 NOT NULL,
  last_vibe_date  DATE,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.user_badges (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  badge_key   TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, badge_key)
);

CREATE TABLE IF NOT EXISTS public.xp_events (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action      TEXT NOT NULL,
  xp_awarded  INTEGER NOT NULL,
  place_id    TEXT,
  city        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xp_events_user_created
  ON public.xp_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_xp_events_city_created
  ON public.xp_events (city, created_at DESC)
  WHERE city IS NOT NULL;

-- RLS
ALTER TABLE public.user_xp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_xp_select_own" ON public.user_xp;
CREATE POLICY "user_xp_select_own" ON public.user_xp
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_xp_insert_own" ON public.user_xp;
CREATE POLICY "user_xp_insert_own" ON public.user_xp
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_xp_update_own" ON public.user_xp;
CREATE POLICY "user_xp_update_own" ON public.user_xp
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_streaks_select_own" ON public.user_streaks;
CREATE POLICY "user_streaks_select_own" ON public.user_streaks
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_streaks_insert_own" ON public.user_streaks;
CREATE POLICY "user_streaks_insert_own" ON public.user_streaks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_streaks_update_own" ON public.user_streaks;
CREATE POLICY "user_streaks_update_own" ON public.user_streaks
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_badges_select_public" ON public.user_badges;
CREATE POLICY "user_badges_select_public" ON public.user_badges
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "user_badges_insert_own" ON public.user_badges;
CREATE POLICY "user_badges_insert_own" ON public.user_badges
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "xp_events_select_own" ON public.xp_events;
CREATE POLICY "xp_events_select_own" ON public.xp_events
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "xp_events_insert_own" ON public.xp_events;
CREATE POLICY "xp_events_insert_own" ON public.xp_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Weekly leaderboard by city (top 10 XP this week)
CREATE OR REPLACE FUNCTION public.get_weekly_leaderboard(p_city text)
RETURNS TABLE (
  user_id uuid,
  weekly_xp bigint,
  display_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.user_id,
    SUM(e.xp_awarded)::bigint AS weekly_xp,
    COALESCE(p.username, 'Night Owl') AS display_name
  FROM public.xp_events e
  LEFT JOIN public.user_profiles p ON p.id = e.user_id
  WHERE e.created_at > NOW() - INTERVAL '7 days'
    AND (
      p_city IS NULL
      OR trim(p_city) = ''
      OR e.city = p_city
    )
  GROUP BY e.user_id, p.username
  ORDER BY weekly_xp DESC
  LIMIT 10;
$$;

REVOKE ALL ON FUNCTION public.get_weekly_leaderboard(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_weekly_leaderboard(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_weekly_leaderboard(text) TO anon;

COMMENT ON TABLE public.user_xp IS 'v2 gamification: total XP and level per user';
COMMENT ON TABLE public.user_streaks IS 'v2 gamification: daily posting streak (activityDate from client local calendar)';
