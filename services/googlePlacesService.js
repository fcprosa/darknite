/**
 * Google Places API (New) — FieldMask-based client for v2 venue discovery.
 */
import Constants from "expo-constants";
import logger from "../utils/logger";

const log = logger.tag("GooglePlaces");

const BASE_URL = "https://places.googleapis.com/v1";

function getApiKey() {
  return (
    Constants.expoConfig?.extra?.googlePlacesApiKey ||
    process.env.GOOGLE_PLACES_API_KEY ||
    ""
  );
}

function normalizePlaceId(id) {
  if (!id) return null;
  if (id.startsWith("places/")) return id.replace("places/", "");
  return id;
}

function mapNearbyPlace(place) {
  const placeId = normalizePlaceId(place.id);
  return {
    place_id: placeId,
    name: place.displayName?.text || place.name || "Unknown",
    vicinity: place.formattedAddress || place.shortFormattedAddress || "",
    geometry: {
      location: {
        latitude: place.location?.latitude ?? 0,
        longitude: place.location?.longitude ?? 0,
      },
    },
    rating: place.rating ?? null,
    user_ratings_total: place.userRatingCount ?? 0,
    types: place.types || [],
    photoReference: place.photos?.[0]?.name || null,
  };
}

async function placesRequest(path, options = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    log.error("GOOGLE_PLACES_API_KEY is not configured");
    return { error: "missing_api_key", data: null };
  }

  const { method = "GET", body, fieldMask } = options;
  const headers = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": apiKey,
  };
  if (fieldMask) {
    headers["X-Goog-FieldMask"] = fieldMask;
  }

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      log.error("Places API error:", response.status, json);
      return { error: json?.error?.message || "places_api_error", data: null };
    }

    return { error: null, data: json };
  } catch (err) {
    log.error("Places API request failed:", err);
    return { error: err.message, data: null };
  }
}

/**
 * Nearby nightlife venues (bars + night clubs).
 */
export async function nearbyNightlife(lat, lng, radiusMeters = 1500) {
  const { error, data } = await placesRequest("/places:searchNearby", {
    method: "POST",
    fieldMask:
      "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types,places.photos",
    body: {
      includedTypes: ["bar", "night_club"],
      maxResultCount: 20,
      rankPreference: "DISTANCE",
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radiusMeters,
        },
      },
    },
  });

  if (error) return [];

  const places = (data?.places || []).map(mapNearbyPlace);
  log.log(`nearbyNightlife: ${places.length} places`);
  return places;
}

/**
 * Autocomplete suggestions for search bar.
 */
export async function autocomplete(query, sessionToken, locationBias = null) {
  if (!query || query.trim().length < 2) return [];

  const body = {
    input: query.trim(),
    includedPrimaryTypes: ["bar", "night_club"],
  };

  if (sessionToken) {
    body.sessionToken = sessionToken;
  }

  if (locationBias?.latitude && locationBias?.longitude) {
    body.locationBias = {
      circle: {
        center: {
          latitude: locationBias.latitude,
          longitude: locationBias.longitude,
        },
        radius: 5000,
      },
    };
  }

  const { error, data } = await placesRequest("/places:autocomplete", {
    method: "POST",
    fieldMask:
      "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
    body,
  });

  if (error) return [];

  return (data?.suggestions || [])
    .map((s) => s.placePrediction)
    .filter(Boolean)
    .map((prediction) => ({
      place_id: prediction.placeId,
      description: prediction.text?.text || "",
      structured_formatting: {
        main_text: prediction.structuredFormat?.mainText?.text || "",
        secondary_text: prediction.structuredFormat?.secondaryText?.text || "",
      },
    }));
}

/**
 * Full place details for venue sheet.
 */
export async function getPlaceDetails(placeId) {
  const id = normalizePlaceId(placeId);
  if (!id) return null;

  const { error, data } = await placesRequest(`/places/${id}`, {
    fieldMask:
      "id,displayName,formattedAddress,location,rating,userRatingCount,photos,regularOpeningHours,priceLevel,types",
  });

  if (error || !data) return null;

  const isClub = (data.types || []).includes("night_club");

  return {
    place_id: normalizePlaceId(data.id),
    name: data.displayName?.text || "Unknown",
    formatted_address: data.formattedAddress || "",
    geometry: {
      location: {
        latitude: data.location?.latitude ?? 0,
        longitude: data.location?.longitude ?? 0,
      },
    },
    rating: data.rating ?? null,
    user_ratings_total: data.userRatingCount ?? 0,
    opening_hours: data.regularOpeningHours || null,
    price_level: data.priceLevel ?? null,
    venue_type: isClub ? "club" : "bar",
    photos: (data.photos || []).map((p) => ({ name: p.name, widthPx: p.widthPx, heightPx: p.heightPx })),
    photoReference: data.photos?.[0]?.name || null,
  };
}

/**
 * CDN URL for a place photo resource.
 */
export function getPlacePhoto(photoReference, maxWidth = 400) {
  const apiKey = getApiKey();
  if (!photoReference || !apiKey) return null;

  const photoName = photoReference.startsWith("places/")
    ? photoReference
    : photoReference;

  return `${BASE_URL}/${photoName}/media?maxWidthPx=${maxWidth}&key=${apiKey}`;
}
