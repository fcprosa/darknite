import { supabase } from "../utils/supabase";
import logger from "../utils/logger";

const log = logger.tag("VenueService");

// Fallback venues if database fails
const FALLBACK_VENUES = [
  { id: "Gospel", name: "Gospel", neighborhood: "SoHo", guys: 50, girls: 50, venue_type: "club" },
  {
    id: "Schimanski",
    name: "Schimanski",
    neighborhood: "Williamsburg",
    guys: 50,
    girls: 50,
    venue_type: "bar",
  },
  {
    id: "Skyline",
    name: "Skyline Rooftop",
    neighborhood: "Midtown",
    guys: 50,
    girls: 50,
    venue_type: "bar",
  },
  {
    id: "PublicArts",
    name: "Public Arts",
    neighborhood: "Lower East Side",
    guys: 50,
    girls: 50,
    venue_type: "bar",
  },
];

/**
 * Fetch all venues
 * @returns {Promise<Array>} Array of venue objects
 */
export async function getAllVenues() {
  try {
    const { data, error } = await supabase
      .from("venues")
      .select("id, name, neighborhood, default_guys, default_girls, venue_type, lat, lng")
      .order("name", { ascending: true });

    if (error) {
      log.error("Error fetching venues:", { count: 0, "error.code": error.code, "error.message": error.message });
      return FALLBACK_VENUES;
    }

    const count = data?.length || 0;
    log.log("getAllVenues success:", { count, "error.code": null, "error.message": null });

    if (!data || data.length === 0) {
      log.warn("getAllVenues returned empty result, using fallback");
      return FALLBACK_VENUES;
    }

    return data.map((row) => {
      const venueType = row.venue_type ? row.venue_type.trim().toLowerCase() : null;
      if (!venueType) {
        log.warn(`Warning: venue "${row.name}" has null/undefined venue_type`);
      }
      return {
        id: row.id,
        name: row.name,
        neighborhood: row.neighborhood,
        guys: row.default_guys ?? 50,
        girls: row.default_girls ?? 50,
        venue_type: venueType,
        lat: row.lat || null,
        lng: row.lng || null,
      };
    });
  } catch (error) {
    log.error("Exception fetching venues:", { count: 0, "error.code": error.code, "error.message": error.message });
    return FALLBACK_VENUES;
  }
}

/**
 * Fetch venues by type
 * @param {string} venueType - 'club' or 'bar'
 * @returns {Promise<Array>} Array of venue objects
 */
export async function getVenuesByType(venueType) {
  try {
    const { data, error } = await supabase
      .from("venues")
      .select("id, name, neighborhood, default_guys, default_girls, venue_type")
      .eq("venue_type", venueType)
      .order("name", { ascending: true });

    if (error) {
      log.error("Error fetching venues by type:", { count: 0, "error.code": error.code, "error.message": error.message, venueType });
      return [];
    }

    const count = data?.length || 0;
    log.log("getVenuesByType success:", { count, "error.code": null, "error.message": null, venueType });

    return (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      neighborhood: row.neighborhood,
      guys: row.default_guys ?? 50,
      girls: row.default_girls ?? 50,
      venue_type: row.venue_type ? row.venue_type.trim().toLowerCase() : null,
    }));
  } catch (error) {
    log.error("Exception fetching venues by type:", { count: 0, "error.code": error.code, "error.message": error.message, venueType });
    return [];
  }
}

/**
 * Fetch a single venue by ID
 * @param {string} venueId - Venue ID
 * @returns {Promise<Object|null>} Venue object or null
 */
export async function getVenueById(venueId) {
  if (!venueId) return null;

  try {
    const { data, error } = await supabase
      .from("venues")
      .select("id, name, neighborhood, default_guys, default_girls, venue_type")
      .eq("id", venueId)
      .maybeSingle();

    if (error) {
      log.error("Error fetching venue by ID:", { count: 0, "error.code": error.code, "error.message": error.message, venueId });
      return null;
    }

    const count = data ? 1 : 0;
    log.log("getVenueById success:", { count, "error.code": null, "error.message": null, venueId });

    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      neighborhood: data.neighborhood,
      guys: data.default_guys ?? 50,
      girls: data.default_girls ?? 50,
      venue_type: data.venue_type ? data.venue_type.trim().toLowerCase() : null,
    };
  } catch (error) {
    log.error("Exception fetching venue by ID:", { count: 0, "error.code": error.code, "error.message": error.message, venueId });
    return null;
  }
}

