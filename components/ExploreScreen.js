import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import VenueCardLovable from "./VenueCardLovable";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://uttcnvqhhmkfkccwjgnt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_FRoLIm9eLIJYnjSMJ68KCw_hwr4zuiF";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const FALLBACK_VENUES = [
  { id: "Gospel", name: "Gospel", neighborhood: "SoHo", guys: 50, girls: 50 },
  {
    id: "Schimanski",
    name: "Schimanski",
    neighborhood: "Williamsburg",
    guys: 50,
    girls: 50,
  },
  {
    id: "Skyline",
    name: "Skyline Rooftop",
    neighborhood: "Midtown",
    guys: 50,
    girls: 50,
  },
  {
    id: "PublicArts",
    name: "Public Arts",
    neighborhood: "Lower East Side",
    guys: 50,
    girls: 50,
  },
];

async function fetchVenues() {
  const { data, error } = await supabase
    .from("venues")
    .select("id, name, neighborhood, default_guys, default_girls, type")
    .order("name", { ascending: true });

  if (error) {
    console.log("Error fetching venues:", error.message);
    return FALLBACK_VENUES;
  }

  if (!data || data.length === 0) {
    return FALLBACK_VENUES;
  }

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    neighborhood: row.neighborhood,
    guys: row.default_guys ?? 50,
    girls: row.default_girls ?? 50,
    type: row.type || null, // May not exist
  }));
}

async function fetchLatestVibe(venueKey) {
  if (!venueKey) return null;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("vibes")
    .select("crowd, ratio, line, cover, music, created_at")
    .eq("venue_id", venueKey)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.log("Error fetching latest vibe:", error.message);
    return null;
  }

  return data;
}

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

export default function ExploreScreen({ navigation, tabNavigation, onOpenVenue }) {
  const [venues, setVenues] = useState(FALLBACK_VENUES);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState("Clubs"); // "Clubs" or "Bars"
  const [searchQuery, setSearchQuery] = useState("");
  const [ratios, setRatios] = useState({});
  const [latestVibes, setLatestVibes] = useState({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      const v = await fetchVenues();
      setVenues(v);
      setLoading(false);

      // Load ratios and vibes
      const nextRatios = {};
      const nextVibes = {};
      for (const venue of v) {
        const key = venue.id || venue.name;
        const vibe = await fetchLatestVibe(key);
        if (vibe) {
          nextVibes[key] = vibe;
          if (vibe.ratio) {
            nextRatios[key] = mapRatioToPercent(vibe.ratio);
          }
        }
      }
      setRatios(nextRatios);
      setLatestVibes(nextVibes);
    }
    load();
  }, []);

  // Filter venues by type (if type exists) and search query
  const filteredVenues = venues.filter((venue) => {
    // Type filter - only filter if venue.type exists and matches
    if (venue.type) {
      const typeLower = venue.type.toLowerCase();
      if (selectedType === "Clubs" && !typeLower.includes("club")) {
        return false;
      }
      if (selectedType === "Bars" && !typeLower.includes("bar")) {
        return false;
      }
    }
    // If type doesn't exist, show all venues (no filtering)

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const nameMatch = venue.name.toLowerCase().includes(query);
      const neighborhoodMatch = venue.neighborhood.toLowerCase().includes(query);
      return nameMatch || neighborhoodMatch;
    }

    return true;
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Explore</Text>
        <TouchableOpacity
          onPress={() => tabNavigation?.navigate("ProfileTab")}
          style={styles.profileIconButton}
        >
          <Ionicons name="person-circle-outline" size={28} color="#A855F7" />
        </TouchableOpacity>
      </View>

      {/* Segmented Toggle */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleButton, selectedType === "Clubs" && styles.toggleButtonActive]}
          onPress={() => setSelectedType("Clubs")}
        >
          <Text style={[styles.toggleText, selectedType === "Clubs" && styles.toggleTextActive]}>
            Clubs
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, selectedType === "Bars" && styles.toggleButtonActive]}
          onPress={() => setSelectedType("Bars")}
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
          placeholder="Search venues…"
          placeholderTextColor="#6B7280"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Venue List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading venues…</Text>
        </View>
      ) : (
        <FlatList
          data={filteredVenues}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const key = item.id || item.name;
            const liveRatio = ratios[key];
            const guys = liveRatio?.guys ?? item.guys;
            const girls = liveRatio?.girls ?? item.girls;
            const latestVibe = latestVibes[key] || null;

            return (
              <VenueCardLovable
                venue={item}
                guys={guys}
                girls={girls}
                onPress={() => onOpenVenue(item)}
                latestVibe={latestVibe}
              />
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No venues found</Text>
            </View>
          }
        />
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#F5F3FF",
  },
  profileIconButton: {
    padding: 4,
  },
  toggleContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
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
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
});

