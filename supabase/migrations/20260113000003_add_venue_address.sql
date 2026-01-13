-- Add address and city fields to venues table
-- These fields will be used for Maps deep-links instead of lat/lng

ALTER TABLE public.venues
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'New York';

