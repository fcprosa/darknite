export type XPAction =
  | "submit_vibe"
  | "first_night_vibe"
  | "streak_7day"
  | "checkin"
  | "first_place"
  | "photo";

export interface XPAwardLine {
  label: string;
  xp: number;
  action: XPAction | string;
}

export interface XPAwardResult {
  totalAwarded: number;
  lines: XPAwardLine[];
}

export interface Badge {
  key: string;
  title: string;
  description: string;
  emoji: string;
  unlocked: boolean;
  unlockedAt?: string | null;
}

export interface Streak {
  current: number;
  longest: number;
  lastVibeDate: string | null;
}

export interface Level {
  level: number;
  title: string;
  minXp: number;
  maxXp: number;
  nextLevelXp: number | null;
  progressInLevel: number;
  progressToNext: number;
}

export interface GamificationState {
  totalXp: number;
  level: Level;
  streak: Streak;
  badges: Badge[];
  lastCity: string | null;
  loading: boolean;
}

export interface LeaderboardEntry {
  userId: string;
  weeklyXp: number;
  displayName: string;
  rank: number;
}
