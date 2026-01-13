import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import VenueCardLovable from "./VenueCardLovable";
import { supabase } from "../utils/supabase";
import { getLatestVibe } from "../services/vibeService";
import { getVenueKeySafe } from "../utils/venueHelpers";


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

export default function NeighborhoodScreen({ neighborhood, selectedType, venues, navigation, onOpenVenue }) {
  const [ratios, setRatios] = useState({});
  const [latestVibes, setLatestVibes] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadRatiosAndVibes() {
      setLoading(true);
      
      // Parallel fetching instead of sequential (much faster!)
      const vibePromises = venues.map(venue => 
        getLatestVibe(venue.id || venue.name)
      );
      
      const vibeResults = await Promise.all(vibePromises);
      
      const nextRatios = {};
      const nextVibes = {};
      
      vibeResults.forEach((vibe, index) => {
        if (vibe) {
          const key = venues[index].id || venues[index].name;
          nextVibes[key] = vibe;
          if (vibe.ratio) {
            nextRatios[key] = mapRatioToPercent(vibe.ratio);
          }
        }
      });
    
      if (!cancelled) {
        setRatios(nextRatios);
        setLatestVibes(nextVibes);
        setLoading(false);
      }
    }

    loadRatiosAndVibes();

    return () => {
      cancelled = true;
    };
  }, [venues]);

  const renderVenueCard = (item) => {
    const key = getVenueKeySafe(item);
    if (!key) return null; // Skip venues without valid IDs
    const liveRatio = ratios[key];
    const guys = liveRatio?.guys ?? item.guys;
    const girls = liveRatio?.girls ?? item.girls;
    const latestVibe = latestVibes[key] || null;

    return (
      <VenueCardLovable
        key={item.id}
        venue={item}
        guys={guys}
        girls={girls}
        onPress={() => onOpenVenue(item)}
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

      {/* Venues List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading venues…</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {venues.length > 0 ? (
            venues.map((venue) => (
              <View key={venue.id} style={styles.venueCardWrapper}>
                {renderVenueCard(venue)}
              </View>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No venues in this neighborhood</Text>
            </View>
          )}
        </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  venueCardWrapper: {
    marginBottom: 6,
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
});

