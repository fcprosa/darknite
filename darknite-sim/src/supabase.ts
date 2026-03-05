import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SimConfig } from './types';

/**
 * Create an anonymous Supabase client (used before auth).
 * Each user gets their own client instance — never shared.
 */
export function createAnonClient(config: SimConfig): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: false,
    },
  });
}

/**
 * Create a service-role Supabase client.
 * Used ONLY for post-simulation verification queries (duplicate detection).
 */
export function createServiceClient(config: SimConfig): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Connectivity check — verify Supabase is reachable before starting.
 */
export async function checkConnectivity(config: SimConfig): Promise<void> {
  const client = createAnonClient(config);
  try {
    const { error } = await client.from('venues').select('id').limit(1);
    if (error) {
      throw new Error(`Supabase query failed: ${error.message} (code: ${error.code})`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Supabase unreachable at ${config.supabaseUrl}: ${msg}`);
  }
}
