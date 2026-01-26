-- Add age_range column to vibes table
-- This field stores optional age range information for both bars and clubs

ALTER TABLE public.vibes
ADD COLUMN IF NOT EXISTS age_range TEXT;
