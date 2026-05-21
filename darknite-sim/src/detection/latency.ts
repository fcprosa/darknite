import { ActionType, LatencyReport, PercentileStats, EventLog } from '../types';
import { logger } from '../reporting/logger';

const ACTION_TYPES: ActionType[] = [
  'FETCH_FEED',
  'OPEN_VENUE',
  'POST_UPDATE',
  'REFRESH_FEED',
  'LIKE_REPORT',
];

function computePercentiles(values: number[]): PercentileStats {
  if (values.length === 0) {
    return { p50: 0, p75: 0, p90: 0, p95: 0, p99: 0, max: 0, count: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const len = sorted.length;

  return {
    p50: sorted[Math.floor(len * 0.5)] ?? 0,
    p75: sorted[Math.floor(len * 0.75)] ?? 0,
    p90: sorted[Math.floor(len * 0.9)] ?? 0,
    p95: sorted[Math.floor(len * 0.95)] ?? 0,
    p99: sorted[Math.floor(len * 0.99)] ?? 0,
    max: sorted[len - 1] ?? 0,
    count: len,
  };
}

/**
 * Latency detector.
 * Computes percentiles per action type and flags slow queries.
 */
export function computeLatencyReport(slowThresholdMs: number): LatencyReport {
  const events = logger.getEvents();

  const byAction: Record<ActionType, PercentileStats> = {} as Record<ActionType, PercentileStats>;
  let slowQueries = 0;

  for (const actionType of ACTION_TYPES) {
    const actionEvents = events.filter(
      (e) =>
        e.action === actionType &&
        e.status !== 'CHAOS_DROP' &&
        e.duration_ms > 0
    );

    const durations = actionEvents.map((e) => e.duration_ms);
    byAction[actionType] = computePercentiles(durations);

    // Count slow queries
    slowQueries += durations.filter((d) => d > slowThresholdMs).length;
  }

  return { byAction, slowQueries };
}
