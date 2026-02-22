/**
 * VenuePickerSheet — Venue selection for Set Move and I'm Here flows.
 * Shows a searchable list of venues. User taps one to proceed.
 */

import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppContext } from "../contexts/AppContext";
import AppScreen from "./AppScreen";
import HeaderIconButton from "./HeaderIconButton";
import { isVibeActive } from "../utils/vibeDecay";

export default function VenuePickerSheet({ title, subtitle, onSelect, onClose }) {
  const insets = useSafeAreaInsets();
  const { venues, latestVibesByVenueId, loadingVenues } = useAppContext();
  const [search, setSearch] = useState("");

  // Filter and sort venues - safe for null/undefined values
  const filteredVenues = useMemo(() => {
    // Early return if no venues
    if (!venues || venues.length === 0) {
      return [];
    }

    let list = [...venues]; // Create copy

    // Filter by search - safe for null/undefined
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((v) => {
        const name = (v.name || "").toLowerCase();
        const neighborhood = (v.neighborhood || "").toLowerCase();
        return name.includes(q) || neighborhood.includes(q);
      });
    }

    // Sort: venues with live vibes first, then alphabetical
    list = list.sort((a, b) => {
      const aLive = latestVibesByVenueId?.[a.id]?.created_at;
      const bLive = latestVibesByVenueId?.[b.id]?.created_at;
      const aIsLive = isVibeActive(aLive);
      const bIsLive = isVibeActive(bLive);

      if (aIsLive && !bIsLive) return -1;
      if (!aIsLive && bIsLive) return 1;
      return (a.name || "").localeCompare(b.name || "");
    });

    return list;
  }, [venues, search, latestVibesByVenueId]);

  // Instrumentation: Log state changes for debugging
  useEffect(() => {
    console.log("[VenuePickerSheet] State update:", {
      venuesCount: venues?.length || 0,
      loadingVenues,
      searchQuery: search,
      filteredCount: filteredVenues.length,
      hasVenues: !!venues && venues.length > 0,
    });
  }, [venues, loadingVenues, search, filteredVenues.length]);

  return (
    <AppScreen
      backgroundColor="#0A0614"
      screenName="VenuePickerSheet"
      contentContainerStyle={{ paddingHorizontal: 0 }}
    >
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={styles.header}>
          <HeaderIconButton
            onPress={onClose}
            accessibilityLabel="Close"
            accessibilityHint="Closes the venue picker"
          >
            <Text style={styles.closeBtn}>✕</Text>
          </HeaderIconButton>
          <View style={styles.headerText}>
            <Text style={styles.title}>{title || "Choose a venue"}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
          <View style={{ width: 44 }} />
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search venues..."
            placeholderTextColor="#6B7280"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Content: Loading, Empty, or List */}
        {loadingVenues ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#A855F7" />
            <Text style={styles.loadingText}>Loading venues...</Text>
          </View>
        ) : filteredVenues.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {search.trim() ? "No venues found. Try clearing search." : "No venues available."}
            </Text>
            {search.trim() && (
              <TouchableOpacity
                onPress={() => setSearch("")}
                style={styles.clearSearchBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.clearSearchText}>Clear search</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            style={styles.list}
            data={filteredVenues}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            renderItem={({ item }) => {
              const latestVibe = latestVibesByVenueId?.[item.id];
              const isLive = isVibeActive(latestVibe?.created_at);
              const isClub = item.venue_type?.toLowerCase() === "club";

              return (
                <TouchableOpacity
                  style={[styles.venueRow, isLive && styles.venueRowLive]}
                  onPress={() => onSelect(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.venueInfo}>
                    <View style={styles.venueNameRow}>
                      {isLive && <View style={styles.liveDot} />}
                      <Text style={styles.venueName}>{item.name || "Unnamed venue"}</Text>
                      <View style={[styles.typeBadge, isClub && styles.typeBadgeClub]}>
                        <Text style={styles.typeBadgeText}>
                          {isClub ? "CLUB" : "BAR"}
                        </Text>
                      </View>
                    </View>
                    {item.neighborhood && (
                      <Text style={styles.venueNeighborhood}>{item.neighborhood}</Text>
                    )}
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  closeBtn: {
    color: "#9CA3AF",
    fontSize: 20,
    fontWeight: "600",
  },
  headerText: {
    flex: 1,
    alignItems: "center",
  },
  title: {
    color: "#F5F3FF",
    fontSize: 18,
    fontWeight: "800",
  },
  subtitle: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchInput: {
    backgroundColor: "rgba(168, 85, 247, 0.08)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.15)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#F5F3FF",
    fontSize: 15,
  },
  venueRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  venueRowLive: {
    backgroundColor: "rgba(245, 158, 11, 0.04)",
  },
  venueInfo: {
    flex: 1,
    gap: 3,
  },
  venueNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F59E0B",
  },
  venueName: {
    color: "#F5F3FF",
    fontSize: 16,
    fontWeight: "700",
  },
  typeBadge: {
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  typeBadgeClub: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
  typeBadgeText: {
    color: "#9CA3AF",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  venueNeighborhood: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "500",
  },
  chevron: {
    color: "#6B7280",
    fontSize: 22,
    fontWeight: "300",
    marginLeft: 8,
  },
  separator: {
    height: 1,
    backgroundColor: "rgba(168, 85, 247, 0.06)",
    marginHorizontal: 16,
  },
  list: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    color: "#9CA3AF",
    fontSize: 15,
    fontWeight: "500",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 16,
  },
  emptyText: {
    color: "#6B7280",
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
  },
  clearSearchBtn: {
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.3)",
  },
  clearSearchText: {
    color: "#A855F7",
    fontSize: 14,
    fontWeight: "600",
  },
});