/**
 * Fetch venue type only
 * @param {string} venueId - Venue ID
 * @returns {Promise<string|null>} Venue type ('club' or 'bar') or null
 */
export async function getVenueType(venueId) {
  if (!venueId) return null;

  try {
    const { data, error } = await supabase
      .from("venues")
      .select("venue_type")
      .eq("id", venueId)
      .maybeSingle();

    if (error) {
      log.error("Error fetching venue type:", { count: 0, "error.code": error.code, "error.message": error.message, venueId });
      return null;
    }

    const count = data ? 1 : 0;
    log.log("getVenueType success:", { count, "error.code": null, "error.message": null, venueId });
    return data?.venue_type ? data.venue_type.trim().toLowerCase() : null;
  } catch (error) {
    log.error("Exception fetching venue type:", { count: 0, "error.code": error.code, "error.message": error.message, venueId });
    return null;
  }
}

/**
 * Fetch venues by IDs
 * @param {Array<string>} venueIds - Array of venue IDs
 * @returns {Promise<Array>} Array of venue objects
 */
export async function getVenuesByIds(venueIds) {
  if (!venueIds || venueIds.length === 0) return [];

  try {
    const { data, error } = await supabase
      .from("venues")
      .select("id, name, neighborhood, default_guys, default_girls, venue_type")
      .in("id", venueIds);

    if (error) {
      log.error("Error fetching venues by IDs:", { count: 0, "error.code": error.code, "error.message": error.message, requestedCount: venueIds.length });
      return [];
    }

    const count = data?.length || 0;
    log.log("getVenuesByIds success:", { count, "error.code": null, "error.message": null, requestedCount: venueIds.length });

    return (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      neighborhood: row.neighborhood,
      guys: row.default_guys ?? 50,
      girls: row.default_girls ?? 50,
      venue_type: row.venue_type ? row.venue_type.trim().toLowerCase() : null,
    }));
  } catch (error) {
    log.error("Exception fetching venues by IDs:", { count: 0, "error.code": error.code, "error.message": error.message, requestedCount: venueIds.length });
    return [];
  }
}

/**
 * Fetch venues by type and neighborhood
 * @param {string} venueType - 'club' or 'bar'
 * @param {string} neighborhood - Neighborhood name
 * @returns {Promise<Array>} Array of venue objects
 */
export async function getVenuesByTypeAndNeighborhood(venueType, neighborhood) {
  try {
    const { data, error } = await supabase
      .from("venues")
      .select("id, name, neighborhood, default_guys, default_girls, venue_type")
      .eq("venue_type", venueType)
      .eq("neighborhood", neighborhood)
      .order("name", { ascending: true });

    if (error) {
      log.error("Error fetching venues by type and neighborhood:", { count: 0, "error.code": error.code, "error.message": error.message, venueType, neighborhood });
      return [];
    }

    const count = data?.length || 0;
    log.log("getVenuesByTypeAndNeighborhood success:", { count, "error.code": null, "error.message": null, venueType, neighborhood });

    return (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      neighborhood: row.neighborhood || "Unknown",
      guys: row.default_guys ?? 50,
      girls: row.default_girls ?? 50,
      venue_type: row.venue_type ? row.venue_type.trim().toLowerCase() : null,
    }));
  } catch (error) {
    log.error("Exception fetching venues by type and neighborhood:", { count: 0, "error.code": error.code, "error.message": error.message, venueType, neighborhood });
    return [];
  }
}

/**
 * Fetch unique neighborhoods from venues
 * @returns {Promise<Array<string>>} Array of unique neighborhood names
 */
export async function getNeighborhoods() {
  try {
    const { data, error } = await supabase
      .from("venues")
      .select("neighborhood")
      .not("neighborhood", "is", null);

    if (error) {
      log.error("Error fetching neighborhoods:", { count: 0, "error.code": error.code, "error.message": error.message });
      return [];
    }

    const unique = [...new Set((data || []).map(v => v.neighborhood))].sort();
    const count = unique.length;
    log.log("getNeighborhoods success:", { count, "error.code": null, "error.message": null });
    return unique;
  } catch (error) {
    log.error("Exception fetching neighborhoods:", { count: 0, "error.code": error.code, "error.message": error.message });
    return [];
  }
}

