/**
 * Profile helper utilities for gamification, levels, badges, and stats
 */

// Level system configuration
export const LEVELS = [
  { level: 1, minPoints: 0, maxPoints: 9, title: "Newbie", badge: "🌱" },
  { level: 2, minPoints: 10, maxPoints: 24, title: "Explorer", badge: "🗺️" },
  { level: 3, minPoints: 25, maxPoints: 49, title: "Regular", badge: "🎯" },
  { level: 4, minPoints: 50, maxPoints: 99, title: "Insider", badge: "💎" },
  { level: 5, minPoints: 100, maxPoints: 199, title: "VIP", badge: "⭐" },
  { level: 6, minPoints: 200, maxPoints: 399, title: "Legend", badge: "👑" },
  { level: 7, minPoints: 400, maxPoints: 799, title: "Icon", badge: "🔥" },
  { level: 8, minPoints: 800, maxPoints: Infinity, title: "Nightlife God", badge: "🏆" },
];

/**
 * Calculate user points from check-ins and vibes
 * Points = Check-ins (1pt) + Vibes (3pts)
 * @param {number} checkInCount - Number of check-ins
 * @param {number} vibeCount - Number of vibes posted
 * @returns {number} Total points
 */
export function calculatePoints(checkInCount = 0, vibeCount = 0) {
  return checkInCount * 1 + vibeCount * 3;
}

/**
 * Get level information for a given point total
 * @param {number} points - Total points
 * @returns {Object} Level info { level, title, badge, minPoints, maxPoints, pointsNeeded }
 */
export function getLevelFromPoints(points = 0) {
  for (const levelInfo of LEVELS) {
    if (points >= levelInfo.minPoints && points <= levelInfo.maxPoints) {
      const pointsNeeded = levelInfo.maxPoints + 1 - points;
      return {
        ...levelInfo,
        pointsNeeded: pointsNeeded > 0 ? pointsNeeded : 0,
        progress: points - levelInfo.minPoints,
        progressMax: levelInfo.maxPoints - levelInfo.minPoints + 1,
      };
    }
  }
  
  // Fallback to level 1
  return {
    ...LEVELS[0],
    pointsNeeded: 10 - points,
    progress: points,
    progressMax: 10,
  };
}

/**
 * Calculate percentile ranking
 * @param {number} userPoints - User's total points
 * @param {number} totalUsers - Total number of users
 * @param {number} usersBelow - Number of users with fewer points
 * @returns {number} Percentile (0-100)
 */
export function calculatePercentile(userPoints, totalUsers, usersBelow) {
  if (!totalUsers || totalUsers === 0) return 0;
  if (totalUsers === 1) return 100;
  
  const percentile = Math.round(((totalUsers - usersBelow) / totalUsers) * 100);
  return Math.min(100, Math.max(0, percentile));
}

/**
 * Format percentile as "Top X%" or "Bottom X%"
 * @param {number} percentile - Percentile value (0-100)
 * @returns {string} Formatted string
 */
export function formatPercentile(percentile) {
  if (percentile >= 90) return `Top ${100 - percentile}%`;
  if (percentile >= 50) return `Top ${100 - percentile}%`;
  if (percentile >= 10) return `Bottom ${percentile}%`;
  return `Bottom ${percentile}%`;
}

/**
 * Calculate streak (consecutive days with activity)
 * @param {Array} activities - Array of activity objects with created_at
 * @returns {number} Streak in days
 */
export function calculateStreak(activities = []) {
  if (!activities || activities.length === 0) return 0;
  
  // Sort by date descending
  const sorted = [...activities].sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  );
  
  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  
  for (const activity of sorted) {
    const activityDate = new Date(activity.created_at);
    activityDate.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.floor((currentDate - activityDate) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === streak) {
      streak++;
      currentDate = new Date(activityDate);
    } else if (daysDiff > streak) {
      break;
    }
  }
  
  return streak;
}

/**
 * Count unique nights out (unique dates with check-ins)
 * @param {Array} checkIns - Array of check-in objects with created_at
 * @returns {number} Number of unique nights
 */
export function countNightsOut(checkIns = []) {
  if (!checkIns || checkIns.length === 0) return 0;
  
  const uniqueDates = new Set();
  
  for (const checkIn of checkIns) {
    const date = new Date(checkIn.created_at);
    date.setHours(0, 0, 0, 0);
    uniqueDates.add(date.toISOString());
  }
  
  return uniqueDates.size;
}

/**
 * Badge definitions
 */
export const BADGES = [
  {
    id: "first_vibe",
    emoji: "🎉",
    title: "First Vibe",
    description: "Post your first vibe",
    check: (stats) => stats.vibeCount >= 1,
  },
  {
    id: "explorer",
    emoji: "📍",
    title: "Explorer",
    description: "Check in to 10 venues",
    check: (stats) => stats.checkInCount >= 10,
  },
  {
    id: "hot_streak",
    emoji: "🔥",
    title: "Hot Streak",
    description: "Post vibes 5 nights in a row",
    check: (stats) => stats.streak >= 5,
  },
  {
    id: "vip_status",
    emoji: "👑",
    title: "VIP Status",
    description: "Reach Level 5",
    check: (stats) => stats.level >= 5,
  },
  {
    id: "neighborhood_king",
    emoji: "🗺️",
    title: "Neighborhood King",
    description: "Visit 5 different neighborhoods",
    check: (stats) => stats.uniqueNeighborhoods >= 5,
  },
  {
    id: "music_lover",
    emoji: "🎵",
    title: "Music Lover",
    description: "Post vibes with 3 different music types",
    check: (stats) => stats.uniqueMusicTypes >= 3,
  },
  {
    id: "weekend_warrior",
    emoji: "🍾",
    title: "Weekend Warrior",
    description: "Check in every weekend for a month",
    check: (stats) => stats.weekendStreak >= 4, // 4 weekends = 1 month
  },
  {
    id: "early_adopter",
    emoji: "💎",
    title: "Early Adopter",
    description: "Join in first 1000 users",
    check: (stats) => stats.userRank <= 1000,
  },
];

/**
 * Check which badges are unlocked
 * @param {Object} stats - User stats object
 * @returns {Array} Array of badge objects with unlocked status
 */
export function checkBadges(stats = {}) {
  return BADGES.map((badge) => ({
    ...badge,
    unlocked: badge.check(stats),
  }));
}
