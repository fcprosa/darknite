import { supabase } from "../utils/supabase";
import logger from "../utils/logger";
import {
  XP_ACTIONS,
  BADGES,
  getLevelForXP,
  getBadgeDefinition,
  getLocalActivityDate,
  parseCityFromAddress,
  isFirstNightHour,
  isNightOwlHour,
} from "../constants/gamification";

const log = logger.tag("Gamification");

function parseDateOnly(str) {
  if (!str) return null;
  const [y, m, d] = String(str).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function daysBetween(dateA, dateB) {
  const a = parseDateOnly(dateA);
  const b = parseDateOnly(dateB);
  if (!a || !b) return null;
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

/**
 * Sacred streak logic — uses client local calendar date (activityDate YYYY-MM-DD).
 *
 * Edge cases for human review:
 * 1. Midnight: posts on consecutive local calendar days increment streak (23:59 day1 + 00:01 day2).
 * 2. Timezone: activityDate must come from device local date, not server UTC.
 * 3. 25h+ gap across 2 skipped calendar days (Mon night → Wed night) resets streak to 1.
 */
export async function updateStreak(userId, activityDate) {
  if (!userId || !activityDate) return { current: 0, longest: 0 };

  const { data: existing, error: fetchErr } = await supabase
    .from("user_streaks")
    .select("id, current_streak, longest_streak, last_vibe_date")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchErr) {
    log.error("updateStreak fetch:", fetchErr.message);
    return { current: 0, longest: 0 };
  }

  let current = 0;
  let longest = 0;
  const last = existing?.last_vibe_date;

  if (!existing) {
    current = 1;
    longest = 1;
  } else if (!last) {
    current = 1;
    longest = Math.max(existing.longest_streak || 0, 1);
  } else if (last === activityDate) {
    current = existing.current_streak || 1;
    longest = existing.longest_streak || current;
  } else {
    const gap = daysBetween(last, activityDate);
    if (gap === 1) {
      current = (existing.current_streak || 0) + 1;
    } else {
      current = 1;
    }
    longest = Math.max(existing.longest_streak || 0, current);
  }

  const row = {
    user_id: userId,
    current_streak: current,
    longest_streak: longest,
    last_vibe_date: activityDate,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    await supabase.from("user_streaks").update(row).eq("id", existing.id);
  } else {
    await supabase.from("user_streaks").insert(row);
  }

  return { current, longest, lastVibeDate: activityDate };
}

async function ensureUserXpRow(userId) {
  const { data } = await supabase
    .from("user_xp")
    .select("id, total_xp, level")
    .eq("user_id", userId)
    .maybeSingle();

  if (data) return data;

  const { data: inserted, error } = await supabase
    .from("user_xp")
    .insert({ user_id: userId, total_xp: 0, level: 1 })
    .select("id, total_xp, level")
    .single();

  if (error) {
    log.error("ensureUserXpRow:", error.message);
    return { total_xp: 0, level: 1 };
  }
  return inserted;
}

async function addXpEvent(userId, action, xp, placeId, city) {
  return supabase.from("xp_events").insert({
    user_id: userId,
    action,
    xp_awarded: xp,
    place_id: placeId || null,
    city: city || null,
  });
}

async function incrementTotalXp(userId, amount) {
  const row = await ensureUserXpRow(userId);
  const newTotal = (row.total_xp || 0) + amount;
  const levelInfo = getLevelForXP(newTotal);

  await supabase
    .from("user_xp")
    .update({
      total_xp: newTotal,
      level: levelInfo.level,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return { totalXp: newTotal, level: levelInfo };
}

async function countVibesAtPlace(userId, placeId) {
  if (!placeId) return 0;
  const id = String(placeId).replace(/"/g, '\\"');
  const { count, error } = await supabase
    .from("vibes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .or(`place_id.eq."${id}",venue_id.eq."${id}"`);
  if (error) return 0;
  return count || 0;
}

async function countDistinctPlaces(userId) {
  const { data, error } = await supabase
    .from("vibes")
    .select("place_id, venue_id")
    .eq("user_id", userId);

  if (error || !data) return 0;
  const keys = new Set();
  for (const v of data) {
    if (v.place_id) keys.add(v.place_id);
    else if (v.venue_id) keys.add(v.venue_id);
  }
  return keys.size;
}

async function countTotalVibes(userId) {
  const { count, error } = await supabase
    .from("vibes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) return 0;
  return count || 0;
}

async function countDistinctCities(userId) {
  const { data, error } = await supabase
    .from("xp_events")
    .select("city")
    .eq("user_id", userId)
    .not("city", "is", null);

  if (error || !data) return 0;
  return new Set(data.map((r) => r.city).filter(Boolean)).size;
}

async function hasBadge(userId, badgeKey) {
  const { data } = await supabase
    .from("user_badges")
    .select("id")
    .eq("user_id", userId)
    .eq("badge_key", badgeKey)
    .maybeSingle();
  return !!data;
}

async function unlockBadge(userId, badgeKey) {
  if (await hasBadge(userId, badgeKey)) return false;
  const { error } = await supabase.from("user_badges").insert({
    user_id: userId,
    badge_key: badgeKey,
  });
  if (error) {
    log.error("unlockBadge:", badgeKey, error.message);
    return false;
  }
  return true;
}

export async function checkAndAwardBadges(userId, context = {}) {
  const newlyUnlocked = [];
  const vibeCount = await countTotalVibes(userId);
  const placeCount = await countDistinctPlaces(userId);
  const cityCount = await countDistinctCities(userId);

  const { data: streakRow } = await supabase
    .from("user_streaks")
    .select("current_streak")
    .eq("user_id", userId)
    .maybeSingle();

  const streak = streakRow?.current_streak || 0;

  const checks = [
    { key: "first_move", ok: vibeCount >= 1 },
    { key: "night_owl", ok: context.isNightOwl === true },
    { key: "explorer", ok: placeCount >= 5 },
    { key: "globe_trotter", ok: cityCount >= 3 },
    { key: "on_fire", ok: streak >= 7 },
    { key: "social_proof", ok: vibeCount >= 50 },
  ];

  for (const { key, ok } of checks) {
    if (ok && (await unlockBadge(userId, key))) {
      const def = getBadgeDefinition(key);
      newlyUnlocked.push(def || { key });
    }
  }

  return newlyUnlocked;
}

/**
 * Preview XP lines without writing to DB.
 */
export async function computeXPAwardPreview(userId, action, options = {}) {
  const lines = [];
  const now = options.date || new Date();
  const activityDate = options.activityDate || getLocalActivityDate(now);

  if (action === "checkin") {
    lines.push({ label: "Check-in", xp: XP_ACTIONS.checkin, action: "checkin" });
    return { totalAwarded: XP_ACTIONS.checkin, lines };
  }

  if (action === "submit_vibe") {
    lines.push({ label: "Vibe posted", xp: XP_ACTIONS.submit_vibe, action: "submit_vibe" });

    if (isFirstNightHour(now)) {
      lines.push({
        label: "First vibe of the night",
        xp: XP_ACTIONS.first_night_vibe,
        action: "first_night_vibe",
      });
    }

    const atPlace = options.placeId
      ? await countVibesAtPlace(userId, options.placeId)
      : 0;
    const isPreview = options.mode !== "award";
    const firstPlace =
      options.placeId &&
      (isPreview ? atPlace === 0 : atPlace === 1);
    if (firstPlace) {
      lines.push({
        label: "New venue explorer",
        xp: XP_ACTIONS.first_place,
        action: "first_place",
      });
    }

    if (options.hasPhoto) {
      lines.push({ label: "Photo bonus", xp: XP_ACTIONS.photo, action: "photo" });
    }

    const { data: streakRow } = await supabase
      .from("user_streaks")
      .select("current_streak, last_vibe_date")
      .eq("user_id", userId)
      .maybeSingle();

    const projected = await updateStreakPreview(
      streakRow,
      activityDate
    );
    if (projected === 7) {
      lines.push({
        label: "7-day streak bonus",
        xp: XP_ACTIONS.streak_7day,
        action: "streak_7day",
      });
    }
  }

  const totalAwarded = lines.reduce((s, l) => s + l.xp, 0);
  return { totalAwarded, lines };
}

function updateStreakPreview(streakRow, activityDate) {
  if (!streakRow?.last_vibe_date) return 1;
  if (streakRow.last_vibe_date === activityDate) {
    return streakRow.current_streak || 1;
  }
  const gap = daysBetween(streakRow.last_vibe_date, activityDate);
  if (gap === 1) return (streakRow.current_streak || 0) + 1;
  return 1;
}

export async function awardXP(userId, action, options = {}) {
  if (!userId) {
    return { totalAwarded: 0, lines: [], error: "No user" };
  }

  const now = options.date || new Date();
  const activityDate = options.activityDate || getLocalActivityDate(now);
  const city =
    options.city ||
    parseCityFromAddress(options.address || options.vicinity) ||
    null;
  const placeId = options.placeId || null;

  const preview = await computeXPAwardPreview(userId, action, {
    ...options,
    activityDate,
    date: now,
    mode: "award",
  });

  const lines = [...preview.lines];
  let totalAwarded = preview.totalAwarded;

  if (action === "submit_vibe") {
    const streakResult = await updateStreak(userId, activityDate);
    if (
      streakResult.current === 7 &&
      !lines.some((l) => l.action === "streak_7day")
    ) {
      lines.push({
        label: "7-day streak bonus",
        xp: XP_ACTIONS.streak_7day,
        action: "streak_7day",
      });
      totalAwarded += XP_ACTIONS.streak_7day;
    }
  }

  for (const line of lines) {
    if (line.xp > 0) {
      await addXpEvent(userId, line.action, line.xp, placeId, city);
    }
  }

  await incrementTotalXp(userId, totalAwarded);

  const newBadges = await checkAndAwardBadges(userId, {
    isNightOwl: isNightOwlHour(now),
  });

  for (const badge of newBadges) {
    lines.push({
      label: `${badge.emoji || "🏅"} ${badge.title} unlocked!`,
      xp: 0,
      action: "badge_unlock",
    });
  }

  log.log("awardXP:", { userId, action, totalAwarded, lines: lines.length });

  return { totalAwarded, lines, newBadges };
}

export async function getLastVibeCity(userId) {
  const { data, error } = await supabase
    .from("xp_events")
    .select("city, created_at")
    .eq("user_id", userId)
    .not("city", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.city;
}

export async function getUserGamificationState(userId) {
  if (!userId) {
    return {
      totalXp: 0,
      level: getLevelForXP(0),
      streak: { current: 0, longest: 0, lastVibeDate: null },
      badges: BADGES.map((b) => ({ ...b, unlocked: false, unlockedAt: null })),
      lastCity: null,
    };
  }

  const [xpRes, streakRes, badgesRes, lastCity] = await Promise.all([
    supabase.from("user_xp").select("total_xp, level").eq("user_id", userId).maybeSingle(),
    supabase
      .from("user_streaks")
      .select("current_streak, longest_streak, last_vibe_date")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("user_badges")
      .select("badge_key, unlocked_at")
      .eq("user_id", userId),
    getLastVibeCity(userId),
  ]);

  const totalXp = xpRes.data?.total_xp ?? 0;
  const level = getLevelForXP(totalXp);
  const unlockedMap = {};
  (badgesRes.data || []).forEach((b) => {
    unlockedMap[b.badge_key] = b.unlocked_at;
  });

  const badges = BADGES.map((b) => ({
    ...b,
    unlocked: !!unlockedMap[b.key],
    unlockedAt: unlockedMap[b.key] || null,
  }));

  return {
    totalXp,
    level,
    streak: {
      current: streakRes.data?.current_streak ?? 0,
      longest: streakRes.data?.longest_streak ?? 0,
      lastVibeDate: streakRes.data?.last_vibe_date ?? null,
    },
    badges,
    lastCity,
  };
}

export async function getWeeklyLeaderboard(city) {
  const { data, error } = await supabase.rpc("get_weekly_leaderboard", {
    p_city: city || null,
  });

  if (error) {
    log.error("getWeeklyLeaderboard:", error.message);
    return [];
  }

  return (data || []).map((row, index) => ({
    userId: row.user_id,
    weeklyXp: Number(row.weekly_xp) || 0,
    displayName: row.display_name || "Night Owl",
    rank: index + 1,
  }));
}
