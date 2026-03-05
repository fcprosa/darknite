import { UserSession } from '../users/session';
import { SimConfig } from '../types';
import { Semaphore } from '../semaphore';
import { refreshFeed } from '../actions/refreshFeed';

/**
 * Refresher scenario: rapid repeated feed polling.
 * When burst mode is enabled, fires multiple simultaneous refreshes.
 */
export async function runRefresher(
  session: UserSession,
  config: SimConfig,
  semaphore: Semaphore,
  endTime: number,
  allRefresherSessions?: UserSession[],
): Promise<void> {
  const interval = config.burstRefreshIntervalMs;

  while (Date.now() < endTime) {
    try {
      if (config.burstRefreshEnabled && allRefresherSessions && allRefresherSessions.length > 0) {
        // Burst mode: fire SIM_BURST_REFRESH_USER_COUNT simultaneous refreshes
        const burstUsers = allRefresherSessions.slice(0, config.burstRefreshUserCount);
        await Promise.all(
          burstUsers.map((s) =>
            semaphore.wrap(() => refreshFeed(s, config))
          )
        );
      } else {
        // Normal mode: single refresh
        await semaphore.wrap(() => refreshFeed(session, config));
      }

      // Wait for next interval
      await new Promise<void>((resolve) => setTimeout(resolve, interval));
    } catch (err) {
      console.error(`[Refresher] ${session.user.id} error:`, err instanceof Error ? err.message : err);
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    }
  }
}
