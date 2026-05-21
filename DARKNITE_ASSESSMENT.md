# DarkNite — Full Project Assessment & Handoff

> **Purpose of this document.** This is a complete, no-omissions assessment of the DarkNite
> codebase, written so another Claude instance (chat) — or any new engineer — can understand
> the project end-to-end and continue work without re-reading every file. It covers what the
> app is, how it is built, what works, what is broken, what is risky, and what to do next.
>
> **Audit date:** 2026-05-17 · **Branch audited:** `ui-lovable-v2` · **App version:** 1.0.2
>
> Read this alongside `CLAUDE.md` (build/run guidance), `PROJECT_CONTEXT_MAP.md`, and
> `database-schema.md`. Where those documents disagree with the actual code, **this document
> reflects the code** and the disagreements are flagged explicitly below.

---

## 1. What DarkNite Is

DarkNite is a **React Native (Expo) mobile app** — "real-time nightlife intel for NYC bars
& clubs." Users browse venues, see live crowd/line/music data submitted by other users
("vibes"), do quick "check-ins," declare a "Move" (intent to go somewhere tonight), and earn
points. The backend is **Supabase** (Postgres + Auth + Realtime).

Target platform is **iOS first** (TestFlight / App Store; bundle `com.darknite.app`,
ASC app ID `6759563569`). Android is configured but secondary. There is no web target in
practice despite `react-native-web` being present.

### Core user-facing concepts

| Concept | Meaning |
|---|---|
| **Vibe** | A detailed venue report (crowd, music, line, cover, drinks price, age range). Posted via the "I'm Here" flow. Server-rate-limited. |
| **Check-in** | A 1-question lightweight report (line wait for clubs, crowd level for bars). |
| **Move** | "I plan to go here tonight." Expires after 8h. Drives social-proof counts. |
| **Feed score / ranking** | Venues are ordered in the Home feed by a computed score (see §6 — there is a serious problem here). |
| **Guest mode** | Browse without an account (limited to 2 venues preview). Posting requires auth. |
| **Founder / verified user** | `user_profiles.is_verified = true` — their vibes get a 1.2× ranking weight. |

---

## 2. Tech Stack & Versions

- **React Native** 0.81.5, **React** 19.1.0, **Expo** ~54.0.30
- **React Navigation** 6 (native-stack + bottom-tabs)
- **Supabase JS** ^2.89.0 (`@supabase/supabase-js`)
- **State:** React Context only (no Redux/Zustand)
- **Auth:** Supabase email/password + Apple Sign-In (`expo-apple-authentication`)
- **Notifications:** `expo-notifications` (local scheduled reminders; no remote push server)
- **Error tracking:** Sentry (`@sentry/react-native` ^7.9.0)
- **Other Expo modules:** location, haptics, blur, linear-gradient, network, updates, sharing
- **Build:** EAS (`eas.json`), `appVersionSource: remote`, production auto-increments build number
- **Language:** Plain JavaScript (`.js`) for almost everything. `tsconfig.json` exists and a
  tiny `src/` folder has 3 `.tsx`/`.ts` files (`Chip.tsx`, `tokens.ts`, `timeAgo.ts`) that
  appear to be an **abandoned/unused** TypeScript migration starter — they are not imported
  by the app.

---

## 3. Repository Layout

```
darknite/
├── App.js                  Root: providers, font loading, Sentry wrap, notif/nav handlers
├── index.js                registerRootComponent + NavigationContainer
├── app.config.js           Expo config (dynamic, reads .env) — THE ACTIVE CONFIG
├── app.json                Expo config (static) — STALE/CONFLICTING, see §9
├── eas.json                EAS build/submit profiles
├── contexts/               AuthContext, AppContext, NetworkContext
├── navigation/             RootNavigator + 5 stack/tab navigators + navigationService
├── components/             38 files — screens AND reusable components mixed together
├── screens/                5 files — more screens (Privacy, Terms, NotificationSettings, SetMove)
├── services/               Supabase data layer (vibe, venue, checkIn, move, profile, user, notification)
├── utils/                  Pure helpers + supabase client + logger + sentry + schedulers
├── constants/              App constants, data sources, layout, spacing
├── supabase/migrations/    8 SQL migrations (+ 2 loose migrate-*.sql files)
├── scripts/                Node scripts: seed venue data, backfill defaults, validate ranking
├── src/                    3 unused .ts/.tsx files (abandoned TS migration)
├── shims/ws.js             Metro shim so 'ws' resolves on RN (Supabase realtime dep)
├── maestro/                3 Maestro E2E smoke-test YAMLs
├── darknite-sim/           Standalone TS load-test harness (separate npm project)
├── styles/common.js        Shared styles
└── docs: README, CLAUDE.md, PROJECT_CONTEXT_MAP.md, database-schema.md,
         RANKING_ENGINE_V2_DEPLOYMENT.md, SENTRY_SETUP.md, TESTFLIGHT_SETUP.md
```

