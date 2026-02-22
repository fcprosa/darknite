/**
 * scripts/seed-venue-data.js
 * 
 * One-time script to seed venue data from Google Places API.
 * Run with: node scripts/seed-venue-data.js
 * 
 * Prerequisites:
 * - GOOGLE_PLACES_API_KEY env variable
 * - SUPABASE_URL env variable  
 * - SUPABASE_SERVICE_KEY env variable (service role key, not anon key)
 * 
 * npm install @supabase/supabase-js node-fetch
 */

require("dotenv").config();
    
const { createClient } = require("@supabase/supabase-js");
const fetch = require("node-fetch");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !GOOGLE_API_KEY) {
  console.error("Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, GOOGLE_PLACES_API_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function searchGooglePlace(venueName, neighborhood) {
  const query = encodeURIComponent(`${venueName} ${neighborhood} NYC`);
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=place_id,name,price_level,rating,formatted_address&key=${GOOGLE_API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status === "OK" && data.candidates && data.candidates.length > 0) {
    return data.candidates[0];
  }
  return null;
}

function mapPriceLevelToDrinks(priceLevel) {
  switch (priceLevel) {
    case 0: return "$";
    case 1: return "$";
    case 2: return "$$";
    case 3: return "$$$";
    case 4: return "$$$$";
    default: return "$$";
  }
}

async function main() {
  console.log("Fetching venues from Supabase...");
  const { data: venues, error } = await supabase
    .from("venues")
    .select("id, name, neighborhood, venue_type, google_place_id, google_price_level");

  if (error) {
    console.error("Error fetching venues:", error);
    process.exit(1);
  }

  console.log(`Found ${venues.length} venues. Starting Google Places lookup...\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const venue of venues) {
    // Skip if already has Google data
    if (venue.google_place_id) {
      console.log(`SKIP: ${venue.name} (already has Google data)`);
      skipped++;
      continue;
    }

    try {
      const place = await searchGooglePlace(venue.name, venue.neighborhood || "");

      if (!place) {
        console.log(`MISS: ${venue.name} — no Google Places match found`);
        failed++;
        continue;
      }

      const updateData = {
        google_place_id: place.place_id || null,
        google_price_level: place.price_level ?? null,
        google_rating: place.rating ?? null,
      };

      const { error: updateError } = await supabase
        .from("venues")
        .update(updateData)
        .eq("id", venue.id);

      if (updateError) {
        console.log(`ERROR: ${venue.name} — ${updateError.message}`);
        failed++;
      } else {
        console.log(`OK: ${venue.name} — price_level=${place.price_level}, rating=${place.rating}`);
        updated++;
      }

      // Rate limiting: wait 200ms between requests
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.log(`ERROR: ${venue.name} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone! Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}`);
}

main();
