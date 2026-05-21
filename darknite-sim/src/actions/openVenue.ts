import { UserSession } from '../users/session';
import { SimConfig, VenueDetail, Vibe } from '../types';
import { logger } from '../reporting/logger';
import { withChaos } from '../chaos/middleware';

/**
 * Open a venue detail: fetch venue by ID with recent vibes (last 10).
 */
export async function openVenue(
  session: UserSession,
  config: SimConfig,
  venueId: string,
  options?: { elevatedChaos?: boolean }
): Promise<VenueDetail | null> {
  const start = Date.now();

  try {
    const chaos = await withChaos(
      config,
      session.user.id,
      'OPEN_VENUE',
      async () => {
        // Fetch venue
        const { data: venueData, error: venueError } = await session.client
          .from('venues')
          .select('id, name, neighborhood, venue_type, address, city')
          .eq('id', venueId)
          .single();

        if (venueError) throw { supabaseError: venueError };

        // Fetch recent vibes
        const { data: vibesData, error: vibesError } = await session.client
          .from('vibes')
          .select('id, venue_id, user_id, crowd, music, line, created_at')
          .eq('venue_id', venueId)
          .order('created_at', { ascending: false })
          .limit(10);

        if (vibesError) throw { supabaseError: vibesError };

        return {
          ...(venueData as import('../types').Venue),
          recentVibes: (vibesData ?? []) as Vibe[],
        } as VenueDetail;
      },
      { elevatedRates: options?.elevatedChaos }
    );

    if (chaos.dropped) return null;

    const detail = chaos.result;
    const durationMs = Date.now() - start;

    logger.logAction({
      userId: session.user.id,
      action: 'OPEN_VENUE',
      venueId,
      durationMs,
      status: durationMs > config.slowQueryThresholdMs ? 'SLOW_QUERY' : 'SUCCESS',
      payload: { updateCount: detail?.recentVibes.length ?? 0 },
      chaosInjected: chaos.chaosApplied ?? undefined,
      chaosDelayMs: chaos.chaosDelayMs || undefined,
    });

    return detail;
  } catch (err) {
    const durationMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    const isChaosUser = session.user.role === 'chaos';

    logger.logAction({
      userId: session.user.id,
      action: 'OPEN_VENUE',
      venueId,
      durationMs,
      status: isChaosUser ? 'CHAOS_EXPECTED_ERROR' : 'ERROR',
      errorMessage: msg,
    });

    return null;
  }
}
