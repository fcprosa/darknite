import { SimConfig, SimulationReport, EventLog } from '../types';
import { logger } from './logger';
import { detectDuplicates } from '../detection/duplicates';
import { detectRLSFailures } from '../detection/rls';
import { detectRaceConditions } from '../detection/racecondition';
import { computeLatencyReport } from '../detection/latency';

/**
 * Aggregate all detection results into a single simulation report.
 */
export async function aggregateReport(
  config: SimConfig,
  startTime: string,
  endTime: string,
  durationMs: number,
  idempotencyReport: import('../types').IdempotencyReport,
): Promise<SimulationReport> {
  const events = logger.getEvents();

  // Run detectors
  const duplicateReport = await detectDuplicates(config, startTime);
  const rlsReport = detectRLSFailures();
  const raceReport = detectRaceConditions(duplicateReport);
  const latencyReport = computeLatencyReport(config.slowQueryThresholdMs);

  // Summary stats
  const totalActions = events.length;
  const chaosDrops = events.filter((e) => e.status === 'CHAOS_DROP').length;
  const chaosSlows = events.filter((e) => e.chaosInjected === 'SLOW').length;
  const chaosRetries = events.filter((e) => e.chaosInjected === 'RETRY').length;

  // Error rate: exclude chaos-expected errors and chaos drops from error count
  const nonChaosEvents = events.filter(
    (e) =>
      e.status !== 'CHAOS_DROP' &&
      e.status !== 'CHAOS_EXPECTED_ERROR' &&
      e.status !== 'FEATURE_NOT_IMPLEMENTED'
  );
  const errorEvents = nonChaosEvents.filter(
    (e) =>
      e.status === 'ERROR' ||
      e.status === 'RLS_BLOCKED_UNEXPECTED'
  );
  const errorRate = nonChaosEvents.length > 0
    ? errorEvents.length / nonChaosEvents.length
    : 0;
  const successRate = 1 - errorRate;

  // Verdict
  const failureReasons: string[] = [];

  if (rlsReport.unexpected > 0) {
    failureReasons.push(`${rlsReport.unexpected} unexpected RLS blocks on legitimate users`);
  }
  if (duplicateReport.confirmed > 0) {
    failureReasons.push(`${duplicateReport.confirmed} confirmed duplicate inserts`);
  }
  if (raceReport.confirmed > 0) {
    failureReasons.push(`${raceReport.confirmed} race conditions produced duplicates`);
  }
  if (idempotencyReport.failed > 0) {
    failureReasons.push(`${idempotencyReport.failed} idempotency test failures`);
  }

  // Check p99 latency across all action types
  const actionTypes = Object.keys(latencyReport.byAction) as Array<keyof typeof latencyReport.byAction>;
  for (const action of actionTypes) {
    const stats = latencyReport.byAction[action];
    if (stats.p99 > config.slowQueryThresholdMs * 2) {
      failureReasons.push(`${action} p99 latency ${stats.p99}ms exceeds ${config.slowQueryThresholdMs * 2}ms threshold`);
    }
  }

  if (errorRate > 0.15) {
    failureReasons.push(`Error rate ${(errorRate * 100).toFixed(1)}% exceeds 15% threshold`);
  }

  const verdict = failureReasons.length > 0 ? 'FAIL' : 'PASS';

  return {
    meta: {
      startTime,
      endTime,
      durationMs,
      userCount: config.userCount,
      concurrencyLimit: config.concurrencyLimit,
      chaosEnabled: config.chaosEnabled,
    },
    summary: {
      totalActions,
      successRate: Math.round(successRate * 10000) / 10000,
      errorRate: Math.round(errorRate * 10000) / 10000,
      chaosDrops,
      chaosSlows,
      chaosRetries,
    },
    latency: latencyReport,
    duplicates: duplicateReport,
    rls: rlsReport,
    race: raceReport,
    idempotency: idempotencyReport,
    verdict,
    failureReasons,
  };
}
