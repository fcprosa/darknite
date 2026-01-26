Database Schema - DarkNite App
Overview
This document describes all tables in the Supabase database and their relationships.
Last updated: 2025-01-27 (After cleanup)

Tables
1. venues
Purpose: Stores nightlife venue information (bars and clubs)
Columns:

id (text, PK) - Unique venue identifier
name (text) - Venue name
venue_type (text) - Type: "bar" or "club"
address (text) - Full address
neighborhood (text) - Neighborhood/area
city (text) - City (currently all "New York")
default_guys (integer) - Default guy percentage for 50/50 ratio
default_girls (integer) - Default girl percentage for 50/50 ratio
created_at (timestamp) - Record creation time
updated_at (timestamp) - Last update time

Notes:

default_guys and default_girls are used when no vibe data exists (default 50/50 ratio)
city is currently set to "New York" for all venues


2. vibes
Purpose: User-submitted venue vibes (crowd, music, pricing, etc.)
Columns:

id (bigint, PK) - Unique vibe identifier
venue_id (text, FK → venues.id) - Reference to venue
user_id (uuid, FK → user_profiles.id) - User who posted
crowd (text) - Crowd level: "Dead", "Chill", "Fun", "Packed", "Chaos"
ratio (text, nullable) - Guy/girl ratio (e.g., "60/40")
music (text, nullable) - Music genre playing
age_range (text, nullable) - Age range observed
cover (text, nullable) - Cover charge (clubs only)
line (text, nullable) - Line wait time (clubs only)
bar_type (text, nullable) - Bar type: "cocktail", "sports", "dive", etc. (bars only)
drinks_price_tier (text, nullable) - Drink pricing tier: "cheap", "moderate", "pricey", "expensive" (bars only)
verified (boolean) - Verification status
created_at (timestamp) - Vibe post time
updated_at (timestamp) - Last update time

✅ CLEANED (2025-01-27):

Removed: stay_duration, tags, bartender_vibe, drinks_price

Notes:

CLUBS use: crowd, ratio, music, cover, line, age_range
BARS use: crowd, ratio, music, bar_type, drinks_price_tier, age_range


3. check_ins
Purpose: Quick user check-ins with minimal info (line wait for clubs, crowd for bars)
Columns:

id (uuid, PK) - Unique check-in identifier
venue_id (text, FK → venues.id) - Reference to venue
user_id (uuid, FK → user_profiles.id) - User who checked in
line_wait (text, nullable) - Line status (clubs only): "No line!", "Chill (5-15 min)", "Worth it (15-30 min)", "Long af (30-60 min)", "Don't bother (60+ min)"
crowd_level (text, nullable) - Crowd level (bars only): "Dead", "Chill", "Buzzing", "Packed"
created_at (timestamp) - Check-in time
updated_at (timestamp) - Last update time

✅ CLEANED (2025-01-27):

Removed: latitude, longitude, cover_price, noise_level

Notes:

CLUBS: Only line_wait is used
BARS: Only crowd_level is used


4. user_profiles
Purpose: User profile information and nightlife preferences
Columns:

id (uuid, PK) - Unique user identifier (matches auth.users.id)
username (text, unique) - Username
going_out_days (text[], nullable) - Preferred days to go out (array, max 3): ["Monday", "Friday", "Saturday"]
preferred_scene (text, nullable) - Preference: "bars", "clubs", or "both"
favorite_neighborhoods (text[], nullable) - Preferred areas (array, max 3)
favorite_genres (text[], nullable) - Preferred music genres (array)
reminders_enabled (boolean) - Whether user has notifications enabled
created_at (timestamp) - Account creation time
updated_at (timestamp) - Last profile update

Notes:

User preferences are collected during onboarding (4 questions flow)
These preferences are used to personalize the "For You" feed
Maximum 3 selections for going_out_days and favorite_neighborhoods
Column names in DB: going_out_days, preferred_scene, favorite_neighborhoods, favorite_genres (not renamed to avoid breaking code)


5. user_points
Purpose: Tracks user gamification points and activity counts
Columns:

user_id (uuid, PK, FK → user_profiles.id) - Reference to user (serves as primary key)
total_points (integer) - Total accumulated points
checkin_count (integer) - Number of check-ins performed
vibe_count (integer) - Number of vibes posted
created_at (timestamp) - Record creation time
updated_at (timestamp) - Last update time

Point System:

Check-in: +1 point
Post vibe: +5 points (to be implemented)

Notes:

Used for leaderboards and gamification
checkin_count and vibe_count track activity for analytics
user_id serves as the primary key (one record per user)


Relationships
user_profiles (1) ──< (many) vibes
user_profiles (1) ──< (many) check_ins
user_profiles (1) ──── (1) user_points

venues (1) ──< (many) vibes
venues (1) ──< (many) check_ins

RLS Policies Status
✅ Applied Policies:
user_profiles:

SELECT - public (everyone can read)
INSERT - only auth.uid() = id (users create own profile)
UPDATE - only auth.uid() = id (users update own profile)
DELETE - not allowed (handled via auth cascade)

user_points:

SELECT - public (for leaderboards)
INSERT - only auth.uid() = user_id (users insert own points)
UPDATE - only auth.uid() = user_id (users update own points)

check_ins:

SELECT - public (for counting)
INSERT - only auth.uid() = user_id (authenticated users)
DELETE - only auth.uid() = user_id (users delete own check-ins)

vibes:

SELECT - public (everyone can read)
INSERT - authenticated users
DELETE - only auth.uid() = user_id (users delete own vibes)

venues:

SELECT - public (everyone can read)
INSERT/UPDATE/DELETE - admin only (via dashboard)


Business Logic Notes
For You Page Algorithm (To Be Implemented)
The "For You" page should be personalized using:

user_profiles.going_out_days - Show venues popular on user's preferred days
user_profiles.preferred_scene - Filter bars/clubs/both
user_profiles.favorite_neighborhoods - Prioritize nearby neighborhoods
user_profiles.favorite_genres - Match with vibes.music

Vibe vs Check-in
Check-in: Quick (1 question), +1 point, minimal friction

Clubs: "What's the line situation?" → Options: No line!, Chill (5-15 min), Worth it (15-30 min), Long af (30-60 min), Don't bother (60+ min)
Bars: "How's the crowd?" → Options: Dead 💀, Chill 😌, Buzzing 🎉, Packed 🔥

Post Vibe: Detailed (multiple fields), +5 points, comprehensive data

Clubs collect: crowd, ratio, music, cover, line, age_range
Bars collect: crowd, ratio, music, bar_type, drinks_price_tier, age_range

Venue Type Differences
CLUBS:

Vibes: crowd, ratio, music, cover, line, age_range
Check-ins: line_wait

BARS:

Vibes: crowd, ratio, music, bar_type, drinks_price_tier, age_range
Check-ins: crowd_level


Cleanup History
✅ Completed (2025-01-27):

Removed deprecated columns from vibes: stay_duration, tags, bartender_vibe, drinks_price
Removed deprecated columns from check_ins: latitude, longitude, cover_price, noise_level
Added RLS policies for all tables
Fixed user_points INSERT/UPDATE policies

🔄 Next Steps:

Implement onboarding flow with 4 questions
Build personalized "For You" algorithm
Add leaderboard using user_points.total_points
Implement +5 points for posting vibes
Add notifications system (reminders_enabled is ready)
