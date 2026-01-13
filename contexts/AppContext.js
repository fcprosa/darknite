import React, { useState, useEffect, useCallback } from "react";
import { getAllVenues } from "../services/venueService";
import { getVenueKeySafe } from "../utils/venueHelpers";

const AppContext = React.createContext(null);

export function AppProvider({ children }) {
  const [venues, setVenues] = useState([]);
  const [loadingVenues, setLoadingVenues] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [guestMode, setGuestMode] = useState(false);
  const [latestVibesByVenueId, setLatestVibesByVenueId] = useState({}); // { [venueId]: vibe }

  useEffect(() => {
    async function loadVenues() {
      setLoadingVenues(true);
      const v = await getAllVenues();
      setVenues(v);
      setLoadingVenues(false);
    }
    loadVenues();
  }, []);

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
        upsertLatestVibe,
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
