import { supabase } from "../utils/supabase";
import logger from "../utils/logger";

const log = logger.tag("FeedService");

export const VIBE_WINDOW_HOURS = 8;

const CHUNK_SIZE = 50;
const NEARBY_FEED_LIMIT = 50;
const PLACE_FEED_LIMIT = 20;
const XP_MATCH_MS = 2 * 60 * 1000;

const FEED_SELECT_FIELDS =
  "id, created_at, place_id, venue_id, user_id, crowd, ratio, line, cover, music, bar_type, drinks_price_tier, age_range, crowd_vibe, user_profiles!user_id(username)";

function sinceIso(hoursWindow) {
  return new Date(Date.now() - hoursWindow * 60 * 60 * 1000).toISOString();
}

function attachFeedProfile(vibe) {
  if (!vibe || typeof vibe !== "object") return vibe;
  const profile = vibe.user_profiles;
  if (profile && typeof profile === "object") {
    vibe.username = profile.username || null;
    delete vibe.user_profiles;
  }
  return vibe;
}

function resolvePlaceId(vibe) {
  return vibe?.place_id || vibe?.venue_id || null;
}

/**
 * Sum xp_events within XP_MATCH_MS of each vibe's created_at (own vibes only; RLS).
 */
async function attachXpTotals(vibes) {
  if (!vibes?.length) return [];

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return vibes.map((v) => ({ ...v, feed_xp_total: 0 }));
  }

  const ownVibes = vibes.filter((v) => v.user_id === user.id);
  if (!ownVibes.length) {
    return vibes.map((v) => ({ ...v, feed_xp_total: 0 }));
  }

  const placeIds = [
    ...new Set(ownVibes.map(resolvePlaceId).filter(Boolean)),
  ];
  const earliest = ownVibes.reduce((min, v) => {
    const t = new Date(v.created_at).getTime();
    return t < min ? t : min;
  }, Date.now());

  try {
    const { data: events, error } = await supabase
      .from("xp_events")
      .select("xp_awarded, place_id, created_at")
      .eq("user_id", user.id)
      .in("place_id", placeIds)
      .gte("created_at", new Date(earliest - XP_MATCH_MS).toISOString());

    if (error) {
      log.error("xp_events fetch:", error.message);
      return vibes.map((v) => ({ ...v, feed_xp_total: 0 }));
    }

    const xpByVibeId = {};
    for (const vibe of ownVibes) {
      const pid = resolvePlaceId(vibe);
      const vibeMs = new Date(vibe.created_at).getTime();
      const total = (events || [])
        .filter((e) => {
          if (e.place_id !== pid) return false;
          const eMs = new Date(e.created_at).getTime();
          return Math.abs(eMs - vibeMs) <= XP_MATCH_MS;
        })
        .reduce((sum, e) => sum + (e.xp_awarded || 0), 0);
      xpByVibeId[vibe.id] = total;
    }

    return vibes.map((v) => ({
      ...v,
      feed_xp_total: xpByVibeId[v.id] || 0,
    }));
  } catch (err) {
    log.error("attachXpTotals exception:", err);
    return vibes.map((v) => ({ ...v, feed_xp_total: 0 }));
  }
}

async function fetchVibesForPlaceIds(placeIds, hoursWindow, limit) {
  const validIds = [...new Set(placeIds.filter(Boolean).map(String))];
  if (!validIds.length) return [];

  const since = sinceIso(hoursWindow);
  const merged = [];

  for (let i = 0; i < validIds.length; i += CHUNK_SIZE) {
    const chunk = validIds.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase
      .from("vibes")
      .select(FEED_SELECT_FIELDS)
      .in("place_id", chunk)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      log.error("feed query error:", error.message);
      continue;
    }
    if (data?.length) merged.push(...data);
  }

  merged.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const sliced = merged.slice(0, limit);
  sliced.forEach(attachFeedProfile);
  return attachXpTotals(sliced);
}

/**
 * Feed for nearby venues (last N hours, newest first).
 * @param {string[]} placeIds - Google place_ids from map Nearby Search
 * @param {number} hoursWindow - Default 8
 */
export async function getNearbyFeed(placeIds, hoursWindow = VIBE_WINDOW_HOURS) {
  if (!placeIds?.length) return [];
  return fetchVibesForPlaceIds(placeIds, hoursWindow, NEARBY_FEED_LIMIT);
}

/**
 * Feed for a single venue (used by Phase 6B).
 * @param {string} placeId
 * @param {number} hoursWindow - Default 8
 */
export async function getFeedForPlace(placeId, hoursWindow = VIBE_WINDOW_HOURS) {
  if (!placeId || typeof placeId !== "string") return [];

  const since = sinceIso(hoursWindow);
  const id = String(placeId).replace(/"/g, '\\"');
  const orFilter = `place_id.eq."${id}",venue_id.eq."${id}"`;

  try {
    const { data, error } = await supabase
      .from("vibes")
      .select(FEED_SELECT_FIELDS)
      .or(orFilter)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(PLACE_FEED_LIMIT);

    if (error) {
      log.error("getFeedForPlace error:", error.message);
      return [];
    }

    const rows = data || [];
    rows.forEach(attachFeedProfile);
    return attachXpTotals(rows);
  } catch (err) {
    log.error("getFeedForPlace exception:", err);
    return [];
  }
}
