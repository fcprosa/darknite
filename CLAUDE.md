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
SENTRY_DSN=your-sentry-dsn (optional, for error tracking)
```

Environment variables flow through `app.config.js` → `Constants.expoConfig.extra`.

## Architecture Overview

**Stack:** React Native 0.81 + Expo 54 + Supabase (PostgreSQL + Auth) + React Navigation 6

**State Management:** React Context API
- `AuthContext` - Authentication state, session, sign in/out methods, guest mode, auth walls via `requireAuth()`
- `AppContext` - App-wide state: venues array, `latestVibesByVenueId` map (batch-loaded to avoid N+1), venue/vibe refresh methods

**Navigation Structure:**
```
RootNavigator (auth routing)
├── AuthStackNavigator (login/signup)
└── AppStackNavigator (main app)
    ├── MainTabsNavigator (bottom tabs: Home, Explore, Profile)
    └── Modal screens (Settings, VibeReport, etc.)
```

**Services Layer (`/services`):** Business logic for vibes, venues, check-ins, notifications, profiles. Services include retry logic with exponential backoff and tagged logging.

**Key Patterns:**
- Vibe rate limiting: 60-minute cooldown per venue per user (enforced by database trigger)
- Haptic feedback via `expo-haptics`
- Logger with Sentry integration (`utils/logger.js`) - sanitizes sensitive data, uses tagged logging: `logger.tag("ServiceName")`
- Supabase RLS: venues public read-only, vibes public read + authenticated insert

## Database Schema

**Tables:**
- `venues` - Nightlife venues (bars/clubs) with neighborhood, venue_type, default ratios
- `vibes` - User-submitted venue experiences (crowd, ratio, line, cover, music, age_range, etc.)
- `user_profiles` - User data

**Migrations** in `/supabase/migrations/` must be applied in order (RLS policies, rate limiting trigger, indexes).

## Key Files

| File | Purpose |
|------|---------|
| `contexts/AuthContext.js` | Auth state, requireAuth(), guest mode |
| `contexts/AppContext.js` | Venues array, latestVibesByVenueId batch map |
| `services/vibeService.js` | Vibe CRUD, batch queries, retry logic |
| `utils/supabase.js` | Supabase client singleton |
| `utils/logger.js` | Tagged logging + Sentry |
| `navigation/RootNavigator.js` | Auth/app/guest routing |

## Debugging

- Auth issues: Check `[Auth]` tagged logs in AuthContext
- Data loading: Enable `[AppContext]` and `[VibeService]` logging
- RLS errors: Verify Supabase policies and user auth state
- Environment: Verify `app.config.js` loads `.env` correctly
