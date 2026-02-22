import React, { useState, useEffect, useCallback, useRef } from "react";
import { getAllVenues } from "../services/venueService";
import { getLatestVibesBatch, fetchVibeWithProfile } from "../services/vibeService";
import { getLatestBarCrowdCheckIn, getLatestLineWait } from "../services/checkInService";
import { getActiveMoveCounts } from "../services/moveService";
import { getVenueKeySafe } from "../utils/venueHelpers";
import { supabase } from "../utils/supabase";

const AppContext = React.createContext(null);

// isRecent validity duration (ms)
const RECENT_VIBE_DURATION_MS = 60000;

export function AppProvider({ children }) {
  const [venues, setVenues] = useState([]);
  const [loadingVenues, setLoadingVenues] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [guestMode, setGuestMode] = useState(false);

  // Vibes (Post Vibe data)
  const [latestVibesByVenueId, setLatestVibesByVenueId] = useState({});
  const [recentVibesByVenueId, setRecentVibesByVenueId] = useState({}); // Array of recent vibes per venue
  const [latestVibesLoaded, setLatestVibesLoaded] = useState(false);

  // Check-ins (I'm here data)
  const [latestBarCrowdByVenueId, setLatestBarCrowdByVenueId] = useState({});
  const [latestLineWaitByVenueId, setLatestLineWaitByVenueId] = useState({});

  // Moves (user intent signals)
  const [moveCountsByVenueId, setMoveCountsByVenueId] = useState({});

  // Refs to prevent race conditions in refresh functions
  const isRefreshingVibesRef = useRef(false);
  const isRefreshingCheckInsRef = useRef(false);
  const isRefreshingMovesRef = useRef(false);
  const refreshVibesAbortRef = useRef(null);
  const realtimeChannelRef = useRef(null);

  // Refresh latest vibes for all venues (with race condition protection)
  const refreshLatestVibes = useCallback(async () => {
    if (venues.length === 0) return;

    if (isRefreshingVibesRef.current) {
      console.log("[AppContext] refreshLatestVibes already in progress, skipping");
      return;
    }

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

      if (!abortController.signal.aborted) {
        setLatestVibesByVenueId(vibesMap);
        // Initialize recentVibesByVenueId: convert each latest vibe to a single-item array
        const recentVibesMap = {};
        for (const [venueId, vibe] of Object.entries(vibesMap)) {
          if (vibe) {
            recentVibesMap[venueId] = [vibe];
          }
        }
        setRecentVibesByVenueId(recentVibesMap);
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

  // Refresh move counts for all venues (with race condition protection)
  const refreshMoveCounts = useCallback(async () => {
    if (venues.length === 0) return;

    if (isRefreshingMovesRef.current) {
      console.log("[AppContext] refreshMoveCounts already in progress, skipping");
      return;
    }

    isRefreshingMovesRef.current = true;

    try {
      const venueIds = venues
        .map(venue => getVenueKeySafe(venue))
        .filter(id => id !== null && id !== undefined);

      if (venueIds.length === 0) {
        setMoveCountsByVenueId({});
        return;
      }

      const counts = await getActiveMoveCounts(venueIds);
      setMoveCountsByVenueId(counts);
    } catch (error) {
      console.error("[AppContext] Error refreshing move counts:", error);
    } finally {
      isRefreshingMovesRef.current = false;
    }
  }, [venues]);

  // Optimistic update: increment move count locally
  const incrementMoveCount = useCallback((venueId) => {
    if (!venueId) return;
    const venueKey = String(venueId);
    setMoveCountsByVenueId((prev) => ({
      ...prev,
      [venueKey]: (prev[venueKey] || 0) + 1,
    }));
  }, []);

  // Handle realtime vibe INSERT
  const handleRealtimeVibeInsert = useCallback(async (payload) => {
    const newVibe = payload.new;
    if (!newVibe || !newVibe.venue_id) return;

    console.log("[AppContext] Realtime vibe received:", newVibe.id);

    try {
      // Fetch full vibe with user_profiles join for is_verified
      const fullVibe = await fetchVibeWithProfile(newVibe.id);
      if (!fullVibe) {
        console.warn("[AppContext] Could not fetch full vibe for realtime update");
        return;
      }

      // Add isRecent flag with timestamp
      fullVibe.isRecent = true;
      fullVibe._recentUntil = Date.now() + RECENT_VIBE_DURATION_MS;

      const venueKey = String(fullVibe.venue_id);

      setLatestVibesByVenueId((prev) => {
        const existingVibe = prev[venueKey];
        // Only update if this vibe is newer
        if (existingVibe && new Date(existingVibe.created_at) > new Date(fullVibe.created_at)) {
          return prev;
        }
        return {
          ...prev,
          [venueKey]: fullVibe,
        };
      });

      // Update recent vibes array (Option B: keep previous vibe in memory)
      setRecentVibesByVenueId((prev) => {
        const existing = prev[venueKey] || [];
        // Deduplicate: remove any existing vibe with the same ID before prepending
        const deduplicated = existing.filter((v) => v?.id !== fullVibe.id);
        const updated = [fullVibe, ...deduplicated]
          .filter((v) => {
            // Keep only vibes within 2 hours
            if (!v?.created_at) return false;
            const age = Date.now() - new Date(v.created_at).getTime();
            return age < 2 * 60 * 60 * 1000;
          })
          .slice(0, 5); // Keep last 5, newest first
        return { ...prev, [venueKey]: updated };
      });

      // Trigger feed re-sort
      setRefreshKey((prev) => prev + 1);

      // Clear isRecent after duration
      setTimeout(() => {
        setLatestVibesByVenueId((prev) => {
          const vibe = prev[venueKey];
          if (vibe && vibe.id === fullVibe.id && vibe._recentUntil) {
            return {
              ...prev,
              [venueKey]: { ...vibe, isRecent: false, _recentUntil: undefined },
            };
          }
          return prev;
        });
      }, RECENT_VIBE_DURATION_MS);

    } catch (error) {
      console.error("[AppContext] Error handling realtime vibe:", error);
    }
  }, []);

  // Setup Supabase Realtime subscription
  useEffect(() => {
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }

    const channel = supabase
      .channel('vibes-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'vibes',
        },
        handleRealtimeVibeInsert
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'vibes',
        },
        // Reuse the same handler: it fetches the full vibe by ID and upserts it
        // into both latestVibesByVenueId and recentVibesByVenueId (deduped by ID).
        handleRealtimeVibeInsert
      )
      .subscribe((status) => {
        console.log("[AppContext] Realtime subscription status:", status);
      });

    realtimeChannelRef.current = channel;

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [handleRealtimeVibeInsert]);

  useEffect(() => {
    async function loadVenues() {
      setLoadingVenues(true);
      const v = await getAllVenues();
      setVenues(v);
      setLoadingVenues(false);
    }
    loadVenues();
  }, []);

  // Refresh vibes, check-ins, and moves after venues load
  useEffect(() => {
    if (venues.length > 0 && !latestVibesLoaded) {
      refreshLatestVibes();
      refreshLatestCheckIns();
      refreshMoveCounts();
    }
  }, [venues, latestVibesLoaded, refreshLatestVibes, refreshLatestCheckIns, refreshMoveCounts]);

  // Periodic refresh of move counts (every 2 minutes)
  useEffect(() => {
    if (venues.length === 0) return;

    refreshMoveCounts();
    const interval = setInterval(refreshMoveCounts, 120000); // Every 2 minutes

    return () => clearInterval(interval);
  }, [venues, refreshMoveCounts]);

  // Upsert latest vibe
  const upsertLatestVibe = useCallback((vibe) => {
    if (!vibe || !vibe.venue_id) {
      console.warn("[AppContext] upsertLatestVibe called with invalid vibe:", vibe);
      return;
    }

    const venueKey = vibe.venue_id;
    
    // Update latest vibe
    setLatestVibesByVenueId((prev) => {
      const oldVibe = prev[venueKey];
      return {
        ...prev,
        [venueKey]: vibe,
      };
    });

    // Update recent vibes array (Option B: keep previous vibe in memory)
    setRecentVibesByVenueId((prev) => {
      const existing = prev[venueKey] || [];
      // Deduplicate: remove any existing vibe with the same ID before prepending
      const deduplicated = existing.filter((v) => v?.id !== vibe.id);
      const updated = [vibe, ...deduplicated]
        .filter((v) => {
          // Keep only vibes within 2 hours
          if (!v?.created_at) return false;
          const age = Date.now() - new Date(v.created_at).getTime();
          return age < 2 * 60 * 60 * 1000;
        })
        .slice(0, 5); // Keep last 5, newest first
      return { ...prev, [venueKey]: updated };
    });
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
        recentVibesByVenueId,
        latestVibesLoaded,
        upsertLatestVibe,
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
