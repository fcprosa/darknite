# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
npm start              # Start Expo dev server
npm run android        # Run on Android emulator
npm run ios            # Run on iOS simulator
npm run web            # Run web version
```

**Prerequisites:** Node.js 18+, Expo CLI (`npm install -g expo-cli`)

## Environment Setup

Create `.env` with required variables:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
GOOGLE_PLACES_API_KEY=your-google-places-key
SENTRY_DSN=your-sentry-dsn (optional, for error tracking)
```

Environment variables flow through `app.config.js` → `Constants.expoConfig.extra`.

## Architecture Overview

**Stack:** React Native 0.81 + Expo 54 + Supabase (PostgreSQL + Auth) + Google Places (New API) + React Navigation 6

**State Management:** React Context API
- `AuthContext` - Authentication state, session, sign in/out methods, guest mode, auth walls via `requireAuth()`
- `AppContext` - `nearbyPlaces`, `vibesByPlaceId` (batch-loaded by `place_id`), `gamification` state, place/vibe refresh methods

**Navigation Structure:**
```
RootNavigator (auth routing)
├── AuthStackNavigator (login/signup, profile setup)
└── AppStackNavigator (main app)
    ├── MainTabsNavigator (bottom tabs: Map, Profile)
    └── Stack screens (Settings, PostVibe, Achievements, Leaderboard)
```

**Services Layer (`/services`):** Business logic for vibes, Google Places, gamification, check-ins, notifications, profiles. Services include retry logic with exponential backoff and tagged logging.

**Key Patterns:**
- Vibes keyed by Google `place_id` (hybrid model; legacy `venue_id` nullable)
- Vibe rate limiting: RPC `submit_venue_vibe(p_place_id)` with 60-minute cooldown per place per user
- Gamification: `awardXP`, streaks, badges via `gamificationService.js` + migration `013_add_gamification_tables.sql`
- Haptic feedback via `expo-haptics` on vibe submit, badge unlock, XP toast, check-in
- UI palette: `COLORS` in `constants/index.js` (Belli-inspired v2 theme)
- Logger with Sentry integration (`utils/logger.js`) - sanitizes sensitive data, uses tagged logging: `logger.tag("ServiceName")`
- Supabase RLS: public read on places/vibes; authenticated insert on vibes

## Database Schema

**Core tables:**
- `venues` - Legacy NYC seed venues (optional; v2 map uses Google Places)
- `vibes` - User-submitted experiences; `place_id` (Google) primary, `venue_id` nullable
- `user_profiles` - User data and preferences

**Gamification (migration 013):**
- `user_xp`, `user_streaks`, `user_badges`, `badge_definitions`

**Migrations** in `/supabase/migrations/` must be applied in order (RLS, `place_id`, RPC updates, gamification).

## Key Files

| File | Purpose |
|------|---------|
| `contexts/AuthContext.js` | Auth state, requireAuth(), guest mode |
| `contexts/AppContext.js` | nearbyPlaces, vibesByPlaceId, gamification |
| `services/vibeService.js` | Vibe CRUD by place_id, batch queries |
| `services/googlePlacesService.js` | Nearby search, place details, photos |
| `services/gamificationService.js` | XP, streaks, badges, leaderboard |
| `components/MapScreen.js` | Global map tab |
| `components/VenueDetailSheet.js` | Place detail bottom sheet (react-native-modal) |
| `components/PostVibeScreen.js` | Structured vibe flow + XP toast |
| `utils/supabase.js` | Supabase client singleton |
| `navigation/RootNavigator.js` | Auth/app/guest routing |

## Debugging

- Auth issues: Check `[Auth]` tagged logs in AuthContext
- Map/Places: Verify `GOOGLE_PLACES_API_KEY` in `.env`, restart with `expo start --clear`
- Data loading: Enable `[AppContext]` and `[VibeService]` logging
- RLS/RPC errors: Verify Supabase policies and `submit_venue_vibe` uses `p_place_id`
- Gamification: Ensure migration `013` applied (`user_xp` table exists)
- Environment: Verify `app.config.js` loads `.env` correctly
