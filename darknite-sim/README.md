# DarkNite Multi-User Simulation Harness

Production-grade QA harness that simulates 30-50 concurrent users against the
live DarkNite Supabase backend. Detects duplicate inserts, RLS failures, race
conditions, and slow queries.

## Prerequisites

- Node.js 18+
- Access to a DarkNite Supabase project (URL, anon key, service role key)

## Setup

```bash
cd darknite-sim
npm install
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
```

## Run

```bash
npm run sim
```

Or build and run separately:

```bash
npm run build
node dist/index.js
```

Exit code `0` = PASS, `1` = FAIL.

## Output

Reports are generated in `./reports/` (configurable via `SIM_REPORT_OUTPUT_DIR`):

| File | Format | Purpose |
|------|--------|---------|
| `report-{timestamp}.json` | JSON | Machine-readable full report |
| `report-{timestamp}.md` | Markdown | Human-readable summary |
| `events-{timestamp}.ndjson` | NDJSON | Raw event log (every action) |

## Interpreting the Report

### Verdict

- **PASS**: No critical issues detected.
- **FAIL**: One or more of these conditions triggered:
  - Unexpected RLS blocks on legitimate users
  - Confirmed duplicate inserts (same user+venue within time window)
  - Race conditions that produced duplicates
  - Idempotency test failures
  - p99 latency exceeding 2x the slow query threshold
  - Error rate exceeding 15% (excluding chaos-expected errors)

### Sections

- **Latency**: p50/p75/p90/p95/p99/max per action type
- **Duplicates**: Same-user and cross-user duplicate detection
- **RLS**: Expected (chaos) vs unexpected access blocks
- **Race Conditions**: Overlapping writes within 100ms windows
- **Idempotency**: Tests whether the DB rejects duplicate submissions

## Tuning Chaos Parameters

All chaos parameters are in `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `SIM_CHAOS_ENABLED` | `true` | Master switch for chaos injection |
| `SIM_CHAOS_DROP_RATE` | `0.05` | Probability of dropping a request |
| `SIM_CHAOS_SLOW_RATE` | `0.10` | Probability of injecting delay |
| `SIM_CHAOS_SLOW_MIN_MS` | `800` | Minimum injected delay |
| `SIM_CHAOS_SLOW_MAX_MS` | `3000` | Maximum injected delay |
| `SIM_CHAOS_RETRY_RATE` | `0.08` | Probability of duplicate execution |

Chaos agents (5% of users) run at 3x these rates.

## Adding New Action Types

1. Create a new file in `src/actions/` following the pattern of existing actions
2. Add the action type to `ActionType` in `src/types.ts`
3. Wire it into the appropriate scenario in `src/scenarios/`
4. The latency detector will automatically pick it up

## User Role Distribution

| Role | % | Behavior |
|------|---|----------|
| browser | 50% | Read-only: fetch feed, open venues |
| poster | 30% | Read + write: post vibes, like/report |
| refresher | 15% | Burst polling: rapid feed refreshes |
| chaos | 5% | Malformed requests, nonexistent venues, elevated chaos |

## Known Limitations

- All calls hit the real Supabase instance (no mocking)
- User sign-up requires email confirmation to be disabled in Supabase auth settings
- The `vibe_likes` table may not exist — the harness handles this gracefully
- Supabase rate limiting may affect results at high concurrency
- The duplicate detection window is time-based, not idempotency-key based at the DB level
- Simulation creates real data in the database — use a staging/test environment
