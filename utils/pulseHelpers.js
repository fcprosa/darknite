/**
 * pulseHelpers.js
 * 
 * Deterministic time-of-night logic and sentence generation
 * for the City Pulse Banner. No ML, no external calls.
 */

/**
 * Returns the current phase of the night.
 * All times in local timezone.
 */
export function getNightPhase(now = new Date()) {
    const hour = now.getHours();
    const minute = now.getMinutes();
    const decimal = hour + minute / 60;
  
    // 5am - 5pm: daytime (app is dormant)
    if (decimal >= 5 && decimal < 17) return "daytime";
    // 5pm - 9pm: pre-game
    if (decimal >= 17 && decimal < 21) return "pregame";
    // 9pm - 10:30pm: building
    if (decimal >= 21 && decimal < 22.5) return "building";
    // 10:30pm - 1am: peak
    if (decimal >= 22.5 || (decimal >= 0 && decimal < 1)) return "peak";
    // 1am - 3am: late
    if (decimal >= 1 && decimal < 3) return "late";
    // 3am - 5am: afterhours
    return "afterhours";
  }
  
  /**
   * Returns the day of week name for contextual messaging.
   */
  export function getDayName(now = new Date()) {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[now.getDay()];
  }
  
  /**
   * Returns true if it's a "going out" night (Thu/Fri/Sat).
   */
  export function isGoingOutNight(now = new Date()) {
    const day = now.getDay();
    return day === 4 || day === 5 || day === 6;
  }
  
  /**
   * Find the neighborhood with the most live signal.
   * Signal = recent vibes + move counts.
   * Returns { name, score } or null.
   */
  export function getTrendingNeighborhood(venues, vibeMap, moveCountMap) {
    const scores = {};
  
    for (const venue of venues) {
      const hood = venue.neighborhood;
      if (!hood) continue;
  
      if (!scores[hood]) scores[hood] = 0;
  
      // Vibe recency score: vibe in last 30 min = 3 pts, last 60 min = 1 pt
      const vibe = vibeMap[venue.id];
      if (vibe?.created_at) {
        const ageMin = (Date.now() - new Date(vibe.created_at).getTime()) / 60000;
        if (ageMin < 30) scores[hood] += 3;
        else if (ageMin < 60) scores[hood] += 1;
      }
  
      // Move count score: 1 pt per move
      const moves = moveCountMap[venue.id] || 0;
      scores[hood] += moves;
    }
  
    let best = null;
    let bestScore = 0;
    for (const [name, score] of Object.entries(scores)) {
      if (score > bestScore) {
        best = name;
        bestScore = score;
      }
    }
  
    return bestScore > 0 ? { name: best, score: bestScore } : null;
  }
  
  /**
   * Generate the pulse sentence.
   * 
   * Rules:
   *  - Never show a zero. If a number is 0, use a different sentence.
   *  - Prefer relative framing ("building", "trending") over absolute counts.
   *  - Only show counts when they're impressive (> 5 for moves, > 3 for vibes).
   */
  export function generatePulseSentence({
    phase,
    dayName,
    isWeekend,
    totalVibes,
    totalMoves,
    trendingHood,
    venueCount,
  }) {
    // --- DAYTIME ---
    if (phase === "daytime") {
      const hour = new Date().getHours();
      if (hour < 18) {
        // Before 6pm
        return `Vibes go live at 6 PM tonight`;
      }
      if (isWeekend) {
        return `${dayName} night is coming — ${venueCount} venues ready to track`;
      }
      return `Vibes go live at 6 PM tonight`;
    }
  
    // --- PREGAME (5pm - 9pm) ---
    if (phase === "pregame") {
      const hour = new Date().getHours();
      // 6pm-8pm with no vibes yet
      if (hour >= 18 && hour < 20 && totalVibes === 0) {
        return `It's early — vibes start picking up soon`;
      }
      if (totalMoves > 5) {
        if (trendingHood) {
          return `${dayName} night building — ${trendingHood.name} trending early`;
        }
        return `${dayName} night building — ${totalMoves} people setting moves`;
      }
      if (totalMoves > 0 && trendingHood) {
        return `${dayName} night shaping up — early moves pointing to ${trendingHood.name}`;
      }
      if (isWeekend) {
        return `${dayName} night building — set a Move to start the signal`;
      }
      return `${dayName} night warming up across the city`;
    }
  
    // --- BUILDING (9pm - 10:30pm) ---
    if (phase === "building") {
      const hour = new Date().getHours();
      // After 8pm with vibes present: don't show banner (return null)
      if (hour >= 20 && totalVibes > 0) {
        return null;
      }
      // After 8pm with no vibes
      if (hour >= 20 && totalVibes === 0) {
        return `Quiet night so far — be the first to post a vibe`;
      }
      if (totalVibes > 3 && trendingHood) {
        return `${trendingHood.name} heating up — ${totalVibes} vibes in the last hour`;
      }
      if (totalMoves > 5 && trendingHood) {
        return `${trendingHood.name} is the move tonight — ${totalMoves} people heading there`;
      }
      if (totalMoves > 0 && trendingHood) {
        return `Tonight's energy pointing to ${trendingHood.name}`;
      }
      if (totalVibes > 0) {
        return `The night is warming up — first vibes coming in`;
      }
      if (isWeekend) {
        return `${dayName} night picking up across NYC`;
      }
      return `The night is getting started — check what's building`;
    }
  
    // --- PEAK (10:30pm - 1am) ---
    if (phase === "peak") {
      // After 8pm with vibes present: don't show banner (return null)
      if (totalVibes > 0) {
        return null;
      }
      // After 8pm with no vibes
      if (totalVibes === 0) {
        return `Quiet night so far — be the first to post a vibe`;
      }
      if (totalVibes > 10 && trendingHood) {
        return `🔥 ${trendingHood.name} is on fire — ${totalVibes} vibes in the last hour`;
      }
      if (totalVibes > 3 && trendingHood) {
        return `${trendingHood.name} leading tonight — the city is live`;
      }
      if (totalMoves > 5) {
        return `Peak hours — ${totalMoves} people still heading out`;
      }
      if (isWeekend) {
        return `${dayName} night in full swing across the city`;
      }
      return `Peak hours — see what's happening right now`;
    }
  
    // --- LATE (1am - 3am) ---
    if (phase === "late") {
      if (totalVibes > 3 && trendingHood) {
        return `Late night — ${trendingHood.name} still going strong`;
      }
      if (totalVibes > 0) {
        return `The night's winding down — a few spots still live`;
      }
      return `Late night — see who's still out`;
    }
  
    // --- AFTERHOURS (3am - 5am) ---
    if (phase === "afterhours") {
      return `The city is sleeping — tonight's recap drops in the morning`;
    }
  
    return `See what's happening tonight`;
  }