# DarkNite - Project Context Map

> **Purpose:** Nightlife app for NYC that shows real-time venue vibes (crowd levels, line wait times, music) via user-submitted data.

---

## 1. Core Architecture

```
darknite/
├── App.js                    # Root component, providers wrapper
├── app.config.js             # Expo config (env vars, plugins)
├── contexts/                 # React Context providers
│   ├── AppContext.js         # Venues, vibes, check-ins state
│   ├── AuthContext.js        # Auth state, Apple Sign-In, requireAuth()
│   └── NetworkContext.js     # Offline detection
├── navigation/               # React Navigation 6 setup
│   ├── RootNavigator.js      # Auth routing, onboarding check
│   ├── MainTabsNavigator.js  # Bottom tabs (Home, Explore, Profile)
│   ├── AppStackNavigator.js  # Modal screens stack
│   └── HomeStackNavigator.js # Home tab nested stack
├── components/               # Screens and UI components
│   ├── HomeScreen.js         # Main feed with venue cards
│   ├── ExploreScreen.js      # Browse by neighborhood/type
│   ├── ProfileScreen.js      # User profile, stats, vibes
│   ├── VenueCardLovable.js   # Venue card component
│   ├── VenueDetailsLovable.js# Venue detail modal
│   ├── PostVibeScreen.js     # Post vibe form
│   ├── CheckInModal.js       # Quick check-in flow
│   └── AuthModal.js          # Sign in/up + Apple Sign-In
├── services/                 # Supabase data layer
│   ├── vibeService.js        # Vibe CRUD, batch queries
│   ├── venueService.js       # Venue queries
│   ├── checkInService.js     # Check-in CRUD
│   ├── profileService.js     # User profile CRUD
│   └── notificationService.js# Push notification handlers
├── utils/                    # Pure helper functions
│   ├── feedHelpers.js        # Feed scoring, status lines
│   ├── supabase.js           # Supabase client singleton
│   ├── notificationScheduler.js # Schedule local notifications
│   └── logger.js             # Tagged logging + Sentry
├── screens/                  # Additional screens
│   ├── NotificationSettingsScreen.js
│   ├── PrivacyPolicyScreen.js
│   └── TermsOfServiceScreen.js
└── constants/                # App constants
```

---

## 2. Data Schema (Supabase)

### `venues` - Nightlife venues
| Column | Type | Description |
|--------|------|-------------|
| `id` | text (PK) | Unique venue ID |
| `name` | text | Venue name |
| `venue_type` | text | `"bar"` or `"club"` |
| `address` | text | Full address |
| `neighborhood` | text | Area (e.g., "Lower East Side") |
| `city` | text | City (all "New York" currently) |
| `default_guys` | integer | Default guy % for ratio |
| `default_girls` | integer | Default girl % for ratio |

### `vibes` - User-submitted venue data
| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint (PK) | Unique vibe ID |
| `venue_id` | text (FK) | Reference to venue |
| `user_id` | uuid (FK) | User who posted |
| `crowd` | text | `"Dead"`, `"Chill"`, `"Fun"`, `"Buzzing"`, `"Packed"`, `"Chaos"` |
| `ratio` | text | Guy/girl ratio (e.g., "60/40") |
| `music` | text | Music genre playing |
| `age_range` | text | `"18–25"`, `"25–30"`, `"30–35"`, `"35+"`, `"Mixed"` |
| `cover` | text | Cover charge: `"$"`, `"$$"`, `"$$$"`, `"$$$$"` (clubs) |
| `line` | text | Line wait description (clubs) |
| `bar_type` | text | `"cocktail"`, `"sports"`, `"dive"`, `"speakeasy"`, `"wine"` (bars) |
| `drinks_price_tier` | text | `"cheap"`, `"moderate"`, `"pricey"`, `"expensive"` (bars) |
| `created_at` | timestamp | Post time |

**Venue-type differences:**
- **CLUBS:** crowd, ratio, music, cover, line, age_range
- **BARS:** crowd, ratio, music, bar_type, drinks_price_tier, age_range

