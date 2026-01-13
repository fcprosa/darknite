import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { supabase } from "../utils/supabase";

export default function VenuePickerScreen({ navigation, route }) {
  const safeParams = route?.params ?? {};
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState(safeParams.preselectedType || "Clubs");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadVenues() {
      setLoading(true);
      const venueTypeFilter = selectedType === "Clubs" ? "club" : "bar";

      const { data, error } = await supabase
        .from("venues")
        .select("id, name, neighborhood, venue_type")
        .eq("venue_type", venueTypeFilter)
        .order("name", { ascending: true });

      if (error) {
        console.error("[VenuePicker] Error fetching venues:", error.message);
        setVenues([]);
        setLoading(false);
        return;
      }

      const mapped = (data || []).map((row) => ({
        id: row.id,
        name: row.name,
        neighborhood: row.neighborhood || "Unknown",
        venue_type: row.venue_type ? row.venue_type.trim().toLowerCase() : null,
      }));

      setVenues(mapped);
      setLoading(false);
    }

    loadVenues();
  }, [selectedType]);

  // Filter venues by search query
  const filteredVenues = useMemo(() => {
    if (!searchQuery.trim()) return venues;

    const q = searchQuery.toLowerCase();
    return venues.filter((venue) => {
      const nameMatch = (venue.name || "").toLowerCase().includes(q);
      const neighborhoodMatch = (venue.neighborhood || "").toLowerCase().includes(q);
      return nameMatch || neighborhoodMatch;
    });
  }, [venues, searchQuery]);

  // Group venues by neighborhood
  const neighborhoodGroups = useMemo(() => {
    const groups = {};
    for (const venue of filteredVenues) {
      const neighborhood = venue.neighborhood || "Unknown";
      if (!groups[neighborhood]) {
        groups[neighborhood] = [];
      }
      groups[neighborhood].push(venue);
    }
    return Object.entries(groups)
      .map(([neighborhood, venues]) => ({ neighborhood, venues }))
      .sort((a, b) => a.neighborhood.localeCompare(b.neighborhood));
  }, [filteredVenues]);

  const handleVenueSelect = (venue) => {
    console.log("[VenuePicker] Venue selected:", venue);
    
    // Validate venue type before proceeding
    if (!venue.venue_type) {
      Alert.alert(
        "Invalid Venue",
        "This venue is missing type information. Please contact support.",
        [{ text: "OK" }]
      );
      return;
    }

    const normalizedType = venue.venue_type.trim().toLowerCase();
    if (normalizedType !== 'club' && normalizedType !== 'bar') {
      Alert.alert(
        "Invalid Venue Type",
        `Venue type "${normalizedType}" is not supported. Please contact support.`,
        [{ text: "OK" }]
      );
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
    
    // Navigate with validated data
    navigation.navigate("PostVibe", {
      venueId: venue.id,
      venueName: venue.name,
      venueType: normalizedType,
      neighborhood: venue.neighborhood,
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#A855F7" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose a venue</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Clubs/Bars Toggle */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleButton, selectedType === "Clubs" && styles.toggleButtonActive]}
          onPress={() => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (e) {}
            setSelectedType("Clubs");
          }}
        >
          <Text style={[styles.toggleText, selectedType === "Clubs" && styles.toggleTextActive]}>
            Clubs
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, selectedType === "Bars" && styles.toggleButtonActive]}
          onPress={() => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (e) {}
            setSelectedType("Bars");
          }}
        >
          <Text style={[styles.toggleText, selectedType === "Bars" && styles.toggleTextActive]}>
            Bars
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or neighborhood…"
          placeholderTextColor="#6B7280"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Venues List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading venues…</Text>
        </View>
      ) : neighborhoodGroups.length > 0 ? (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {neighborhoodGroups.map((group) => (
            <View key={group.neighborhood} style={styles.neighborhoodSection}>
              <Text style={styles.neighborhoodHeader}>{group.neighborhood}</Text>
              {group.venues.map((venue) => (
                <TouchableOpacity
                  key={venue.id}
                  style={styles.venueRow}
                  onPress={() => handleVenueSelect(venue)}
                  activeOpacity={0.7}
                >
                  <View style={styles.venueRowContent}>
                    <Text style={styles.venueName}>{venue.name}</Text>
                    <Text style={styles.venueNeighborhood}>{venue.neighborhood}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#6B7280" />
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No venues found</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050013",
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
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#F9FAFB",
    textAlign: "center",
  },
  headerRight: {
    width: 36,
  },
  toggleContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    backgroundColor: "rgba(168,85,247,0.1)",
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.2)",
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  toggleButtonActive: {
    backgroundColor: "#A855F7",
  },
  toggleText: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "600",
  },
  toggleTextActive: {
    color: "#F9FAFB",
    fontWeight: "700",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "#0B0625",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: "#F9FAFB",
    fontSize: 15,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  neighborhoodSection: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  neighborhoodHeader: {
    fontSize: 16,
    fontWeight: "700",
    color: "#A855F7",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  venueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0B0625",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.2)",
  },
  venueRowContent: {
    flex: 1,
  },
  venueName: {
    color: "#F9FAFB",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  venueNeighborhood: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "500",
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
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyText: {
    color: "#9CA3AF",
    fontSize: 14,
  },
});

