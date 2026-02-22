import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import VenueCardCompact from "./VenueCardCompact";
import { VenueCardSeparator } from "./VenueCardSeparator";
import { mapCoverPriceToUI, BAR_TIER_UI_LABELS, mapBarTierToUI, mapLegacyDrinksPriceToTier } from "../utils/priceMapping";
import { getVenueKeySafe } from "../utils/venueHelpers";
import { useAppContext } from "../contexts/AppContext";
import { useAuth } from "../contexts/AuthContext";
import { computeStatusLine, computeChips, computeFeedScore } from "../utils/feedHelpers";
import { isVibeActive } from "../utils/vibeDecay";
import { getVenuesByType } from "../services/venueService";
import { SCREEN_PADDING_HORIZONTAL, SCREEN_PADDING_TOP, SCREEN_PADDING_BOTTOM } from "../constants/spacing";
import IconButton from "./IconButton";

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
  const insets = useSafeAreaInsets();
  const { isAuthenticated, setShowAuthModal } = useAuth();
  const {
    venues: allVenues,
    loadingVenues: loadingAllVenues,
    latestVibesByVenueId,
    moveCountsByVenueId,
  } = useAppContext();
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedType, setSelectedType] = useState("Clubs");
  const [searchQuery, setSearchQuery] = useState("");

  const [activeFilters, setActiveFilters] = useState(() => {
    return { music: [], cover: [], crowd: [], neighborhood: [] };
  });

  // Reset type-specific filters when switching tabs; preserve crowd + neighborhood
  useEffect(() => {
    setActiveFilters(prev => {
      const keep = { crowd: prev.crowd || [], neighborhood: prev.neighborhood || [] };
      if (selectedType === "Clubs") {
        return { music: [], cover: [], ...keep };
      } else {
        return { drinks_price: [], ratio: [], ...keep };
      }
    });
  }, [selectedType]);

  // ── Filter options ─────────────────────────────────────────────
  // IMPORTANT: Values must exactly match what PostVibeScreen / CheckInModal write to the DB.

  const clubFilterOptions = {
    crowd:  ["Dead", "Chill", "Fun", "Packed", "Chaos"],
    music:  ["Hip-Hop / R&B", "Afrobeats", "House / Techno", "Latin / Reggaeton", "Pop / Top Hits", "Mixed"],
    cover:  ["Free", "< $10", "$10-20", "$20-30", "$30+"],
    line:   ["No line", "Short wait", "Long line", "Not worth it"],
  };

  const barFilterOptions = {
    crowd:        ["Dead", "Chill", "Fun", "Packed"],
    drinks_price: [
      BAR_TIER_UI_LABELS.cheap,
      BAR_TIER_UI_LABELS.moderate,
      BAR_TIER_UI_LABELS.pricey,
      BAR_TIER_UI_LABELS.expensive,
    ],
    ratio:        ["Mostly guys", "Balanced", "Mostly girls"],
  };

  // ── Load venues by type ────────────────────────────────────────
  const loadVenues = async () => {
    if (loadingAllVenues) {
      setLoading(true);
      return;
    }
    setLoading(true);
    try {
      const venueTypeFilter = selectedType === "Clubs" ? "club" : "bar";
      const fetchedVenues = await getVenuesByType(venueTypeFilter);
      setVenues(fetchedVenues);
    } catch (error) {
      console.error("[ExploreScreen] Error loading venues:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVenues();
  }, [selectedType, loadingAllVenues]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const venueTypeFilter = selectedType === "Clubs" ? "club" : "bar";
      const fetchedVenues = await getVenuesByType(venueTypeFilter);
      setVenues(fetchedVenues);
    } finally {
      setRefreshing(false);
    }
  };

  const toggleFilter = (filterType, value) => {
    setActiveFilters((prev) => {
      const arr = prev[filterType] || [];
      return arr.includes(value)
        ? { ...prev, [filterType]: arr.filter((x) => x !== value) }
        : { ...prev, [filterType]: [...arr, value] };
    });
  };

  // ── Filter logic ───────────────────────────────────────────────
  const filteredVenues = useMemo(() => {
    const list = venues || [];
    const isClub = selectedType === "Clubs";

    return list.filter((venue) => {
      const key = getVenueKeySafe(venue);
      if (!key) return false;

      const vibe = latestVibesByVenueId?.[key] ?? null;

      // Search — name, neighborhood, or music/bar_type
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch          = (venue.name || "").toLowerCase().includes(q);
        const neighborhoodMatch  = (venue.neighborhood || "").toLowerCase().includes(q);
        const musicMatch         = (vibe?.music || venue.default_music_genre || "").toLowerCase().includes(q);
        const barTypeMatch       = (vibe?.bar_type || "").toLowerCase().includes(q);
        if (!nameMatch && !neighborhoodMatch && !musicMatch && !barTypeMatch) return false;
      }

      const hasActiveFilters = Object.values(activeFilters).some(
        (arr) => Array.isArray(arr) && arr.length > 0
      );

      // Neighbourhood filter always applies regardless of vibe
      if (activeFilters.neighborhood?.length > 0) {
        if (!activeFilters.neighborhood.includes(venue.neighborhood)) return false;
      }

      if (!vibe) {
        if (isClub) {
          // Cover, crowd, and line filters require a live vibe
          if (
            activeFilters.cover?.length > 0 ||
            activeFilters.crowd?.length > 0 ||
            activeFilters.line?.length > 0
          ) return false;
          // Music can be inferred from the venue's default genre
          if (activeFilters.music?.length > 0) {
            return !!venue.default_music_genre &&
              activeFilters.music.includes(venue.default_music_genre);
          }
        } else {
          // All bar-specific filters require a live vibe
          if (
            activeFilters.drinks_price?.length > 0 ||
            activeFilters.crowd?.length > 0 ||
            activeFilters.ratio?.length > 0
          ) return false;
        }
        return !hasActiveFilters;
      }

      // ── Club filters ──
      if (isClub) {
        if (activeFilters.crowd?.length > 0) {
          if (!vibe.crowd || !activeFilters.crowd.includes(vibe.crowd)) return false;
        }
        if (activeFilters.music?.length > 0) {
          // Fall back to venue default when tonight's vibe has no music reported
          const musicValue = vibe.music || venue.default_music_genre;
          if (!musicValue || !activeFilters.music.includes(musicValue)) return false;
        }
        if (activeFilters.cover?.length > 0) {
          const coverUI = mapCoverPriceToUI(vibe.cover);
          if (!activeFilters.cover.includes(coverUI)) return false;
        }
        if (activeFilters.line?.length > 0) {
          const lineVal = vibe.line || "";
          const matched = activeFilters.line.some(f => lineVal.toLowerCase().includes(f.toLowerCase()));
          if (!matched) return false;
        }
      }

      // ── Bar filters ──
      if (!isClub) {
        if (activeFilters.crowd?.length > 0) {
          if (!vibe.crowd || !activeFilters.crowd.includes(vibe.crowd)) return false;
        }
        if (activeFilters.drinks_price?.length > 0) {
          let vibeUILabel = null;
          if (vibe.drinks_price_tier) {
            vibeUILabel = mapBarTierToUI(vibe.drinks_price_tier);
          } else if (vibe.drinks_price) {
            const tier = mapLegacyDrinksPriceToTier(vibe.drinks_price);
            vibeUILabel = tier ? mapBarTierToUI(tier) : null;
          }
          if (!vibeUILabel || !activeFilters.drinks_price.includes(vibeUILabel)) return false;
        }
        if (activeFilters.ratio?.length > 0) {
          if (!vibe.ratio || !activeFilters.ratio.includes(vibe.ratio)) return false;
        }
      }

      return true;
    });
  }, [venues, latestVibesByVenueId, searchQuery, activeFilters, selectedType]);

  // ── Sort filtered venues by feed score (same ranking as HomeScreen) ──
  const sortedFilteredVenues = useMemo(() => {
    const now = new Date();
    return [...filteredVenues].sort((a, b) => {
      const keyA   = getVenueKeySafe(a);
      const keyB   = getVenueKeySafe(b);
      const vibeA  = latestVibesByVenueId?.[keyA] ?? null;
      const vibeB  = latestVibesByVenueId?.[keyB] ?? null;
      const moveA  = moveCountsByVenueId?.[keyA] || 0;
      const moveB  = moveCountsByVenueId?.[keyB] || 0;
      const scoreA = computeFeedScore(a, vibeA, moveA, now);
      const scoreB = computeFeedScore(b, vibeB, moveB, now);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [filteredVenues, latestVibesByVenueId, moveCountsByVenueId]);

  // ── Render a single venue card — identical pipeline to HomeScreen ──
  const renderVenueCard = (item, index, total) => {
    const key = getVenueKeySafe(item);
    if (!key) return null;

    const latestVibe = latestVibesByVenueId?.[key] ?? null;
    const moveCount  = moveCountsByVenueId?.[key] || 0;
    const now        = new Date();

    const statusLine = computeStatusLine(item, latestVibe, moveCount, now);
    const chips      = computeChips(item, latestVibe, now);
    const live       = isVibeActive(latestVibe?.created_at);

    return (
      <React.Fragment key={key}>
        <VenueCardCompact
          venue={item}
          statusLine={statusLine}
          chips={chips}
          isLive={live}
          lastVibeTimestamp={latestVibe?.created_at || null}
          moveCount={moveCount}
          onPress={() => onOpenVenue(item)}
        />
        {index < total - 1 && <VenueCardSeparator />}
      </React.Fragment>
    );
  };

  const clearFilters = () => {
    setActiveFilters(prev => {
      const keep = { neighborhood: prev.neighborhood || [] };
      if (selectedType === "Clubs") {
        return { music: [], cover: [], crowd: [], line: [], ...keep };
      } else {
        return { drinks_price: [], ratio: [], crowd: [], ...keep };
      }
    });
  };

  const hasAnyActiveFilter = Object.values(activeFilters).some(
    arr => Array.isArray(arr) && arr.length > 0
  );

  // Guest mode: show locked screen instead of the explore feed
  if (!isAuthenticated) {
    return (
      <View style={[styles.container, styles.lockedContainer]}>
        <View style={styles.lockedContent}>
          <View style={styles.lockedIconWrap}>
            <Ionicons name="lock-closed" size={40} color="#A855F7" />
          </View>
          <Text style={styles.lockedTitle}>Explore Locked</Text>
          <Text style={styles.lockedSubtitle}>
            Sign in to explore all venues and live vibes across the city.
          </Text>
          <TouchableOpacity
            style={styles.lockedButton}
            onPress={() => setShowAuthModal(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.lockedButtonText}>Sign In or Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Explore</Text>
        <IconButton onPress={() => tabNavigation?.navigate("ProfileTab")}>
          <Ionicons name="person-circle-outline" size={28} color="#A855F7" />
        </IconButton>
      </View>

      {/* Clubs / Bars toggle */}
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

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search: Soho, reggaeton, cocktail…"
          placeholderTextColor="#6B7280"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter chips — type-aware */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersContent}
      >
        {selectedType === "Clubs" ? (
          <>
            {clubFilterOptions.crowd.map(c => (
              <FilterChip key={`crowd-${c}`} label={c}
                isActive={activeFilters.crowd?.includes(c)}
                onPress={() => toggleFilter("crowd", c)} />
            ))}
            {clubFilterOptions.music.map(m => (
              <FilterChip key={`music-${m}`} label={m}
                isActive={activeFilters.music?.includes(m)}
                onPress={() => toggleFilter("music", m)} />
            ))}
            {clubFilterOptions.cover.map(co => (
              <FilterChip key={`cover-${co}`} label={`Cover: ${co}`}
                isActive={activeFilters.cover?.includes(co)}
                onPress={() => toggleFilter("cover", co)} />
            ))}
            {clubFilterOptions.line.map(l => (
              <FilterChip key={`line-${l}`} label={`Line: ${l}`}
                isActive={activeFilters.line?.includes(l)}
                onPress={() => toggleFilter("line", l)} />
            ))}
          </>
        ) : (
          <>
            {barFilterOptions.crowd.map(c => (
              <FilterChip key={`crowd-${c}`} label={c}
                isActive={activeFilters.crowd?.includes(c)}
                onPress={() => toggleFilter("crowd", c)} />
            ))}
            {barFilterOptions.drinks_price.map(p => (
              <FilterChip key={`price-${p}`} label={`Drinks: ${p}`}
                isActive={activeFilters.drinks_price?.includes(p)}
                onPress={() => toggleFilter("drinks_price", p)} />
            ))}
            {barFilterOptions.ratio.map(r => (
              <FilterChip key={`ratio-${r}`} label={r}
                isActive={activeFilters.ratio?.includes(r)}
                onPress={() => toggleFilter("ratio", r)} />
            ))}
          </>
        )}
      </ScrollView>

      {/* Active-filter count badge + clear button */}
      {hasAnyActiveFilter && (
        <View style={styles.activeFilterRow}>
          <Text style={styles.activeFilterCount}>
            {Object.values(activeFilters).flat().length} filter{Object.values(activeFilters).flat().length !== 1 ? "s" : ""} active
          </Text>
          <TouchableOpacity onPress={clearFilters} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>Clear all</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Venue cards — same cards as HomeScreen */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#A855F7"
            colors={["#A855F7"]}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading venues…</Text>
          </View>
        ) : sortedFilteredVenues.length > 0 ? (
          sortedFilteredVenues.map((venue, index) =>
            renderVenueCard(venue, index, sortedFilteredVenues.length)
          )
        ) : (
          <View style={styles.emptyContainer}>
            {hasAnyActiveFilter ? (
              <>
                <Ionicons name="funnel-outline" size={48} color="#6B7280" style={{ marginBottom: 12 }} />
                <Text style={styles.emptyText}>No venues match your filters</Text>
                <Text style={styles.emptySubtext}>Try adjusting or clearing filters</Text>
                <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050013" },

  lockedContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  lockedContent: {
    alignItems: "center",
    paddingHorizontal: 40,
  },
  lockedIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(168,85,247,0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  lockedTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#F5F3FF",
    marginBottom: 12,
    textAlign: "center",
  },
  lockedSubtitle: {
    fontSize: 15,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  lockedButton: {
    backgroundColor: "#A855F7",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 40,
    shadowColor: "#A855F7",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
  lockedButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    fontFamily: "Inter_800ExtraBold",
    color: "#F5F3FF",
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

  filtersScroll: { maxHeight: 40, marginBottom: 6 },
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

  activeFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
  },
  activeFilterCount: {
    color: "#A855F7",
    fontSize: 12,
    fontWeight: "600",
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(168,85,247,0.12)",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
  },
  clearBtnText: { color: "#C084FC", fontSize: 12, fontWeight: "600" },

  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: SCREEN_PADDING_HORIZONTAL,
    paddingTop: SCREEN_PADDING_TOP,
    paddingBottom: SCREEN_PADDING_BOTTOM,
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
  clearFiltersText: { color: "#A855F7", fontSize: 14, fontWeight: "600" },
});