### `check_ins` - Quick user check-ins
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Unique check-in ID |
| `venue_id` | text (FK) | Reference to venue |
| `user_id` | uuid (FK) | User who checked in |
| `line_wait` | text | Line status (clubs): `"No line!"`, `"Chill (5-15 min)"`, etc. |
| `crowd_level` | text | Crowd level (bars): `"Dead"`, `"Chill"`, `"Buzzing"`, `"Packed"` |
| `created_at` | timestamp | Check-in time |

### `user_profiles` - User data
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Matches auth.users.id |
| `username` | text (unique) | Username |
| `going_out_days` | text[] | Preferred days (max 3) |
| `preferred_scene` | text | `"bars"`, `"clubs"`, `"both"` |
| `favorite_neighborhoods` | text[] | Preferred areas (max 3) |
| `favorite_genres` | text[] | Preferred music genres |
| `reminders_enabled` | boolean | Notification preference |
| `notification_settings` | jsonb | Additional notification prefs |

### `user_points` - Gamification
| Column | Type | Description |
|--------|------|-------------|
| `user_id` | uuid (PK) | Reference to user |
| `total_points` | integer | Total points |
| `checkin_count` | integer | Check-ins performed |
| `vibe_count` | integer | Vibes posted |

**Point system:** Check-in = +1 pt, Post Vibe = +5 pts

---

## 3. Core Logic: `computeFeedScore()`

Located in `utils/feedHelpers.js`. Determines venue ranking in the feed.

### Formula
```
feedScore = (Wl × L × founderMultiplier) + (Wm × M) + (Wh × H) + venueBoost
```

### Weights
| Weight | Value | Component |
|--------|-------|-----------|
| `Wl` | 1.0 | Live vibe (highest priority) |
| `Wm` | 0.6 | Moves |
| `Wh` | 0.3 | Historical |

### Components

**L — Live Vibe Score (0-150)**
```javascript
L = crowdIntensity × vibeCountMultiplier × freshness
```
- `crowdIntensity`: Dead=5, Chill=20, Fun=50, Buzzing=60, Packed=85, Chaos=100
- `vibeCountMultiplier`: 3+ vibes=1.5x, 2 vibes=1.3x, 1 vibe=1.0x
- `freshness`: Exponential decay `e^(-0.025 × minutesAgo)`
  - Half-life ≈ 28 minutes
  - 5 min ago → 88%, 30 min → 47%, 60 min → 22%, 2h → 5%
- `founderMultiplier`: 1.2x if user is verified

**M — Move Score (0-50)**
```javascript
moveScore × moveFreshness
```
- Step function: 11+ moves=50, 6-10=40, 3-5=25, 1-2=10
- Linear decay: 6pm=100%, 9pm=50%, midnight=0%

**H — Historical Score (0-30)**
```javascript
nightRelevance × peakProximity
```
- `nightRelevance`: Weekend clubs=30, Weekend bars=25, Thursday clubs=20, Thursday bars=15, Weekday=5
- `peakProximity`: 1.0 at peak hour, 0.0 at ±3 hours

**Venue Boost**
- +10 if venue has BOTH live vibes AND moves (cross-confirmation)

---

## 4. Key Services: `vibeService.js`

| Function | Description |
|----------|-------------|
| `getLatestVibe(venueId, options)` | Fetch latest vibe for a venue (with retry) |
| `getRecentVibes(venueKeyOrOptions, hours)` | Get vibes for venue OR hot-now mode |
| `getHotNowVibes(hoursAgo, limit)` | Fetch vibes for "Hot Now" feed |
| `getLatestVibesBatch(venueIds)` | Batch fetch latest vibes for multiple venues |
| `getUserVibes(userId, limit)` | Fetch user's posted vibes |
| `createVibe(vibeData)` | Create new vibe (with validation) |

**Important constants:**
- `VIBE_SELECT_FIELDS` - Standard fields including `user_profiles` join for `is_verified`
- Rate limiting: 60-minute cooldown per venue per user (enforced by DB trigger)

---

## 5. Primary Components

