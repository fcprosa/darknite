/**
 * v2 gamification constants — XP actions, levels, badges.
 */

export const XP_ACTIONS = {
  submit_vibe: 10,
  first_night_vibe: 25,
  streak_7day: 100,
  checkin: 5,
  first_place: 20,
  photo: 15,
};

export const LEVEL_THRESHOLDS = [
  { level: 1, minXp: 0, maxXp: 99, title: "Rookie" },
  { level: 2, minXp: 100, maxXp: 499, title: "Regular" },
  { level: 3, minXp: 500, maxXp: 999, title: "VIP" },
  { level: 4, minXp: 1000, maxXp: 2499, title: "Nightlife Pro" },
  { level: 5, minXp: 2500, maxXp: Infinity, title: "Legend" },
];

export const BADGES = [
  {
    key: "first_move",
    title: "First Move",
    description: "Submit your first vibe ever",
    emoji: "🎯",
  },
  {
    key: "night_owl",
    title: "Night Owl",
    description: "Submit a vibe after 2am",
    emoji: "🦉",
  },
  {
    key: "explorer",
    title: "Explorer",
    description: "Vibes at 5 unique venues",
    emoji: "🗺️",
  },
  {
    key: "globe_trotter",
    title: "Globe Trotter",
    description: "Vibes in 3 different cities",
    emoji: "🌍",
  },
  {
    key: "on_fire",
    title: "On Fire",
    description: "Maintain a 7-day streak",
    emoji: "🔥",
  },
  {
    key: "social_proof",
    title: "Social Proof",
    description: "50 total vibe submissions",
    emoji: "⭐",
  },
];

export function getLevelForXP(totalXp) {
  const xp = Math.max(0, Number(totalXp) || 0);
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    const t = LEVEL_THRESHOLDS[i];
    if (xp >= t.minXp) {
      const next = LEVEL_THRESHOLDS[i + 1];
      return {
        level: t.level,
        title: t.title,
        minXp: t.minXp,
        maxXp: t.maxXp,
        nextLevelXp: next ? next.minXp : null,
        progressInLevel: xp - t.minXp,
        progressToNext: next ? next.minXp - t.minXp : 0,
      };
    }
  }
  return {
    level: 1,
    title: "Rookie",
    minXp: 0,
    maxXp: 99,
    nextLevelXp: 100,
    progressInLevel: xp,
    progressToNext: 100,
  };
}

export function getBadgeDefinition(badgeKey) {
  return BADGES.find((b) => b.key === badgeKey) || null;
}

/** Local calendar date YYYY-MM-DD (client timezone). */
export function getLocalActivityDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parse city from Google vicinity / address (e.g. "..., San Francisco, CA"). */
export function parseCityFromAddress(address) {
  if (!address || typeof address !== "string") return null;
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return parts[parts.length - 2];
  }
  return parts[0] || null;
}

export function isFirstNightHour(date = new Date()) {
  const hour = date.getHours();
  return hour >= 20 || hour < 6;
}

export function isNightOwlHour(date = new Date()) {
  return date.getHours() >= 2 && date.getHours() < 6;
}
