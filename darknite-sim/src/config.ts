import { config as dotenvConfig } from 'dotenv';
import { SimConfig } from './types';

dotenvConfig();

const REQUIRED_VARS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val || val.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val.trim();
}

function envInt(name: string, fallback: number): number {
  const val = process.env[name];
  if (!val) return fallback;
  const parsed = parseInt(val, 10);
  if (Number.isNaN(parsed)) return fallback;
  return parsed;
}

function envFloat(name: string, fallback: number): number {
  const val = process.env[name];
  if (!val) return fallback;
  const parsed = parseFloat(val);
  if (Number.isNaN(parsed)) return fallback;
  return parsed;
}

function envBool(name: string, fallback: boolean): boolean {
  const val = process.env[name];
  if (!val) return fallback;
  return val.toLowerCase() === 'true' || val === '1';
}

export function loadConfig(): SimConfig {
  // Validate all required vars upfront
  const missing = REQUIRED_VARS.filter(
    (v) => !process.env[v] || process.env[v]?.trim() === ''
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map((v) => `  - ${v}`).join('\n')}\n\nCopy .env.example to .env and fill in values.`
    );
  }

  return {
    supabaseUrl: requireEnv('SUPABASE_URL'),
    supabaseAnonKey: requireEnv('SUPABASE_ANON_KEY'),
    supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    userCount: envInt('SIM_USER_COUNT', 40),
    durationMs: envInt('SIM_DURATION_MS', 120000),
    concurrencyLimit: envInt('SIM_CONCURRENCY_LIMIT', 15),
    chaosEnabled: envBool('SIM_CHAOS_ENABLED', true),
    chaosDropRate: envFloat('SIM_CHAOS_DROP_RATE', 0.05),
    chaosSlowRate: envFloat('SIM_CHAOS_SLOW_RATE', 0.10),
    chaosSlowMinMs: envInt('SIM_CHAOS_SLOW_MIN_MS', 800),
    chaosSlowMaxMs: envInt('SIM_CHAOS_SLOW_MAX_MS', 3000),
    chaosRetryRate: envFloat('SIM_CHAOS_RETRY_RATE', 0.08),
    burstRefreshEnabled: envBool('SIM_BURST_REFRESH_ENABLED', true),
    burstRefreshIntervalMs: envInt('SIM_BURST_REFRESH_INTERVAL_MS', 5000),
    burstRefreshUserCount: envInt('SIM_BURST_REFRESH_USER_COUNT', 10),
    slowQueryThresholdMs: envInt('SIM_SLOW_QUERY_THRESHOLD_MS', 1500),
    idempotencyTestEnabled: envBool('SIM_IDEMPOTENCY_TEST_ENABLED', true),
    duplicateWindowMs: envInt('SIM_DUPLICATE_WINDOW_MS', 500),
    reportOutputDir: process.env['SIM_REPORT_OUTPUT_DIR'] || './reports',
  };
}