**Note:** `components/` contains both full screens (HomeScreen, ExploreScreen, ProfileScreen,
PostVibeScreen, etc.) and small reusable components (VibeChip, FilterChip, Toast). `screens/`
contains only 5 screens. This split is inconsistent — there is no rule, just history.

---

## 4. Architecture

### 4.1 Provider tree (`App.js`)

```
SafeAreaProvider
└── NetworkProvider          (online/offline detection)
    └── AuthProvider         (Supabase session, sign-in/out, requireAuth)
        └── AppProvider      (venues, vibes, check-ins, moves, location, realtime)
            ├── RootNavigator
            ├── AuthModalWrapper      (global auth modal)
            ├── SignOutGuestReset     (clears guest mode on auth change)
            ├── PendingNavHandler     (deferred navigation after signup)
            ├── NotificationHandler   (deep-link from tapped notifications)
            └── OfflineBanner
```

`index.js` wraps `App` in `NavigationContainer` with a shared `navigationRef`
(`navigation/navigationService.js`) used for imperative navigation from notification taps.

### 4.2 Navigation

```
RootNavigator (decides: onboarding? / auth? / app?)
├── OnboardingScreen          (first launch only — AsyncStorage flag)
├── AuthStackNavigator        (just LandingScreen — when not signed in & not guest)
└── AppStackNavigator         (signed in OR guest mode)
    ├── MainTabsNavigator
    │   ├── HomeTab    → HomeStackNavigator   (HomeList, VenuePicker, SetMove, PostVibe, VenueDetails)
    │   ├── ExploreTab → ExploreStackNavigator (ExploreList, NeighborhoodVenues, VenueDetails)
    │   └── ProfileTab → ProfileScreen
    └── Modals: Settings, PrivacySettings, NotificationSettings, ProfileSetup,
                VibeReport, PrivacyPolicy, TermsOfService
```

Both Home and Explore stacks keep `selectedVenue` and `showPostVibe` in **local component
state** and render `AnimatedPostVibeSheet` as a sibling overlay. This works but means venue
selection state is duplicated across two navigators.

### 4.3 Contexts

- **`AuthContext`** — Supabase session, `user`, `loading`, `signUp/signIn/signInWithApple/
  signOut/deleteAccount`, `requireAuth(callbackOrNav)` auth-wall helper, global `showAuthModal`,
  `pendingNav`. Subscribes once to `onAuthStateChange`. Creates `user_profiles` row on signup.
- **`AppContext`** — `venues[]`, `latestVibesByVenueId`, `recentVibesByVenueId`,
  `latestBarCrowdByVenueId`, `latestLineWaitByVenueId`, `moveCountsByVenueId`, `guestMode`,
  `userLocation`, `locationReady`, plus refresh/upsert methods and a Supabase **Realtime**
  subscription on the `vibes` table. Polls move counts every 2 min.
- **`NetworkContext`** — `expo-network` polling every 30 s + on foreground. Derives `isOnline`.

### 4.4 Services layer

`services/*.js` wrap Supabase queries. Generally solid: defensive null checks, tagged
logging (`logger.tag("Name")`), retry-with-backoff in `vibeService.getLatestVibe`, fallback
venues in `venueService` if the DB call fails. `vibeService` is the most important file —
it owns `VIBE_SELECT_FIELDS`, the `is_verified` profile-join flattening, and `createVibe`
which calls the `submit_venue_vibe` RPC and decodes its three rate-limit error types.

---

