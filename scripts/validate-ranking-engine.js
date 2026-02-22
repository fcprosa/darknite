/**
 * Ranking Engine v2 Validation Script
 * 
 * Run this in Node.js to validate ranking scores before deployment:
 *   node scripts/validate-ranking-engine.js
 * 
 * Or copy-paste the testRankingScenarios function into your browser console
 * after importing computeFeedScore from feedHelpers.
 */

// Copy the CROWD_INTENSITY map from feedHelpers.js
const CROWD_INTENSITY = {
  Dead: 5,
  Chill: 20,
  Fun: 50,
  Packed: 85,
  Chaos: 100,
  Buzzing: 60,
};

// Simplified computeFeedScore for validation (matches feedHelpers.js logic)
function computeFeedScore(venue, latestVibe, moveCount = 0, now = new Date(), options = {}) {
  const Wl = 1.0;
  const Wm = 0.6;
  const Wh = 0.3;
  const LAMBDA = 0.025;

  const currentHour = now.getHours() + now.getMinutes() / 60;
  const dayOfWeek = options.dayOfWeek ?? now.getDay();
  const peakHour = venue.typical_peak_hour || 23.5; // Default club peak

  // L — LIVE VIBE COMPONENT
  let L = 0;
  let founderMultiplier = 1.0;

  if (latestVibe?.created_at) {
    const minutesAgo = (now.getTime() - new Date(latestVibe.created_at).getTime()) / 60000;
    if (minutesAgo < 120) {
      const crowdIntensity = CROWD_INTENSITY[latestVibe.crowd] || 20;
      const vibeCount = options.vibeCount ?? 1;
      const countMultiplier = vibeCount >= 3 ? 1.5 : vibeCount === 2 ? 1.3 : 1.0;
      const freshness = Math.exp(-LAMBDA * minutesAgo);
      L = crowdIntensity * countMultiplier * freshness;
      if (latestVibe.is_verified === true) {
        founderMultiplier = 1.2;
      }
    }
  }

  // M — MOVE COMPONENT
  let M = 0;
  if (moveCount > 0) {
    let moveScore;
    if (moveCount >= 11) moveScore = 50;
    else if (moveCount >= 6) moveScore = 40;
    else if (moveCount >= 3) moveScore = 25;
    else moveScore = 10;
    const hoursSince6pm = currentHour >= 18 ? currentHour - 18 : currentHour + 6;
    const moveFreshness = Math.max(0, 1 - hoursSince6pm / 6);
    M = moveScore * moveFreshness;
  }

  // H — HISTORICAL COMPONENT
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
  const isThursday = dayOfWeek === 4;
  const isClub = venue?.venue_type?.toLowerCase() === "club";
  let nightRelevance = 5;
  if (isWeekend) nightRelevance = isClub ? 30 : 25;
  else if (isThursday) nightRelevance = isClub ? 20 : 15;
  let hoursFromPeak = Math.abs(peakHour - currentHour);
  if (hoursFromPeak > 12) hoursFromPeak = 24 - hoursFromPeak;
  const peakProximity = Math.max(0, 1 - hoursFromPeak / 3);
  const H = nightRelevance * peakProximity;

  // VENUE BOOST
  let venueBoost = 0;
  if (L > 0 && moveCount > 0) venueBoost += 10;

  const score = Wl * founderMultiplier * L + Wm * M + Wh * H + venueBoost;
  return Math.round(score * 100) / 100;
}

/**
 * Test the 3 critical ranking scenarios
 */
