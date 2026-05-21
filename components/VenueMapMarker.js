import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Marker } from "react-native-maps";
import { useAppContext } from "../contexts/AppContext";
import { getAggregatedVibesByPlaceIds } from "../services/vibeService";
import { COLORS } from "../constants";

const sharedCounts = {};
const listeners = new Set();
let fetchTimer = null;
let inFlightKey = null;

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

function scheduleBatchFetch(placeIds) {
  const ids = [...new Set(placeIds.filter(Boolean))];
  const key = ids.sort().join("|");
  if (!key) return;

  if (inFlightKey === key) return;

  if (fetchTimer) clearTimeout(fetchTimer);

  fetchTimer = setTimeout(async () => {
    fetchTimer = null;
    inFlightKey = key;
    try {
      const aggregated = await getAggregatedVibesByPlaceIds(ids);
      for (const id of ids) {
        sharedCounts[id] = aggregated[id]?.count ?? 0;
      }
      notifyListeners();
    } catch (err) {
      console.error("[VenueMapMarker] batch vibe counts error:", err);
    } finally {
      inFlightKey = null;
    }
  }, 400);
}

// Called once from MapScreen when nearbyPlaces changes — not per-marker.
export function triggerVibeCounts(places) {
  const ids = (places || []).map((p) => p.place_id);
  scheduleBatchFetch(ids);
}

function usePlaceVibeCount(placeId) {
  const [count, setCount] = useState(sharedCounts[placeId] ?? 0);

  useEffect(() => {
    // Sync immediately in case sharedCounts was already populated
    setCount(sharedCounts[placeId] ?? 0);

    const onUpdate = () => setCount(sharedCounts[placeId] ?? 0);
    listeners.add(onUpdate);
    return () => listeners.delete(onUpdate);
  }, [placeId]);

  return count;
}

export default function VenueMapMarker({ place, onPress }) {
  const { latitude, longitude } = place.geometry?.location || {};
  const vibeCount = usePlaceVibeCount(place.place_id);

  if (!latitude || !longitude) return null;

  return (
    <Marker
      coordinate={{ latitude, longitude }}
      onPress={() => onPress?.(place)}
      tracksViewChanges={false}
    >
      <View style={styles.pinContainer}>
        <View style={styles.pin}>
          <View style={styles.pinDot} />
        </View>
        {vibeCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {vibeCount > 99 ? "99+" : vibeCount}
            </Text>
          </View>
        ) : null}
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  pinContainer: {
    alignItems: "center",
  },
  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.primaryGlow,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 4,
  },
  pinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.textPrimary,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: COLORS.background,
  },
  badgeText: {
    color: COLORS.background,
    fontSize: 10,
    fontWeight: "700",
  },
});
