import { EventLog, RaceReport, RaceWindow, DuplicateReport } from '../types';
import { logger } from '../reporting/logger';

const RACE_WINDOW_MS = 100;

/**
 * Race condition detector.
 * Finds postUpdate calls to the same venue_id within 100ms windows.
 * Cross-references with duplicate report to confirm race-produced duplicates.
 */
export function detectRaceConditions(duplicateReport: DuplicateReport): RaceReport {
  const events = logger.getEvents();

  // Get all POST_UPDATE events with timestamps
  const postEvents = events.filter(
    (e) => e.action === 'POST_UPDATE' && e.venueId && e.status !== 'CHAOS_DROP'
  );

  // Group by venue ID
  const byVenue = new Map<string, EventLog[]>();
  for (const evt of postEvents) {
    if (!evt.venueId) continue;
    const existing = byVenue.get(evt.venueId) ?? [];
    existing.push(evt);
    byVenue.set(evt.venueId, existing);
  }

  const raceWindows: RaceWindow[] = [];

  // For each venue, find overlapping windows
  for (const [venueId, venueEvents] of byVenue) {
    if (venueEvents.length < 2) continue;

    // Sort by timestamp
    const sorted = [...venueEvents].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Sliding window: group events within RACE_WINDOW_MS
    let windowStart = 0;
    while (windowStart < sorted.length) {
      const windowStartTime = new Date(sorted[windowStart].timestamp).getTime();
      const inWindow: EventLog[] = [sorted[windowStart]];

      let windowEnd = windowStart + 1;
      while (windowEnd < sorted.length) {
        const endTime = new Date(sorted[windowEnd].timestamp).getTime();
        if (endTime - windowStartTime <= RACE_WINDOW_MS) {
          inWindow.push(sorted[windowEnd]);
          windowEnd++;
        } else {
          break;
        }
      }

      if (inWindow.length >= 2) {
        const userIds = [...new Set(inWindow.map((e) => e.userId))];
        const timestamps = inWindow.map((e) => e.timestamp);
        const windowMs =
          new Date(timestamps[timestamps.length - 1]).getTime() -
          new Date(timestamps[0]).getTime();

        raceWindows.push({
          venueId,
          userIds,
          timestamps,
          windowMs,
          producedDuplicate: false, // Will be cross-referenced below
        });
      }

      windowStart = windowEnd > windowStart ? windowEnd : windowStart + 1;
    }
  }

  // Cross-reference with duplicates
  let confirmed = 0;
  for (const rw of raceWindows) {
    const hasDuplicate = duplicateReport.records.some(
      (d) => d.venueId === rw.venueId
    );
    if (hasDuplicate) {
      rw.producedDuplicate = true;
      confirmed++;
    }
  }

  return {
    windows: raceWindows.length,
    confirmed,
    records: raceWindows,
  };
}