## 5. Data Model (Supabase)

### Tables

| Table | Key columns | Notes |
|---|---|---|
| `venues` | `id` (text PK), `name`, `venue_type` ('bar'\|'club'), `neighborhood`, `address`, `city`, `default_guys/girls`, plus many `default_*`/`typical_*`/`usual_*`/`google_*` columns, `latest_vibe_created_at`, `vibe_active` | Heavily denormalized over migrations. `venue_type` defaults to `'bar'`. |
| `vibes` | `id` (bigint PK), `venue_id`→venues, `user_id`→user, `crowd`, `ratio`, `music`, `line`, `cover`, `bar_type`, `drinks_price_tier`, `age_range`, `crowd_vibe`, `confidence_score`, `verified`, `created_at` | Inserts go ONLY through `submit_venue_vibe` RPC (RLS denies direct insert). |
| `check_ins` | `id` (uuid PK), `venue_id`, `user_id`, `line_wait` (clubs), `crowd_level` (bars), `created_at` | Direct client insert allowed. |
| `user_profiles` | `id` (uuid PK = auth.users.id), `username` (unique), `going_out_days[]`, `preferred_scene`, `favorite_neighborhoods[]`, `favorite_genres[]`, `reminders_enabled`, `notification_settings` (jsonb), `is_verified` | |
| `user_points` | `user_id` (PK), `total_points`, `checkin_count`, `vibe_count` | **Read but never written by the app** — see §7. |
| `moves` | `id` (uuid), `venue_id`, `user_id`, `time_band`, `status`, `created_at`, `expires_at` | Two conflicting creation scripts exist — see §9. |
| `vibe_reports` | `reporter_id`, `reported_vibe_id`, `reason` (CHECK), `details`, UNIQUE(reporter,vibe) | UGC moderation. No SELECT policy (admin-only via service_role). |
| `user_blocks` | `blocker_id`, `blocked_user_id`, composite PK, CHECK no self-block | UGC blocking. |

### RPC functions

- **`submit_venue_vibe(...)`** — `SECURITY DEFINER`. The only legitimate way to insert a vibe.
  Enforces three rate limits: **10 min** between any submission (`rate_limit_speed`),
  **30 min** per same venue (`rate_limit_venue`), **15 vibes / rolling 12 h**
  (`rate_limit_global`). Admin UUID `b668ed54-5379-4ac7-b798-b9589a99442b` bypasses all three.
  Upserts (UPDATE) if the same user posted at the venue within 4 h, else INSERT.
- **`delete_user()`** — `SECURITY DEFINER`. GDPR / App Store 5.1.1(v) account deletion. Deletes
  all user rows then `auth.users`. Called by `AuthContext.deleteAccount()`.
- **`update_venue_latest_vibe()`** — trigger on `vibes` insert/update; maintains
  `venues.latest_vibe_created_at` + `vibe_active`.
- **`expire_stale_vibes()`** / **`expire_old_moves()`** — cleanup functions intended for
  `pg_cron`. **The cron schedule is commented out** in the migration — see §9.

### RLS summary (from `add_ugc_compliance_and_rls_hardening.sql`)

- `vibes`: SELECT public; **INSERT denied for all client roles** (RPC only); UPDATE/DELETE owner.
- `user_profiles`: SELECT public; INSERT/UPDATE owner; DELETE denied (RPC only).
- `vibe_reports`: INSERT owner-only; **no SELECT policy** (default deny).
- `user_blocks`: SELECT/INSERT/DELETE own rows.
- `moves`: SELECT all; INSERT/UPDATE/DELETE owner.

> ⚠️ **Migrations are NOT auto-applied.** There is no Supabase CLI link / no migration runner.
> Files in `supabase/migrations/` are applied **manually in the Supabase SQL Editor**. So the
> live database state can drift from these files, and from `database-schema.md`. Always verify
> the live schema before trusting either. The schema doc is dated 2025-01-27 and is **stale**
> (e.g. it still lists pre-RPC RLS like "vibes INSERT — authenticated users").

---

## 6. 🚨 The Biggest Issue: Three Competing Ranking Systems, Two of Them Dead

This is the single most important thing for a new engineer to understand.

The codebase contains **three separate venue-ranking implementations**:

