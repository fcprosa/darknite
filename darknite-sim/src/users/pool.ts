import { SimUser, UserRole, SimConfig } from '../types';
import { UserSession } from './session';
import { createHash } from 'crypto';

/**
 * Generate a deterministic password for a sim user based on email + salt.
 * This allows simulation users to be reused across runs.
 *
 * Password format:
 *   Sim! + sha256(email + ":" + salt).slice(0, 24)
 *
 * Salt comes from SIM_PASSWORD_SALT (default: "darknite-sim").
 */
function generatePassword(email: string): string {
  const salt = process.env.SIM_PASSWORD_SALT || 'darknite-sim';
  const hash = createHash('sha256')
    .update(`${email}:${salt}`)
    .digest('hex');

  // Ensure Supabase password rules are satisfied:
  // - Length >= 6 (we use 4 + 24 = 28)
  // - Contains upper, lower, number, and symbol via prefix "Sim!"
  const core = hash.slice(0, 24);
  return `Sim!${core}`;
}

/**
 * Assign role deterministically by index:
 * 50% browser, 30% poster, 15% refresher, 5% chaos
 */
function assignRole(index: number, total: number): UserRole {
  const pct = index / total;
  if (pct < 0.5) return 'browser';
  if (pct < 0.8) return 'poster';
  if (pct < 0.95) return 'refresher';
  return 'chaos';
}

/**
 * Generate SIM_USER_COUNT synthetic users.
 */
export function generateUserPool(config: SimConfig): SimUser[] {
  const users: SimUser[] = [];
  for (let i = 0; i < config.userCount; i++) {
    const email = `sim-user-${i}@darknite-test.internal`;
    users.push({
      id: `sim-user-${i}`, // Placeholder until auth assigns real ID
      email,
      password: generatePassword(email),
      role: assignRole(i, config.userCount),
    });
  }
  return users;
}

/**
 * Create sessions for all users and authenticate sequentially.
 */
export async function createAndAuthenticateSessions(
  users: SimUser[],
  config: SimConfig,
  onProgress?: (completed: number, total: number) => void
): Promise<UserSession[]> {
  const sessions: UserSession[] = [];

  for (let i = 0; i < users.length; i++) {
    const session = new UserSession(users[i], config);
    try {
      await session.authenticate();
      sessions.push(session);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Pool] Failed to authenticate user ${i}: ${msg}`);
      // Continue with remaining users — don't block the pool
    }
    if (onProgress) {
      onProgress(i + 1, users.length);
    }
  }

  if (sessions.length === 0) {
    throw new Error('No users could be authenticated. Check Supabase auth config.');
  }

  return sessions;
}
