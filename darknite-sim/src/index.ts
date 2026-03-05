import { loadConfig } from './config';
import { SimConfig, IdempotencyReport, IdempotencyCase, Venue } from './types';
import { checkConnectivity } from './supabase';
import { Semaphore } from './semaphore';
import { generateUserPool, createAndAuthenticateSessions } from './users/pool';
import { UserSession } from './users/session';
import { runBrowser } from './scenarios/browser';
import { runPoster } from './scenarios/poster';
import { runRefresher } from './scenarios/refresher';
import { runChaos } from './scenarios/chaos';
import { postUpdate } from './actions/postUpdate';
import { fetchFeed } from './actions/fetchFeed';
import { aggregateReport } from './reporting/aggregator';
import { generateReports } from './reporting/reporter';
import { logger } from './reporting/logger';

async function main(): Promise<void> {
  console.log('=== DarkNite Multi-User Simulation Harness ===\n');

  // 1. Load and validate config
  let config: SimConfig;
  try {
    config = loadConfig();
    console.log(`[Config] Loaded: ${config.userCount} users, ${config.durationMs}ms duration, concurrency ${config.concurrencyLimit}`);
    console.log(`[Config] Chaos: ${config.chaosEnabled ? 'ENABLED' : 'DISABLED'} (drop=${config.chaosDropRate}, slow=${config.chaosSlowRate}, retry=${config.chaosRetryRate})`);
  } catch (err) {
    console.error('[FATAL]', err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // 2. Connectivity check
  try {
    await checkConnectivity(config);
    console.log('[Connectivity] Supabase reachable\n');
  } catch (err) {
    console.error('[FATAL]', err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // 3. Generate user pool
  const users = generateUserPool(config);
  const roleCounts = users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log(`[Pool] Generated ${users.length} users:`, roleCounts);

  // 4. Authenticate all users (sequential)
  console.log('[Auth] Authenticating users...');
  let sessions: UserSession[];
  try {
    sessions = await createAndAuthenticateSessions(users, config, (done, total) => {
      if (done % 10 === 0 || done === total) {
        console.log(`[Auth] ${done}/${total} authenticated`);
      }
    });
    console.log(`[Auth] ${sessions.length}/${users.length} sessions active\n`);
  } catch (err) {
    console.error('[FATAL]', err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // 5. Create semaphore
  const semaphore = new Semaphore(config.concurrencyLimit);

  // 6. Group sessions by role
  const browserSessions = sessions.filter((s) => s.user.role === 'browser');
  const posterSessions = sessions.filter((s) => s.user.role === 'poster');
  const refresherSessions = sessions.filter((s) => s.user.role === 'refresher');
  const chaosSessions = sessions.filter((s) => s.user.role === 'chaos');

  console.log(`[Sim] Starting simulation for ${config.durationMs / 1000}s...`);
  console.log(`[Sim] Browsers: ${browserSessions.length}, Posters: ${posterSessions.length}, Refreshers: ${refresherSessions.length}, Chaos: ${chaosSessions.length}`);

  const startTime = new Date().toISOString();
  const endTime = Date.now() + config.durationMs;

  // 7. Launch all scenarios concurrently
  const scenarioPromises: Promise<void>[] = [];

  for (const session of browserSessions) {
    scenarioPromises.push(runBrowser(session, config, semaphore, endTime));
  }
  for (const session of posterSessions) {
    scenarioPromises.push(runPoster(session, config, semaphore, endTime));
  }
  // Refreshers share the refresher session pool for burst mode
  for (const session of refresherSessions) {
    scenarioPromises.push(
      runRefresher(session, config, semaphore, endTime, refresherSessions)
    );
  }
  for (const session of chaosSessions) {
    scenarioPromises.push(runChaos(session, config, semaphore, endTime));
  }

  // Wait for all scenarios to finish
  const results = await Promise.allSettled(scenarioPromises);

  const failedScenarios = results.filter((r) => r.status === 'rejected');
  if (failedScenarios.length > 0) {
    console.error(`[Sim] ${failedScenarios.length} scenarios failed unexpectedly`);
  }

  const simEndTime = new Date().toISOString();
  const actualDuration = new Date(simEndTime).getTime() - new Date(startTime).getTime();
  console.log(`\n[Sim] Simulation complete. Duration: ${(actualDuration / 1000).toFixed(1)}s, Events: ${logger.count}`);

  // 8. Idempotency testing
  let idempotencyReport: IdempotencyReport = { passed: 0, failed: 0, cases: [] };

  if (config.idempotencyTestEnabled && posterSessions.length > 0) {
    console.log('\n[Idempotency] Running idempotency tests...');
    idempotencyReport = await runIdempotencyTests(posterSessions, config, semaphore);
    console.log(`[Idempotency] Passed: ${idempotencyReport.passed}, Failed: ${idempotencyReport.failed}`);
  }

  // 9. Generate reports
  console.log('\n[Report] Running detection modules...');
  const report = await aggregateReport(config, startTime, simEndTime, actualDuration, idempotencyReport);

  console.log('[Report] Generating output files...');
  const { jsonPath, mdPath, eventsPath } = generateReports(report, config.reportOutputDir);

  console.log(`[Report] JSON: ${jsonPath}`);
  console.log(`[Report] Markdown: ${mdPath}`);
  console.log(`[Report] Events: ${eventsPath}`);

  // 10. Print verdict
  console.log('\n' + '='.repeat(50));
  if (report.verdict === 'PASS') {
    console.log('  VERDICT: PASS');
  } else {
    console.log('  VERDICT: FAIL');
    console.log('  Reasons:');
    for (const reason of report.failureReasons) {
      console.log(`    - ${reason}`);
    }
  }
  console.log('='.repeat(50));

  // 11. Cleanup: sign out all users
  console.log('\n[Cleanup] Signing out users...');
  await Promise.allSettled(sessions.map((s) => s.signOut()));

  // 12. Exit with appropriate code
  process.exit(report.verdict === 'PASS' ? 0 : 1);
}

/**
 * Idempotency test suite.
 * Pick 5 random poster users, submit same payload twice with 50ms gap.
 */
async function runIdempotencyTests(
  posterSessions: UserSession[],
  config: SimConfig,
  semaphore: Semaphore,
): Promise<IdempotencyReport> {
  const cases: IdempotencyCase[] = [];
  const testUsers = posterSessions.slice(0, Math.min(5, posterSessions.length));

  // Fetch venues to use for tests
  let venues: Venue[] = [];
  if (testUsers.length > 0) {
    venues = await fetchFeed(testUsers[0], config);
  }
  if (venues.length === 0) {
    console.log('[Idempotency] No venues available for testing');
    return { passed: 0, failed: 0, cases: [] };
  }

  for (const session of testUsers) {
    const venue = venues[Math.floor(Math.random() * venues.length)];

    try {
      // First insert
      const firstId = await semaphore.wrap(() =>
        postUpdate(session, config, venue)
      );

      // 50ms delay
      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      // Second insert (identical content — same venue, different timestamp but within window)
      const secondId = await semaphore.wrap(() =>
        postUpdate(session, config, venue)
      );

      const isDuplicate = firstId !== null && secondId !== null;

      cases.push({
        userId: session.user.id,
        venueId: venue.id,
        firstInsertId: firstId,
        secondInsertId: secondId,
        result: isDuplicate ? 'DUPLICATE_CREATED' : 'REJECTED',
      });

      if (isDuplicate) {
        logger.logAction({
          userId: session.user.id,
          action: 'POST_UPDATE',
          venueId: venue.id,
          durationMs: 0,
          status: 'IDEMPOTENCY_FAILURE',
          payload: { firstId, secondId },
        });
      }
    } catch (err) {
      console.error(`[Idempotency] Test error for ${session.user.id}:`, err instanceof Error ? err.message : err);
    }
  }

  const passed = cases.filter((c) => c.result === 'REJECTED').length;
  const failed = cases.filter((c) => c.result === 'DUPLICATE_CREATED').length;

  return { passed, failed, cases };
}

// Run
main().catch((err) => {
  console.error('[FATAL] Unhandled error:', err);
  process.exit(1);
});
