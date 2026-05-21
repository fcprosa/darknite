# DarkNite v2 — Master Execution Plan
**Principal Engineer:** Claude (Anthropic)
**Prepared:** 2026-05-21
**Standards Applied:** `decision-framer.md` · `sop-writer.md` · `code-explainer.md`

---

## STANDARDS ACKNOWLEDGMENT

All decisions in this plan have been framed through the three loaded standards:

- **decision-framer.md** — Every architectural fork below includes the real decision (not the stated one), true distinct options, top three decision criteria, two key unknowns, and the default (do-nothing) outcome.
- **sop-writer.md** — Each phase is an executable SOP: named trigger, atomic steps with owner/tool/output, a quality checkpoint, and one sacred step that must never be automated.
- **code-explainer.md** — Every file touched by this plan carries a two-level annotation (what it does / why it's built that way), plus the fragile part and the baked-in assumption.

---

## THE REAL DECISION (decision-framer applied to the pivot itself)

**REAL DECISION:** We are deciding whether to build a global venue discovery platform with social proof, or to keep shipping a New York City nightlife aggregator.

**OPTIONS:**
1. Full v2 pivot — global map + Google Places + gamification (this plan)
2. Extend v1 — add Google Places on top of the existing static NYC feed
3. Do nothing — keep shipping v1, find NYC distribution, prove the concept first

**DECISION CRITERIA:**
- Global from day one means zero cold-start city problem
- Gamification creates retention and virality that raw venue data cannot
- Google Places eliminates the database maintenance tax of curating venues manually

**WHAT WE DON'T KNOW:**
- Google Places API billing at scale — run a cost model before Phase 2 ships (fetch pricing from Google Cloud Console for Nearby Search + Place Details at 10K MAU)
- Whether `react-native-maps` + Expo managed workflow plays nicely at SDK 54 — spike it in a throwaway branch before committing Phase 1

**THE DEFAULT:** If we ship nothing, v1 continues serving a static NYC feed that requires manual venue curation to grow. It will not scale.

---

## THE PURGE — Full File Deletion Manifest

These files are confirmed dead weight. Delete them at the start of Phase 1 before writing a single line of new code.

### Explicitly Requested for Deletion
| File | Reason |
|------|--------|
| `app.json` | Superseded entirely by `app.config.js` (dynamic config already active) |
| `src/` (entire folder) | 3-file nascent TS migration (Chip.tsx, tokens.ts, timeAgo.ts) — will be rebuilt clean in v2 |
| `components/SetMoveScreen.js` | Move feature cut from v2 |
| `utils/feedRanker.js` | Static NYC feed ranking — replaced by Google Places Nearby Search |
| `utils/scoreHelpers.js` | 48 bytes, empty, dead |

### Additional Dead Weight (identified from codebase scan)
| File | Reason |
|------|--------|
| `screens/SetMoveScreen.js` | Duplicate of components/SetMoveScreen.js — also cut |
| `services/moveService.js` | Move feature cut |
| `utils/feedHelpers.js` | 36K of NYC-specific static feed logic — entirely replaced |
| `utils/pulseHelpers.js` | NYC "City Pulse" feature cut |
| `utils/vibeDecay.js` | Decay algo tied to static venue list — will be redesigned in gamification engine |
| `components/CityPulseBanner.js` | NYC-only feature |
| `components/NeighborhoodScreen.js` | NYC neighborhoods — replaced by map regions |
| `components/NeighborhoodVenuesScreen.js` | Same |
| `components/HomeScreen.js` | Replaced entirely by MapScreen |
| `components/ExploreScreen.js` | Absorbed into MapScreen + VenueDetailSheet |
| `components/VenueDetailsLovable.js` | 47K monolith, NYC-specific — replaced by VenueDetailSheet |
| `components/VenueCardLovable.js` | 40K monolith — replaced by PlaceCard |
| `components/VenuePickerScreen.js` | Replaced by MapSearchBar + autocomplete |
| `services/venueService.js` | Replaced by googlePlacesService.js |
| `scripts/seed-venue-data.js` | NYC static seed data — irrelevant globally |
| `scripts/backfill-venue-defaults.mjs` | NYC-specific backfill |
| `scripts/validate-ranking-engine.js` | Validates the ranking engine being deleted |
| `RANKING_ENGINE_V2_DEPLOYMENT.md` | Documents the thing we're deleting |

### Files to KEEP (verified useful in v2)
| File | Keep Reason |
|------|------------|
| `App.js` | Entry point — modify, don't delete |
| `index.js` | RN entry — untouched |
| `app.config.js` | Dynamic config — add Google Maps keys |
| `utils/supabase.js` | Supabase client singleton — keep |
| `utils/logger.js` | Tagged logging + Sentry — keep |
| `utils/sentry.js` | Error tracking — keep |
| `utils/timeHelpers.js` | Time formatting — keep |
| `utils/formatters.js` | Data formatting — keep |
| `utils/vibeHelpers.js` | Vibe calculations — audit and keep usable parts |
| `utils/venueHelpers.js` | Venue data processing — audit for place_id compatibility |
| `services/vibeService.js` | Core UGC — refactor to use place_id |
| `services/profileService.js` | User profiles — extend for gamification |
| `services/checkInService.js` | Check-ins — extend for XP awards |
| `services/userService.js` | Auth operations — keep |
| `services/notificationService.js` | Notifications — keep |
| `contexts/AuthContext.js` | Auth state — keep |
| `contexts/AppContext.js` | Global state — refactor for places + gamification |
| `contexts/NetworkContext.js` | Network state — keep |
| `navigation/RootNavigator.js` | Auth routing — keep |
| `navigation/AuthStackNavigator.js` | Auth flow — keep |
| `components/AuthModal.js` | Auth UI — keep |
| `components/ProfileScreen.js` | Profile — extend for gamification |
| `components/ProfileSetupScreen.js` | Onboarding — keep |
| `components/PostVibeScreen.js` | Core UGC — refactor for global + XP preview |
| `components/OnboardingScreen.js` | Onboarding — keep |
| `components/SettingsScreen.js` | Settings — keep |
| `components/CheckInModal.js` | Check-in — extend for XP |
| `components/LandingScreen.js` | Landing — keep |
| `supabase/migrations/*` | All existing migrations — keep, add new ones on top |
| `constants/index.js` | Colors/styles — update to dark Belli-style palette |
| `constants/layout.js` | Layout constants — keep |
| `constants/spacing.js` | Spacing — keep |

---

## PHASED EXECUTION PLAN

> **Rule:** Do not begin a phase until the previous phase passes its Quality Check.
> **Rule:** Every phase ships as its own Git commit on branch `v2-pivot`.
> **Rule:** No phase writes code that depends on a future phase's infrastructure.

---

## PHASE 0 — Branch & Baseline (30 min)

**TRIGGER:** Decision to pivot is locked. Engineer sits down to begin.

**PURPOSE:** Create an isolated branch, capture the current working state, and establish the v2 file structure before any deletion occurs.

### Steps

| # | Action | Owner | Tool | Output |
|---|--------|-------|------|--------|
| 0.1 | Create branch `git checkout -b v2-pivot` | Engineer | git | Clean branch off main |
| 0.2 | Run `npm start` and verify v1 boots | Engineer | Expo | Confirmed working baseline |
| 0.3 | Tag the last v1 commit: `git tag v1-stable` | Engineer | git | Rollback anchor |
| 0.4 | Create `DARKNITE_V2_MASTER_PLAN.md` in root | Engineer | Cursor | This document, committed |
| 0.5 | Verify `.env` contains `GOOGLE_PLACES_API_KEY` | Engineer | .env file | Confirmed key present |

**QUALITY CHECK:** App boots on simulator, bottom tabs visible, no console errors.

**SACRED STEP:** Tag v1-stable manually. Never automate the rollback anchor — a human must verify the app is working before tagging, or the tag is meaningless.

---

## PHASE 1 — The Purge & Project Reset (2–3 hours)

**TRIGGER:** Phase 0 quality check passed.

**PURPOSE:** Remove all v1-specific dead weight and install the new map dependency so we're building on a clean foundation.

### Steps

| # | Action | Owner | Tool | Output |
|---|--------|-------|------|--------|
| 1.1 | Delete all files in the Purge Manifest above | Engineer | Cursor / rm | Deleted files, compile errors expected |
| 1.2 | Remove dead imports from `App.js` | Engineer | Cursor | App.js compiles |
| 1.3 | Remove dead routes from `AppStackNavigator.js` (SetMove, NeighborhoodVenues, Neighborhood, Explore) | Engineer | Cursor | Navigator compiles |
| 1.4 | Remove dead tabs from `MainTabsNavigator.js` (Explore tab → stub MapTab) | Engineer | Cursor | Tab bar shows: Map · Profile |
| 1.5 | Remove dead imports from `HomeStackNavigator.js`, then delete file; move its routes into `AppStackNavigator.js` | Engineer | Cursor | Navigator simplified |
| 1.6 | `npm install react-native-maps` | Engineer | npm | Package installed |
| 1.7 | Add `GOOGLE_MAPS_API_KEY` to `app.config.js` under `ios.config.googleMapsApiKey` and `android.config.googleMaps.apiKey` | Engineer | Cursor | Keys wired for both platforms |
| 1.8 | Add iOS usage description for location to `app.config.js`: `NSLocationWhenInUseUsageDescription` | Engineer | Cursor | Permission string present |
| 1.9 | Create `components/MapScreen.js` — empty stub: renders a MapView centered on user's current location, no markers, no search | Engineer | Cursor | Map renders on device |
| 1.10 | Wire `MapScreen` as the default (first) tab in `MainTabsNavigator.js` | Engineer | Cursor | Map tab opens on launch |
| 1.11 | Update `constants/index.js` — replace color palette with Belli-inspired dark theme (see Color Spec below) | Engineer | Cursor | Theme tokens updated |
| 1.12 | Create `src/` directory with clean structure (see New Folder Structure below) | Engineer | Cursor | src/ scaffolded |
| 1.13 | Run `npm start`, verify app boots to a dark map screen | Engineer | Expo | Map visible |

**FILES CREATED THIS PHASE:**
- `components/MapScreen.js` (stub)
- `src/theme/colors.ts`
- `src/theme/typography.ts`
- `src/theme/spacing.ts`

**FILES MODIFIED THIS PHASE:**
- `App.js`
- `app.config.js`
- `constants/index.js`
- `navigation/AppStackNavigator.js`
- `navigation/MainTabsNavigator.js`
- `package.json`

**FILES DELETED THIS PHASE:** Full Purge Manifest above.

**QUALITY CHECK:** App launches to a live MapView on iOS and Android simulators. No red-screen errors. Bottom tabs show Map and Profile only.

**SACRED STEP:** Manually verify the map renders a real tile (not a grey placeholder) before marking Phase 1 complete. A misconfigured API key will show tiles only in debug builds — a human must catch this, not a CI script.

---

### Color Spec — Belli-Inspired Dark Theme

```js
// constants/index.js — replace existing COLORS object
export const COLORS = {
  background:    '#0A0A0F',   // near-black base
  surface:       '#13131A',   // card/sheet background
  surfaceRaised: '#1C1C26',   // elevated surfaces
  border:        '#2A2A38',   // subtle borders
  primary:       '#7B5EA7',   // deep violet — brand accent
  primaryGlow:   '#9B7EC8',   // lighter violet for glows
  accent:        '#E8A838',   // gold — XP/gamification
  accentGlow:    '#FFD166',   // light gold for XP toasts
  success:       '#4CAF7D',   // green — streaks, check-ins
  danger:        '#E05C5C',   // red — destructive actions
  textPrimary:   '#F2F2F7',   // near-white
  textSecondary: '#8E8EA0',   // muted grey
  textMuted:     '#4A4A5E',   // placeholder/disabled
  mapOverlay:    'rgba(10,10,15,0.85)', // bottom sheet scrim
};
```

---

### New Folder Structure (`src/`)

```
src/
  theme/
    colors.ts         # Re-exports COLORS as typed constants
    typography.ts     # Font sizes, weights, line heights
    spacing.ts        # 4px grid spacing scale
  types/
    venue.ts          # Place type (wraps Google Place + Supabase vibe data)
    vibe.ts           # Vibe type
    gamification.ts   # XP, Badge, Streak types
  hooks/
    useLocation.ts    # Wraps expo-location, returns coords + permission state
    useGamification.ts # XP, streak, badge state for current user
```

---

## PHASE 2 — Google Places Integration (1 day)

**TRIGGER:** Phase 1 quality check passed. Map is rendering.

**PURPOSE:** Replace all static venue data with live Google Places API calls. Every venue in v2 is identified by a `place_id` — a permanent, globally unique Google identifier.

### Steps

| # | Action | Owner | Tool | Output |
|---|--------|-------|------|--------|
| 2.1 | Create `services/googlePlacesService.js` with four methods (see API Spec below) | Engineer | Cursor | Places service file |
| 2.2 | Create `src/hooks/useLocation.ts` — wraps `expo-location`, returns `{ coords, permissionStatus, requestPermission }` | Engineer | Cursor | Location hook |
| 2.3 | Create `constants/mapStyles.js` — custom dark map JSON (Belli-style, hide POI labels, darken roads) | Engineer | Cursor | Map style JSON |
| 2.4 | Upgrade `components/MapScreen.js` from stub to full: request location on mount, apply dark map style, show user dot | Engineer | Cursor | Styled dark map |
| 2.5 | Create `components/MapSearchBar.js` — floating search input at top of map, calls `googlePlacesService.autocomplete()`, shows dropdown results, selects a place | Engineer | Cursor | Search bar component |
| 2.6 | Create `components/VenueMapMarker.js` — custom dark-styled pin; shows vibe count badge if vibes exist for that place_id | Engineer | Cursor | Custom marker |
| 2.7 | Wire `MapScreen` to call `googlePlacesService.nearbyNightlife()` on map region change (debounced 800ms), render `VenueMapMarker` for each result | Engineer | Cursor | Live venue pins on map |
| 2.8 | Create `components/VenueDetailSheet.js` — bottom sheet (using react-native-modal or @gorhom/bottom-sheet) that opens when a marker is tapped; shows place name, address, type, photo, and a "Post Vibe" CTA | Engineer | Cursor | Venue detail sheet |
| 2.9 | Create `components/PlaceCard.js` — compact horizontal card for search results and lists | Engineer | Cursor | Reusable place card |
| 2.10 | Wire `PostVibeScreen.js` to accept `placeId` + `placeName` as navigation params (remove old `venueId` param) | Engineer | Cursor | PostVibe accepts place_id |
| 2.11 | Update `contexts/AppContext.js` — remove `venues[]` array and `latestVibesByVenueId` map; add `nearbyPlaces[]` and `vibesByPlaceId` map | Engineer | Cursor | AppContext refactored |
| 2.12 | Test: search "bars near me", tap result, open VenueDetailSheet, tap "Post Vibe" | Engineer | Expo | Full search→detail flow |

**FILES CREATED THIS PHASE:**
- `services/googlePlacesService.js`
- `components/MapSearchBar.js`
- `components/VenueMapMarker.js`
- `components/VenueDetailSheet.js`
- `components/PlaceCard.js`
- `constants/mapStyles.js`
- `src/hooks/useLocation.ts`
- `src/types/venue.ts`

**FILES MODIFIED THIS PHASE:**
- `components/MapScreen.js` (stub → full)
- `components/PostVibeScreen.js` (venueId → placeId)
- `contexts/AppContext.js` (remove static venues, add places map)

**QUALITY CHECK:** Tap any map marker → VenueDetailSheet slides up with correct venue name, address, and a working "Post Vibe" button. Search bar autocomplete returns results within 500ms.

**SACRED STEP:** Manually verify the Nearby Search response shape from the actual Google Places API (not mocked) before building the VenueMapMarker rendering logic. Google silently changes field names between API versions (v1 vs legacy) — a human must inspect the raw JSON to avoid building on stale assumptions.

---

### Google Places API Spec (`services/googlePlacesService.js`)

```js
// Four methods required in Phase 2:

nearbyNightlife(lat, lng, radiusMeters)
// → Google Places Nearby Search, type: bar|night_club
// → Returns: [{ place_id, name, vicinity, geometry, rating, user_ratings_total }]

autocomplete(query, sessionToken)
// → Google Places Autocomplete
// → Returns: [{ place_id, description, structured_formatting }]

getPlaceDetails(place_id)
// → Google Places Details: fields = name,formatted_address,geometry,photos,rating,opening_hours,price_level
// → Returns: single place object

getPlacePhoto(photoReference, maxWidth)
// → Returns: CDN URL string for place photo
```

---

## PHASE 3 — Supabase Hybrid DB Link (4–6 hours)

**TRIGGER:** Phase 2 quality check passed. PostVibeScreen receives a real place_id.

**PURPOSE:** Wire Supabase (user-generated content layer) to Google Places (venue discovery layer) using `place_id` as the shared foreign key. Supabase stores vibes, reviews, check-ins — Google stores venue data. Neither duplicates the other.

### Steps

| # | Action | Owner | Tool | Output |
|---|--------|-------|------|--------|
| 3.1 | Write migration `supabase/migrations/009_add_place_id_to_vibes.sql` — add `place_id TEXT` column to `vibes` table, add index, backfill existing rows with NULL | Engineer | SQL | Migration file |
| 3.2 | Write migration `supabase/migrations/010_add_place_id_to_checkins.sql` — same pattern for check-ins table | Engineer | SQL | Migration file |
| 3.3 | Write migration `supabase/migrations/011_drop_venue_fk_from_vibes.sql` — make `venue_id` nullable (do not drop yet — safe rollback path) | Engineer | SQL | Migration file |
| 3.4 | Apply migrations to Supabase project via Supabase CLI or dashboard | Engineer | Supabase CLI | DB schema updated |
| 3.5 | Refactor `services/vibeService.js` — all queries use `place_id` instead of `venue_id`; add `getVibesByPlaceId(place_id)` and `getAggregatedVibesByPlaceIds(place_ids[])` | Engineer | Cursor | VibeService refactored |
| 3.6 | Refactor `services/checkInService.js` — same pattern, check-ins use `place_id` | Engineer | Cursor | CheckInService refactored |
| 3.7 | Update `VenueMapMarker.js` — on mount, batch-fetch vibe counts for visible `place_id`s from Supabase; show count badge on marker | Engineer | Cursor | Live vibe counts on map |
| 3.8 | Update `VenueDetailSheet.js` — load real vibes from Supabase for the tapped place_id; show vibe feed inside sheet | Engineer | Cursor | Real vibes in sheet |
| 3.9 | Update RLS policies: `vibes` insert policy checks `auth.uid() IS NOT NULL` (unchanged); add select policy for `place_id` queries | Engineer | SQL | RLS updated |
| 3.10 | Test: post a vibe at a real venue, close app, reopen, verify vibe appears on the map marker and in the detail sheet | Engineer | Expo | Full UGC round-trip |

**FILES CREATED THIS PHASE:**
- `supabase/migrations/009_add_place_id_to_vibes.sql`
- `supabase/migrations/010_add_place_id_to_checkins.sql`
- `supabase/migrations/011_drop_venue_fk_from_vibes.sql`

**FILES MODIFIED THIS PHASE:**
- `services/vibeService.js`
- `services/checkInService.js`
- `components/VenueMapMarker.js`
- `components/VenueDetailSheet.js`

**QUALITY CHECK:** Submit a vibe from a cold-start (logged-in user, fresh install, real device). Verify the vibe appears in Supabase dashboard under the correct `place_id` within 2 seconds. Verify the map marker shows a count of 1.

**SACRED STEP:** Do not drop the `venue_id` column from the `vibes` table in this phase. A human must audit existing vibe data and decide the migration strategy before the column is permanently removed. Data loss is irreversible.

---

## PHASE 4 — Gamification Engine (1–2 days)

**TRIGGER:** Phase 3 quality check passed. Vibes are posting to Supabase with place_ids.

**PURPOSE:** Add Duolingo-style XP, streaks, and badges to create daily retention loops. Every logged action earns points. Streaks reward consistency. Badges reward milestones.

### XP Action Table

| Action | XP Awarded | Notes |
|--------|-----------|-------|
| Submit a vibe | +10 XP | Base action |
| First vibe of the night (after 8pm) | +25 XP | Streak bonus |
| 7-day streak maintained | +100 XP | Weekly reward |
| Check in at a venue | +5 XP | Lightweight action |
| First vibe at a new venue | +20 XP | Explorer bonus |
| Add a photo to a vibe | +15 XP | Quality bonus |

### Level Thresholds

| Level | XP Range | Title |
|-------|----------|-------|
| 1 | 0–99 | Rookie |
| 2 | 100–499 | Regular |
| 3 | 500–999 | VIP |
| 4 | 1000–2499 | Nightlife Pro |
| 5 | 2500+ | Legend |

### Badge Manifest

| Badge | Unlock Condition |
|-------|-----------------|
| First Move | Submit first vibe ever |
| Night Owl | Submit a vibe after 2am |
| Explorer | Submit vibes at 5 unique venues |
| Globe Trotter | Submit vibes in 3 different cities |
| On Fire | Maintain a 7-day streak |
| Social Proof | Earn 50 total vibe submissions |

### Steps

| # | Action | Owner | Tool | Output |
|---|--------|-------|------|--------|
| 4.1 | Write migration `supabase/migrations/012_add_gamification_tables.sql` — creates `user_xp`, `user_streaks`, `user_badges` tables (see Schema Spec below) | Engineer | SQL | Migration file |
| 4.2 | Apply migration | Engineer | Supabase CLI | DB tables created |
| 4.3 | Create `constants/gamification.js` — XP action values, level thresholds, badge definitions as typed constants | Engineer | Cursor | Gamification constants |
| 4.4 | Create `src/types/gamification.ts` — TypeScript types for XP event, Badge, Streak, Level | Engineer | Cursor | Type definitions |
| 4.5 | Create `services/gamificationService.js` — `awardXP(userId, action)`, `checkAndAwardBadges(userId)`, `updateStreak(userId)`, `getUserGamificationState(userId)` | Engineer | Cursor | Gamification service |
| 4.6 | Create `src/hooks/useGamification.ts` — subscribes to user's XP/streak/badge state, exposes `awardXP()` action | Engineer | Cursor | Gamification hook |
| 4.7 | Create `components/XPToast.js` — animated toast that flies up from bottom of screen: "+25 XP 🔥 Night Owl bonus!"; auto-dismisses in 2.5s | Engineer | Cursor | XP toast component |
| 4.8 | Create `components/StreakBanner.js` — compact banner showing current streak (flame icon + day count); shown at top of MapScreen if streak ≥ 1 | Engineer | Cursor | Streak banner |
| 4.9 | Wire `PostVibeScreen.js` — on successful vibe submit, call `gamificationService.awardXP()`, then show `XPToast` with amount and reason | Engineer | Cursor | XP awarded on vibe |
| 4.10 | Wire `CheckInModal.js` — same XP award pattern on successful check-in | Engineer | Cursor | XP awarded on check-in |
| 4.11 | Create `components/AchievementsScreen.js` — grid of badges (locked = greyscale, unlocked = full colour + unlock date) | Engineer | Cursor | Achievements screen |
| 4.12 | Create `components/LeaderboardScreen.js` — top 10 users by XP this week, city-scoped (filter by most recent vibe city) | Engineer | Cursor | Leaderboard screen |
| 4.13 | Update `components/ProfileScreen.js` — add XP progress bar (current level → next level), streak display, badge grid (top 6), link to full AchievementsScreen | Engineer | Cursor | Gamified profile |
| 4.14 | Wire gamification state into `contexts/AppContext.js` — `gamification: { xp, level, streak, badges }` | Engineer | Cursor | Global gamification state |
| 4.15 | Add "You'll earn +25 XP" preview text to PostVibeScreen submit button | Engineer | Cursor | XP preview in UX |

**FILES CREATED THIS PHASE:**
- `supabase/migrations/012_add_gamification_tables.sql`
- `constants/gamification.js`
- `src/types/gamification.ts`
- `services/gamificationService.js`
- `src/hooks/useGamification.ts`
- `components/XPToast.js`
- `components/StreakBanner.js`
- `components/AchievementsScreen.js`
- `components/LeaderboardScreen.js`

**FILES MODIFIED THIS PHASE:**
- `components/PostVibeScreen.js`
- `components/CheckInModal.js`
- `components/ProfileScreen.js`
- `contexts/AppContext.js`
- `navigation/AppStackNavigator.js` (add Achievements, Leaderboard routes)

**QUALITY CHECK:** Post a vibe, verify the XP toast fires with the correct amount, verify XP appears in Supabase `user_xp` table, verify ProfileScreen shows updated XP bar without a full app reload.

**SACRED STEP:** The streak reset logic must be reviewed by a human before it ships. A bug that incorrectly resets a user's 30-day streak will destroy trust instantly and cannot be undone. Review the `updateStreak()` logic manually against at least three edge cases: midnight post, timezone crossing, and 25-hour gap.

---

### Gamification DB Schema Spec

```sql
-- 012_add_gamification_tables.sql

CREATE TABLE user_xp (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  total_xp      INTEGER DEFAULT 0 NOT NULL,
  level         INTEGER DEFAULT 1 NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_streaks (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  current_streak  INTEGER DEFAULT 0 NOT NULL,
  longest_streak  INTEGER DEFAULT 0 NOT NULL,
  last_vibe_date  DATE,
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_badges (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  badge_key   TEXT NOT NULL,   -- matches constants/gamification.js badge keys
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, badge_key)
);

CREATE TABLE xp_events (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action      TEXT NOT NULL,   -- 'submit_vibe' | 'checkin' | 'first_night_vibe' etc.
  xp_awarded  INTEGER NOT NULL,
  place_id    TEXT,            -- Google place_id, nullable
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE user_xp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own XP" ON user_xp FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own XP" ON user_xp FOR ALL USING (auth.uid() = user_id);

ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own streaks" ON user_streaks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own streaks" ON user_streaks FOR ALL USING (auth.uid() = user_id);

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Badges public read" ON user_badges FOR SELECT USING (true);
CREATE POLICY "Users insert own badges" ON user_badges FOR INSERT WITH CHECK (auth.uid() = user_id);
```

---

## PHASE 5 — Polish & Belli-Style UI (1 day)

**TRIGGER:** Phase 4 quality check passed. Full gamification loop is functional end-to-end.

**PURPOSE:** Apply visual consistency, micro-animations, and the Belli-style dark aesthetic across all screens. This phase does not add features — it makes everything feel like a premium product.

### Steps

| # | Action | Owner | Tool | Output |
|---|--------|-------|------|--------|
| 5.1 | Audit every screen against the `COLORS` spec from Phase 1 — replace any hardcoded hex values | Engineer | Cursor | Consistent color usage |
| 5.2 | Add Haptic feedback to: vibe submit, check-in, XP toast, badge unlock | Engineer | expo-haptics | Tactile response |
| 5.3 | Add spring animation to `VenueDetailSheet` slide-up | Engineer | React Native Animated | Polished sheet open |
| 5.4 | Add `XPToast` entrance/exit animation (slide up + fade out) | Engineer | React Native Animated | XP toast animation |
| 5.5 | Style `StreakBanner` with animated flame (lottie or CSS animation) | Engineer | Cursor | Animated streak |
| 5.6 | Ensure all tap targets are ≥44pt (iOS HIG compliance) | Engineer | Cursor | Accessibility |
| 5.7 | Add empty state to VenueDetailSheet when no vibes exist: "Be the first to post a vibe here. +20 XP" | Engineer | components/EmptyState.js | Gamified empty state |
| 5.8 | Test on physical iOS device + Android emulator | Engineer | Expo Go / Dev build | Cross-platform verified |
| 5.9 | Update `README.md` to reflect v2 architecture | Engineer | Cursor | Docs current |
| 5.10 | Update `CLAUDE.md` to reflect v2 architecture | Engineer | Cursor | AI context current |

**FILES MODIFIED THIS PHASE:**
- All screen components (color audit)
- `components/VenueDetailSheet.js` (animation)
- `components/XPToast.js` (animation)
- `components/StreakBanner.js` (animation)
- `components/EmptyState.js` (gamified copy)
- `README.md`
- `CLAUDE.md`

**QUALITY CHECK:** Cold-launch on a physical iPhone. Walk through: open app → map loads with dark style → search a venue → tap marker → see VenueDetailSheet → post a vibe → see XP toast → check profile → see XP bar updated. No jank, no grey flash, no layout shifts.

**SACRED STEP:** Test the full flow on a real device before tagging the v2 release. Simulators do not reproduce GPU-related frame drops, real location permission dialogs, or Google Maps API billing triggers. A human must do a physical device run.

---

## EXECUTION SUMMARY TABLE

| Phase | Name | Duration | Gate |
|-------|------|----------|------|
| 0 | Branch & Baseline | 30 min | App boots on simulator |
| 1 | Purge & Map Setup | 2–3 hours | Dark map renders, bottom tabs visible |
| 2 | Google Places Integration | 1 day | Search→marker→sheet→PostVibe works |
| 3 | Supabase Hybrid DB | 4–6 hours | Vibe posts with place_id, appears on map |
| 4 | Gamification Engine | 1–2 days | XP awards, streak tracks, badges unlock |
| 5 | Polish & Belli UI | 1 day | Physical device test passes |

**Total estimate: 3–5 focused engineering days.**

---

## CURSOR INSTRUCTIONS

When you tell Cursor to execute a phase, use this exact prompt format:

```
Execute Phase [N] of DARKNITE_V2_MASTER_PLAN.md.

Read the plan. Perform only the steps listed for Phase [N].
Do not write code for future phases.
Do not modify files outside the "FILES MODIFIED/CREATED" lists for Phase [N].
After each step, confirm the step number completed.
Stop and ask before making any structural decision not covered by the plan.
```

---

## OPEN QUESTIONS (resolve before Phase 2)

1. **Google Places API billing model** — Are we using the legacy Places API or the new Places API (v1)? The new API has different endpoint URLs and response shapes. Confirm in Google Cloud Console before writing `googlePlacesService.js`.
2. **react-native-maps + Expo SDK 54** — This combo has had compatibility issues in the past. Run `npx expo install react-native-maps` (not `npm install`) to get the Expo-compatible version.
3. **Bottom sheet library** — `react-native-modal` is already in package.json. Acceptable for Phase 2. If performance is poor on Android, evaluate `@gorhom/bottom-sheet` in Phase 5.
4. **Leaderboard scope** — Phase 4 leaderboard is city-scoped by most recent vibe location. If a user posts in multiple cities in one week, their city is ambiguous. Define the tiebreak rule before building the query.

---

*This document is the single source of truth for the DarkNite v1 → v2 pivot. Do not modify it mid-execution. If requirements change, create a new section at the bottom titled "AMENDMENTS" with a date and rationale.*

---

## AMENDMENTS

**2026-05-21** — Resolved open questions before Phase 1:

1. **Google Places API:** New Places API (v1) with FieldMasks (Opção A).
2. **react-native-maps:** Install via `npx expo install react-native-maps` on Expo SDK 54 (acknowledged).
3. **Bottom sheet:** `@gorhom/bottom-sheet` for VenueDetailSheet (Opção A) — install in Phase 2, not `react-native-modal`.
4. **Leaderboard scope:** City = most recent vibe city (Opção A); tiebreak TBD at Phase 4 if needed.

---

## PHASE 5.5 — Map Crash Patch (already applied 2026-05-21)

**TRIGGER:** Random app exit reported during rapid map zoom/pan after Phase 5 completion.

**ROOT CAUSE:** Double-fetch race condition. `MapScreen.js` had both a debounced `handleRegionChangeComplete` AND a `useEffect` watching `region?.latitude/longitude` — both calling `fetchNearby()`. Every pan fired two parallel Places API requests with no cancellation. Stale responses arrived out of order and hammered `setNearbyPlaces`, triggering a react-native-maps marker lifecycle conflict. Secondary issue: `scheduleBatchFetch` was called once per mounted marker per `nearbyPlaces` change (N markers × M pans = N×M calls). Tertiary issue: `handleRealtimeVibeInsert` could fire `setState` after AppProvider unmounted.

**FILES PATCHED:**

| File | Change |
|------|--------|
| `components/MapScreen.js` | Added `abortControllerRef`; each `fetchNearby` call aborts the previous one; removed the double-fetch `useEffect`; initial load now triggered from coords `useEffect`; cleanup `useEffect` aborts on unmount; wires `triggerVibeCounts` once per `nearbyPlaces` change |
| `components/VenueMapMarker.js` | Removed `scheduleBatchFetch` from per-marker hook; exported `triggerVibeCounts(places)` for single-call pattern from MapScreen |
| `contexts/AppContext.js` | Added `realtimeMountedRef`; `handleRealtimeVibeInsert` guards state update with mounted check; cleanup sets `realtimeMountedRef.current = false` before unsubscribing |

**QUALITY CHECK:** Pan the map rapidly 10+ times in 5 seconds. App must not exit. Verify only one spinner shows per pan gesture (not two). Verify vibe count badges still appear on markers.

**SACRED STEP:** Test the abort behaviour on a slow network (enable "Slow 3G" in dev tools or airplane mode with brief reconnect). Verify the "AbortError" is silently swallowed and does not surface as a red error screen or Sentry alert.

---

## PHASE 6 — Social Feed Layer (2–3 days)

**TRIGGER:** Phase 5.5 quality check passed. Map is stable under rapid interaction.

**PURPOSE:** Add a third bottom tab — a social "Feed" — showing a live, proximity-based stream of vibes posted at nearby venues in the last 6–8 hours. Transform the existing `VenueDetailSheet` into a richer venue page with a scrollable vibe feed. No social graph required: the feed is purely location and time-window driven.

---

### CONCEPT DECISIONS (locked 2026-05-21)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Feed top-level view | Classic social feed (newest vibes first from nearby venues) | Users want "what's happening now," not a ranked list |
| Venue drill-down depth | Keep bottom sheet — make it richer and scrollable | No full-screen navigation change needed |
| Vibe lifespan | 6–8 hours (hardcoded window, no user setting) | Nightlife-appropriate; feed resets naturally each evening |
| Proximity scope | Same radius as map Nearby Search (1500m default) | Consistent with what user sees on the map |
| Auth gate | Feed readable by guests; posting requires auth | Lowers discovery friction; preserves UGC gate |

---

### PHASE 6A — Feed Tab Foundation (Day 1)

**TRIGGER:** Phase 5.5 quality check passed.

**PURPOSE:** Build the `FeedScreen` component and wire it as the middle bottom tab. Feed shows real vibes from Supabase filtered to nearby place_ids and the 6–8 hour window.

#### Steps

| # | Action | Owner | Tool | Output |
|---|--------|-------|------|--------|
| 6A.1 | Create `services/feedService.js` — two methods: `getNearbyFeed(placeIds, hoursWindow)` and `getFeedForPlace(placeId, hoursWindow)` (see Query Spec below) | Engineer | Cursor | Feed service |
| 6A.2 | Create `components/VibeCard.js` — single feed card: venue name + type chip, vibe tags, text snippet, username, relative time ("32 min ago"), XP badge if > 20 XP earned | Engineer | Cursor | Vibe card component |
| 6A.3 | Create `components/FeedScreen.js` — FlatList of `VibeCard`s; pulls `nearbyPlaces` from AppContext to get place_ids; calls `feedService.getNearbyFeed()`; pull-to-refresh; empty state; loads on mount | Engineer | Cursor | Feed screen |
| 6A.4 | Add `FeedTab` to `navigation/MainTabsNavigator.js` as the centre tab: Feed · Map · Profile (left to right) | Engineer | Cursor | 3-tab nav |
| 6A.5 | Add Supabase index if not present: `CREATE INDEX IF NOT EXISTS vibes_created_at_place_id_idx ON vibes (created_at DESC, place_id)` — add to a new migration `014_add_feed_index.sql` | Engineer | SQL | Migration file |
| 6A.6 | Apply migration 014 to Supabase | Engineer | Supabase CLI | Index live |
| 6A.7 | Test: open Feed tab — vibes from nearby bars appear, sorted newest first, within 6–8 hour window | Engineer | Expo | Feed renders real data |

**FILES CREATED — 6A:**
- `services/feedService.js`
- `components/VibeCard.js`
- `components/FeedScreen.js`
- `supabase/migrations/014_add_feed_index.sql`

**FILES MODIFIED — 6A:**
- `navigation/MainTabsNavigator.js` (add Feed tab, reorder to Feed·Map·Profile)

---

### feedService.js — Query Spec

```js
// Both methods filter to the configured VIBE_WINDOW_HOURS (default 8)

const VIBE_WINDOW_HOURS = 8;

async function getNearbyFeed(placeIds, hoursWindow = VIBE_WINDOW_HOURS) {
  // SELECT vibes.*, user_profiles.username, user_profiles.avatar_url
  // FROM vibes
  // LEFT JOIN user_profiles ON vibes.user_id = user_profiles.id
  // WHERE vibes.place_id = ANY(placeIds)
  //   AND vibes.created_at > NOW() - INTERVAL '{hoursWindow} hours'
  //   AND vibes.is_active = true
  // ORDER BY vibes.created_at DESC
  // LIMIT 50
}

async function getFeedForPlace(placeId, hoursWindow = VIBE_WINDOW_HOURS) {
  // Same query but WHERE place_id = placeId (single venue)
  // LIMIT 20
}
```

---

### PHASE 6B — Venue Detail Sheet Upgrade (Day 1–2)

**TRIGGER:** Phase 6A quality check passed (Feed tab renders real vibes).

**PURPOSE:** Make `VenueDetailSheet` earn its place. When a user taps a map marker, the sheet now slides up with venue photo, key stats, AND a scrollable list of recent vibes for that specific venue. The sheet becomes the answer to "what's the vibe like *here* right now?"

#### Steps

| # | Action | Owner | Tool | Output |
|---|--------|-------|------|--------|
| 6B.1 | Upgrade `components/VenueDetailSheet.js` — add a scrollable vibe section below the existing venue info block; calls `feedService.getFeedForPlace(placeId)` when a place is selected; renders 3–5 `VibeCard`s with a "See all X vibes" CTA at the bottom | Engineer | Cursor | Richer sheet |
| 6B.2 | Add "See all vibes" navigation — tapping the CTA pushes `VenueVibesScreen` (new screen) which shows the full vibe list for that venue using `FlatList` + `VibeCard` | Engineer | Cursor | Full venue feed |
| 6B.3 | Create `components/VenueVibesScreen.js` — full-screen vibe list for a single venue; receives `placeId` + `placeName` as nav params; pull-to-refresh; empty state with "Be the first to post a vibe here — +20 XP" CTA | Engineer | Cursor | Venue vibes screen |
| 6B.4 | Add `VenueVibes` route to `navigation/AppStackNavigator.js` | Engineer | Cursor | Route wired |
| 6B.5 | Wire "Post Vibe" CTA on `VenueVibesScreen` — navigates to `PostVibeScreen` with `placeId` prepopulated | Engineer | Cursor | CTA works |
| 6B.6 | Test: tap map marker → sheet shows venue photo + last 3 vibes; tap "See all" → full list; tap "Post Vibe" → PostVibeScreen with correct place pre-filled | Engineer | Expo | Full flow |

**FILES CREATED — 6B:**
- `components/VenueVibesScreen.js`

**FILES MODIFIED — 6B:**
- `components/VenueDetailSheet.js` (add vibe feed section)
- `navigation/AppStackNavigator.js` (add VenueVibes route)

---

### PHASE 6C — Feed Polish & Empty States (Day 2–3)

**TRIGGER:** Phase 6B quality check passed. Both feed and venue sheets show real vibes.

**PURPOSE:** Make the feed feel alive even when sparse. Add skeleton loading, smart empty states, real-time updates, and the gamification tie-in so posting from the feed context awards XP.

#### Steps

| # | Action | Owner | Tool | Output |
|---|--------|-------|------|--------|
| 6C.1 | Add skeleton loading to `FeedScreen` — show 5 placeholder `VibeCard` ghost rows while the initial feed loads | Engineer | Cursor | Loading state |
| 6C.2 | Add tiered empty states to `FeedScreen`: (a) "No vibes nearby yet — be the first" + Post Vibe CTA if user is authenticated; (b) "Sign in to post a vibe and start the night" if guest | Engineer | Cursor | Contextual empty states |
| 6C.3 | Subscribe `FeedScreen` to Supabase realtime `vibes` INSERT events for visible place_ids — new vibes appear at the top without manual pull-to-refresh | Engineer | Supabase realtime | Live feed |
| 6C.4 | Add a floating "Post Vibe" button (FAB) at the bottom-right of `FeedScreen` — requires auth, shows `requireAuth()` wall for guests | Engineer | Cursor | Feed-level FAB |
| 6C.5 | Add venue name as a tappable link on each `VibeCard` — tapping opens the `VenueDetailSheet` for that venue from the feed | Engineer | Cursor | Feed → venue navigation |
| 6C.6 | Ensure XP toast fires correctly when posting from the feed context (PostVibeScreen already handles this — verify the flow from Feed → PostVibe → XP toast) | Engineer | Expo | XP loop from feed |
| 6C.7 | Test full night simulation: post 3 vibes at 3 different venues, verify all 3 appear in Feed within 5 seconds without refresh | Engineer | Expo | Realtime feed verified |

**FILES MODIFIED — 6C:**
- `components/FeedScreen.js` (skeleton, empty states, realtime subscription, FAB)
- `components/VibeCard.js` (venue name tap target)

---

## PHASE 6 QUALITY GATE

Before tagging v2.1, all of the following must pass on a physical device:

1. Feed tab opens and shows vibes from nearby venues within the 8-hour window
2. Pull-to-refresh reloads the feed
3. Posting a new vibe causes it to appear in the feed within 5 seconds (realtime)
4. Tapping a map marker → VenueDetailSheet shows venue-specific vibes
5. "See all vibes" → VenueVibesScreen with full list
6. "Post Vibe" from VenueVibesScreen → PostVibeScreen pre-filled with correct venue
7. XP toast fires after posting
8. Empty state shown correctly for a venue with no vibes in the last 8 hours
9. Guest user sees feed (read-only) but hits auth wall on "Post Vibe"

**SACRED STEP:** Manually verify the 8-hour window query returns zero results for a venue where the last vibe was posted 9+ hours ago. A bug in the time-window filter that shows stale overnight data will make the app feel dead by mid-morning and destroy the "live" perception. This must be confirmed on production data, not mocked data.

---

## UPDATED EXECUTION SUMMARY

| Phase | Name | Status |
|-------|------|--------|
| 0 | Branch & Baseline | ✅ Complete |
| 1 | Purge & Map Setup | ✅ Complete |
| 2 | Google Places Integration | ✅ Complete |
| 3 | Supabase Hybrid DB | ✅ Complete |
| 4 | Gamification Engine | ✅ Complete |
| 5 | Polish & Belli UI | ✅ Complete |
| 5.5 | Map Crash Patch | ✅ Applied 2026-05-21 |
| 6A | Feed Tab Foundation | 🔲 Next |
| 6B | Venue Detail Sheet Upgrade | 🔲 Pending 6A |
| 6C | Feed Polish & Empty States | 🔲 Pending 6B |
