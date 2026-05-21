import React, { useState, useEffect, useCallback, useRef } from "react";
import { fetchVibeWithProfile } from "../services/vibeService";
import { supabase } from "../utils/supabase";
import * as Location from "expo-location";

const AppContext = React.createContext(null);

const RECENT_VIBE_DURATION_MS = 60000;

export function AppProvider({ children }) {
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [vibesByPlaceId, setVibesByPlaceId] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [guestMode, setGuestMode] = useState(false);

  const [locationReady, setLocationReady] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  const [latestBarCrowdByVenueId, setLatestBarCrowdByVenueId] = useState({});
  const [latestLineWaitByVenueId, setLatestLineWaitByVenueId] = useState({});
  const [moveCountsByVenueId, setMoveCountsByVenueId] = useState({});

  const realtimeChannelRef = useRef(null);

  const upsertVibeForPlace = useCallback((vibe) => {
    const placeKey = vibe?.place_id || vibe?.venue_id;
    if (!vibe || !placeKey) {
      console.warn("[AppContext] upsertVibeForPlace: invalid vibe", vibe);
      return;
    }

    setVibesByPlaceId((prev) => ({
      ...prev,
      [String(placeKey)]: vibe,
    }));
    setRefreshKey((k) => k + 1);
  }, []);

  const handleRealtimeVibeInsert = useCallback(
    async (payload) => {
      const newVibe = payload.new;
      const placeKey = newVibe?.place_id || newVibe?.venue_id;
      if (!newVibe || !placeKey) return;

      try {
        const fullVibe = await fetchVibeWithProfile(newVibe.id);
        if (fullVibe) {
          fullVibe.isRecent = true;
          upsertVibeForPlace(fullVibe);
        }
      } catch (error) {
        console.error("[AppContext] Realtime vibe error:", error);
      }
    },
    [upsertVibeForPlace]
  );

  useEffect(() => {
    const channel = supabase
      .channel("vibes-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "vibes" },
        handleRealtimeVibeInsert
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "vibes" },
        handleRealtimeVibeInsert
      )
      .subscribe();

    realtimeChannelRef.current = channel;
    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, [handleRealtimeVibeInsert]);

  useEffect(() => {
    let mounted = true;
    const LOCATION_TIMEOUT_MS = 8000;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!mounted) return;

        if (status === "granted") {
          const locationPromise = Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("location_timeout")), LOCATION_TIMEOUT_MS)
          );

          try {
            const loc = await Promise.race([locationPromise, timeoutPromise]);
            if (mounted && loc) setUserLocation(loc);
          } catch {
            // proceed without coords
          }
        }
      } catch {
        // permission API failed
      }

      if (mounted) setLocationReady(true);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const refreshMoveCounts = useCallback(async () => {
    setMoveCountsByVenueId({});
  }, []);

  const incrementMoveCount = useCallback((venueId) => {
    if (!venueId) return;
    setMoveCountsByVenueId((prev) => ({
      ...prev,
      [String(venueId)]: (prev[String(venueId)] || 0) + 1,
    }));
  }, []);

  const upsertLatestBarCrowd = useCallback((venueId, checkInData) => {
    if (!venueId || !checkInData) return;
    setLatestBarCrowdByVenueId((prev) => ({
      ...prev,
      [venueId]: checkInData,
    }));
  }, []);

  const upsertLatestLineWait = useCallback((venueId, lineWait) => {
    if (!venueId || !lineWait) return;
    setLatestLineWaitByVenueId((prev) => ({
      ...prev,
      [venueId]: lineWait,
    }));
  }, []);

  const refreshLatestVibes = useCallback(async () => {}, []);

  return (
    <AppContext.Provider
      value={{
        nearbyPlaces,
        setNearbyPlaces,
        vibesByPlaceId,
        upsertVibeForPlace,
        refreshKey,
        setRefreshKey: () => setRefreshKey((prev) => prev + 1),
        guestMode,
        setGuestMode,
        locationReady,
        userLocation,
        // Shims for legacy consumers until Phase 3
        venues: nearbyPlaces,
        loadingVenues: false,
        latestVibesByVenueId: vibesByPlaceId,
        recentVibesByVenueId: {},
        latestVibesLoaded: true,
        upsertLatestVibe: upsertVibeForPlace,
        refreshLatestVibes,
        latestBarCrowdByVenueId,
        latestLineWaitByVenueId,
        upsertLatestBarCrowd,
        upsertLatestLineWait,
        moveCountsByVenueId,
        refreshMoveCounts,
        incrementMoveCount,
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