1. **`utils/feedHelpers.js → computeFeedScore()`** — the sophisticated "Ranking Engine v2":
   exponential freshness decay (λ=0.025, ~28 min half-life), crowd intensity map, move-count
   step function, historical peak-proximity, founder 1.2× boost. An entire deployment doc
   (`RANKING_ENGINE_V2_DEPLOYMENT.md`) and a validation script
   (`scripts/validate-ranking-engine.js`) exist for it.
2. **`utils/feedRanker.js → rankVenue()`** — a different, simpler bucketed scoring (age
   buckets, volume cap, trending boost, move momentum, Haversine proximity).
3. **`utils/scoreHelpers.js → getHotnessScore()`** — yet a third scheme using `CROWD_SCORES`
   and `HOTNESS_*` constants from `constants/index.js`.

**What the Home feed actually does** (`components/HomeScreen.js`):

```js
// line 120: computeFeedScore() is called...
const feedScore = computeFeedScore(venue, latestVibe, moveCount, now, {...});
// ...stored on the object as `feedScore`...
// line 163-194: ...but the sort uses rankVenue(), NOT feedScore.
return [...enrichedVenues].sort((a, b) => { const aScore = rankVenue(...); ... });
```

So **`computeFeedScore` is dead code in the feed** — computed every render, logged in dev,
and thrown away. The feed is ordered entirely by `rankVenue`. `getHotnessScore` is not used
anywhere in the runtime feed either.

**Worse:** `rankVenue` and `feedRanker.js`'s proximity logic read `venue.latitude` /
`venue.longitude`. Those columns **do not exist** on `venues` (the schema doc explicitly
says lat/lng were removed). So the proximity branch of `rankVenue` is permanently dead, and
`distanceKm` in HomeScreen is always `null`.

**Action for whoever picks this up:** decide which ranking is canonical. The documented
intent (and the most polished implementation) is `computeFeedScore`. Either wire the sort to
`feedScore` and delete `feedRanker.js` + `scoreHelpers.js`, or formally retire
`computeFeedScore` and its deployment doc. Right now the docs describe an engine the app
doesn't run.

---

## 7. Functional Gaps & Bugs (ranked)

### Critical / correctness

1. **Dead ranking engine** — see §6. The shipped feed does not behave the way
   `RANKING_ENGINE_V2_DEPLOYMENT.md` claims.
2. **Points system is non-functional.** `user_points` is read (`userService.getUserPoints`)
   but **never written** — there is no `awardPoints`, no INSERT/UPDATE to `user_points`
   anywhere in the app, and **no DB trigger** in any migration despite
   `checkInService.js` commenting "Awards +1 point automatically via database trigger."
   `getUserStats()` instead computes points client-side as `checkIns*1 + vibes*3`.
   - Inconsistent with docs: README/`PROJECT_CONTEXT_MAP.md` say a vibe = **+5**, code uses **×3**.
   - `userRank` is hardcoded to `9999` (placeholder); `weekendStreak` always `0`.
3. **Block filtering is incomplete.** `user_blocks` is loaded and applied **only in
   `VenueDetailsLovable.js`** (filters the recent-updates list there). The **Home feed and
   Explore feed do not filter blocked users at all** — a blocked user's vibe still drives a
   venue's status line, chips, and ranking everywhere except one screen.
4. **Realtime may silently not fire.** `AppContext` subscribes to `postgres_changes` on
   `vibes`. For that to work the `vibes` table must be in the `supabase_realtime` publication.
   **No migration adds it.** If it was not enabled by hand in the dashboard, realtime updates
   never arrive and the feature degrades to the 2-min move poll + manual refresh. Verify in
   the Supabase dashboard.

### Inconsistencies / drift

5. **`app.json` vs `app.config.js` conflict.** Both exist. `app.config.js` wins (Expo
   prefers it), but they disagree: `buildNumber` `"1"` vs `"2"`, plugin lists differ
   (`app.config.js` adds `expo-location`; `app.json` omits it), `infoPlist` differs. The git
   log even has a commit "Forcar build number 10 caralho" showing past confusion.
   **`app.json` should be deleted** to remove ambiguity.
