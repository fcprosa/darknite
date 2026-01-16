import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import VenueCardLovable from "./VenueCardLovable";
import { useAuth } from "../contexts/AuthContext";
import { useAppContext } from "../contexts/AppContext";
import { getRecentVibes } from "../services/vibeService";
import { getVenuesByIds } from "../services/venueService";
import { getHotnessScore } from "../utils/scoreHelpers";
import * as CONSTANTS from "../constants";
import { getVenueKeySafe } from "../utils/venueHelpers";

// Helper function: map ratio label to percentages
function mapRatioToPercent(ratioLabel) {
  switch (ratioLabel) {
    case "Mostly guys":
      return { guys: 70, girls: 30 };
    case "Balanced":
      return { guys: 50, girls: 50 };
    case "Mostly girls":
      return { guys: 30, girls: 70 };
    default:
      return { guys: 50, girls: 50 };
  }
}


function HomeScreen({ navigation, tabNavigation, venues, onOpenVenue, onOpenSheet, refreshKey, selectedVenue, setSelectedVenue }) {
  const { setShowAuthModal, isAuthenticated } = useAuth();
  const { latestVibesByVenueId, upsertLatestVibe } = useAppContext();
  const isLoggedIn = isAuthenticated;
  const [feedMode, setFeedMode] = useState("forYou"); // "forYou" | "hotNow"
  const [hotNowVenues, setHotNowVenues] = useState([]); // Venues with recent vibes
  const [hotNowLoading, setHotNowLoading] = useState(false);

  // Load Hot Now venues (venues with vibes in last 30 minutes)
  useEffect(() => {
    if (feedMode !== "hotNow") return;

    let cancelled = false;

    async function loadHotNow() {
      setHotNowLoading(true);
      try {
        // Fetch vibes from last 30 minutes
        const vibesData = await getRecentVibes({ minutes: 30, limit: 100 });

        if (!vibesData || vibesData.length === 0) {
          if (!cancelled) {
            setHotNowVenues([]);
            setHotNowLoading(false);
          }
          return;
        }

        // Build ordered unique venueIds from vibes (keep first occurrence = latest)
        const vibeMap = new Map();
        const venueIds = [];
        for (const vibe of vibesData) {
          if (!vibeMap.has(vibe.venue_id)) {
            vibeMap.set(vibe.venue_id, vibe);
            venueIds.push(vibe.venue_id);
          }
        }

        // Sync with latestVibesByVenueId context: upsert each vibe if it's newest for that venue
        for (const vibe of vibesData) {
          const venueKey = vibe.venue_id;
          const existingVibe = latestVibesByVenueId[venueKey];
          if (!existingVibe || new Date(vibe.created_at) > new Date(existingVibe.created_at)) {
            upsertLatestVibe(vibe);
          }
        }

        // Fetch venues for those venue_ids
        const venuesData = await getVenuesByIds(venueIds);

        if (!venuesData || venuesData.length === 0) {
          if (!cancelled) {
            setHotNowVenues([]);
            setHotNowLoading(false);
          }
          return;
        }

        // Create a map of venue by id for quick lookup
        const venueMap = new Map(venuesData.map(v => [v.id, v]));

        // Sort venues to match venueIds order (maintain vibe recency order)
        const sortedVenues = venueIds
          .map(id => venueMap.get(id))
          .filter(Boolean);

        // Join in-memory: create list with venue + latestVibe + guys/girls
        const hotNowList = sortedVenues.map((venue) => {
          const vibe = vibeMap.get(venue.id);
          const ratio = vibe?.ratio ? mapRatioToPercent(vibe.ratio) : null;
          return {
            venue,
            latestVibe: vibe || null,
            guys: ratio?.guys ?? venue.default_guys ?? 50,
            girls: ratio?.girls ?? venue.default_girls ?? 50,
            created_at: vibe?.created_at || null,
          };
        });

        if (!cancelled) {
          setHotNowVenues(hotNowList);
          setHotNowLoading(false);
        }
      } catch (error) {
        console.error("[Home] Error in loadHotNow:", error);
        if (!cancelled) {
          setHotNowVenues([]);
          setHotNowLoading(false);
        }
      }
    }

    loadHotNow();

    // Periodic refresh every 60 seconds while Hot Now is active
    const intervalId = setInterval(() => {
      if (feedMode === "hotNow" && !cancelled) {
        loadHotNow();
      }
    }, 60000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [feedMode, refreshKey, latestVibesByVenueId, upsertLatestVibe]);

  // Sort venues by hotness score for "For You" feed (memoized for performance)
  const sortedVenues = useMemo(() => {
    if (feedMode === "hotNow") {
      // Return hot now venues (already sorted)
      return hotNowVenues.map((item) => item.venue);
    }
    
    const baseVenues = isLoggedIn ? venues : venues.slice(0, CONSTANTS.PREVIEW_VENUE_LIMIT);
    
    if (feedMode === "forYou") {
      // Sort by hotness score
      return [...baseVenues].sort((a, b) => {
        const keyA = getVenueKeySafe(a) || a.id || a.name;
        const keyB = getVenueKeySafe(b) || b.id || b.name;
        const vibeA = latestVibesByVenueId[keyA];
        const vibeB = latestVibesByVenueId[keyB];
        const scoreA = getHotnessScore(vibeA);
        const scoreB = getHotnessScore(vibeB);
        return scoreB - scoreA; // Descending order
      });
    }
    
    return baseVenues;
  }, [venues, feedMode, hotNowVenues, latestVibesByVenueId, isLoggedIn]);
  
  // Get latest vibe for a venue (works for both feed modes)
  const getVenueData = (venue) => {
    if (feedMode === "hotNow") {
      const hotNowItem = hotNowVenues.find((item) => item.venue.id === venue.id);
      if (hotNowItem) {
        return {
          latestVibe: hotNowItem.latestVibe,
        };
      }
    }
    // Use latestVibesByVenueId from context as single source of truth
    const key = getVenueKeySafe(venue) || venue.id || venue.name;
    const latestVibe = latestVibesByVenueId?.[key] ?? null;
    return {
      latestVibe,
    };
  };

  // Handle FAB press for posting vibes
  const handleFABPress = () => {
    if (!isLoggedIn) {
      // Not authenticated - prompt to sign in
      Alert.alert(
        "Sign in required",
        "Please sign in to post vibes",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Sign in",
            onPress: () => setShowAuthModal(true),
          },
        ]
      );
      return;
    }
    console.log("[Home] FAB pressed, navigating to VenuePicker");
    // Navigate to venue picker screen
    navigation.navigate("VenuePicker");
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.logo}>DarkNite</Text>
          <Text style={styles.headerSubtitle}>Feed · Live vibes</Text>
        </View>
        <TouchableOpacity
          onPress={() => tabNavigation?.navigate("ProfileTab")}
          style={styles.mapIconButton}
        >
          <Ionicons name="person-circle-outline" size={28} color="#A855F7" />
        </TouchableOpacity>
      </View>

      {!isLoggedIn && (
        <View style={styles.previewModeBadge}>
          <Text style={styles.previewModeText}>Preview mode</Text>
        </View>
      )}

      {/* For You / Hot Now Toggle */}
      <View style={styles.feedToggleContainer}>
        <TouchableOpacity
          style={[styles.feedToggleButton, feedMode === "forYou" && styles.feedToggleButtonActive]}
          onPress={() => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (e) {}
            setFeedMode("forYou");
          }}
        >
          <Text style={[styles.feedToggleText, feedMode === "forYou" && styles.feedToggleTextActive]}>
            For You
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.feedToggleButton, feedMode === "hotNow" && styles.feedToggleButtonActive]}
          onPress={() => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (e) {}
            setFeedMode("hotNow");
          }}
        >
          <Text style={[styles.feedToggleText, feedMode === "hotNow" && styles.feedToggleTextActive]}>
            Hot Now
          </Text>
        </TouchableOpacity>
      </View>

      {feedMode === "hotNow" && hotNowLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading hot venues…</Text>
        </View>
      ) : (
        <FlatList
          data={sortedVenues}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListEmptyComponent={
            feedMode === "hotNow" ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Nothing hot right now</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const venueData = getVenueData(item);
            return (
              <VenueCardLovable
                venue={item}
                onPress={() => onOpenVenue(item)}
                latestVibe={venueData.latestVibe}
              />
            );
          }}
        />
      )}

      {/* Floating Action Button (FAB) */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleFABPress}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+ Post Vibe</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    alignItems: "center",
  },
  headerLeft: {
    flex: 1,
  },
  logo: {
    fontSize: 24,
    fontWeight: "800",
    color: "#F5F3FF",
  },
  headerSubtitle: {
    color: "#9CA3AF",
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  mapIconButton: {
    padding: 4,
  },
  previewModeBadge: {
    alignSelf: "flex-start",
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: "rgba(168,85,247,0.15)",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  previewModeText: {
    color: "#A855F7",
    fontSize: 11,
    fontWeight: "600",
  },
  feedToggleContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: "rgba(168,85,247,0.1)",
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.2)",
  },
  feedToggleButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  feedToggleButtonActive: {
    backgroundColor: "#A855F7",
  },
  feedToggleText: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "600",
  },
  feedToggleTextActive: {
    color: "#F9FAFB",
    fontWeight: "700",
  },
  nearYouHint: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(168,85,247,0.1)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.2)",
  },
  nearYouHintText: {
    color: "#A855F7",
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
  loadingText: {
    color: "#E5E7EB",
    fontSize: 14,
  },
  emptyContainer: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    color: "#9CA3AF",
    fontSize: 14,
  },
  fab: {
    position: "absolute",
    bottom: CONSTANTS.FAB_BOTTOM_OFFSET,
    right: 16,
    backgroundColor: "#A855F7",
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 20,
    shadowColor: "#A855F7",
    shadowOpacity: 0.8,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  fabText: {
    color: "#F9FAFB",
    fontSize: 15,
    fontWeight: "700",
    marginLeft: 4,
  },
});

export default function HomeScreenWrapper(props) {
  return <HomeScreen {...props} />;
}

