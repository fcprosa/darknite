-- Phase 6A: Index for feed queries (place_id + recency)

CREATE INDEX IF NOT EXISTS vibes_created_at_place_id_idx
  ON public.vibes (created_at DESC, place_id);
