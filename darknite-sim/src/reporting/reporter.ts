import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { SimulationReport, ActionType, PercentileStats } from '../types';
import { logger } from './logger';

/**
 * Generate final report files: JSON and Markdown.
 */
export function generateReports(
  report: SimulationReport,
  outputDir: string,
): { jsonPath: string; mdPath: string; eventsPath: string } {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');

  // 1. Machine-readable JSON
  const jsonPath = join(outputDir, `report-${ts}.json`);
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');

  // 2. Human-readable Markdown
  const mdPath = join(outputDir, `report-${ts}.md`);
  writeFileSync(mdPath, generateMarkdown(report), 'utf-8');

  // 3. Event log NDJSON
  const eventsPath = logger.flush(outputDir);

  return { jsonPath, mdPath, eventsPath };
}

function generateMarkdown(r: SimulationReport): string {
  const verdict = r.verdict === 'PASS' ? '**PASS**' : '**FAIL**';
  const verdictEmoji = r.verdict === 'PASS' ? 'GREEN' : 'RED';

  const lines: string[] = [];

  lines.push(`# DarkNite Simulation Report`);
  lines.push('');
  lines.push(`## Verdict: ${verdict}`);
  lines.push('');

  if (r.failureReasons.length > 0) {
    lines.push('### Failure Reasons');
    for (const reason of r.failureReasons) {
      lines.push(`- ${reason}`);
    }
    lines.push('');
  }

  // Metadata
  lines.push('## Simulation Metadata');
  lines.push('');
  lines.push('| Parameter | Value |');
  lines.push('|-----------|-------|');
  lines.push(`| Start Time | ${r.meta.startTime} |`);
  lines.push(`| End Time | ${r.meta.endTime} |`);
  lines.push(`| Duration | ${(r.meta.durationMs / 1000).toFixed(1)}s |`);
  lines.push(`| User Count | ${r.meta.userCount} |`);
  lines.push(`| Concurrency Limit | ${r.meta.concurrencyLimit} |`);
  lines.push(`| Chaos Enabled | ${r.meta.chaosEnabled} |`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total Actions | ${r.summary.totalActions} |`);
  lines.push(`| Success Rate | ${(r.summary.successRate * 100).toFixed(2)}% |`);
  lines.push(`| Error Rate | ${(r.summary.errorRate * 100).toFixed(2)}% |`);
  lines.push(`| Chaos Drops | ${r.summary.chaosDrops} |`);
  lines.push(`| Chaos Slows | ${r.summary.chaosSlows} |`);
  lines.push(`| Chaos Retries | ${r.summary.chaosRetries} |`);
  lines.push('');

  // Latency
  lines.push('## Latency (ms)');
  lines.push('');
  lines.push('| Action | Count | p50 | p90 | p99 | Max |');
  lines.push('|--------|-------|-----|-----|-----|-----|');
  const actionTypes: ActionType[] = ['FETCH_FEED', 'OPEN_VENUE', 'POST_UPDATE', 'REFRESH_FEED', 'LIKE_REPORT'];
  for (const action of actionTypes) {
    const s = r.latency.byAction[action];
    if (s && s.count > 0) {
      lines.push(`| ${action} | ${s.count} | ${s.p50} | ${s.p90} | ${s.p99} | ${s.max} |`);
    }
  }
  lines.push('');
  lines.push(`Slow queries (>${r.meta.durationMs ? '' : ''}threshold): **${r.latency.slowQueries}**`);
  lines.push('');

  // Duplicates
  lines.push('## Duplicate Detection');
  lines.push('');
  lines.push(`- Confirmed duplicates: **${r.duplicates.confirmed}**`);
  lines.push(`- Collision duplicates: **${r.duplicates.collisions}**`);
  lines.push('');

  // RLS
  lines.push('## RLS Failures');
  lines.push('');
  lines.push(`- Expected blocks (chaos): **${r.rls.expected}**`);
  lines.push(`- Unexpected blocks: **${r.rls.unexpected}**`);
  lines.push('');

  // Race conditions
  lines.push('## Race Conditions');
  lines.push('');
  lines.push(`- Race windows detected: **${r.race.windows}**`);
  lines.push(`- Confirmed (produced duplicates): **${r.race.confirmed}**`);
  lines.push('');

  // Idempotency
  lines.push('## Idempotency Tests');
  lines.push('');
  lines.push(`- Passed: **${r.idempotency.passed}**`);
  lines.push(`- Failed: **${r.idempotency.failed}**`);
  if (r.idempotency.cases.length > 0) {
    lines.push('');
    lines.push('| User | Venue | First ID | Second ID | Result |');
    lines.push('|------|-------|----------|-----------|--------|');
    for (const c of r.idempotency.cases) {
      lines.push(`| ${maskId(c.userId)} | ${maskId(c.venueId)} | ${c.firstInsertId ?? 'null'} | ${c.secondInsertId ?? 'null'} | ${c.result} |`);
    }
  }
  lines.push('');

  // Top 10 slowest requests
  lines.push('## Top 10 Slowest Requests');
  lines.push('');
  const allEvents = logger.getEvents();
  const slowest = [...allEvents]
    .filter((e) => e.duration_ms > 0 && e.status !== 'CHAOS_DROP')
    .sort((a, b) => b.duration_ms - a.duration_ms)
    .slice(0, 10);

  if (slowest.length > 0) {
    lines.push('| Action | Duration (ms) | Venue | Status |');
    lines.push('|--------|---------------|-------|--------|');
    for (const e of slowest) {
      lines.push(`| ${e.action} | ${e.duration_ms} | ${e.venueId ?? '-'} | ${e.status} |`);
    }
  } else {
    lines.push('No requests recorded.');
  }
  lines.push('');

  lines.push('---');
  lines.push('*Generated by darknite-sim*');

  return lines.join('\n');
}

function maskId(id: string): string {
  if (id.length > 8) {
    return id.substring(0, 8) + '...';
  }
  return id;
}
