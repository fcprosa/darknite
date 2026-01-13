import React, { useState, useEffect } from "react";
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
import { getHotNowVibes } from "../services/vibeService";
import { getVenuesByIds } from "../services/venueService";
import { getHotnessScore } from "../utils/scoreHelpers";
import * as CONSTANTS from "../constants";

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
  const isLoggedIn = isAuthenticated;
  const [ratios, setRatios] = useState({}); // { [venueId]: { guys, girls } }
  const [latestVibes, setLatestVibes] = useState({}); // { [venueId]: vibe }
  const [feedMode, setFeedMode] = useState("forYou"); // "forYou" | "hotNow"
  const [hotNowVenues, setHotNowVenues] = useState([]); // Venues with recent vibes
  const [hotNowLoading, setHotNowLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadRatios() {
      const nextRatios = {};
      const nextVibes = {};
      for (const v of venues) {
        const key = v.id || v.name;
        const vibe = await getLatestVibe(key);
        if (vibe) {
          nextVibes[key] = vibe;
          if (vibe.ratio) {
            nextRatios[key] = mapRatioToPercent(vibe.ratio);
          }
        }
      }
      if (!cancelled) {
        setRatios(nextRatios);
        setLatestVibes(nextVibes);
      }
    }

    loadRatios();

    return () => {
      cancelled = true;
    };
  }, [refreshKey, venues]);

  // Load Hot Now venues (venues with vibes in last 12 hours)
  useEffect(() => {
    if (feedMode !== "hotNow") return;

    let cancelled = false;

    async function loadHotNow() {
      setHotNowLoading(true);
      try {
        // Query vibes from last 12 hours
        const hoursAgo = 12; // Configurable
        const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

        const { data: vibesData, error: vibesError } = await supabase
          .from("vibes")
          .select("venue_id, crowd, ratio, line, cover, drinks_price, music, bar_type, created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: false });

        if (vibesError) {
          console.error("[Home] Error fetching hot now vibes:", vibesError.message);
          if (!cancelled) {
            setHotNowVenues([]);
            setHotNowLoading(false);
          }
          return;
        }

        if (!vibesData || vibesData.length === 0) {
          if (!cancelled) {
            setHotNowVenues([]);
            setHotNowLoading(false);
          }
          return;
        }

        // Dedupe by venue_id - keep first occurrence (latest)
        const vibeMap = new Map();
        for (const vibe of vibesData) {
          if (!vibeMap.has(vibe.venue_id)) {
            vibeMap.set(vibe.venue_id, vibe);
          }
        }

        const venueIds = Array.from(vibeMap.keys());

        // Fetch venue rows for those venue_ids
        const { data: venuesData, error: venuesError } = await supabase
          .from("venues")
          .select("id, name, neighborhood, default_guys, default_girls, venue_type")
          .in("id", venueIds);


        // Join in-memory: create list with venue + latestVibe + guys/girls
        const hotNowList = (venuesData || []).map((venue) => {
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

        // Sort by created_at desc (most recent first), tie-break by crowd score
        hotNowList.sort((a, b) => {
          if (!a.created_at && !b.created_at) return 0;
          if (!a.created_at) return 1;
          if (!b.created_at) return -1;
          const timeDiff = new Date(b.created_at) - new Date(a.created_at);
          if (timeDiff !== 0) return timeDiff;
          // Tie-break by crowd score
          const crowdScores = { Dead: 1, Chill: 2, Fun: 3, Packed: 4, Chaos: 5 };
          const scoreA = crowdScores[a.latestVibe?.crowd] || 0;
          const scoreB = crowdScores[b.latestVibe?.crowd] || 0;
          return scoreB - scoreA;
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

    return () => {
      cancelled = true;
    };
  }, [feedMode, refreshKey]);

  // Sort venues by hotness score for "For You" feed
  const getSortedVenues = () => {
    if (feedMode === "hotNow") {
      // Return hot now venues (already sorted)
      return hotNowVenues.map((item) => item.venue);
    }
    
    const baseVenues = isLoggedIn ? venues : venues.slice(0, CONSTANTS.PREVIEW_VENUE_LIMIT);
    
    if (feedMode === "forYou") {
      // Sort by hotness score
      return [...baseVenues].sort((a, b) => {
        const keyA = a.id || a.name;
        const keyB = b.id || b.name;
        const vibeA = latestVibes[keyA];
        const vibeB = latestVibes[keyB];
        const scoreA = getHotnessScore(vibeA);
        const scoreB = getHotnessScore(vibeB);
        return scoreB - scoreA; // Descending order
      });
    }
    
    return baseVenues;
  };

  const sortedVenues = getSortedVenues();
  
  // Get latest vibe and ratio for a venue (works for both feed modes)
  const getVenueData = (venue) => {
    if (feedMode === "hotNow") {
      const hotNowItem = hotNowVenues.find((item) => item.venue.id === venue.id);
      if (hotNowItem) {
        return {
          latestVibe: hotNowItem.latestVibe,
          guys: hotNowItem.guys,
          girls: hotNowItem.girls,
        };
      }
    }
    // Fallback to regular lookup
    const key = venue.id || venue.name;
    const liveRatio = ratios[key];
    return {
      latestVibe: latestVibes[key] || null,
      guys: liveRatio?.guys ?? venue.guys,
      girls: liveRatio?.girls ?? venue.girls,
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
                <Text style={styles.emptyText}>No venues with recent vibes</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const venueData = getVenueData(item);
            return (
              <VenueCardLovable
                venue={item}
                guys={venueData.guys}
                girls={venueData.girls}
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

