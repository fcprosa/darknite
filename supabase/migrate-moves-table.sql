-- ============================================================
-- DarkNite: Create moves table for user intent declarations
-- Run this in Supabase SQL Editor (one shot, copy-paste the whole thing)
-- ============================================================

-- 1. Create the table
create table moves (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  venue_id text references venues(id) not null,
  time_band text not null check (time_band in ('early', 'prime', 'late', 'spontaneous')),
  status text not null default 'active' check (status in ('active', 'expired', 'canceled')),
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '8 hours')
);

-- 2. Indexes for fast queries
create index idx_moves_venue_active on moves(venue_id) where status = 'active';
create index idx_moves_expires on moves(expires_at) where status = 'active';
create index idx_moves_user_active on moves(user_id) where status = 'active';

-- 3. One active move per user at a time (prevents spam / ghost moves)
create unique index idx_moves_one_active_per_user 
  on moves(user_id) 
  where status = 'active';

-- 4. Row Level Security
alter table moves enable row level security;

-- Anyone can read active moves that haven't expired yet
-- (filters out stale moves even if cron hasn't cleaned them up)
create policy "Anyone can read active moves"
  on moves for select
  using (status = 'active' and expires_at > now());

-- Users can insert their own moves
create policy "Users can insert their own moves"
  on moves for insert
  with check (auth.uid() = user_id);

-- Users can update their own moves (cancel, expire)
create policy "Users can update their own moves"
  on moves for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can delete their own moves
create policy "Users can delete their own moves"
  on moves for delete
  using (auth.uid() = user_id);

-- 5. Background cleanup function (call via Supabase cron or pg_cron)
create or replace function expire_old_moves()
returns void as $$
begin
  update moves
  set status = 'expired'
  where status = 'active'
    and expires_at < now();
end;
$$ language plpgsql;