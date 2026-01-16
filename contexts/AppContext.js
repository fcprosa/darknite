import React, { useState, useEffect, useCallback } from "react";
import { getAllVenues } from "../services/venueService";
import { getLatestVibesBatch } from "../services/vibeService";
import { getVenueKeySafe } from "../utils/venueHelpers";

const AppContext = React.createContext(null);

export function AppProvider({ children }) {
  const [venues, setVenues] = useState([]);
  const [loadingVenues, setLoadingVenues] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [guestMode, setGuestMode] = useState(false);
  const [latestVibesByVenueId, setLatestVibesByVenueId] = useState({}); // { [venueId]: vibe }
  const [latestVibesLoaded, setLatestVibesLoaded] = useState(false);

  // Refresh latest vibes for all venues (batch request to avoid N+1 problem)
  const refreshLatestVibes = useCallback(async () => {
    if (venues.length === 0) {
      return;
    }

    try {
      // Extract all valid venue IDs
      const venueIds = venues
        .map(venue => getVenueKeySafe(venue))
        .filter(id => id !== null && id !== undefined);

      if (venueIds.length === 0) {
        setLatestVibesLoaded(true);
        return;
      }

      // Fetch all latest vibes in a single batch request
      const vibesMap = await getLatestVibesBatch(venueIds);
      
      setLatestVibesByVenueId(vibesMap);
      setLatestVibesLoaded(true);
    } catch (error) {
      console.error("[AppContext] Error refreshing latest vibes:", error);
      // Still set loaded to true to prevent infinite retries
      setLatestVibesLoaded(true);
    }
  }, [venues]);

  useEffect(() => {
    async function loadVenues() {
      setLoadingVenues(true);
      const v = await getAllVenues();
      setVenues(v);
      setLoadingVenues(false);
    }
    loadVenues();
  }, []);

  // Refresh latest vibes after venues load
  useEffect(() => {
    if (venues.length > 0 && !latestVibesLoaded) {
      refreshLatestVibes();
    }
  }, [venues, latestVibesLoaded, refreshLatestVibes]);

  // Upsert latest vibe into the central map
  const upsertLatestVibe = useCallback((vibe) => {
    if (!vibe || !vibe.venue_id) {
      console.warn("[AppContext] upsertLatestVibe called with invalid vibe:", vibe);
      return;
    }
    
    const venueKey = vibe.venue_id; // venue_id is already the venue ID
    setLatestVibesByVenueId((prev) => ({
      ...prev,
      [venueKey]: vibe,
    }));
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
        latestVibesByVenueId,
        latestVibesLoaded,
        upsertLatestVibe,
        refreshLatestVibes,
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
