import { EventLog, RLSReport } from '../types';
import { logger } from '../reporting/logger';

/**
 * RLS failure detector.
 * Classifies 401/403 and PGRST3/42501 errors.
 *
 * - RLS_BLOCKED_EXPECTED: chaos agent or malformed request
 * - RLS_BLOCKED_UNEXPECTED: legitimate user blocked on valid operation (hard failure)
 */
export function detectRLSFailures(): RLSReport {
  const events = logger.getEvents();

  const rlsEvents = events.filter(
    (e) =>
      e.status === 'RLS_BLOCKED_EXPECTED' ||
      e.status === 'RLS_BLOCKED_UNEXPECTED' ||
      e.errorCode === '401' ||
      e.errorCode === '403' ||
      e.errorCode === 'PGRST3' ||
      e.errorCode === '42501'
  );

  const expected = rlsEvents.filter(
    (e) => e.status === 'RLS_BLOCKED_EXPECTED'
  );
  const unexpected = rlsEvents.filter(
    (e) => e.status === 'RLS_BLOCKED_UNEXPECTED'
  );

  return {
    expected: expected.length,
    unexpected: unexpected.length,
    records: rlsEvents,
  };
}
