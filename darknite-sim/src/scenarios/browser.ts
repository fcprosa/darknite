import { UserSession } from '../users/session';
import { SimConfig, Venue } from '../types';
import { Semaphore } from '../semaphore';
import { fetchFeed } from '../actions/fetchFeed';
import { openVenue } from '../actions/openVenue';

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.floor(Math.random() * (maxMs - minMs));
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Browser scenario: fetch feed, open random venue, repeat.
 * No posting, no mutations.
 */
export async function runBrowser(
  session: UserSession,
  config: SimConfig,
  semaphore: Semaphore,
  endTime: number,
): Promise<void> {
  while (Date.now() < endTime) {
    try {
      // Fetch feed
      const venues = await semaphore.wrap(() => fetchFeed(session, config));

      if (venues.length === 0 || Date.now() >= endTime) break;

      // Random delay 2-5s
      await randomDelay(2000, 5000);
      if (Date.now() >= endTime) break;

      // Open a random venue
      const randomVenue = venues[Math.floor(Math.random() * venues.length)];
      await semaphore.wrap(() => openVenue(session, config, randomVenue.id));

      // Random delay 3-8s
      await randomDelay(3000, 8000);
    } catch (err) {
      // Log but continue
      console.error(`[Browser] ${session.user.id} error:`, err instanceof Error ? err.message : err);
      await randomDelay(1000, 3000);
    }
  }
}
