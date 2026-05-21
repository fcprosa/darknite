import { UserSession } from '../users/session';
import { SimConfig, Venue } from '../types';
import { logger } from '../reporting/logger';
import { withChaos } from '../chaos/middleware';

/**
 * Same as fetchFeed but tagged as BURST_REFRESH in logs.
 * Tracks consecutive refreshes per user within 10s windows.
 */
const refreshTracker = new Map<string, { count: number; windowStart: number }>();

export async function refreshFeed(
  session: UserSession,
  config: SimConfig,
): Promise<Venue[]> {
  const start = Date.now();
  const userId = session.user.id;

  // Track consecutive refreshes in 10s windows
  const tracker = refreshTracker.get(userId);
  const now = Date.now();
  if (tracker && now - tracker.windowStart < 10000) {
    tracker.count++;
  } else {
    refreshTracker.set(userId, { count: 1, windowStart: now });
  }

  try {
    const chaos = await withChaos(
      config,
      session.user.id,
      'REFRESH_FEED',
      async () => {
        const { data, error } = await session.client
          .from('venues')
          .select('id, name, neighborhood, venue_type, address, city')
          .order('name', { ascending: true })
          .limit(50);

        if (error) throw { supabaseError: error };
        return (data ?? []) as Venue[];
      },
    );

    if (chaos.dropped) return [];

    const venues = chaos.result ?? [];
    const durationMs = Date.now() - start;

    const currentTracker = refreshTracker.get(userId);

    logger.logAction({
      userId: session.user.id,
      action: 'REFRESH_FEED',
      durationMs,
      status: durationMs > config.slowQueryThresholdMs ? 'SLOW_QUERY' : 'SUCCESS',
      payload: {
        rowCount: venues.length,
        burstRefresh: true,
        consecutiveRefreshes: currentTracker?.count ?? 1,
      },
      chaosInjected: chaos.chaosApplied ?? undefined,
      chaosDelayMs: chaos.chaosDelayMs || undefined,
    });

    return venues;
  } catch (err) {
    const durationMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);

    logger.logAction({
      userId: session.user.id,
      action: 'REFRESH_FEED',
      durationMs,
      status: 'ERROR',
      errorMessage: msg,
    });

    return [];
  }
}
