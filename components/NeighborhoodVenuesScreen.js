import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import VenueCardLovable from "./VenueCardLovable";
import { getVenueKeySafe } from "../utils/venueHelpers";
import { getVenuesByTypeAndNeighborhood } from "../services/venueService";
import { VenueCardSeparator } from "./VenueCardSeparator";
import { useAppContext } from "../contexts/AppContext";
import { SCREEN_PADDING_HORIZONTAL, SCREEN_PADDING_TOP } from "../constants/spacing";

// Constants for layout stability
const TAB_BAR_HEIGHT = 60;
const BOTTOM_PADDING_EXTRA = 40;

export default function NeighborhoodVenuesScreen({ navigation, route }) {
  const params = route?.params ?? {};
  const neighborhood = params.neighborhood || "Unknown";
  const selectedType = params.selectedType || "Clubs";
  
  const { latestVibesByVenueId } = useAppContext();
  const insets = useSafeAreaInsets();
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const bottomPadding = TAB_BAR_HEIGHT + BOTTOM_PADDING_EXTRA + insets.bottom;

  useEffect(() => {
    async function loadVenues() {
      setLoading(true);
      const venueTypeFilter = selectedType === "Clubs" ? "club" : "bar";

      // Use service to fetch venues by type and neighborhood
      const fetchedVenues = await getVenuesByTypeAndNeighborhood(venueTypeFilter, neighborhood);

      // Set venues - vibes will be loaded via AppContext's refreshLatestVibes (batch fetch)
      setVenues(fetchedVenues);
      setLoading(false);
    }

    loadVenues();
  }, [neighborhood, selectedType]);

  const renderVenueCard = (item) => {
    const key = getVenueKeySafe(item);
    if (!key) return null; // Skip venues without valid IDs
    const latestVibe = latestVibesByVenueId?.[key] ?? null;

    return (
      <VenueCardLovable
        venue={item}
        onPress={() => {
          // Navigate to venue details - use same pattern as Home flow
          console.log("[NeighborhoodVenues] Press venue:", item.id, item.name);
          navigation.navigate("VenueDetails", { venueId: item.id, venue: item });
        }}
        onPostVibe={() => {
          // Navigate to PostVibe screen via parent tab navigator
          const tabNav = navigation.getParent?.();
          if (tabNav) {
            // Navigate to HomeTab first, then to PostVibe
            tabNav.navigate("HomeTab", {
              screen: "PostVibe",
              params: {
                venueId: item.id,
                venueName: item.name,
                venueType: item.venue_type,
                neighborhood: item.neighborhood,
              },
            });
          } else {
            // Fallback: try direct navigation
            navigation.navigate("PostVibe", {
              venueId: item.id,
              venueName: item.name,
              venueType: item.venue_type,
              neighborhood: item.neighborhood,
            });
          }
        }}
        latestVibe={latestVibe}
      />
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#A855F7" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{neighborhood}</Text>
          <Text style={styles.headerSubtitle}>{venues.length} venue{venues.length !== 1 ? 's' : ''}</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* Venues List - Using FlatList like HomeScreen for consistent layout */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading venues…</Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={venues}
          keyExtractor={(item, index) => `venue-${item.id || item.name || index}`}
          extraData={latestVibesByVenueId} // Force re-render when vibes update
          removeClippedSubviews={false} // Prevent layout issues
          windowSize={10} // Optimize rendering
          maxToRenderPerBatch={10} // Batch rendering
          updateCellsBatchingPeriod={50} // Update frequency
          initialNumToRender={5} // Initial render count
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding }]}
          ItemSeparatorComponent={VenueCardSeparator}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No venues found in {neighborhood}</Text>
            </View>
          }
          renderItem={({ item }) => renderVenueCard(item)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050013",
    // Ensure container fills available space properly
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(168,85,247,0.2)",
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F9FAFB",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 2,
  },
  headerRight: {
    width: 36,
  },
  listContent: {
    paddingHorizontal: SCREEN_PADDING_HORIZONTAL,
    paddingTop: SCREEN_PADDING_TOP,
    flexGrow: 0, // Prevent content from stretching when there are few items
  },
  loadingContainer: {
    // REMOVED flex: 1 - was causing layout issues during state transition
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
  loadingText: {
    color: "#E5E7EB",
    fontSize: 14,
  },
  emptyContainer: {
    // REMOVED flex: 1 - was causing layout issues
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyText: {
    color: "#9CA3AF",
    fontSize: 14,
  },
});