6. **Two `moves` table definitions disagree.** `supabase/migrate-moves-table.sql` has CHECK
   constraints on `time_band`/`status` and a **unique partial index** "one active move per
   user." `supabase/migrations/add_moves_table.sql` has neither. Whichever ran on the live DB
   determines real behavior. `moveService.createMove` cancels-then-inserts, which only works
   correctly if exactly one active move per user is enforced.
7. **Two `SetMoveScreen` files** — `components/SetMoveScreen.js` (360 lines) and
   `screens/SetMoveScreen.js` (564 lines). Only `screens/SetMoveScreen.js` is wired into
   `HomeStackNavigator`. `components/SetMoveScreen.js` looks orphaned.
8. **`database-schema.md` is stale** (dated 2025-01-27, pre-RPC, pre-UGC). Do not trust its
   RLS section. `PROJECT_CONTEXT_MAP.md`'s RLS table is also outdated (says vibes INSERT =
   authenticated).
9. **`crowd` value sets are inconsistent.** `vibeService.validateVibeData` allows
   `Dead/Chill/Fun/Buzzing/Packed/Chaos`; `feedHelpers.CROWD_INTENSITY` lacks `Fun`'s
   sibling logic edge cases and treats `Buzzing` as legacy; `constants.CROWD_SCORES` omits
   `Buzzing` entirely and has different magnitudes. `database-schema.md` lists yet another set.
10. **Abandoned TypeScript starter** — `src/` (`Chip.tsx`, `tokens.ts`, `timeAgo.ts`) and
    `tsconfig.json` are unused. Either commit to TS or delete `src/`.

### Minor

11. `utils/supabase.js:10` logs `SUPABASE_URL` to the console unconditionally (not
    `__DEV__`-guarded). Low risk (URL is public) but noisy in production logs.
12. `getUserStats` runs a query that counts `vibes` rows just to derive a "total users"
    number it then ignores (`userRank` is hardcoded). Wasted query.
13. `App.js`, `RootNavigator.js`, several contexts use raw `console.log` with no `__DEV__`
    guard; only `logger.js`/`debug` are environment-aware.
