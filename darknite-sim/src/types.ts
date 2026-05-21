// ─── Action Types ────────────────────────────────────────────────

export type ActionType =
  | 'FETCH_FEED'
  | 'OPEN_VENUE'
  | 'POST_UPDATE'
  | 'REFRESH_FEED'
  | 'LIKE_REPORT';

// ─── User Types ─────────────────────────────────────────────────

export type UserRole = 'browser' | 'poster' | 'refresher' | 'chaos';

export interface SimUser {
  id: string;
  email: string;
  password: string;
  role: UserRole;
  sessionToken?: string;
  refreshToken?: string;
}

// ─── Event Logging ──────────────────────────────────────────────

export type EventStatus =
  | 'SUCCESS'
  | 'ERROR'
  | 'CHAOS_DROP'
  | 'CHAOS_SLOW'
  | 'RLS_BLOCKED_EXPECTED'
  | 'RLS_BLOCKED_UNEXPECTED'
  | 'POTENTIAL_DUPLICATE'
  | 'CONFIRMED_DUPLICATE'
  | 'RACE_WINDOW'
  | 'RACE_CONDITION_CONFIRMED'
  | 'SLOW_QUERY'
  | 'IDEMPOTENCY_FAILURE'
  | 'CHAOS_EXPECTED_ERROR'
  | 'FEATURE_NOT_IMPLEMENTED';

export type ChaosType = 'DROP' | 'SLOW' | 'RETRY';

export interface EventLog {
  timestamp: string;
  userId: string;
  action: ActionType;
  venueId?: string;
  duration_ms: number;
  status: EventStatus;
  httpStatus?: number;
  errorCode?: string;
  errorMessage?: string;
  payload?: Record<string, unknown>;
  chaosInjected?: ChaosType;
  chaosDelayMs?: number;
}

// ─── Venue / Vibe Types ─────────────────────────────────────────

export interface Venue {
  id: string;
  name: string;
  neighborhood: string;
  venue_type: string;
  address?: string;
  city?: string;
}

export interface VenueDetail extends Venue {
  recentVibes: Vibe[];
}

export interface Vibe {
  id: string;
  venue_id: string;
  user_id: string;
  crowd?: string;
  music?: string;
  line?: string;
  created_at: string;
}

export interface PostUpdatePayload {
  venue_id: string;
  crowd: string;
  music?: string;
  line?: string;
  user_id: string;
  created_at: string;
}

// ─── Detection Reports ──────────────────────────────────────────

export interface DuplicateRecord {
  id1: string;
  id2: string;
  userId: string;
  venueId: string;
  timeDeltaMs: number;
  type: 'CONFIRMED_DUPLICATE' | 'COLLISION_DUPLICATE';
}

export interface DuplicateReport {
  confirmed: number;
  collisions: number;
  records: DuplicateRecord[];
}

export interface RLSReport {
  expected: number;
  unexpected: number;
  records: EventLog[];
}

export interface RaceWindow {
  venueId: string;
  userIds: string[];
  timestamps: string[];
  windowMs: number;
  producedDuplicate: boolean;
}

export interface RaceReport {
  windows: number;
  confirmed: number;
  records: RaceWindow[];
}

export interface PercentileStats {
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  max: number;
  count: number;
}

export interface LatencyReport {
  byAction: Record<ActionType, PercentileStats>;
  slowQueries: number;
}

export interface IdempotencyCase {
  userId: string;
  venueId: string;
  firstInsertId: string | null;
  secondInsertId: string | null;
  result: 'REJECTED' | 'DUPLICATE_CREATED';
}

export interface IdempotencyReport {
  passed: number;
  failed: number;
  cases: IdempotencyCase[];
}

// ─── Final Report ───────────────────────────────────────────────

export interface SimulationReport {
  meta: {
    startTime: string;
    endTime: string;
    durationMs: number;
    userCount: number;
    concurrencyLimit: number;
    chaosEnabled: boolean;
  };
  summary: {
    totalActions: number;
    successRate: number;
    errorRate: number;
    chaosDrops: number;
    chaosSlows: number;
    chaosRetries: number;
  };
  latency: LatencyReport;
  duplicates: DuplicateReport;
  rls: RLSReport;
  race: RaceReport;
  idempotency: IdempotencyReport;
  verdict: 'PASS' | 'FAIL';
  failureReasons: string[];
}

// ─── Config ─────────────────────────────────────────────────────

export interface SimConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  userCount: number;
  durationMs: number;
  concurrencyLimit: number;
  chaosEnabled: boolean;
  chaosDropRate: number;
  chaosSlowRate: number;
  chaosSlowMinMs: number;
  chaosSlowMaxMs: number;
  chaosRetryRate: number;
  burstRefreshEnabled: boolean;
  burstRefreshIntervalMs: number;
  burstRefreshUserCount: number;
  slowQueryThresholdMs: number;
  idempotencyTestEnabled: boolean;
  duplicateWindowMs: number;
  reportOutputDir: string;
}
