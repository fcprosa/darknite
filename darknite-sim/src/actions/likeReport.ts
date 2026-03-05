import { UserSession } from '../users/session';
import { SimConfig } from '../types';
import { logger } from '../reporting/logger';
import { withChaos } from '../chaos/middleware';

/**
 * Like or report an existing vibe update.
 * If the likes/reports table doesn't exist, log FEATURE_NOT_IMPLEMENTED and skip.
 */
export async function likeReport(
  session: UserSession,
  config: SimConfig,
  venueId: string,
  options?: { elevatedChaos?: boolean }
): Promise<void> {
  const start = Date.now();

  try {
    // First fetch a recent vibe for this venue
    const { data: vibes, error: fetchError } = await session.client
      .from('vibes')
      .select('id')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError || !vibes || vibes.length === 0) {
      const durationMs = Date.now() - start;
      logger.logAction({
        userId: session.user.id,
        action: 'LIKE_REPORT',
        venueId,
        durationMs,
        status: 'SUCCESS',
        payload: { note: 'No vibes found to like/report' },
      });
      return;
    }

    const vibeId = vibes[0].id as string;

    const chaos = await withChaos(
      config,
      session.user.id,
      'LIKE_REPORT',
      async () => {
        // Try to insert a like — if table doesn't exist, handle gracefully
        const { error } = await session.client
          .from('vibe_likes')
          .insert({ vibe_id: vibeId, user_id: session.user.id });

        if (error) {
          // Check if table doesn't exist
          if (
            error.message.includes('relation') &&
            (error.message.includes('does not exist') || error.code === '42P01')
          ) {
            return 'NOT_IMPLEMENTED';
          }
          throw { supabaseError: error };
        }
        return 'OK';
      },
      { elevatedRates: options?.elevatedChaos }
    );

    if (chaos.dropped) return;

    const durationMs = Date.now() - start;

    if (chaos.result === 'NOT_IMPLEMENTED') {
      logger.logAction({
        userId: session.user.id,
        action: 'LIKE_REPORT',
        venueId,
        durationMs,
        status: 'FEATURE_NOT_IMPLEMENTED',
        payload: { note: 'vibe_likes table does not exist' },
      });
      return;
    }

    logger.logAction({
      userId: session.user.id,
      action: 'LIKE_REPORT',
      venueId,
      durationMs,
      status: durationMs > config.slowQueryThresholdMs ? 'SLOW_QUERY' : 'SUCCESS',
      chaosInjected: chaos.chaosApplied ?? undefined,
      chaosDelayMs: chaos.chaosDelayMs || undefined,
    });
  } catch (err) {
    const durationMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    const isChaosUser = session.user.role === 'chaos';

    logger.logAction({
      userId: session.user.id,
      action: 'LIKE_REPORT',
      venueId,
      durationMs,
      status: isChaosUser ? 'CHAOS_EXPECTED_ERROR' : 'ERROR',
      errorMessage: msg,
    });
  }
}