### Main Screens
| Screen | Location | Purpose |
|--------|----------|---------|
| `HomeScreen` | components/ | Main feed with scored venue cards |
| `ExploreScreen` | components/ | Browse by neighborhood, filter by type |
| `ProfileScreen` | components/ | User profile, stats, activity |
| `VenueDetailsLovable` | components/ | Venue detail modal with vibes history |
| `PostVibeScreen` | components/ | Multi-step vibe posting form |
| `CheckInModal` | components/ | Quick 1-question check-in |

### Auth & Onboarding
| Screen | Location | Purpose |
|--------|----------|---------|
| `AuthModal` | components/ | Sign in/up with email or Apple |
| `OnboardingScreen` | components/ | 4-slide intro for new users |
| `ProfileSetupScreen` | components/ | Preferences setup (days, scene, genres) |
| `LandingScreen` | components/ | Unauthenticated landing |

### Settings & Legal
| Screen | Location | Purpose |
|--------|----------|---------|
| `SettingsScreen` | components/ | User settings, sign out |
| `NotificationSettingsScreen` | screens/ | Push notification preferences |
| `PrivacyPolicyScreen` | screens/ | Privacy policy |
| `TermsOfServiceScreen` | screens/ | Terms of service |

### Supporting Components
| Component | Purpose |
|-----------|---------|
| `VenueCardLovable` | Venue card with status line, chips |
| `EmptyState` | Reusable empty state component |
| `OfflineBanner` | Offline detection banner |
| `CityPulseBanner` | City-wide activity banner |

---

## 6. State Management

### `AppContext` (global app state)
```javascript
{
  venues: [],                    // All venues array
  latestVibesByVenueId: {},      // Map: venueId → latest vibe
  latestBarCrowdByVenueId: {},   // Map: venueId → latest bar check-in
  latestLineWaitByVenueId: {},   // Map: venueId → latest club line wait
  guestMode: boolean,            // Guest browsing mode
  refreshLatestVibes(),          // Refresh vibes batch
  refreshLatestCheckIns(),       // Refresh check-ins
  upsertLatestBarCrowd(),        // Update bar crowd optimistically
  upsertLatestLineWait(),        // Update line wait optimistically
}
```

### `AuthContext` (auth state)
```javascript
{
  session,                       // Supabase session
  user,                          // Current user
  isAuthenticated: boolean,
  isGuest: boolean,
  signUp(email, password, username),
  signIn(email, password),
  signInWithApple(),             // Apple Sign-In
  signOut(),
  requireAuth(callback),         // Auth wall helper
  showAuthModal,                 // Modal visibility
}
```

### `NetworkContext` (connectivity)
```javascript
{
  isOnline: boolean,             // Combined connected + reachable
  isConnected: boolean,
  isInternetReachable: boolean,
  checkNetworkStatus(),          // Manual refresh
}
```

---

## 7. Key Patterns

1. **Batch Loading:** `getLatestVibesBatch()` fetches vibes for all venues in one call to avoid N+1
2. **Race Condition Protection:** `useRef` flags prevent concurrent refresh calls
3. **Optimistic Updates:** `upsertLatestBarCrowd()` / `upsertLatestLineWait()` update UI immediately
4. **Auth Walls:** `requireAuth(callback)` shows modal if not authenticated, executes callback after
5. **Rate Limiting:** 60-minute cooldown per venue enforced by Supabase trigger
6. **Tagged Logging:** `logger.tag("ServiceName")` for consistent log prefixes
7. **Exponential Backoff:** Services include retry logic with increasing delays

---

## 8. Environment

- **Stack:** React Native 0.81 + Expo 54 + Supabase + React Navigation 6
- **Auth:** Email/password + Apple Sign-In
- **Notifications:** expo-notifications (local + push)
- **Error Tracking:** Sentry
- **Target:** iOS (TestFlight ready), Android secondary

---

## 9. Database Policies (RLS)

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| venues | public | admin | admin | admin |
| vibes | public | authenticated | - | owner only |
| check_ins | public | authenticated | - | owner only |
| user_profiles | public | owner only | owner only | - |
| user_points | public | owner only | owner only | - |
