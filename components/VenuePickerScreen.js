import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { supabase } from "../utils/supabase";
import { useAuth } from "../contexts/AuthContext";
import { getUserProfile } from "../services/profileService";
import { getUserVibes, getRecentVibes } from "../services/vibeService";

// Helper to format time ago
function formatTimeAgo(dateStr) {
  if (!dateStr) return "";
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export default function VenuePickerScreen({ navigation, route, onOpenSheet }) {
  const safeParams = route?.params ?? {};
  const { user, isAuthenticated } = useAuth();

  // Core state
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Personalization state
  const [userProfile, setUserProfile] = useState(null);
  const [recentUserVibes, setRecentUserVibes] = useState([]); // User's recent vibes
  const [hotNowVenues, setHotNowVenues] = useState([]); // Venues with recent activity
  const [loadingPersonalization, setLoadingPersonalization] = useState(true);

  // Collapsible sections state
  const [expandedNeighborhoods, setExpandedNeighborhoods] = useState({});
  const [allVenuesExpanded, setAllVenuesExpanded] = useState(false);

  // Load user personalization data
  useEffect(() => {
    async function loadPersonalization() {
      if (!isAuthenticated || !user?.id) {
        setLoadingPersonalization(false);
        return;
      }

      setLoadingPersonalization(true);
      try {
        // Fetch user profile and recent vibes in parallel
        const [profile, userVibes, hotVibes] = await Promise.all([
          getUserProfile(user.id),
          getUserVibes(user.id, 10), // Get last 10 vibes to find unique venues
          getRecentVibes({ minutes: 60, limit: 50 }), // Hot now - last hour
        ]);

        setUserProfile(profile);

        // Get unique venues from user's recent vibes (last 3)
        if (userVibes && userVibes.length > 0) {
          const seenVenueIds = new Set();
          const uniqueRecentVibes = [];
          for (const vibe of userVibes) {
            if (!seenVenueIds.has(vibe.venue_id) && uniqueRecentVibes.length < 3) {
              seenVenueIds.add(vibe.venue_id);
              uniqueRecentVibes.push(vibe);
            }
          }
          setRecentUserVibes(uniqueRecentVibes);
        }

        // Get unique venues from hot vibes (last 5)
        if (hotVibes && hotVibes.length > 0) {
          const seenVenueIds = new Set();
          const uniqueHotVibes = [];
          for (const vibe of hotVibes) {
            if (!seenVenueIds.has(vibe.venue_id) && uniqueHotVibes.length < 5) {
              seenVenueIds.add(vibe.venue_id);
              uniqueHotVibes.push(vibe);
            }
          }
          setHotNowVenues(uniqueHotVibes);
        }
      } catch (error) {
        console.error("[VenuePicker] Error loading personalization:", error);
      } finally {
        setLoadingPersonalization(false);
      }
    }

    loadPersonalization();
  }, [isAuthenticated, user?.id]);

  // Load all venues (clubs and bars together)
  useEffect(() => {
    async function loadVenues() {
      setLoading(true);

      const { data, error } = await supabase
        .from("venues")
        .select("id, name, neighborhood, venue_type")
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
  }, []);

  // Get favorite neighborhoods from profile
  const favoriteNeighborhoods = useMemo(() => {
    return userProfile?.favorite_neighborhoods || [];
  }, [userProfile]);

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

  // Get venues for favorite neighborhoods
  const favoriteNeighborhoodVenues = useMemo(() => {
    if (favoriteNeighborhoods.length === 0) return [];

    return favoriteNeighborhoods.map((neighborhood) => {
      const venuesInNeighborhood = venues.filter(
        (v) => v.neighborhood?.toLowerCase() === neighborhood.toLowerCase()
      );
      return {
        neighborhood,
        venues: venuesInNeighborhood,
        count: venuesInNeighborhood.length,
      };
    }).filter((g) => g.count > 0);
  }, [favoriteNeighborhoods, venues]);

  // Get venue info from recent vibes
  const recentVibesWithVenues = useMemo(() => {
    return recentUserVibes.map((vibe) => {
      const venue = venues.find((v) => v.id === vibe.venue_id);
      return {
        ...vibe,
        venue: venue || { id: vibe.venue_id, name: "Unknown Venue", neighborhood: "Unknown" },
      };
    }).filter((item) => item.venue);
  }, [recentUserVibes, venues]);

  // Get venue info from hot vibes
  const hotNowWithVenues = useMemo(() => {
    return hotNowVenues
      .map((vibe) => {
        const venue = venues.find((v) => v.id === vibe.venue_id);
        return {
          ...vibe,
          venue: venue,
        };
      })
      .filter((item) => item.venue);
  }, [hotNowVenues, venues]);

  const handleVenueSelect = (venue) => {
    console.log("[VenuePicker] Venue selected:", venue);

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

    // Use modal sheet instead of navigation
    if (onOpenSheet) {
      onOpenSheet({
        ...venue,
        venue_type: normalizedType,
      });
    } else {
      // Fallback to navigation if onOpenSheet not provided
      navigation.navigate("PostVibe", {
        venueId: venue.id,
        venueName: venue.name,
        venueType: normalizedType,
        neighborhood: venue.neighborhood,
        venue: venue,
      });
    }
  };

  const toggleNeighborhoodExpanded = (neighborhood) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
    setExpandedNeighborhoods((prev) => ({
      ...prev,
      [neighborhood]: !prev[neighborhood],
    }));
  };

  // Render a venue row
  const renderVenueRow = (venue, showNeighborhood = false) => {
    const typeEmoji = venue.venue_type === "club" ? "🪩" : "🍺";
    return (
      <TouchableOpacity
        key={venue.id}
        style={styles.venueRow}
        onPress={() => handleVenueSelect(venue)}
        activeOpacity={0.7}
      >
        <View style={styles.venueRowContent}>
          <View style={styles.venueNameRow}>
            <Text style={styles.venueName}>{venue.name}</Text>
            <Text style={styles.venueTypeEmoji}>{typeEmoji}</Text>
          </View>
          {showNeighborhood && (
            <Text style={styles.venueNeighborhood}>{venue.neighborhood}</Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#6B7280" />
      </TouchableOpacity>
    );
  };

  // Render section header
  const renderSectionHeader = (icon, title, count = null) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionIcon}>{icon}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      {count !== null && (
        <View style={styles.sectionCount}>
          <Text style={styles.sectionCountText}>{count}</Text>
        </View>
      )}
    </View>
  );

  // Check if we're searching
  const isSearching = searchQuery.trim().length > 0;

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

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or neighborhood..."
          placeholderTextColor="#6B7280"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={20} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#A855F7" />
          <Text style={styles.loadingText}>Loading venues...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

          {/* When searching, show filtered results only */}
          {isSearching ? (
            <>
              {filteredVenues.length > 0 ? (
                <View style={styles.section}>
                  {renderSectionHeader("🔍", "Search Results", filteredVenues.length)}
                  {filteredVenues.map((venue) => renderVenueRow(venue, true))}
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No venues found</Text>
                </View>
              )}
            </>
          ) : (
            <>
              {/* YOUR RECENT VIBES - Only show if user has recent vibes */}
              {isAuthenticated && recentVibesWithVenues.length > 0 && (
                <View style={styles.section}>
                  {renderSectionHeader("🕐", "YOUR RECENT VIBES", recentVibesWithVenues.length)}
                  {recentVibesWithVenues.map((item) => (
                    <TouchableOpacity
                      key={`recent-${item.id}`}
                      style={styles.recentVibeRow}
                      onPress={() => handleVenueSelect(item.venue)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.venueRowContent}>
                        <View style={styles.recentVibeHeader}>
                          <Text style={styles.venueName}>{item.venue.name}</Text>
                          <Text style={styles.recentVibeTime}>{formatTimeAgo(item.created_at)}</Text>
                        </View>
                        <Text style={styles.venueNeighborhood}>{item.venue.neighborhood}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#6B7280" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* YOUR NEIGHBORHOODS - Only show if user has favorite neighborhoods */}
              {isAuthenticated && favoriteNeighborhoodVenues.length > 0 && (
                <View style={styles.section}>
                  {renderSectionHeader("⭐", "YOUR NEIGHBORHOODS")}
                  {favoriteNeighborhoodVenues.map((group) => {
                    const isExpanded = expandedNeighborhoods[group.neighborhood];
                    const previewVenues = group.venues.slice(0, 2);
                    const remainingCount = group.venues.length - 2;

                    return (
                      <View key={`fav-${group.neighborhood}`} style={styles.favoriteNeighborhoodCard}>
                        <TouchableOpacity
                          style={styles.favoriteNeighborhoodHeader}
                          onPress={() => toggleNeighborhoodExpanded(group.neighborhood)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.favoriteNeighborhoodTitle}>
                            <Text style={styles.favoriteNeighborhoodIcon}>📍</Text>
                            <Text style={styles.favoriteNeighborhoodName}>{group.neighborhood}</Text>
                            <View style={styles.neighborhoodCountBadge}>
                              <Text style={styles.neighborhoodCountText}>{group.count}</Text>
                            </View>
                          </View>
                          <Ionicons
                            name={isExpanded ? "chevron-up" : "chevron-down"}
                            size={20}
                            color="#A855F7"
                          />
                        </TouchableOpacity>

                        {/* Preview venues (always show first 2) */}
                        {previewVenues.map((venue) => {
                          const typeEmoji = venue.venue_type === "club" ? "🪩" : "🍺";
                          return (
                            <TouchableOpacity
                              key={venue.id}
                              style={styles.compactVenueRow}
                              onPress={() => handleVenueSelect(venue)}
                              activeOpacity={0.7}
                            >
                              <View style={styles.compactVenueNameRow}>
                                <Text style={styles.compactVenueName}>{venue.name}</Text>
                                <Text style={styles.compactVenueTypeEmoji}>{typeEmoji}</Text>
                              </View>
                              <Ionicons name="chevron-forward" size={16} color="#6B7280" />
                            </TouchableOpacity>
                          );
                        })}

                        {/* Expanded venues */}
                        {isExpanded && remainingCount > 0 && (
                          group.venues.slice(2).map((venue) => {
                            const typeEmoji = venue.venue_type === "club" ? "🪩" : "🍺";
                            return (
                              <TouchableOpacity
                                key={venue.id}
                                style={styles.compactVenueRow}
                                onPress={() => handleVenueSelect(venue)}
                                activeOpacity={0.7}
                              >
                                <View style={styles.compactVenueNameRow}>
                                  <Text style={styles.compactVenueName}>{venue.name}</Text>
                                  <Text style={styles.compactVenueTypeEmoji}>{typeEmoji}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color="#6B7280" />
                              </TouchableOpacity>
                            );
                          })
                        )}

                        {/* Show more button */}
                        {!isExpanded && remainingCount > 0 && (
                          <TouchableOpacity
                            style={styles.showMoreButton}
                            onPress={() => toggleNeighborhoodExpanded(group.neighborhood)}
                          >
                            <Text style={styles.showMoreText}>+ {remainingCount} more venues</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Set up profile prompt if no favorites */}
              {isAuthenticated && favoriteNeighborhoods.length === 0 && !loadingPersonalization && (
                <View style={styles.section}>
                  <View style={styles.setupProfileCard}>
                    <Text style={styles.setupProfileEmoji}>⭐</Text>
                    <Text style={styles.setupProfileTitle}>Personalize your experience</Text>
                    <Text style={styles.setupProfileText}>
                      Set up your favorite neighborhoods to find venues faster
                    </Text>
                    <TouchableOpacity
                      style={styles.setupProfileButton}
                      onPress={() => navigation.navigate("ProfileSetup")}
                    >
                      <Text style={styles.setupProfileButtonText}>Set up profile</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* HOT NOW - Only show if there are recent vibes */}
              {hotNowWithVenues.length > 0 && (
                <View style={styles.section}>
                  {renderSectionHeader("🔥", "HOT NOW", hotNowWithVenues.length)}
                  <Text style={styles.sectionSubtitle}>Venues with recent vibes</Text>
                  {hotNowWithVenues.slice(0, 5).map((item) => (
                    <TouchableOpacity
                      key={`hot-${item.id}`}
                      style={styles.hotVenueRow}
                      onPress={() => handleVenueSelect(item.venue)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.venueRowContent}>
                        <View style={styles.recentVibeHeader}>
                          <Text style={styles.venueName}>{item.venue.name}</Text>
                          <View style={styles.hotBadge}>
                            <Text style={styles.hotBadgeText}>{formatTimeAgo(item.created_at)}</Text>
                          </View>
                        </View>
                        <Text style={styles.venueNeighborhood}>{item.venue.neighborhood}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#6B7280" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* ALL VENUES - Collapsible */}
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.collapsibleSectionHeader}
                  onPress={() => {
                    try {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    } catch (e) {}
                    setAllVenuesExpanded(!allVenuesExpanded);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.sectionHeaderContent}>
                    <Text style={styles.sectionIcon}>🌍</Text>
                    <Text style={styles.sectionTitle}>ALL VENUES</Text>
                    <View style={styles.sectionCount}>
                      <Text style={styles.sectionCountText}>{venues.length}</Text>
                    </View>
                  </View>
                  <Ionicons
                    name={allVenuesExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="#A855F7"
                  />
                </TouchableOpacity>

                {allVenuesExpanded && neighborhoodGroups.map((group) => (
                  <View key={group.neighborhood} style={styles.neighborhoodSection}>
                    <Text style={styles.neighborhoodHeader}>{group.neighborhood}</Text>
                    {group.venues.map((venue) => renderVenueRow(venue, false))}
                  </View>
                ))}

                {!allVenuesExpanded && (
                  <Text style={styles.collapsedHint}>Tap to browse all venues by neighborhood</Text>
                )}
              </View>
            </>
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
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
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
  // Section styles
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  collapsibleSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(168,85,247,0.1)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.25)",
  },
  sectionHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  collapsedHint: {
    color: "#6B7280",
    fontSize: 13,
    textAlign: "center",
    marginTop: -4,
  },
  sectionIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#9CA3AF",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  sectionCount: {
    marginLeft: 8,
    backgroundColor: "rgba(168,85,247,0.2)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sectionCountText: {
    color: "#A855F7",
    fontSize: 12,
    fontWeight: "600",
  },
  sectionSubtitle: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: -8,
    marginBottom: 12,
  },
  // Recent vibes row
  recentVibeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(168,85,247,0.1)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.25)",
  },
  recentVibeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recentVibeTime: {
    color: "#A855F7",
    fontSize: 12,
    fontWeight: "600",
  },
  // Hot venue row
  hotVenueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(245,158,11,0.1)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.25)",
  },
  hotBadge: {
    backgroundColor: "rgba(245,158,11,0.2)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  hotBadgeText: {
    color: "#F59E0B",
    fontSize: 11,
    fontWeight: "600",
  },
  // Favorite neighborhood card
  favoriteNeighborhoodCard: {
    backgroundColor: "#0B0625",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
    marginBottom: 12,
    overflow: "hidden",
  },
  favoriteNeighborhoodHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    backgroundColor: "rgba(168,85,247,0.08)",
  },
  favoriteNeighborhoodTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  favoriteNeighborhoodIcon: {
    fontSize: 16,
  },
  favoriteNeighborhoodName: {
    color: "#F9FAFB",
    fontSize: 15,
    fontWeight: "600",
  },
  neighborhoodCountBadge: {
    backgroundColor: "rgba(168,85,247,0.3)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  neighborhoodCountText: {
    color: "#A855F7",
    fontSize: 11,
    fontWeight: "700",
  },
  compactVenueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(168,85,247,0.15)",
  },
  compactVenueNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  compactVenueName: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "500",
  },
  compactVenueTypeEmoji: {
    fontSize: 11,
  },
  showMoreButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(168,85,247,0.15)",
  },
  showMoreText: {
    color: "#A855F7",
    fontSize: 13,
    fontWeight: "600",
  },
  // Setup profile card
  setupProfileCard: {
    backgroundColor: "#0B0625",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
    padding: 20,
    alignItems: "center",
  },
  setupProfileEmoji: {
    fontSize: 32,
    marginBottom: 12,
  },
  setupProfileTitle: {
    color: "#F9FAFB",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  setupProfileText: {
    color: "#9CA3AF",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 16,
  },
  setupProfileButton: {
    backgroundColor: "#A855F7",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  setupProfileButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  // Neighborhood section (ALL VENUES)
  neighborhoodSection: {
    marginBottom: 20,
  },
  neighborhoodHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: "#A855F7",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  // Standard venue row
  venueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0B0625",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.2)",
  },
  venueRowContent: {
    flex: 1,
  },
  venueNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  venueName: {
    color: "#F9FAFB",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  venueTypeEmoji: {
    fontSize: 12,
    marginBottom: 2,
  },
  venueNeighborhood: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "500",
  },
  // Loading & empty states
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
  loadingText: {
    color: "#E5E7EB",
    fontSize: 14,
    marginTop: 12,
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
