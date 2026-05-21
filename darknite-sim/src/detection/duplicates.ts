import { SupabaseClient } from '@supabase/supabase-js';
import { SimConfig, DuplicateReport, DuplicateRecord } from '../types';
import { createServiceClient } from '../supabase';

/**
 * Post-simulation duplicate detection.
 * Uses service role key to query raw vibes table.
 *
 * Finds:
 * 1. CONFIRMED_DUPLICATE: same (user_id, venue_id) within duplicate window
 * 2. COLLISION_DUPLICATE: different users, same (venue_id, crowd, music) within window
 */
export async function detectDuplicates(
  config: SimConfig,
  simulationStartTime: string,
): Promise<DuplicateReport> {
  const client = createServiceClient(config);
  const records: DuplicateRecord[] = [];

  try {
    // Fetch all vibes created during simulation by sim users
    const { data: vibes, error } = await client
      .from('vibes')
      .select('id, user_id, venue_id, crowd, music, created_at')
      .gte('created_at', simulationStartTime)
      .order('created_at', { ascending: true });

    if (error || !vibes) {
      console.error('[Duplicates] Failed to query vibes:', error?.message);
      return { confirmed: 0, collisions: 0, records: [] };
    }

    const windowMs = config.duplicateWindowMs;

    // 1. CONFIRMED_DUPLICATE: same user + same venue within window
    for (let i = 0; i < vibes.length; i++) {
      for (let j = i + 1; j < vibes.length; j++) {
        const a = vibes[i];
        const b = vibes[j];

        if (a.user_id !== b.user_id || a.venue_id !== b.venue_id) continue;

        const timeDelta = Math.abs(
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        if (timeDelta <= windowMs) {
          records.push({
            id1: a.id as string,
            id2: b.id as string,
            userId: a.user_id as string,
            venueId: a.venue_id as string,
            timeDeltaMs: timeDelta,
            type: 'CONFIRMED_DUPLICATE',
          });
        }
      }
    }

    // 2. COLLISION_DUPLICATE: different users, same venue + same crowd + same music within window
    for (let i = 0; i < vibes.length; i++) {
      for (let j = i + 1; j < vibes.length; j++) {
        const a = vibes[i];
        const b = vibes[j];

        if (a.user_id === b.user_id) continue; // Must be different users
        if (a.venue_id !== b.venue_id) continue;
        if (a.crowd !== b.crowd) continue;
        if ((a.music ?? null) !== (b.music ?? null)) continue;

        const timeDelta = Math.abs(
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        if (timeDelta <= windowMs) {
          records.push({
            id1: a.id as string,
            id2: b.id as string,
            userId: `${a.user_id as string}+${b.user_id as string}`,
            venueId: a.venue_id as string,
            timeDeltaMs: timeDelta,
            type: 'COLLISION_DUPLICATE',
          });
        }
      }
    }
  } catch (err) {
    console.error('[Duplicates] Detection error:', err instanceof Error ? err.message : err);
  }

  return {
    confirmed: records.filter((r) => r.type === 'CONFIRMED_DUPLICATE').length,
    collisions: records.filter((r) => r.type === 'COLLISION_DUPLICATE').length,
    records,
  };
}
