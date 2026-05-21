import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAppContext } from "../contexts/AppContext";
import { useAuth } from "../contexts/AuthContext";
import { getNearbyFeed, VIBE_WINDOW_HOURS } from "../services/feedService";
import { supabase } from "../utils/supabase";
import { COLORS, FAB_BOTTOM_OFFSET } from "../constants";
import VibeCard from "./VibeCard";
import EmptyState from "./EmptyState";
import VenueDetailSheet from "./VenueDetailSheet";

const SKELETON_ROWS = [1, 2, 3, 4, 5];
const FEED_LIMIT = 50;

const FEED_SELECT_FIELDS =
  "id, created_at, place_id, venue_id, user_id, crowd, ratio, line, cover, music, bar_type, drinks_price_tier, age_range, crowd_vibe, user_profiles!user_id(username)";

function attachFeedProfile(vibe) {
  if (!vibe || typeof vibe !== "object") return vibe;
  const profile = vibe.user_profiles;
  if (profile && typeof profile === "object") {
    vibe.username = profile.username || null;
    delete vibe.user_profiles;
  }
  return vibe;
}

function buildPlaceLookup(nearbyPlaces) {
  const map = {};
  (nearbyPlaces || []).forEach((place) => {
    const id = place?.place_id;
    if (!id) return;
    map[id] = place;
  });
  return map;
}

function isWithinFeedWindow(createdAt) {
  if (!createdAt) return false;
  const since = Date.now() - VIBE_WINDOW_HOURS * 60 * 60 * 1000;
  return new Date(createdAt).getTime() >= since;
}

function mergeVibesPrepend(prev, newVibe) {
  const id = String(newVibe.id);
  const filtered = prev.filter((v) => String(v.id) !== id);
  const merged = [newVibe, ...filtered];
  merged.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return merged.slice(0, FEED_LIMIT);
}

