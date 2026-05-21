-- Phase 3.2: Google place_id on check_ins (v2 venue key)

ALTER TABLE public.check_ins
  ADD COLUMN IF NOT EXISTS place_id TEXT;

CREATE INDEX IF NOT EXISTS idx_check_ins_place_id_created
  ON public.check_ins (place_id, created_at DESC)
  WHERE place_id IS NOT NULL;

COMMENT ON COLUMN public.check_ins.place_id IS
  'Google Places place_id (v2). Primary venue key for new check-ins; venue_id retained for v1.';
