/**
 * Backfill Venue Defaults from VENUE_OVERRIDES
 * 
 * Migrates hardcoded venue overrides from feedHelpers.js to Supabase venues table.
 * 
 * Usage:
 *   node scripts/backfill-venue-defaults.mjs --dry-run
 *   node scripts/backfill-venue-defaults.mjs --execute
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

// ── CONFIG ──────────────────────────────────────────────────
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials. Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');
const EXECUTE = process.argv.includes('--execute');

if (!DRY_RUN && !EXECUTE) {
  console.log('Usage: node scripts/backfill-venue-defaults.mjs --dry-run | --execute');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── VENUE_OVERRIDES DATA (copied from feedHelpers.js) ────────────────
const VENUE_OVERRIDES = {
  // CLUBS
  "Marquee": {
    typical_peak_hour: 24,
    typical_peak_label: "Usually peaks around midnight",
    usual_cover: "$30-40",
    usual_line: "Long line after 11",
    usual_music: "Top Hits",
    typical_crowd: "Packed",
  },
  "Gospel": {
    typical_peak_hour: 23,
    typical_peak_label: "Gets going around 11",
    usual_cover: "$20",
    usual_line: "Moderate line",
    usual_music: "Hip-Hop / R&B",
    typical_crowd: "Packed",
  },
  "Le Bain": {
    typical_peak_hour: 24.5,
    typical_peak_label: "Peaks after midnight",
    usual_cover: "$30+",
    usual_line: "Guest list helps",
    usual_music: "House / Techno",
    typical_crowd: "Buzzing",
  },
  "Harbor New York City": {
    typical_peak_hour: 23.5,
    typical_peak_label: "Busiest around 11:30",
    usual_cover: "$20-30",
    usual_line: "Expect a wait",
    usual_music: "House / Techno",
    typical_crowd: "Packed",
  },
  "Deluxx Fluxx": {
    typical_peak_hour: 23,
    typical_peak_label: "Fills up around 11",
    usual_cover: "Varies",
    usual_line: "Can get long",
    usual_music: "Mixed / EDM",
    typical_crowd: "Chaos",
  },
  "Little Sister": {
    typical_peak_hour: 23,
    typical_peak_label: "Best after 11",
    usual_cover: "$10-20",
    usual_line: "Short wait",
    usual_music: "Hip-Hop / R&B",
    typical_crowd: "Fun",
  },
  "PHD Downtown": {
    typical_peak_hour: 23,
    typical_peak_label: "Busiest around 11",
    usual_cover: "$20-30",
    usual_line: "Guest list helps",
    usual_music: "Top Hits",
    typical_crowd: "Buzzing",
  },
  "Somewhere Nowhere": {
    typical_peak_hour: 23.5,
    typical_peak_label: "Peaks around 11:30",
    usual_cover: "$20",
    usual_line: "Line after 11",
    usual_music: "Mixed / EDM",
    typical_crowd: "Fun",
  },
  "Tao Downtown": {
    typical_peak_hour: 24,
    typical_peak_label: "Late crowd, peaks midnight",
    usual_cover: "$30+",
    usual_line: "Guest list only",
    usual_music: "Top Hits",
    typical_crowd: "Packed",
  },
  "The Fleur Room": {
    typical_peak_hour: 23.5,
    typical_peak_label: "Peaks around 11:30",
    usual_cover: "$20-30",
    usual_line: "Expect a wait",
    usual_music: "R&B / Top Hits",
    typical_crowd: "Buzzing",
  },
  "Loosie's": {
    typical_peak_hour: 23,
    typical_peak_label: "Heats up around 11",
    usual_cover: "$10-15",
    usual_line: "Quick entry usually",
    usual_music: "Hip-Hop / Mixed",
    typical_crowd: "Fun",
  },
  "Lost in Paradise": {
    typical_peak_hour: 23.5,
    typical_peak_label: "Gets packed around 11:30",
    usual_cover: "$20-30",
    usual_line: "Expect a line",
    usual_music: "Latin / Reggaeton",
    typical_crowd: "Packed",
  },
  "Musica": {
    typical_peak_hour: 24,
    typical_peak_label: "Late night crowd, peaks midnight",
    usual_cover: "$20-30",
    usual_line: "Expect a wait",
    usual_music: "House / EDM",
    typical_crowd: "Packed",
  },
  "Nebula": {
    typical_peak_hour: 23.5,
    typical_peak_label: "Peaks around 11:30",
    usual_cover: "$20-30",
    usual_line: "Expect a line",
    usual_music: "EDM / House",
    typical_crowd: "Buzzing",
  },
  // BARS
  "Analogue": {
    typical_peak_hour: 22.5,
    typical_peak_label: "Best vibes around 10:30",
    typical_crowd: "Chill",
    usual_line: "Walk right in",
    usual_music: "Indie / Mixed",
  },
  "Banzarbar": {
    typical_peak_hour: 23,
    typical_peak_label: "Picks up late, around 11",
    typical_crowd: "Fun",
    usual_line: "No line",
    usual_music: "Afrobeats",
  },
  "Bar Kabawa": {
    typical_peak_hour: 22,
    typical_peak_label: "Lively by 10",
    typical_crowd: "Fun",
    usual_line: "Walk right in",
    usual_music: "Hip-Hop / R&B",
  },
  "Bar Snack": {
    typical_peak_hour: 21.5,
    typical_peak_label: "Starts early, around 9:30",
    typical_crowd: "Chill",
    usual_line: "No line",
    usual_music: "Indie / Jazz",
  },
  "Dante": {
    typical_peak_hour: 21,
    typical_peak_label: "Great from early evening",
    typical_crowd: "Chill",
    usual_line: "Walk right in",
    usual_music: "Jazz / Lounge",
  },
  "Ding-a-ling": {
    typical_peak_hour: 22.5,
    typical_peak_label: "Picks up around 10:30",
    typical_crowd: "Fun",
    usual_line: "No line",
    usual_music: "Mixed / Pop",
  },
  "Hi-Note": {
    typical_peak_hour: 22,
    typical_peak_label: "Lively by 10",
    typical_crowd: "Fun",
    usual_line: "Walk right in",
    usual_music: "R&B / Soul",
  },
  "Joyface": {
    typical_peak_hour: 22.5,
    typical_peak_label: "Gets fun around 10:30",
    typical_crowd: "Fun",
    usual_line: "Walk right in",
    usual_music: "Indie / Dance",
  },
  "Katana Kitten": {
    typical_peak_hour: 21.5,
    typical_peak_label: "Best early, around 9:30",
    typical_crowd: "Chill",
    usual_line: "No line",
    usual_music: "Lounge / Jazz",
  },
  "Little Branch": {
    typical_peak_hour: 22,
    typical_peak_label: "Intimate vibes by 10",
    typical_crowd: "Chill",
    usual_line: "Small space, may wait",
    usual_music: "Jazz / Classic",
  },
  "Public Arts": {
    typical_peak_hour: 23,
    typical_peak_label: "Late crowd, around 11",
    typical_crowd: "Fun",
    usual_line: "No line usually",
    usual_music: "Mixed / Electronic",
  },
  "Saint Tuesday": {
    typical_peak_hour: 22.5,
    typical_peak_label: "Picks up around 10:30",
    typical_crowd: "Fun",
    usual_line: "Walk right in",
    usual_music: "R&B / Hip-Hop",
  },
  "Schimanski": {
    typical_peak_hour: 23.5,
    typical_peak_label: "Late crowd, peaks 11:30",
    typical_crowd: "Buzzing",
    usual_line: "Can get long",
    usual_music: "House / Techno",
  },
  "Skyline Rooftop": {
    typical_peak_hour: 21.5,
    typical_peak_label: "Best at sunset, around 9:30",
    typical_crowd: "Chill",
    usual_line: "Walk right in",
    usual_music: "Top Hits / Mixed",
  },
};

// ── MATCHING LOGIC ──────────────────────────────────────────
async function findVenue(name, overrideData) {
  // Strategy 1: Match by exact name (case-insensitive)
  let { data, error } = await supabase
    .from('venues')
    .select('id, name, google_place_id, city')
    .ilike('name', name)
    .limit(5);

  if (error) {
    console.error(`  ❌ Query error for "${name}":`, error.message);
    return null;
  }

  if (!data || data.length === 0) {
    // Try fuzzy match with partial name
    const nameWords = name.split(' ').filter(w => w.length > 2);
    if (nameWords.length > 0) {
      const searchTerm = `%${nameWords[0]}%`;
      const { data: fuzzyData, error: fuzzyError } = await supabase
        .from('venues')
        .select('id, name, google_place_id, city')
        .ilike('name', searchTerm)
        .limit(5);

      if (!fuzzyError && fuzzyData && fuzzyData.length > 0) {
        data = fuzzyData;
      }
    }
  }

  if (!data || data.length === 0) {
    console.warn(`  ⚠️  No match found for "${name}"`);
    return null;
  }

  // If multiple matches, prefer exact name match, then city match
  let match = data.find(v => v.name.toLowerCase() === name.toLowerCase());
  if (!match && overrideData.city) {
    match = data.find(v => v.city?.toLowerCase() === overrideData.city?.toLowerCase());
  }
  if (!match) {
    match = data[0]; // fallback to first result
    console.warn(`  ⚠️  Fuzzy match for "${name}" → "${match.name}" (id: ${match.id})`);
  }

  return match;
}

// ── BACKFILL ────────────────────────────────────────────────
async function run() {
  console.log(`\n🔧 DarkNite Venue Defaults Backfill`);
  console.log(`   Mode: ${DRY_RUN ? '🏜️  DRY RUN (no writes)' : '🚀 EXECUTE (writing to DB)'}`);
  console.log(`   Venues to process: ${Object.keys(VENUE_OVERRIDES).length}\n`);

  let matched = 0;
  let skipped = 0;
  let updated = 0;
  let errors = 0;

  for (const [venueName, overrides] of Object.entries(VENUE_OVERRIDES)) {
    console.log(`Processing: "${venueName}"`);

    const venue = await findVenue(venueName, overrides);
    if (!venue) {
      skipped++;
      continue;
    }
    matched++;

    const updatePayload = {
      default_crowd_label: overrides.typical_crowd || null,
      default_music_genre: overrides.usual_music || null,
      default_peak_label: overrides.typical_peak_label || null,
      default_line_note: overrides.usual_line || null,
      default_cover_note: overrides.usual_cover || null,
      defaults_source: 'backfill_v1',
      defaults_updated_at: new Date().toISOString(),
    };

    // Only set google_price_level if override has it AND DB doesn't already
    // Note: VENUE_OVERRIDES doesn't have priceLevel, so we skip this
    // if (overrides.priceLevel && !venue.google_price_level) {
    //   updatePayload.google_price_level = overrides.priceLevel;
    // }

    if (DRY_RUN) {
      console.log(`  ✅ WOULD UPDATE venue id=${venue.id} ("${venue.name}"):`);
      console.log(`     ${JSON.stringify(updatePayload, null, 2).split('\n').join('\n     ')}`);
    } else {
      const { error } = await supabase
        .from('venues')
        .update(updatePayload)
        .eq('id', venue.id);

      if (error) {
        console.error(`  ❌ Update failed for "${venue.name}":`, error.message);
        errors++;
      } else {
        console.log(`  ✅ Updated venue id=${venue.id} ("${venue.name}")`);
        updated++;
      }
    }
  }

  console.log(`\n────────────────────────────────────────`);
  console.log(`📊 Results:`);
  console.log(`   Processed: ${Object.keys(VENUE_OVERRIDES).length}`);
  console.log(`   Matched:   ${matched}`);
  console.log(`   Skipped:   ${skipped}`);
  console.log(`   Updated:   ${updated}`);
  console.log(`   Errors:    ${errors}`);
  if (DRY_RUN) {
    console.log(`\n   ℹ️  This was a dry run. Run with --execute to write changes.`);
  }
}

run().catch(console.error);