export default function FeedScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { nearbyPlaces, guestMode } = useAppContext();
  const { isAuthenticated, requireAuth } = useAuth();

  const [vibes, setVibes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);

  const placeIdsRef = useRef([]);
  const feedChannelRef = useRef(null);

  const placeIds = useMemo(
    () => (nearbyPlaces || []).map((p) => p.place_id).filter(Boolean),
    [nearbyPlaces]
  );

  const placeById = useMemo(() => buildPlaceLookup(nearbyPlaces), [nearbyPlaces]);

  const isGuestViewer = guestMode || !isAuthenticated;

  useEffect(() => {
    placeIdsRef.current = placeIds;
  }, [placeIds]);

  const loadFeed = useCallback(async (isRefresh = false) => {
    if (!placeIds.length) {
      setVibes([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await getNearbyFeed(placeIds);
      setVibes(data);
    } catch (err) {
      console.error("[FeedScreen] load error:", err);
      setVibes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [placeIds]);

  useEffect(() => {
    loadFeed(false);
  }, [loadFeed]);

  const fetchFeedVibeById = useCallback(async (vibeId) => {
    if (!vibeId) return null;
    try {
      const { data, error } = await supabase
        .from("vibes")
        .select(FEED_SELECT_FIELDS)
        .eq("id", vibeId)
        .maybeSingle();

      if (error || !data) return null;
      return attachFeedProfile({ ...data });
    } catch (err) {
      console.error("[FeedScreen] fetchFeedVibeById:", err);
      return null;
    }
  }, []);

  useEffect(() => {
    if (feedChannelRef.current) {
      supabase.removeChannel(feedChannelRef.current);
      feedChannelRef.current = null;
    }

    if (!placeIds.length) return undefined;

    const channel = supabase
      .channel("feed-vibes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "vibes" },
        async (payload) => {
          const row = payload?.new;
          const pid = row?.place_id || row?.venue_id;
          if (!pid || !placeIdsRef.current.includes(pid)) return;
          if (!isWithinFeedWindow(row?.created_at)) return;

          const full = await fetchFeedVibeById(row.id);
          if (!full) return;

          setVibes((prev) => mergeVibesPrepend(prev, full));
        }
      )
      .subscribe();

    feedChannelRef.current = channel;

    return () => {
      if (feedChannelRef.current) {
        supabase.removeChannel(feedChannelRef.current);
        feedChannelRef.current = null;
      }
    };
  }, [placeIds, fetchFeedVibeById]);

  const onRefresh = useCallback(() => {
    loadFeed(true);
  }, [loadFeed]);

  const goToMapForVibe = useCallback(() => {
    navigation.navigate("MainTabs", { screen: "MapTab" });
  }, [navigation]);

  const handleFabPress = useCallback(() => {
    if (isGuestViewer) {
      requireAuth();
      return;
    }
    requireAuth(goToMapForVibe);
  }, [isGuestViewer, requireAuth, goToMapForVibe]);

  const handlePostVibeFromSheet = useCallback(
    (place) => {
      setSelectedPlace(null);
      navigation.navigate("PostVibe", {
        venue: {
          id: place.place_id,
          place_id: place.place_id,
          name: place.name,
          venue_type: place.venue_type || "bar",
        },
      });
    },
    [navigation]
  );

  const handleVenuePress = useCallback(
    (pid) => {
      const place = placeById[pid];
      if (place) setSelectedPlace(place);
    },
    [placeById]
  );

  const renderItem = useCallback(
    ({ item }) => {
      const pid = item.place_id || item.venue_id;
      const place = placeById[pid];
      const meta = place
        ? { name: place.name || "Unknown venue", venue_type: place.venue_type || "bar" }
        : { name: "Nearby venue", venue_type: "bar" };

      return (
        <VibeCard
          vibe={item}
          venueName={meta.name}
          venueType={meta.venue_type}
          onVenuePress={place ? () => handleVenuePress(pid) : undefined}
        />
      );
    },
    [placeById, handleVenuePress]
  );

  const listEmpty = useCallback(() => {
    if (loading) return null;

    if (!placeIds.length) {
      return (
        <View style={styles.emptyWrap}>
          <EmptyState
            variant="compact"
            emoji="🗺️"
            title="Open the map first"
            message="Pan the map to load nearby venues, then check the feed for live vibes."
          />
        </View>
      );
    }

    if (isGuestViewer) {
      return (
        <View style={styles.emptyWrap}>
          <EmptyState
            variant="compact"
            emoji="🔐"
            title="Sign in to post a vibe and start the night"
            message="Browse nearby vibes as a guest, or sign in to contribute."
          />
          <TouchableOpacity
            style={styles.emptyCta}
            onPress={() => requireAuth()}
            activeOpacity={0.85}
          >
            <Text style={styles.emptyCtaText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyWrap}>
        <EmptyState
          variant="compact"
          emoji="✨"
          title="No vibes nearby yet — be the first"
          message="Pick a venue on the map and post the first vibe tonight."
        />
        <TouchableOpacity
          style={styles.emptyCta}
          onPress={handleFabPress}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle-outline" size={22} color={COLORS.textPrimary} />
          <Text style={styles.emptyCtaText}>Post Vibe</Text>
        </TouchableOpacity>
      </View>
    );
  }, [loading, placeIds.length, isGuestViewer, requireAuth, handleFabPress]);

  const listBottomPadding = insets.bottom + FAB_BOTTOM_OFFSET + 56;

  const showSkeleton = loading && !refreshing;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Feed</Text>
        <Text style={styles.subtitle}>Live vibes from the last 8 hours</Text>
      </View>

      <FlatList
        data={showSkeleton ? SKELETON_ROWS : vibes}
        keyExtractor={(item, index) =>
          showSkeleton ? `skeleton-${item}` : String(item.id)
        }
        renderItem={
          showSkeleton
            ? () => <VibeCard skeleton />
            : renderItem
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: listBottomPadding },
          !showSkeleton && vibes.length === 0 && styles.listContentEmpty,
        ]}
        refreshControl={
          showSkeleton ? undefined : (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          )
        }
        ListEmptyComponent={showSkeleton ? null : listEmpty}
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + FAB_BOTTOM_OFFSET }]}
        onPress={handleFabPress}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color={COLORS.textPrimary} />
      </TouchableOpacity>

      <VenueDetailSheet
        place={selectedPlace}
        onClose={() => setSelectedPlace(null)}
        onPostVibe={handlePostVibeFromSheet}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  emptyWrap: {
    paddingTop: 24,
    alignItems: "center",
  },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    minHeight: 44,
    gap: 8,
    marginTop: 16,
  },
  emptyCtaText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
