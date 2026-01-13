import React, { useState, useEffect } from "react";
import { supabase } from "../utils/supabase";

// Fallback local (if Supabase fails completely)
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

// Fetch venues from table `venues`
async function fetchVenues() {
  const { data, error } = await supabase
    .from("venues")
    .select("id, name, neighborhood, default_guys, default_girls, venue_type, lat, lng")
    .order("name", { ascending: true });

  if (error) {
    console.log("Error fetching venues:", error.message);
    return FALLBACK_VENUES;
  }

  if (!data || data.length === 0) {
    return FALLBACK_VENUES;
  }

  return data.map((row) => {
    // Normalize venue_type to lowercase, keep as-is from DB (no defaulting)
    const venueType = row.venue_type ? row.venue_type.trim().toLowerCase() : null;
    if (!venueType) {
      console.warn(`[fetchVenues] Warning: venue "${row.name}" has null/undefined venue_type`);
    }
    return {
      id: row.id, // ex: "Gospel"
      name: row.name,
      neighborhood: row.neighborhood,
      guys: row.default_guys ?? 50,
      girls: row.default_girls ?? 50,
      venue_type: venueType, // Normalized lowercase: "club" or "bar" or null
      lat: row.lat || null,
      lng: row.lng || null,
    };
  });
}

const AppContext = React.createContext(null);

export function AppProvider({ children }) {
  const [venues, setVenues] = useState(FALLBACK_VENUES);
  const [loadingVenues, setLoadingVenues] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [guestMode, setGuestMode] = useState(false);

  useEffect(() => {
    async function loadVenues() {
      setLoadingVenues(true);
      const v = await fetchVenues();
      setVenues(v);
      setLoadingVenues(false);
    }
    loadVenues();
  }, []);

  return (
    <AppContext.Provider
      value={{
        venues,
        loadingVenues,
        refreshKey,
        setRefreshKey: () => setRefreshKey((prev) => prev + 1),
        guestMode,
        setGuestMode,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = React.useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within AppProvider");
  }
  return context;
}
