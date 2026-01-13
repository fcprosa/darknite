import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import VenueCardLovable from "./VenueCardLovable";
import { mapCoverPriceToUI, BAR_TIER_UI_LABELS, mapBarTierToUI, mapLegacyDrinksPriceToTier } from "../utils/priceMapping";
import { fetchLatestVibe } from "../utils/vibeHelpers";
import { formatTimeAgo } from "../utils/timeHelpers";
import { getVenueKeySafe } from "../utils/venueHelpers";
import { useAppContext } from "../contexts/AppContext";
import { getVenuesByType } from "../services/venueService";


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

function FilterChip({ label, isActive, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.filterChip, isActive && styles.filterChipActive]}
      onPress={() => {
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (e) {}
        onPress();
      }}
      activeOpacity={0.7}
    >
      <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function ExploreScreen({ navigation, tabNavigation, onOpenVenue }) {
  const { venues: allVenues, loadingVenues: loadingAllVenues } = useAppContext();
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState("Clubs");
  const [searchQuery, setSearchQuery] = useState("");
  const [ratios, setRatios] = useState({});
  const [latestVibes, setLatestVibes] = useState({});

  const [activeFilters, setActiveFilters] = useState(() => {
    return selectedType === "Clubs"
      ? { music: [], cover: [], line: [], vibe: [], neighborhood: [] }
      : { bar_type: [], drinks_price: [], ratio: [], vibe: [], neighborhood: [] };
  });

  // Reset filters when switching tabs
  useEffect(() => {
    // Preserve neighborhood filter when switching tabs
    setActiveFilters(prev => {
      const currentNeighborhood = prev.neighborhood || [];
      
      if (selectedType === "Clubs") {
        return { music: [], cover: [], line: [], vibe: [], neighborhood: currentNeighborhood };
      } else {
        return { bar_type: [], drinks_price: [], ratio: [], vibe: [], neighborhood: currentNeighborhood };
      }
    });
  }, [selectedType]);

  // Filter options by venue type
  const clubFilterOptions = {
    music: ["Hip-Hop / R&B", "Afrobeats", "House / Techno", "Reggaeton", "Top Hits", "Mixed"],
    cover: ["Free", "< $10", "$10-20", "$20-30", "$30+"],
    line: ["No line", "Short", "30+ min"],
    vibe: ["Chill", "Chaos"],
  };

  const barFilterOptions = {
    bar_type: ["Cocktail", "Sports", "Dive", "Rooftop", "Wine", "Speakeasy"],
    drinks_price: [
      BAR_TIER_UI_LABELS.cheap,
      BAR_TIER_UI_LABELS.normal,
      BAR_TIER_UI_LABELS.expensive,
      BAR_TIER_UI_LABELS.crazy,
    ],
    ratio: ["Mostly guys", "Balanced", "Mostly girls"],
    vibe: ["Chill", "Chaos"],
  };

  const neighborhoods = useMemo(() => {
    return [...new Set(venues.map((v) => v.neighborhood))].sort();
  }, [venues]);

  useEffect(() => {
    async function load() {
      if (loadingAllVenues) {
        setLoading(true);
        return;
      }

      setLoading(true);
      const venueTypeFilter = selectedType === "Clubs" ? "club" : "bar";

      // Use service to fetch venues by type
      const fetchedVenues = await getVenuesByType(venueTypeFilter);

      if (fetchedVenues.length === 0) {
        setVenues([]);
        setRatios({});
        setLatestVibes({});
        setLoading(false);
        return;
      }

      // Fetch all vibes in parallel BEFORE setting state
      const vibePromises = fetchedVenues.map(venue => 
        fetchLatestVibe(getVenueKeySafe(venue))
      );
      const vibeResults = await Promise.all(vibePromises);

      const nextRatios = {};
      const nextVibes = {};

      vibeResults.forEach((vibe, index) => {
        if (vibe) {
          const key = getVenueKeySafe(fetchedVenues[index]);
          if (key) {
            nextVibes[key] = vibe;
            if (vibe.ratio) nextRatios[key] = mapRatioToPercent(vibe.ratio);
          }
        }
      });

      // Set all state together at the end
      setVenues(fetchedVenues);
      setRatios(nextRatios);
      setLatestVibes(nextVibes);
      setLoading(false);
    }

    load();
  }, [selectedType, loadingAllVenues]);

  const toggleFilter = (filterType, value) => {
    setActiveFilters((prev) => {
      const arr = prev[filterType] || [];
      return arr.includes(value)
        ? { ...prev, [filterType]: arr.filter((x) => x !== value) }
        : { ...prev, [filterType]: [...arr, value] };
    });
  };

  const filteredVenues = useMemo(() => {
    const list = venues || [];
    const isClub = selectedType === "Clubs";

    return list.filter((venue) => {
      const key = getVenueKeySafe(venue);
      if (!key) return false; // Skip venues without valid IDs
      const vibe = latestVibes[key];

      // Search - works for both tabs
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (venue.name || "").toLowerCase().includes(q);
        const neighborhoodMatch = (venue.neighborhood || "").toLowerCase().includes(q);
        const musicMatch = vibe?.music?.toLowerCase().includes(q) || false;
        const barTypeMatch = vibe?.bar_type?.toLowerCase().includes(q) || false;
        if (!nameMatch && !neighborhoodMatch && !musicMatch && !barTypeMatch) return false;
      }

      // Check if any filters are active
      const hasActiveFilters = Object.values(activeFilters).some(
        (arr) => Array.isArray(arr) && arr.length > 0
      );

      if (!vibe) return !hasActiveFilters;

      if (isClub) {
        // CLUB FILTERS
        // Music filter
        if (activeFilters.music?.length > 0) {
          if (!vibe.music || !activeFilters.music.includes(vibe.music)) return false;
        }

        // Cover filter
        if (activeFilters.cover?.length > 0) {
          if (!vibe.cover || !activeFilters.cover.includes(vibe.cover)) return false;
        }

        // Line filter
        if (activeFilters.line?.length > 0) {
          if (!vibe.line || !activeFilters.line.includes(vibe.line)) return false;
        }

        // Vibe filter (crowd)
        if (activeFilters.vibe?.length > 0) {
          if (!vibe.crowd || !activeFilters.vibe.includes(vibe.crowd)) return false;
        }
      } else {
        // BAR FILTERS
        // Bar type filter - handle case sensitivity
        if (activeFilters.bar_type?.length > 0) {
          const vibeBarType = vibe.bar_type ? vibe.bar_type.toLowerCase() : null;
          const filterBarTypes = activeFilters.bar_type.map(bt => bt.toLowerCase());
          if (!vibeBarType || !filterBarTypes.includes(vibeBarType)) return false;
        }

        // Drinks price filter - for bars: use tier system, for clubs: use cover
        if (activeFilters.drinks_price?.length > 0) {
          let vibeUILabel = null;
          if (isBar) {
            // Bar: check drinks_price_tier (new) or legacy drinks_price
            if (vibe.drinks_price_tier) {
              vibeUILabel = mapBarTierToUI(vibe.drinks_price_tier);
            } else if (vibe.drinks_price) {
              // Backward compatibility: convert legacy to tier
              const tier = mapLegacyDrinksPriceToTier(vibe.drinks_price);
              vibeUILabel = tier ? mapBarTierToUI(tier) : null;
            }
          } else {
            // Club: drinks_price is actually cover charge
            vibeUILabel = vibe.cover ? mapCoverPriceToUI(vibe.cover) : null;
          }
          if (!vibeUILabel || !activeFilters.drinks_price.includes(vibeUILabel)) {
            return false;
          }
        }

        // Ratio filter (optional for bars)
        if (activeFilters.ratio?.length > 0) {
          if (!vibe.ratio || !activeFilters.ratio.includes(vibe.ratio)) return false;
        }

        // Vibe filter (crowd)
        if (activeFilters.vibe?.length > 0) {
          if (!vibe.crowd || !activeFilters.vibe.includes(vibe.crowd)) return false;
        }

        // Bartender filter (optional - only if column exists)
        // if (activeFilters.bartender?.length > 0) {
        //   if (!vibe.bartender_vibe || !activeFilters.bartender.includes(vibe.bartender_vibe)) return false;
        // }
      }

      // Neighborhood filter (works for both)
      if (activeFilters.neighborhood?.length > 0) {
        if (!activeFilters.neighborhood.includes(venue.neighborhood)) return false;
      }

      return true;
    });
  }, [venues, latestVibes, searchQuery, activeFilters, selectedType]);

  // Group filtered venues by neighborhood
  const neighborhoodGroups = useMemo(() => {
    const groups = {};
    for (const venue of filteredVenues) {
      const key = getVenueKeySafe(venue);
      if (!key) continue; // Skip venues without valid IDs
      const vibe = latestVibes[key];
      const neighborhood = venue.neighborhood || "Unknown";
      
      if (!groups[neighborhood]) {
        groups[neighborhood] = {
          neighborhood,
          venues: [],
          count: 0,
          lastUpdated: null,
        };
      }
      
      groups[neighborhood].venues.push(venue);
      groups[neighborhood].count += 1;
      
      // Track latest updated time
      if (vibe?.created_at) {
        const vibeTime = new Date(vibe.created_at);
        if (!groups[neighborhood].lastUpdated || vibeTime > groups[neighborhood].lastUpdated) {
          groups[neighborhood].lastUpdated = vibeTime;
        }
      }
    }
    
    // Convert to array and sort by neighborhood name
    return Object.values(groups).sort((a, b) => a.neighborhood.localeCompare(b.neighborhood));
  }, [filteredVenues, latestVibes]);

  const renderVenueCard = (item) => {
    const key = getVenueKeySafe(item);
    if (!key) return null; // Skip venues without valid IDs
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
  };


  const renderNeighborhoodCard = (group) => {
    const lastUpdatedText = group.lastUpdated ? formatTimeAgo(group.lastUpdated, true) : null;
    
    const handlePress = () => {
      console.log('[Explore] neighborhood pressed', group.neighborhood);
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {
        console.log('[Explore] Haptics error:', e);
      }
      // Navigate to NeighborhoodVenuesScreen
      navigation.navigate("NeighborhoodVenues", {
        neighborhood: group.neighborhood,
        selectedType: selectedType,
      });
    };
    
    return (
      <TouchableOpacity
        key={group.neighborhood}
        style={styles.neighborhoodCard}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <View style={styles.neighborhoodCardContent}>
          <View style={styles.neighborhoodCardLeft}>
            <Text style={styles.neighborhoodCardName}>{group.neighborhood}</Text>
            <Text style={styles.neighborhoodCardCount}>{group.count} venue{group.count !== 1 ? 's' : ''}</Text>
          </View>
          <View style={styles.neighborhoodCardRight}>
            {lastUpdatedText && (
              <Text style={styles.neighborhoodCardTime}>{lastUpdatedText}</Text>
            )}
            <Ionicons
              name="chevron-forward"
              size={20}
              color="#A855F7"
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Explore</Text>
        <TouchableOpacity onPress={() => tabNavigation?.navigate("ProfileTab")} style={styles.profileIconButton}>
          <Ionicons name="person-circle-outline" size={28} color="#A855F7" />
        </TouchableOpacity>
      </View>

      {/* Clubs/Bars Toggle */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleButton, selectedType === "Clubs" && styles.toggleButtonActive]}
          onPress={() => setSelectedType("Clubs")}
        >
          <Text style={[styles.toggleText, selectedType === "Clubs" && styles.toggleTextActive]}>Clubs</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleButton, selectedType === "Bars" && styles.toggleButtonActive]}
          onPress={() => setSelectedType("Bars")}
        >
          <Text style={[styles.toggleText, selectedType === "Bars" && styles.toggleTextActive]}>Bars</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search: Soho, reggaeton, rooftop…"
          placeholderTextColor="#6B7280"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersContent}
      >
        {selectedType === "Clubs" ? (
          <>
            {/* Club filters: Music */}
            {clubFilterOptions.music.map((music) => (
              <FilterChip
                key={music}
                label={music}
                isActive={activeFilters.music?.includes(music) || false}
                onPress={() => toggleFilter("music", music)}
              />
            ))}
            {/* Club filters: Cover */}
            {clubFilterOptions.cover.map((cover) => (
              <FilterChip
                key={cover}
                label={cover}
                isActive={activeFilters.cover?.includes(cover) || false}
                onPress={() => toggleFilter("cover", cover)}
              />
            ))}
            {/* Club filters: Line */}
            {clubFilterOptions.line.map((line) => (
              <FilterChip
                key={line}
                label={line}
                isActive={activeFilters.line?.includes(line) || false}
                onPress={() => toggleFilter("line", line)}
              />
            ))}
            {/* Club filters: Vibe */}
            {clubFilterOptions.vibe.map((vibe) => (
              <FilterChip
                key={vibe}
                label={vibe}
                isActive={activeFilters.vibe?.includes(vibe) || false}
                onPress={() => toggleFilter("vibe", vibe)}
              />
            ))}
          </>
        ) : (
          <>
            {/* Bar filters: Bar Type */}
            {barFilterOptions.bar_type.map((barType) => (
              <FilterChip
                key={barType}
                label={barType}
                isActive={activeFilters.bar_type?.includes(barType) || false}
                onPress={() => toggleFilter("bar_type", barType)}
              />
            ))}
            {/* Bar filters: Drinks Price */}
            {barFilterOptions.drinks_price.map((price) => (
              <FilterChip
                key={price}
                label={price}
                isActive={activeFilters.drinks_price?.includes(price) || false}
                onPress={() => toggleFilter("drinks_price", price)}
              />
            ))}
            {/* Bar filters: Ratio */}
            {barFilterOptions.ratio.map((ratio) => (
              <FilterChip
                key={ratio}
                label={ratio}
                isActive={activeFilters.ratio?.includes(ratio) || false}
                onPress={() => toggleFilter("ratio", ratio)}
              />
            ))}
            {/* Bar filters: Vibe */}
            {barFilterOptions.vibe.map((vibe) => (
              <FilterChip
                key={vibe}
                label={vibe}
                isActive={activeFilters.vibe?.includes(vibe) || false}
                onPress={() => toggleFilter("vibe", vibe)}
              />
            ))}
          </>
        )}
      </ScrollView>

      {/* Neighborhoods */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading venues…</Text>
          </View>
        ) : (
          <>
            {neighborhoodGroups.length > 0 ? (
              <View style={styles.neighborhoodsContainer}>
                {neighborhoodGroups.map((group) => renderNeighborhoodCard(group))}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                {/* Check if any filters are active */}
                {Object.values(activeFilters).some(arr => Array.isArray(arr) && arr.length > 0) ? (
                  <>
                    <Ionicons name="funnel-outline" size={48} color="#6B7280" style={{ marginBottom: 12 }} />
                    <Text style={styles.emptyText}>No venues match your filters</Text>
                    <Text style={styles.emptySubtext}>Try adjusting or clearing filters</Text>
                    <TouchableOpacity
                      style={styles.clearFiltersButton}
                      onPress={() => setActiveFilters(prev => {
                        const currentNeighborhood = prev.neighborhood || [];
                        if (selectedType === "Clubs") {
                          return { music: [], cover: [], line: [], vibe: [], neighborhood: currentNeighborhood };
                        } else {
                          return { bar_type: [], drinks_price: [], ratio: [], vibe: [], neighborhood: currentNeighborhood };
                        }
                      })}
                    >
                      <Text style={styles.clearFiltersText}>Clear all filters</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Ionicons name="location-outline" size={48} color="#6B7280" style={{ marginBottom: 12 }} />
                    <Text style={styles.emptyText}>No {selectedType.toLowerCase()} found</Text>
                    <Text style={styles.emptySubtext}>Check back later for new venues</Text>
                  </>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050013" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#F5F3FF" },
  profileIconButton: { padding: 4 },

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
  toggleButton: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  toggleButtonActive: { backgroundColor: "#A855F7" },
  toggleText: { color: "#9CA3AF", fontSize: 14, fontWeight: "600" },
  toggleTextActive: { color: "#F9FAFB" },

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
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: "#F9FAFB", fontSize: 15 },

  filtersScroll: { maxHeight: 40, marginBottom: 12 },
  filtersContent: { paddingHorizontal: 16, gap: 6 },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(168,85,247,0.06)",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.22)",
    minHeight: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  filterChipActive: {
    backgroundColor: "rgba(168,85,247,0.30)",
    borderColor: "rgba(168,85,247,0.70)",
  },
  filterChipText: { color: "#E5E7EB", fontSize: 11, fontWeight: "600" },
  filterChipTextActive: { color: "#F9FAFB", fontWeight: "700" },

  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 32 },

  neighborhoodsContainer: { paddingHorizontal: 16, paddingTop: 8 },
  neighborhoodCard: {
    backgroundColor: "#0B0625",
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.4)",
    overflow: "hidden",
  },
  neighborhoodCardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  neighborhoodCardLeft: {
    flex: 1,
  },
  neighborhoodCardName: {
    color: "#F9FAFB",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  neighborhoodCardCount: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "500",
  },
  neighborhoodCardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  neighborhoodCardTime: {
    color: "#A855F7",
    fontSize: 12,
    fontWeight: "600",
  },

  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 48 },
  loadingText: { color: "#E5E7EB", fontSize: 14 },

  emptyContainer: { padding: 32, alignItems: "center" },
  emptyText: { color: "#9CA3AF", fontSize: 14 },
  emptySubtext: { 
    color: "#6B7280", 
    fontSize: 13, 
    marginTop: 4,
    textAlign: "center",
  },
  clearFiltersButton: {
    marginTop: 16,
    backgroundColor: "rgba(168,85,247,0.2)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#A855F7",
  },
  clearFiltersText: {
    color: "#A855F7",
    fontSize: 14,
    fontWeight: "600",
  },
});