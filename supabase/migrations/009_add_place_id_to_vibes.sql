-- Phase 3.1: Google place_id on vibes (v2 venue key)
-- Sacred: do NOT drop venue_id column — v1 rows keep venue_id, place_id NULL until backfill.

ALTER TABLE public.vibes
  ADD COLUMN IF NOT EXISTS place_id TEXT;

CREATE INDEX IF NOT EXISTS idx_vibes_place_id_created
  ON public.vibes (place_id, created_at DESC)
  WHERE place_id IS NOT NULL;

COMMENT ON COLUMN public.vibes.place_id IS
  'Google Places place_id (v2). Primary venue key for new vibes; venue_id retained for v1 rollback.';

-- RLS: vibes_select_public (add_ugc_compliance) already allows public SELECT.
-- Queries filtered by place_id use idx_vibes_place_id_created; INSERT remains RPC-only.
