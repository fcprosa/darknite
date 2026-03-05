import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { EventLog, ActionType, EventStatus, ChaosType } from '../types';

/**
 * Structured event logger. Buffers events in memory, flushes to NDJSON on completion.
 * Never logs credentials, auth tokens, or passwords.
 */
export class Logger {
  private events: EventLog[] = [];

  log(event: EventLog): void {
    // Mask email in any string payload values
    const masked = { ...event };
    if (masked.userId && masked.userId.includes('@')) {
      masked.userId = maskEmail(masked.userId);
    }
    this.events.push(masked);
  }

  logAction(params: {
    userId: string;
    action: ActionType;
    venueId?: string;
    durationMs: number;
    status: EventStatus;
    httpStatus?: number;
    errorCode?: string;
    errorMessage?: string;
    payload?: Record<string, unknown>;
    chaosInjected?: ChaosType;
    chaosDelayMs?: number;
  }): void {
    this.log({
      timestamp: new Date().toISOString(),
      userId: params.userId,
      action: params.action,
      venueId: params.venueId,
      duration_ms: params.durationMs,
      status: params.status,
      httpStatus: params.httpStatus,
      errorCode: params.errorCode,
      errorMessage: params.errorMessage,
      payload: sanitizePayload(params.payload),
      chaosInjected: params.chaosInjected,
      chaosDelayMs: params.chaosDelayMs,
    });
  }

  getEvents(): ReadonlyArray<EventLog> {
    return this.events;
  }

  getEventsByAction(action: ActionType): EventLog[] {
    return this.events.filter((e) => e.action === action);
  }

  getEventsByStatus(status: EventStatus): EventLog[] {
    return this.events.filter((e) => e.status === status);
  }

  flush(outputDir: string): string {
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `events-${ts}.ndjson`;
    const filepath = join(outputDir, filename);

    const lines = this.events.map((e) => JSON.stringify(e)).join('\n');
    writeFileSync(filepath, lines + '\n', 'utf-8');

    return filepath;
  }

  get count(): number {
    return this.events.length;
  }
}

function maskEmail(email: string): string {
  if (email.includes('sim-user-')) {
    return 'sim-user-***@darknite-test.internal';
  }
  return '***@***';
}

function sanitizePayload(
  payload?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!payload) return undefined;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    // Strip sensitive keys
    if (['password', 'token', 'access_token', 'refresh_token', 'apikey'].includes(key.toLowerCase())) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof value === 'string' && value.includes('@') && value.includes('sim-user-')) {
      sanitized[key] = maskEmail(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// Singleton logger instance
export const logger = new Logger();
