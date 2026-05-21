import { UserSession } from '../users/session';
import { SimConfig } from '../types';
import { Semaphore } from '../semaphore';
import { fetchFeed } from '../actions/fetchFeed';
import { openVenue } from '../actions/openVenue';
import { postUpdate } from '../actions/postUpdate';
import { likeReport } from '../actions/likeReport';

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.floor(Math.random() * (maxMs - minMs));
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poster scenario: fetch feed, open venue, post update or like/report, repeat.
 */
export async function runPoster(
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

      // Random delay 1-3s
      await randomDelay(1000, 3000);
      if (Date.now() >= endTime) break;

      // Open a random venue
      const randomVenue = venues[Math.floor(Math.random() * venues.length)];
      await semaphore.wrap(() => openVenue(session, config, randomVenue.id));

      // Random delay 2-4s
      await randomDelay(2000, 4000);
      if (Date.now() >= endTime) break;

      // 70% chance: post update
      if (Math.random() < 0.7) {
        await semaphore.wrap(() => postUpdate(session, config, randomVenue));
      } else {
        // 30% chance: like/report
        await semaphore.wrap(() => likeReport(session, config, randomVenue.id));
      }

      // Random delay 5-15s
      await randomDelay(5000, 15000);
    } catch (err) {
      console.error(`[Poster] ${session.user.id} error:`, err instanceof Error ? err.message : err);
      await randomDelay(2000, 5000);
    }
  }
}
