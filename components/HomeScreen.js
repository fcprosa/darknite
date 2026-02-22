import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  Alert,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import VenueCardCompact from "./VenueCardCompact";
import EmptyState, { EmptyStates } from "./EmptyState";
import { useAuth } from "../contexts/AuthContext";
import { useAppContext } from "../contexts/AppContext";
import { computeStatusLine, computeChips, computeFeedScore, mergeRecentVibes } from "../utils/feedHelpers";
import { isVibeActive, getVibeAgeMinutes } from "../utils/vibeDecay";
import { rankVenue } from "../utils/feedRanker";
import CityPulseBanner from "./CityPulseBanner";
import * as CONSTANTS from "../constants";
import { VenueCardSeparator } from "./VenueCardSeparator";
import { getVenueKeySafe } from "../utils/venueHelpers";
import { SCREEN_PADDING_HORIZONTAL, SCREEN_PADDING_TOP } from "../constants/spacing";
import VenuePickerSheet from "./VenuePickerSheet";
import SetMoveScreen from "./SetMoveScreen";
import IconButton from "./IconButton";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { haversineKm } from "../utils/feedRanker";

// Constants for floating pill button
const FLOATING_PILL_HEIGHT = 54; // Compact pill height (52-56px range)
const TAB_BAR_HEIGHT = 60; // Tab bar height from MainTabsNavigator
const PILL_BOTTOM_OFFSET = 16; // Space above tab bar
const PILL_PADDING_HORIZONTAL = 20; // Horizontal padding for pill

