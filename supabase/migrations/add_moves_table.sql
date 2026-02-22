-- ═══════════════════════════════════════════════════════════
-- MOVES TABLE — User intent signals ("heading here tonight")
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS moves (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id text NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  time_band text NOT NULL DEFAULT 'spontaneous',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '8 hours')
);

-- Index for fast lookups: "how many active moves does this venue have tonight?"
CREATE INDEX IF NOT EXISTS idx_moves_venue_active
  ON moves (venue_id, status, expires_at DESC);

-- Index for user's active moves
CREATE INDEX IF NOT EXISTS idx_moves_user_active
  ON moves (user_id, status, expires_at DESC);

-- RLS policies
ALTER TABLE moves ENABLE ROW LEVEL SECURITY;

-- Anyone can read moves (needed for move counts on feed)
CREATE POLICY "moves_select_all" ON moves
  FOR SELECT USING (true);

-- Authenticated users can create moves
CREATE POLICY "moves_insert_auth" ON moves
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update/cancel their own moves
CREATE POLICY "moves_update_own" ON moves
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own moves
CREATE POLICY "moves_delete_own" ON moves
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE moves IS 'User intent signals. A move means "I plan to go to this venue tonight." Expires after 8 hours.';
COMMENT ON COLUMN moves.time_band IS 'When the user plans to arrive: early (8-10pm), prime (10pm-12am), late (12am+), spontaneous';
COMMENT ON COLUMN moves.status IS 'active = planning to go. cancelled = user changed mind. expired = auto-expired after 8h.';
