import { UserSession } from '../users/session';
import { SimConfig, Venue } from '../types';
import { Semaphore } from '../semaphore';
import { fetchFeed } from '../actions/fetchFeed';
import { openVenue } from '../actions/openVenue';
import { postUpdate } from '../actions/postUpdate';
import { refreshFeed } from '../actions/refreshFeed';
import { likeReport } from '../actions/likeReport';

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.floor(Math.random() * (maxMs - minMs));
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const FAKE_VENUE_IDS = [
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'nonexistent-venue-id',
];

/**
 * Chaos scenario: randomly chooses actions, uses elevated chaos rates,
 * sends malformed payloads 20% of the time, tries nonexistent venues.
 */
export async function runChaos(
  session: UserSession,
  config: SimConfig,
  semaphore: Semaphore,
  endTime: number,
): Promise<void> {
  let cachedVenues: Venue[] = [];

  while (Date.now() < endTime) {
    try {
      const actionChoice = Math.random();

      if (actionChoice < 0.2) {
        // Fetch feed with elevated chaos
        cachedVenues = await semaphore.wrap(() =>
          fetchFeed(session, config, { elevatedChaos: true })
        );
      } else if (actionChoice < 0.4) {
        // Open venue — sometimes nonexistent
        const useNonexistent = Math.random() < 0.3;
        const venueId = useNonexistent
          ? FAKE_VENUE_IDS[Math.floor(Math.random() * FAKE_VENUE_IDS.length)]
          : cachedVenues.length > 0
            ? cachedVenues[Math.floor(Math.random() * cachedVenues.length)].id
            : FAKE_VENUE_IDS[0];

        await semaphore.wrap(() =>
          openVenue(session, config, venueId, { elevatedChaos: true })
        );
      } else if (actionChoice < 0.65) {
        // Post update — 20% malformed, sometimes to nonexistent venues
        const useMalformed = Math.random() < 0.2;
        const useNonexistent = Math.random() < 0.2;

        const venue: Venue = useNonexistent
          ? {
              id: FAKE_VENUE_IDS[Math.floor(Math.random() * FAKE_VENUE_IDS.length)],
              name: 'Nonexistent Venue',
              neighborhood: 'Nowhere',
              venue_type: Math.random() < 0.5 ? 'bar' : 'club',
            }
          : cachedVenues.length > 0
            ? cachedVenues[Math.floor(Math.random() * cachedVenues.length)]
            : {
                id: FAKE_VENUE_IDS[0],
                name: 'Fallback',
                neighborhood: 'Unknown',
                venue_type: 'bar',
              };

        await semaphore.wrap(() =>
          postUpdate(session, config, venue, {
            elevatedChaos: true,
            malformed: useMalformed,
          })
        );
      } else if (actionChoice < 0.85) {
        // Refresh feed
        await semaphore.wrap(() => refreshFeed(session, config));
      } else {
        // Like/report
        const venueId = cachedVenues.length > 0
          ? cachedVenues[Math.floor(Math.random() * cachedVenues.length)].id
          : FAKE_VENUE_IDS[0];

        await semaphore.wrap(() =>
          likeReport(session, config, venueId, { elevatedChaos: true })
        );
      }

      // Random delay 0.5-4s (faster than other scenarios)
      await randomDelay(500, 4000);
    } catch (err) {
      // Chaos errors are expected — log and continue
      console.error(`[Chaos] ${session.user.id} error (expected):`, err instanceof Error ? err.message : err);
      await randomDelay(500, 2000);
    }
  }
}
