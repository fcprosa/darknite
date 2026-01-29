import React, { useState, useEffect, useCallback, useRef } from "react";
import { getAllVenues } from "../services/venueService";
import { getLatestVibesBatch } from "../services/vibeService";
import { getLatestBarCrowdCheckIn, getLatestLineWait } from "../services/checkInService";
import { getVenueKeySafe } from "../utils/venueHelpers";

const AppContext = React.createContext(null);

export function AppProvider({ children }) {
  const [venues, setVenues] = useState([]);
  const [loadingVenues, setLoadingVenues] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [guestMode, setGuestMode] = useState(false);

  // Vibes (Post Vibe data)
  const [latestVibesByVenueId, setLatestVibesByVenueId] = useState({});
  const [latestVibesLoaded, setLatestVibesLoaded] = useState(false);

  // Check-ins (I'm here data)
  const [latestBarCrowdByVenueId, setLatestBarCrowdByVenueId] = useState({});
  const [latestLineWaitByVenueId, setLatestLineWaitByVenueId] = useState({});

  // Refs to prevent race conditions in refresh functions
  const isRefreshingVibesRef = useRef(false);
  const isRefreshingCheckInsRef = useRef(false);
  const refreshVibesAbortRef = useRef(null);

  // Refresh latest vibes for all venues (with race condition protection)
  const refreshLatestVibes = useCallback(async () => {
    if (venues.length === 0) return;

    // Prevent concurrent refreshes - if already refreshing, skip
    if (isRefreshingVibesRef.current) {
      console.log("[AppContext] refreshLatestVibes already in progress, skipping");
      return;
    }

    // Create abort controller for this refresh
    const abortController = new AbortController();
    refreshVibesAbortRef.current = abortController;
    isRefreshingVibesRef.current = true;

    try {
      const venueIds = venues
        .map(venue => getVenueKeySafe(venue))
        .filter(id => id !== null && id !== undefined);

      if (venueIds.length === 0) {
        setLatestVibesLoaded(true);
        return;
      }

      const vibesMap = await getLatestVibesBatch(venueIds);

      // Only update state if this refresh wasn't aborted
      if (!abortController.signal.aborted) {
        setLatestVibesByVenueId(vibesMap);
        setLatestVibesLoaded(true);
      }
    } catch (error) {
      if (!abortController.signal.aborted) {
        console.error("[AppContext] Error refreshing latest vibes:", error);
        setLatestVibesLoaded(true);
      }
    } finally {
      isRefreshingVibesRef.current = false;
    }
  }, [venues]);

  // Refresh latest check-ins for all venues (with race condition protection)
  const refreshLatestCheckIns = useCallback(async () => {
    if (venues.length === 0) return;

    // Prevent concurrent refreshes
    if (isRefreshingCheckInsRef.current) {
      console.log("[AppContext] refreshLatestCheckIns already in progress, skipping");
      return;
    }

    isRefreshingCheckInsRef.current = true;

    try {
      const barCrowdMap = {};
      const lineWaitMap = {};

      await Promise.all(
        venues.map(async (venue) => {
          const venueId = getVenueKeySafe(venue);
          if (!venueId) return;

          const isBar = venue.venue_type === "bar";
          const isClub = venue.venue_type === "club";

          if (isBar) {
            const { data } = await getLatestBarCrowdCheckIn(venueId, 240);
            if (data) {
              barCrowdMap[venueId] = data;
            }
          }

          if (isClub) {
            const { data } = await getLatestLineWait(venueId, 120);
            if (data?.line_wait) {
              lineWaitMap[venueId] = data.line_wait;
            }
          }
        })
      );

      setLatestBarCrowdByVenueId(barCrowdMap);
      setLatestLineWaitByVenueId(lineWaitMap);
    } catch (error) {
      console.error("[AppContext] Error refreshing check-ins:", error);
    } finally {
      isRefreshingCheckInsRef.current = false;
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

  // Refresh vibes and check-ins after venues load
  useEffect(() => {
    if (venues.length > 0 && !latestVibesLoaded) {
      refreshLatestVibes();
      refreshLatestCheckIns();
    }
  }, [venues, latestVibesLoaded, refreshLatestVibes, refreshLatestCheckIns]);

  // Upsert latest vibe
  const upsertLatestVibe = useCallback((vibe) => {
    if (!vibe || !vibe.venue_id) {
      console.warn("[AppContext] upsertLatestVibe called with invalid vibe:", vibe);
      return;
    }
    
    const venueKey = vibe.venue_id;
    setLatestVibesByVenueId((prev) => ({
      ...prev,
      [venueKey]: vibe,
    }));
  }, []);

  // Upsert latest bar crowd check-in
  const upsertLatestBarCrowd = useCallback((venueId, checkInData) => {
    if (!venueId || !checkInData) {
      console.warn("[AppContext] upsertLatestBarCrowd: invalid data");
      return;
    }
    
    setLatestBarCrowdByVenueId((prev) => ({
      ...prev,
      [venueId]: checkInData,
    }));
  }, []);

  // Upsert latest line wait check-in
  const upsertLatestLineWait = useCallback((venueId, lineWait) => {
    if (!venueId || !lineWait) {
      console.warn("[AppContext] upsertLatestLineWait: invalid data");
      return;
    }
    
    setLatestLineWaitByVenueId((prev) => ({
      ...prev,
      [venueId]: lineWait,
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
        latestBarCrowdByVenueId,
        latestLineWaitByVenueId,
        upsertLatestBarCrowd,
        upsertLatestLineWait,
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