14. Some Portuguese-language comments/commit messages mixed in ("Forcar build number 10
    caralho", "O teu UUID de Admin", "remove o listener") — cosmetic, the author is
    Portuguese-speaking. Harmless but worth knowing when reading.

---

## 8. Security Review

**Generally solid for an MVP.** Highlights:

- ✅ Vibe inserts are server-authoritative. RLS denies direct client INSERT on `vibes`; the
  `submit_venue_vibe` RPC (`SECURITY DEFINER`, `SET search_path = public`) takes `user_id`
  from `auth.uid()` — callers cannot forge another user. Rate limits cannot be bypassed
  client-side.
- ✅ `delete_user()` RPC satisfies App Store guideline 5.1.1(v); `REVOKE ALL ... FROM PUBLIC`
  + `GRANT EXECUTE ... TO authenticated`.
- ✅ RLS is explicit and idempotent across vibes, user_profiles, vibe_reports, user_blocks.
- ✅ `vibe_reports` has no SELECT policy — users cannot enumerate reports (anti-gaming).
- ✅ `logger.sanitizeError` strips `password`/`email`/`token`/`secret` before Sentry.
- ✅ `.env` and `.env.local` are git-ignored; `eas.json` is git-ignored too.

**Watch items:**

- ⚠️ The local `.env` contains a `SUPABASE_SERVICE_KEY` and `GOOGLE_PLACES_API_KEY`. The
  service key is **not** bundled into the app (`app.config.js extra` only exposes URL + anon
  key + Sentry DSN), so it does not ship to clients — good. But it lives in a plaintext file
  on disk and is used by Node `scripts/`. Treat it as a secret; never move it into `extra`.
- ⚠️ `darknite-sim/.env` also holds Supabase keys (it is a load-test harness that hits the
  **real** backend). `darknite-sim/.env.example` is the only currently-untracked file
  (`git status` shows it as `??`).
- ⚠️ Admin bypass UUID is **hardcoded** in `submit_venue_vibe`. Fine for one founder; if the
  team grows, move to an `is_admin` flag or a config table.
- ⚠️ `delete_user()` must be **owned by `postgres`** to delete from `auth.users`. If the
  migration was run as a non-superuser, deletion silently fails on step 8. Verify ownership
  with the verification query at the bottom of the migration.

---

## 9. Build, Release & Ops

- **Run locally:** `npm start` / `npm run ios` / `npm run android`. Node 18+, Expo CLI.
- **Env:** `.env` must contain `SUPABASE_URL`, `SUPABASE_ANON_KEY` (required), plus optional
  `SENTRY_DSN`, `EAS_PROJECT_ID`, `GOOGLE_PLACES_API_KEY`, `SUPABASE_SERVICE_KEY`. Flows
  through `app.config.js` → `Constants.expoConfig.extra`. `.env.local` holds
  `SENTRY_AUTH_TOKEN`.
- **EAS profiles:** `development` (simulator dev client), `preview` (internal, channel
  `preview`), `production` (store, channel `production`, `autoIncrement: true`,
  `SENTRY_DISABLE_AUTO_UPLOAD=true`). Submit config targets Apple ID
  `danielcamachorosa@gmail.com`, team `SNG6RL58QT`.
- **Sentry:** `tracesSampleRate 0.1`, session replay disabled (App Store privacy),
  `enableInExpoDevelopment: false`. Auto source-map upload disabled in production builds.
- **⚠️ `pg_cron` is not scheduled.** `add_vibe_active_column_and_scheduled_job.sql` and
  `migrate-moves-table.sql` define `expire_stale_vibes()` / `expire_old_moves()` but the
  `cron.schedule(...)` calls are **commented out**. Unless someone enabled `pg_cron` and ran
  the schedule by hand, **stale `vibe_active` flags and expired moves are never cleaned up**
  server-side. The app mostly compensates with time-window filters in queries
  (`expires_at > now()`, `created_at` cutoffs), so this is a data-hygiene issue more than a
  correctness one — but `venues.vibe_active` will go stale.
- **The one uncommitted code change:** `git diff` shows a trailing-whitespace-only edit
  (`BEGIN ` → `BEGIN`) in `add_vibe_active_column_and_scheduled_job.sql`. Cosmetic.

### Testing assets

- **`maestro/`** — 3 Maestro YAML flows (`smoke.yaml`, `open_darknite.yaml`,
  `02_open_first_venue.yaml`). Basic launch / open-venue smoke tests.
- **`darknite-sim/`** — a genuinely impressive standalone TypeScript load-test harness
  (its own `package.json`, `node_modules`, `dist`). Simulates 30–50 concurrent users with
  chaos injection, and detects duplicate inserts, RLS failures, race conditions, slow
  queries. Last 3 reports in `darknite-sim/reports/` all **PASS** (latest: 15 users, 525
  actions, 92.95% success, 0 duplicates, 0 RLS failures, p99 ~1 s on refresh).
- There are **no unit tests** for the app itself (no Jest, no test runner in `package.json`).
  `scripts/validate-ranking-engine.js` is a manual validation script, not an automated test.

---

## 10. Compliance Status (App Store)

The git history (`df0efbb`, `40505c2`) shows a pre-launch compliance push. Current state:

- ✅ **Account deletion** — `delete_user()` RPC + `Settings → Delete Account`.
- ✅ **UGC moderation** — Report Vibe + Block User are **fully wired** in
  `VenueDetailsLovable.js` (`vibe_reports` / `user_blocks` inserts; optimistic hide). Note:
  `MEMORY.md` claims this is "UI stub only" — **that is now out of date; it is implemented.**
  The remaining weakness is that block filtering doesn't reach the feeds (§7.3).
- ✅ **Terms / Privacy acceptance** — `AuthModal` has a required Terms checkbox for email
  signup AND a legal disclosure for the Apple Sign-In path. `MEMORY.md` says this is missing
  — **also out of date; it is implemented.** `LegalModal`, `PrivacyPolicyScreen`,
  `TermsOfServiceScreen` exist.
- ✅ `ITSAppUsesNonExemptEncryption: false`, location usage strings present.
- ⚠️ Privacy Policy must be hosted at a public URL for App Store Connect (in-app screen
  exists; confirm the hosted URL — `TESTFLIGHT_SETUP.md` checklist flags it).

> **Important for the next Claude:** `MEMORY.md` in the Claude memory store has several
> "Still Outstanding" items (terms checkbox, report/block wiring, `__DEV__` guard) that have
> **since been completed** in the code. Trust the code, not that memory. The memory should be
> updated.

---

## 11. What Actually Works Well

Credit where due — this is a competent MVP:

- Clean service layer with consistent error handling, retries, tagged logging.
- Server-authoritative vibe submission with real, un-bypassable rate limiting.
- Thoughtful RLS, written idempotently and well-commented.
- Defensive coding throughout (`attachProfileVerified` never returns non-boolean; venue
  fallbacks; abort controllers on refresh; race-condition `useRef` guards in `AppContext`).
- The location "hard gate" in `AppContext` (don't touch Supabase until the Location API
  settles) is a real fix for an iOS cold-start race — well reasoned and documented in-code.
- Notification scheduler is careful: module-level lock against concurrent scheduling, a
  settings "signature" to skip needless reschedules, nuclear cancel to kill orphan dupes.
  (This was hardened across commits `fd44b9d` / `720df5f` to kill notification spam.)
- The `darknite-sim` harness is production-grade QA tooling most MVPs never build.

---

## 12. Recommended Next Steps (priority order)

1. **Resolve the ranking situation (§6).** Pick `computeFeedScore` as canonical, wire
   `HomeScreen`'s sort to `feedScore`, delete `feedRanker.js` / `scoreHelpers.js` and the
   dead proximity code; or formally retire `computeFeedScore`. Update
   `RANKING_ENGINE_V2_DEPLOYMENT.md` to match reality.
2. **Fix or remove the points system (§7.2).** Either add a DB trigger / RPC that writes
   `user_points`, or rip out `user_points` reads and rely on `getUserStats`. Pick one number
   for a vibe (3 or 5) and make code + docs agree.
3. **Apply block filtering to the feeds (§7.3).** Lift `blockedUserIds` into `AppContext`
   and filter blocked users out of `latestVibesByVenueId` / feed enrichment globally.
4. **Verify backend invariants in the live Supabase project:** (a) `vibes` is in the
   `supabase_realtime` publication; (b) `delete_user()` is owned by `postgres`; (c) which
   `moves` schema actually ran; (d) whether `pg_cron` jobs are scheduled.
5. **Delete `app.json`** (keep only `app.config.js`); reconcile `buildNumber`/`versionCode`.
6. **Refresh the docs:** rewrite `database-schema.md` from the live schema; update
   `MEMORY.md`; fix `PROJECT_CONTEXT_MAP.md`'s RLS table.
7. **Clean up dead code:** `src/` (unused TS), the orphan `components/SetMoveScreen.js`,
   loose `supabase/migrate-*.sql` files (fold into numbered migrations or document order).
8. **Add a real test setup** (Jest) — at minimum cover `feedHelpers`, rate-limit error
   decoding in `createVibe`, and `notificationScheduler`.

---

## 13. Quick Reference for a New Claude Session

- **Entry point:** `index.js` → `App.js`. Active Expo config: **`app.config.js`** (ignore
  `app.json`).
- **To understand data flow:** `AppContext.js` is the hub. Venues load after location
  resolves; vibes/check-ins/moves batch-load after venues; realtime + 2-min poll keep them fresh.
- **To change vibe submission:** `services/vibeService.js → createVibe` (client) +
  `supabase/migrations/add_submit_venue_vibe_rpc.sql` (server). Both must change together.
- **To change the feed order:** `components/HomeScreen.js` (currently uses
  `rankVenue`) — but read §6 first.
- **To change ranking math:** `utils/feedHelpers.js` (`computeFeedScore`, `computeStatusLine`,
  `computeChips`, `mergeRecentVibes`).
- **Migrations are manual.** Editing a file in `supabase/migrations/` does nothing until
  someone pastes it into the Supabase SQL Editor. Always confirm live schema.
- **Don't trust `database-schema.md` or `MEMORY.md` blindly** — both have stale sections,
  flagged in §7 and §10. The code is the source of truth.
- **App is iOS-first**, version 1.0.2, on a `ui-lovable-v2` branch (UI redesign line:
  `ui-lovable-v1` → `ui-lovable-v2`).
