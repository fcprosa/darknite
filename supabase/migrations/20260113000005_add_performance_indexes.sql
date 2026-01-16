-- Performance indexes for vibes table
-- These indexes optimize common query patterns:
-- 1. Latest vibe per venue (venue_id + created_at)
-- 2. User's vibe history (user_id + created_at)
-- 3. Recent vibes across all venues (created_at)
-- 4. Batch queries for multiple venues (venue_id IN (...))

-- Index for latest vibe per venue queries (most common pattern)
-- Used by: getLatestVibe, getLatestVibesBatch, getRecentVibes(venue)
CREATE INDEX IF NOT EXISTS idx_vibes_venue_id_created_at_desc 
  ON public.vibes(venue_id, created_at DESC);

-- Index for user vibe history queries
-- Used by: getUserVibes
CREATE INDEX IF NOT EXISTS idx_vibes_user_id_created_at_desc 
  ON public.vibes(user_id, created_at DESC);

-- Index for "Hot Now" queries (recent vibes across all venues)
-- Used by: getRecentVibes({ minutes, limit })
CREATE INDEX IF NOT EXISTS idx_vibes_created_at_desc 
  ON public.vibes(created_at DESC);

-- Composite index for rate limit trigger queries
-- Used by: check_vibe_rate_limit_60min trigger (venue_id + user_id + created_at)
CREATE INDEX IF NOT EXISTS idx_vibes_venue_user_created_at 
  ON public.vibes(venue_id, user_id, created_at DESC);

-- Index for venue lookup by type (if venues table is frequently filtered)
CREATE INDEX IF NOT EXISTS idx_venues_venue_type 
  ON public.venues(venue_type);

-- Index for venue lookup by neighborhood (used in filtering)
CREATE INDEX IF NOT EXISTS idx_venues_neighborhood 
  ON public.venues(neighborhood);
