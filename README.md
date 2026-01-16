# DarkNite

DarkNite is a React Native app for discovering nightlife venues and sharing real-time vibes.

## Setup

### Prerequisites

- Node.js 18+ and npm
- Expo CLI (`npm install -g expo-cli`)
- Supabase account and project

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   
   Create a `.env` file in the root directory:
   ```bash
   cp .env.example .env  # If you have an example file
   ```
   
   Add your Supabase credentials to `.env`:
   ```env
   # Required: Supabase Configuration
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   
   # Optional: Error Tracking (for production)
   # SENTRY_DSN=your-sentry-dsn
   ```

   **Important Notes:**
   - The `.env` file is already in `.gitignore` - never commit it to version control
   - `SUPABASE_URL` and `SUPABASE_ANON_KEY` are required for the app to function
   - Get these values from your Supabase project settings (Project Settings > API)
   - The anon key is safe to use client-side (it's public by design)

3. Set up the database:
   
   Run migrations in Supabase SQL Editor (in order):
   - `supabase/migrations/20260113000001_enable_rls_venues_vibes.sql`
   - `supabase/migrations/20260113000002_anti_spam_vibes.sql`
   - `supabase/migrations/20260113000003_add_venue_address.sql`
   - `supabase/migrations/20260113000004_rate_limit_vibes_60min.sql`
   - `supabase/migrations/20260113000005_add_performance_indexes.sql`

4. Run the app:
   ```bash
   npm start
   ```

## Environment Configuration

### Development

The app uses `dotenv` to load environment variables from `.env` file. Variables are injected into the Expo config via `app.config.js`.

### Production

For production builds, ensure environment variables are set:
- **Expo/EAS Build:** Set variables in `eas.json` or EAS dashboard
- **Standalone builds:** Use environment-specific `.env` files or CI/CD secrets

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Your Supabase project URL | `https://xyz.supabase.co` |
| `SUPABASE_ANON_KEY` | Your Supabase anonymous key | `eyJhbGc...` |

### Optional Environment Variables

| Variable | Description | When Needed |
|----------|-------------|-------------|
| `SENTRY_DSN` | Sentry DSN for error tracking | Production monitoring |
| `NODE_ENV` | Environment mode | Production builds (auto-set) |

## Database

### Schema

The app uses two main tables:
- **`venues`**: Nightlife venues (clubs, bars)
- **`vibes`**: User-submitted vibe data for venues

### Migrations

All database migrations are in `supabase/migrations/` and should be run in order:
1. Enable RLS and create policies
2. Anti-spam triggers (15-min rate limit - deprecated)
3. Add venue address fields
4. 60-minute rate limit trigger
5. Performance indexes

### Performance Indexes

The following indexes optimize query performance:
- `idx_vibes_venue_id_created_at_desc`: Latest vibe per venue
- `idx_vibes_user_id_created_at_desc`: User vibe history
- `idx_vibes_created_at_desc`: Recent vibes ("Hot Now")
- `idx_vibes_venue_user_created_at`: Rate limit checks
- `idx_venues_venue_type`: Venue type filtering
- `idx_venues_neighborhood`: Neighborhood filtering

### Venues

Venues require `address` for accurate Maps linking. Recommended format: "Street, New York, NY ZIP, USA".

The `address` field is used for Maps deep-links. If `address` is not provided, the app falls back to using the venue name and neighborhood.

## Security

- Row Level Security (RLS) is enabled on all tables
- Users can only insert vibes with their own `user_id`
- Rate limiting prevents spam (60 minutes per venue per user)
- Input validation occurs before database insertion
- Sensitive data (emails, passwords) is not logged

## Error Monitoring

The app includes a production-ready logger that:
- Logs to console in development
- Can integrate with error tracking services (Sentry, LogRocket)
- Sanitizes sensitive data from error logs
- Always logs errors (even in production)

To enable error tracking, add your Sentry DSN to environment variables and uncomment the integration in `utils/logger.js`.
