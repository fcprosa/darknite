import { UserSession } from '../users/session';
import { SimConfig, Venue } from '../types';
import { logger } from '../reporting/logger';
import { withChaos } from '../chaos/middleware';

/**
 * Fetch the home feed: venues ordered by updated_at desc, limit 50.
 */
export async function fetchFeed(
  session: UserSession,
  config: SimConfig,
  options?: { elevatedChaos?: boolean }
): Promise<Venue[]> {
  const start = Date.now();

  try {
    const chaos = await withChaos(
      config,
      session.user.id,
      'FETCH_FEED',
      async () => {
        const { data, error } = await session.client
          .from('venues')
          .select('id, name, neighborhood, venue_type, address, city')
          .order('name', { ascending: true })
          .limit(50);

        if (error) {
          throw { supabaseError: error };
        }
        return (data ?? []) as Venue[];
      },
      { elevatedRates: options?.elevatedChaos }
    );

    if (chaos.dropped) {
      return [];
    }

    const venues = chaos.result ?? [];
    const durationMs = Date.now() - start;

    logger.logAction({
      userId: session.user.id,
      action: 'FETCH_FEED',
      durationMs,
      status: durationMs > config.slowQueryThresholdMs ? 'SLOW_QUERY' : 'SUCCESS',
      payload: { rowCount: venues.length },
      chaosInjected: chaos.chaosApplied ?? undefined,
      chaosDelayMs: chaos.chaosDelayMs || undefined,
    });

    return venues;
  } catch (err) {
    const durationMs = Date.now() - start;
    const supaError = isSupabaseError(err);

    logger.logAction({
      userId: session.user.id,
      action: 'FETCH_FEED',
      durationMs,
      status: classifyError(supaError, session.user.role === 'chaos'),
      httpStatus: supaError?.code ? parseInt(supaError.code, 10) || undefined : undefined,
      errorCode: supaError?.code,
      errorMessage: supaError?.message ?? (err instanceof Error ? err.message : String(err)),
    });

    return [];
  }
}

function isSupabaseError(err: unknown): { code?: string; message: string } | null {
  if (
    err &&
    typeof err === 'object' &&
    'supabaseError' in err
  ) {
    const se = (err as { supabaseError: { code?: string; message: string } }).supabaseError;
    return se;
  }
  if (err instanceof Error) {
    return { message: err.message };
  }
  return null;
}

function classifyError(
  err: { code?: string; message: string } | null,
  isChaos: boolean
): import('../types').EventStatus {
  if (!err) return 'ERROR';
  const code = err.code ?? '';
  if (code === '401' || code === '403' || code === 'PGRST3' || code === '42501') {
    return isChaos ? 'RLS_BLOCKED_EXPECTED' : 'RLS_BLOCKED_UNEXPECTED';
  }
  if (isChaos) return 'CHAOS_EXPECTED_ERROR';
  return 'ERROR';
}