function testRankingScenarios() {
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║   Ranking Engine v2 — Validation Scenarios               ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  const baseVenue = {
    venue_type: "club",
    typical_peak_hour: 23.5, // 11:30 PM
  };

  // ──────────────────────────────────────────────────────────────────────
  // SCENARIO 1: Freshness Decay (5 min vs 45 min)
  // ──────────────────────────────────────────────────────────────────────
  console.log("📊 SCENARIO 1: Freshness Decay");
  console.log("─────────────────────────────────────────────────────────────");
  
  const now = new Date("2024-01-05T23:30:00"); // Friday 11:30 PM
  const vibe5min = {
    created_at: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
    crowd: "Packed",
    is_verified: false,
  };
  const vibe45min = {
    created_at: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
    crowd: "Packed",
    is_verified: false,
  };

  const score5min = computeFeedScore(baseVenue, vibe5min, 0, now, { dayOfWeek: 5 });
  const score45min = computeFeedScore(baseVenue, vibe45min, 0, now, { dayOfWeek: 5 });

  console.log(`  Club "Packed" vibe from 5 min ago:  ${score5min.toFixed(2)}`);
  console.log(`  Club "Packed" vibe from 45 min ago: ${score45min.toFixed(2)}`);
  console.log(`  Decay ratio: ${(score45min / score5min * 100).toFixed(1)}%`);
  console.log(`  Expected: ~47% (half-life ≈28 min, so 45min ≈ 1.6 half-lives)`);
  console.log(`  ✅ ${score5min > score45min ? "PASS" : "FAIL"}: Fresh vibes rank higher\n`);

  // ──────────────────────────────────────────────────────────────────────
  // SCENARIO 2: Move Decay (8 PM vs 12 AM)
  // ──────────────────────────────────────────────────────────────────────
  console.log("📊 SCENARIO 2: Move Decay Over Time");
  console.log("─────────────────────────────────────────────────────────────");

  const barVenue = {
    venue_type: "bar",
    typical_peak_hour: 22, // 10 PM
  };

  const time8pm = new Date("2024-01-05T20:00:00"); // Friday 8:00 PM
  const time12am = new Date("2024-01-06T00:00:00"); // Saturday 12:00 AM

  const score8pm = computeFeedScore(barVenue, null, 10, time8pm, { dayOfWeek: 5 });
  const score12am = computeFeedScore(barVenue, null, 10, time12am, { dayOfWeek: 6 });

  console.log(`  Bar with 10 moves at 8:00 PM:  ${score8pm.toFixed(2)}`);
  console.log(`  Bar with 10 moves at 12:00 AM: ${score12am.toFixed(2)}`);
  console.log(`  Decay ratio: ${(score12am / score8pm * 100).toFixed(1)}%`);
  console.log(`  Expected: ~0% (moves decay linearly to 0 by midnight)`);
  console.log(`  ✅ ${score8pm > score12am && score12am < 5 ? "PASS" : "FAIL"}: Moves lose value late night\n`);

  // ──────────────────────────────────────────────────────────────────────
  // SCENARIO 3: Founder Boost
  // ──────────────────────────────────────────────────────────────────────
  console.log("📊 SCENARIO 3: Founder Boost");
  console.log("─────────────────────────────────────────────────────────────");

  const vibeNormal = {
    created_at: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
    crowd: "Packed",
    is_verified: false,
  };
  const vibeFounder = {
    created_at: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
    crowd: "Packed",
    is_verified: true,
  };

  const scoreNormal = computeFeedScore(baseVenue, vibeNormal, 0, now, { dayOfWeek: 5 });
  const scoreFounder = computeFeedScore(baseVenue, vibeFounder, 0, now, { dayOfWeek: 5 });

  const boostPercent = ((scoreFounder / scoreNormal - 1) * 100).toFixed(1);

  console.log(`  Normal user "Packed" vibe:  ${scoreNormal.toFixed(2)}`);
  console.log(`  Founder "Packed" vibe:     ${scoreFounder.toFixed(2)}`);
  console.log(`  Founder boost: +${boostPercent}%`);
  console.log(`  Expected: ~18% (1.2x multiplier applies only to L component, not entire score)`);
  console.log(`  ✅ ${Math.abs(parseFloat(boostPercent) - 18) < 2 ? "PASS" : "FAIL"}: Founder boost ~18%\n`);

  // ──────────────────────────────────────────────────────────────────────
  // BONUS: Edge Cases
  // ──────────────────────────────────────────────────────────────────────
  console.log("📊 BONUS: Edge Cases");
  console.log("─────────────────────────────────────────────────────────────");

  // Dead vibe should score low
  const vibeDead = {
    created_at: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
    crowd: "Dead",
    is_verified: false,
  };
  const scoreDead = computeFeedScore(baseVenue, vibeDead, 0, now, { dayOfWeek: 5 });
  console.log(`  "Dead" vibe score: ${scoreDead.toFixed(2)} (should be < Packed)`);
  console.log(`  ✅ ${scoreDead < scoreNormal ? "PASS" : "FAIL"}: Dead vibes rank lower\n`);

  // No vibe, no moves = historical only
  const scoreHistorical = computeFeedScore(baseVenue, null, 0, now, { dayOfWeek: 5 });
  console.log(`  Historical-only score (Fri 11:30 PM, club peak): ${scoreHistorical.toFixed(2)}`);
  console.log(`  Expected: ~9.0 (H=30 × Wh=0.3 = 9.0, since historical is weighted)`);
  console.log(`  ✅ ${Math.abs(scoreHistorical - 9.0) < 1 ? "PASS" : "FAIL"}: Historical baseline correct\n`);

  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║   Validation Complete                                    ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");
}

// Run if executed directly
if (require.main === module) {
  testRankingScenarios();
}

// Export for use in other scripts
module.exports = { testRankingScenarios, computeFeedScore };
