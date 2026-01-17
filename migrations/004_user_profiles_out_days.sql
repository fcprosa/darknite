-- Add going out days and reminders enabled to user_profiles table
-- Migration: 004_user_profiles_out_days.sql

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS going_out_days TEXT[],
ADD COLUMN IF NOT EXISTS reminders_enabled BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN public.user_profiles.going_out_days IS 'Array of day codes (mon, tue, wed, thu, fri, sat, sun) when user typically goes out';
COMMENT ON COLUMN public.user_profiles.reminders_enabled IS 'Whether user has enabled weekly reminder notifications';
