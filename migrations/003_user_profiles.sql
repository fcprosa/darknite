-- Migration: Create user_profiles table for username and preferences
-- Run this migration in your Supabase SQL editor

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  preferred_scene TEXT, -- 'clubs', 'bars', 'both', or NULL
  favorite_genres TEXT[], -- Array of music genres (up to 3)
  favorite_neighborhoods TEXT[], -- Array of neighborhoods (up to 3)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraint on username (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_username_lower_idx 
ON user_profiles (LOWER(username));

-- Enable RLS (Row Level Security)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can read all profiles (for username lookup)
CREATE POLICY "Users can read all profiles"
  ON user_profiles FOR SELECT
  USING (true);

-- Create policy: Users can only insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create policy: Users can only update their own profile
CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Profile will be created by the app with username
  -- This function is a placeholder in case we need it later
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger (optional - we'll create profile from app)
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

