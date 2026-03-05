import { SimConfig, ChaosType } from '../types';
import { logger } from '../reporting/logger';

export interface ChaosResult<T> {
  result: T | null;
  chaosApplied: ChaosType | null;
  chaosDelayMs: number;
  dropped: boolean;
}

/**
 * Chaos middleware wraps every outbound Supabase call.
 * Transparent to callers — actions don't know chaos is applied.
 *
 * Three independent modes per request:
 * - DROP: cancel before execution, return simulated network error
 * - SLOW: inject random delay before executing
 * - RETRY: execute, then immediately re-execute with same payload
 */
export async function withChaos<T>(
  config: SimConfig,
  userId: string,
  action: string,
  fn: () => Promise<T>,
  options?: { elevatedRates?: boolean }
): Promise<ChaosResult<T>> {
  if (!config.chaosEnabled) {
    const result = await fn();
    return { result, chaosApplied: null, chaosDelayMs: 0, dropped: false };
  }

  const multiplier = options?.elevatedRates ? 3 : 1;
  const dropRate = config.chaosDropRate * multiplier;
  const slowRate = config.chaosSlowRate * multiplier;
  const retryRate = config.chaosRetryRate * multiplier;

  // DROP check
  if (Math.random() < dropRate) {
    logger.logAction({
      userId,
      action: action as import('../types').ActionType,
      durationMs: 0,
      status: 'CHAOS_DROP',
      chaosInjected: 'DROP',
    });
    return { result: null, chaosApplied: 'DROP', chaosDelayMs: 0, dropped: true };
  }

  // SLOW check
  let chaosDelayMs = 0;
  if (Math.random() < slowRate) {
    chaosDelayMs =
      config.chaosSlowMinMs +
      Math.floor(Math.random() * (config.chaosSlowMaxMs - config.chaosSlowMinMs));
    await sleep(chaosDelayMs);
  }

  // Execute the request
  const result = await fn();

  // RETRY check — execute again with same payload
  if (Math.random() < retryRate) {
    logger.logAction({
      userId,
      action: action as import('../types').ActionType,
      durationMs: chaosDelayMs,
      status: 'CHAOS_SLOW',
      chaosInjected: 'RETRY',
      chaosDelayMs,
    });

    // Second execution (duplicate trigger)
    try {
      await fn();
    } catch {
      // Retry errors are expected — don't propagate
    }

    return { result, chaosApplied: 'RETRY', chaosDelayMs, dropped: false };
  }

  if (chaosDelayMs > 0) {
    return { result, chaosApplied: 'SLOW', chaosDelayMs, dropped: false };
  }

  return { result, chaosApplied: null, chaosDelayMs: 0, dropped: false };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