function HomeScreen({ navigation, tabNavigation, venues, onOpenVenue, onOpenSheet, refreshKey, selectedVenue, setSelectedVenue }) {
  const { setShowAuthModal, isAuthenticated } = useAuth();
  const { latestVibesByVenueId, recentVibesByVenueId, latestLineWaitByVenueId, latestBarCrowdByVenueId, moveCountsByVenueId, refreshLatestVibes, refreshLatestCheckIns, refreshMoveCounts } = useAppContext();
  const isLoggedIn = isAuthenticated;
  const insets = useSafeAreaInsets();
  // ─── FAB Mode: Set Move (pregame) vs I'm Here (night active) ───
  // 9pm–5am = "I'm Here" (night is active, users are at venues)
  // 5am–9pm = "Set Move" (pregame, users are planning)
  const [userLocation, setUserLocation] = useState(null);
  const [fabMode, setFabMode] = useState(() => {
    const hour = new Date().getHours();
    return (hour >= 21 || hour < 5) ? "imHere" : "setMove";
  });
  const [showVenuePicker, setShowVenuePicker] = useState(false);
  const [showSetMove, setShowSetMove] = useState(false);
  const [selectedFABVenue, setSelectedFABVenue] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshLatestVibes(),
        refreshLatestCheckIns(),
        refreshMoveCounts(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  // Calculate floating pill button position (above tab bar)
  const floatingPillBottom = TAB_BAR_HEIGHT + PILL_BOTTOM_OFFSET + insets.bottom;
  
  // Calculate content padding to clear:
  // - Floating pill button height
  // - Space above tab bar
  // - Tab bar height
  // - Safe area bottom
  // - Extra breathing room
  const totalBottomPadding = FLOATING_PILL_HEIGHT + PILL_BOTTOM_OFFSET + TAB_BAR_HEIGHT + insets.bottom + 70;

  // Request location permission once on mount — non-blocking, non-fatal
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation(loc);
      } catch (e) {
        // Location unavailable — feed still works, just no distance sorting
      }
    })();
  }, []);

  // Update FAB mode every minute (handles the 9pm transition while app is open)
  useEffect(() => {
    const interval = setInterval(() => {
      const hour = new Date().getHours();
      const newMode = (hour >= 21 || hour < 5) ? "imHere" : "setMove";
      setFabMode((prev) => (prev !== newMode ? newMode : prev));
    }, 60000); // Check every 60 seconds
    return () => clearInterval(interval);
  }, []);

  // Pre-compute enriched data for all venues (memoized for performance)
  const enrichedVenues = useMemo(() => {
    if (__DEV__) {
      const vibeCount = Object.keys(latestVibesByVenueId || {}).length;
      console.log(`[Feed] Re-computing enrichedVenues: ${venues.length} venues, ${vibeCount} with vibes`);
    }
    const baseVenues = isLoggedIn ? venues : venues.slice(0, CONSTANTS.PREVIEW_VENUE_LIMIT);
    const now = new Date();
    const uLat = userLocation?.coords?.latitude;
    const uLng = userLocation?.coords?.longitude;

    return baseVenues.map((venue) => {
      const key = getVenueKeySafe(venue) || venue.id || venue.name;
      const latestVibe = latestVibesByVenueId?.[key] ?? null;
      const recentVibes = recentVibesByVenueId?.[key] || (latestVibe ? [latestVibe] : []);
      const mergedVibe = mergeRecentVibes(recentVibes);
      const latestLineWait = latestLineWaitByVenueId?.[key] ?? null;
      const latestBarCrowd = latestBarCrowdByVenueId?.[key] ?? null;
      const moveCount = moveCountsByVenueId?.[key] || 0;
      
      // Determine if this venue has live data (vibe < 90 min old)
      const isLive = isVibeActive(latestVibe?.created_at);
      
      // Status line uses latestVibe (for accurate crowd freshness and timestamp)
      const statusLine = computeStatusLine(venue, latestVibe, moveCount, now, recentVibes);
      // Chips use latestVibe (SAME source as status line for data consistency)
      const chips = computeChips(venue, latestVibe, now);
      
      // Compute feed score for sorting (uses latestVibe for correct freshness and crowd)
      const feedScore = computeFeedScore(venue, latestVibe, moveCount, now, {
        vibeCount: recentVibes.length, // BONUS: accurate vibe count for consensus multiplier
      });
      
      // Diagnostic logging for state inconsistency (Fix 4)
      if (__DEV__ && latestVibe) {
        const ageMin = Math.round((Date.now() - new Date(latestVibe.created_at).getTime()) / 60000);
        console.log(`[Feed] ${venue.name}: isLive=${isLive}, crowd=${latestVibe.crowd}, age=${ageMin}m, status=${statusLine.type}, score=${feedScore}`);
      }

      // Approximate per-venue stats for ranking
      const updateCountTonight = recentVibes.length;
      const recentUpdateCount = recentVibes.filter((v) => {
        const age = getVibeAgeMinutes(v?.created_at);
        return age != null && age <= 30;
      }).length;

      const distanceKm =
        uLat != null && uLng != null &&
        venue?.latitude != null && venue?.longitude != null
          ? haversineKm(uLat, uLng, venue.latitude, venue.longitude)
          : null;

      return {
        venue,
        statusLine,
        chips,
        feedScore,
        isLive,
        lastVibeTimestamp: latestVibe?.created_at || null,
        moveCount,
        updateCountTonight,
        recentUpdateCount,
        distanceKm,
      };
    });
  }, [venues, latestVibesByVenueId, recentVibesByVenueId, latestLineWaitByVenueId, latestBarCrowdByVenueId, moveCountsByVenueId, isLoggedIn, userLocation]);
  
  // Sort venues with weighted ranking (active venues always above inactive)
  const sortedVenues = useMemo(() => {
    const userLat = userLocation?.coords?.latitude;
    const userLng = userLocation?.coords?.longitude;

    return [...enrichedVenues].sort((a, b) => {
      const aScore = rankVenue(
        {
          latest_update_created_at: a.lastVibeTimestamp,
          update_count_tonight: a.updateCountTonight,
          recent_update_count: a.recentUpdateCount,
          move_count_tonight: a.moveCount,
          latitude: a.venue?.latitude,
          longitude: a.venue?.longitude,
        },
        userLat,
        userLng
      );

      const bScore = rankVenue(
        {
          latest_update_created_at: b.lastVibeTimestamp,
          update_count_tonight: b.updateCountTonight,
          recent_update_count: b.recentUpdateCount,
          move_count_tonight: b.moveCount,
          latitude: b.venue?.latitude,
          longitude: b.venue?.longitude,
        },
        userLat,
        userLng
      );

      if (bScore === aScore) {
        return (a.venue.name || "").localeCompare(b.venue.name || "");
      }
      return bScore - aScore;
    });
  }, [enrichedVenues, userLocation]);

  // Memoize extraData to prevent unnecessary re-renders
  const extraData = useMemo(() => sortedVenues, [sortedVenues]);

  // Handle FAB press - route to Set Move or Post Vibe based on time
  const handleFABPress = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {}

    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    // Both modes start with venue selection
    setShowVenuePicker(true);
  };

  // Handle venue selection from picker
  const handleVenueSelected = (venue) => {
    setSelectedFABVenue(venue);
    setShowVenuePicker(false);

    if (fabMode === "imHere") {
      // Open PostVibeScreen with selected venue
      if (onOpenSheet) {
        onOpenSheet(venue);
      } else {
        navigation.navigate("PostVibe", {
          venueId: venue.id,
          venueName: venue.name,
          venueType: venue.venue_type,
          neighborhood: venue.neighborhood,
        });
      }
    } else {
      // Open SetMoveScreen with selected venue
      setShowSetMove(true);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.logo}>DarkNite</Text>
          <Text style={styles.headerSubtitle}>Feed · Live vibes</Text>
        </View>
        <IconButton onPress={() => tabNavigation?.navigate("ProfileTab")}>
          <Ionicons name="person-circle-outline" size={28} color="#A855F7" />
        </IconButton>
      </View>

      {!isLoggedIn && (
        <View style={styles.previewModeBadge}>
          <Text style={styles.previewModeText}>Preview mode</Text>
        </View>
      )}

      <FlatList
          data={sortedVenues}
          keyExtractor={(item) => item.venue.id}
          extraData={extraData} // Memoized to prevent unnecessary re-renders
          removeClippedSubviews={false} // Prevent layout issues
          windowSize={10} // Optimize rendering
          maxToRenderPerBatch={10} // Batch rendering
          updateCellsBatchingPeriod={50} // Update frequency
          initialNumToRender={5} // Initial render count
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#A855F7"
              colors={["#A855F7"]}
            />
          }
          contentContainerStyle={{
            paddingHorizontal: SCREEN_PADDING_HORIZONTAL,
            paddingTop: SCREEN_PADDING_TOP,
            paddingBottom: Math.max(80, totalBottomPadding), // Ensures last item is never obscured by FAB
          }}
          ListHeaderComponent={
            <CityPulseBanner
              venues={venues}
              vibeMap={latestVibesByVenueId}
              moveCountsByVenueId={moveCountsByVenueId}
            />
          }
          ItemSeparatorComponent={VenueCardSeparator}
          ListEmptyComponent={
            <EmptyState
              {...EmptyStates.noVenues}
              variant="compact"
            />
          }
          ListFooterComponent={
            !isLoggedIn ? (
              <View style={styles.guestFooter}>
                <View style={styles.guestFooterIconWrap}>
                  <Ionicons name="lock-closed" size={28} color="#A855F7" />
                </View>
                <Text style={styles.guestFooterTitle}>More venues await</Text>
                <Text style={styles.guestFooterSubtitle}>
                  Sign in to see live vibes from every spot in the city
                </Text>
                <TouchableOpacity
                  style={styles.guestFooterButton}
                  onPress={() => setShowAuthModal(true)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.guestFooterButtonText}>Sign In or Sign Up</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            return (
              <VenueCardCompact
                venue={item.venue}
                statusLine={item.statusLine}
                chips={item.chips}
                isLive={!!item.isLive}
                lastVibeTimestamp={item.lastVibeTimestamp}
                moveCount={item.moveCount}
                distanceKm={item.distanceKm}
                onPress={() => onOpenVenue(item.venue)}
              />
            );
          }}
        />

      {/* Floating Pill Button - Gen-Z style compact FAB */}
      {!showVenuePicker && !showSetMove && (
        <Pressable
          style={[
            styles.floatingCta,
            { bottom: floatingPillBottom },
            fabMode === "setMove" && styles.floatingCtaSetMove,
          ]}
          onPress={handleFABPress}
          android_ripple={{ color: "rgba(255,255,255,0.2)" }}
        >
          <Text style={styles.floatingCtaIcon}>+</Text>
          <Text style={styles.floatingCtaText}>
            {fabMode === "imHere" ? "I'm Here" : "Set Move"}
          </Text>
        </Pressable>
      )}

      {/* Venue Picker Modal */}
      {showVenuePicker && (
        <View style={StyleSheet.absoluteFill}>
          <VenuePickerSheet
            title={fabMode === "imHere" ? "Where are you?" : "Where are you heading?"}
            subtitle={fabMode === "imHere" ? "Select the venue you're at" : "Set your move for tonight"}
            onSelect={handleVenueSelected}
            onClose={() => setShowVenuePicker(false)}
          />
        </View>
      )}

      {/* Set Move Flow */}
      {showSetMove && selectedFABVenue && (
        <View style={StyleSheet.absoluteFill}>
          <SetMoveScreen
            venue={selectedFABVenue}
            onClose={() => {
              setShowSetMove(false);
              setSelectedFABVenue(null);
            }}
            onSuccess={() => {
              setShowSetMove(false);
              setSelectedFABVenue(null);
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    // paddingTop set dynamically via insets.top + 12
    alignItems: "center",
  },
  headerLeft: {
    flex: 1,
  },
  logo: {
    fontSize: 24,
    fontWeight: "800",
    fontFamily: "Inter_800ExtraBold",
    color: "#F5F3FF",
  },
  headerSubtitle: {
    color: "#9CA3AF",
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
    fontFamily: "Inter_500Medium",
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
  floatingCta: {
    position: "absolute",
    right: 16,
    backgroundColor: "#A855F7",
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: PILL_PADDING_HORIZONTAL,
    height: FLOATING_PILL_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    zIndex: 9999,
    shadowColor: "#A855F7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.4)",
  },
  floatingCtaIcon: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 20,
  },
  floatingCtaText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  floatingCtaSetMove: {
    backgroundColor: "rgba(168, 85, 247, 0.85)",
    // Slightly different from the I'm Here purple to subtly indicate different mode
    // I'm Here = solid purple (#A855F7)
    // Set Move = slightly transparent purple
  },
  guestFooter: {
    alignItems: "center",
    marginTop: 24,
    marginHorizontal: 4,
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: "#0D0A1F",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.25)",
  },
  guestFooterIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(168,85,247,0.12)",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  guestFooterTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F5F3FF",
    marginBottom: 8,
    textAlign: "center",
  },
  guestFooterSubtitle: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  guestFooterButton: {
    backgroundColor: "#A855F7",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    shadowColor: "#A855F7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  guestFooterButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});

export default HomeScreen;

