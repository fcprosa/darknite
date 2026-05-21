# DarkNite

**Real-time nightlife intel — global map, live vibes, and XP gamification**

DarkNite is a **React Native (Expo)** app that surfaces nearby bars and clubs via **Google Places**, lets users post structured **vibes** (crowd, music, line, cover, and more), and rewards contributions with **XP, streaks, and badges**.

---

## Quick Start

### Prerequisites

- **Node.js 18+**
- **npm**
- **Expo CLI** (`npm install -g expo-cli`)
- **Supabase** project
- **Google Places API** key (Places API New enabled)

### Installation

```bash
git clone <your-repo-url>
cd darknite
npm install
```

### Environment variables

Create a `.env` file in the project root:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
GOOGLE_PLACES_API_KEY=your-google-places-key
SENTRY_DSN=your-sentry-dsn   # optional
```

Get Supabase values from: **Dashboard → Settings → API**

Get Google key from: **Google Cloud Console → APIs & Services → Credentials** (enable Places API New)

> `.env` is gitignored — never commit secrets.

### Database setup

Apply migrations in `/supabase/migrations/` **in order** via the Supabase SQL Editor (or CLI).

Required for v2:

- `009`–`012` — `place_id` on vibes, `submit_venue_vibe(p_place_id)` RPC
- `013` — gamification tables (`user_xp`, streaks, badges)

See `database-schema.md` for legacy NYC `venues` documentation.

### Run the app

```bash
npm start
```

- Scan the QR code with **Expo Go** (iOS / Android), or
- Press `i` (iOS simulator) / `a` (Android emulator)

After changing `.env`, restart with `expo start --clear`.

---

## v2 Features

| Area | Description |
|------|-------------|
| **Map tab** | Dark-styled map, nearby nightlife from Google Places, search, venue detail sheet |
| **Vibes** | Post vibes tied to `place_id`; rate-limited via Supabase RPC |
| **Gamification** | XP on vibe/check-in, streak banner, badges, leaderboard by recent vibe city |
| **Profile tab** | XP bar, streak, badges, vibe history, settings |

**Navigation:** Map + Profile tabs; stack screens for Post Vibe, Settings, Achievements, Leaderboard.

**Design:** Belli-inspired `COLORS` palette in `constants/index.js`; haptics on key actions.

---

## Manual QA checklist (device)

Run on a physical iPhone and Android emulator before release:

1. **Cold launch (iPhone):** Map loads with dark tiles; no grey flash on startup.
2. **Search → marker → sheet:** Search a venue, tap result, sheet slides up with spring animation.
3. **Post vibe:** Submit a vibe → success haptic → XP toast → profile XP bar updates.
4. **Streak:** Post on consecutive local days (or verify streak banner after activity).
5. **Android smoke:** Map, search, sheet, post vibe, profile load without crashes.

---

## Project structure

```
darknite/
├── components/          # Screens & UI (MapScreen, PostVibeScreen, VenueDetailSheet, …)
├── contexts/            # AuthContext, AppContext
├── services/            # vibeService, googlePlacesService, gamificationService, …
├── navigation/          # Root, Auth, App stack, Main tabs
├── constants/           # COLORS, gamification constants
├── supabase/migrations/ # Ordered SQL migrations
├── utils/               # supabase client, logger, helpers
└── app.config.js        # Expo config (reads .env)
```

---

## Environment reference

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Public anon key (RLS protects data) |
| `GOOGLE_PLACES_API_KEY` | Yes | Google Places API (New) for map search |
| `SENTRY_DSN` | No | Error tracking |

---

## Troubleshooting

**Places / map empty**

- Confirm `GOOGLE_PLACES_API_KEY` in `.env` and Places API New is enabled.
- Restart Expo with `--clear`.

**RLS or RPC errors on vibe submit**

- User must be logged in.
- Apply migrations through `012` (RPC uses `p_place_id`).

**XP / badges not updating**

- Apply migration `013_add_gamification_tables.sql`.

**Supabase connection**

- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY`; restart dev server after `.env` changes.

---

## License

TBD
