import { UserSession } from '../users/session';
import { SimConfig, PostUpdatePayload, Venue } from '../types';
import { logger } from '../reporting/logger';
import { withChaos } from '../chaos/middleware';

// Shared in-memory idempotency map
const idempotencyMap = new Map<string, { timestamp: number; insertId?: string }>();

const CROWD_OPTIONS = ['Dead', 'Chill', 'Fun', 'Packed', 'Chaos'];
const MUSIC_OPTIONS = ['Hip-Hop / R&B', 'House / Techno', 'Top Hits', 'Indie / Rock', 'Mixed'];
const LINE_OPTIONS = ['No line', 'Short wait', 'Long line', 'Not worth it'];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate an idempotency key for duplicate detection.
 */
function makeIdempotencyKey(userId: string, venueId: string, windowMs: number): string {
  return `${userId}:${venueId}:${Math.floor(Date.now() / windowMs)}`;
}

/**
 * Post a vibe update for a venue.
 * BAR: crowd + music
 * CLUB: crowd + line
 */
export async function postUpdate(
  session: UserSession,
  config: SimConfig,
  venue: Venue,
  options?: { elevatedChaos?: boolean; malformed?: boolean }
): Promise<string | null> {
  const start = Date.now();
  const isClub = venue.venue_type?.toLowerCase() === 'club';

  // Build payload
  let payload: PostUpdatePayload;
  if (options?.malformed) {
    // Chaos: malformed payload — missing fields, wrong types, empty strings
    const malformType = Math.random();
    if (malformType < 0.33) {
      // Missing required field (venue_id)
      payload = {
        venue_id: '',
        crowd: randomFrom(CROWD_OPTIONS),
        user_id: session.user.id,
        created_at: new Date().toISOString(),
      };
    } else if (malformType < 0.66) {
      // Wrong data type for crowd
      payload = {
        venue_id: venue.id,
        crowd: '12345' as string, // Invalid crowd value
        user_id: session.user.id,
        created_at: new Date().toISOString(),
      };
    } else {
      // Empty content
      payload = {
        venue_id: venue.id,
        crowd: '',
        music: '',
        user_id: session.user.id,
        created_at: new Date().toISOString(),
      };
    }
  } else {
    payload = {
      venue_id: venue.id,
      crowd: randomFrom(CROWD_OPTIONS),
      user_id: session.user.id,
      created_at: new Date().toISOString(),
    };
    if (isClub) {
      payload.line = randomFrom(LINE_OPTIONS);
    } else {
      payload.music = randomFrom(MUSIC_OPTIONS);
    }
  }

  // Idempotency key
  const idempKey = makeIdempotencyKey(session.user.id, venue.id, config.duplicateWindowMs);
  const existingEntry = idempotencyMap.get(idempKey);

  try {
    const chaos = await withChaos(
      config,
      session.user.id,
      'POST_UPDATE',
      async () => {
        const { data, error } = await session.client
          .from('vibes')
          .insert({
            venue_id: payload.venue_id,
            user_id: payload.user_id,
            crowd: payload.crowd || null,
            music: payload.music || null,
            line: payload.line || null,
          })
          .select('id')
          .single();

        if (error) throw { supabaseError: error };
        return data?.id as string | undefined;
      },
      { elevatedRates: options?.elevatedChaos }
    );

    if (chaos.dropped) return null;

    const insertId = chaos.result ?? null;
    const durationMs = Date.now() - start;

    // Check for potential duplicate via idempotency map
    let status: import('../types').EventStatus = 'SUCCESS';
    if (existingEntry) {
      status = 'POTENTIAL_DUPLICATE';
    }
    if (durationMs > config.slowQueryThresholdMs) {
      status = 'SLOW_QUERY';
    }

    // Store in idempotency map
    idempotencyMap.set(idempKey, { timestamp: Date.now(), insertId: insertId ?? undefined });

    logger.logAction({
      userId: session.user.id,
      action: 'POST_UPDATE',
      venueId: venue.id,
      durationMs,
      status,
      payload: {
        venue_id: payload.venue_id,
        crowd: payload.crowd,
        music: payload.music ?? null,
        line: payload.line ?? null,
        idempotencyKey: idempKey,
        insertId: insertId ?? null,
      },
      chaosInjected: chaos.chaosApplied ?? undefined,
      chaosDelayMs: chaos.chaosDelayMs || undefined,
    });

    return insertId;
  } catch (err) {
    const durationMs = Date.now() - start;
    const supaErr = extractSupabaseError(err);
    const isChaosUser = session.user.role === 'chaos';

    let status: import('../types').EventStatus = 'ERROR';
    if (supaErr?.code === '401' || supaErr?.code === '403' || supaErr?.code === 'PGRST3' || supaErr?.code === '42501') {
      status = isChaosUser ? 'RLS_BLOCKED_EXPECTED' : 'RLS_BLOCKED_UNEXPECTED';
    } else if (isChaosUser) {
      status = 'CHAOS_EXPECTED_ERROR';
    }

    logger.logAction({
      userId: session.user.id,
      action: 'POST_UPDATE',
      venueId: venue.id,
      durationMs,
      status,
      errorCode: supaErr?.code,
      errorMessage: supaErr?.message ?? (err instanceof Error ? err.message : String(err)),
      payload: {
        venue_id: payload.venue_id,
        crowd: payload.crowd,
        malformed: options?.malformed ?? false,
      },
    });

    return null;
  }
}

/**
 * Get the idempotency map for post-simulation analysis.
 */
export function getIdempotencyMap(): ReadonlyMap<string, { timestamp: number; insertId?: string }> {
  return idempotencyMap;
}

function extractSupabaseError(err: unknown): { code?: string; message: string } | null {
  if (err && typeof err === 'object' && 'supabaseError' in err) {
    return (err as { supabaseError: { code?: string; message: string } }).supabaseError;
  }
  if (err instanceof Error) return { message: err.message };
  return null;
}
