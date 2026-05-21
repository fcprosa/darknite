import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getFeedForPlace } from "../services/feedService";
import { COLORS } from "../constants";
import VibeCard from "./VibeCard";
import EmptyState, { EmptyStates } from "./EmptyState";

export default function VenueVibesScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const placeId = route.params?.placeId || route.params?.place_id;
  const placeName = route.params?.placeName || route.params?.place_name || "Venue";
  const venueType = route.params?.venueType || route.params?.venue_type || "bar";

  const [vibes, setVibes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadVibes = useCallback(
    async (isRefresh = false) => {
      if (!placeId) {
        setVibes([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const data = await getFeedForPlace(placeId);
        setVibes(data);
      } catch (err) {
        console.error("[VenueVibesScreen] load error:", err);
        setVibes([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [placeId]
  );

  useFocusEffect(
    useCallback(() => {
      loadVibes(false);
    }, [loadVibes])
  );

  const handlePostVibe = useCallback(() => {
    navigation.navigate("PostVibe", {
      venue: {
        id: placeId,
        place_id: placeId,
        name: placeName,
        venue_type: venueType,
      },
    });
  }, [navigation, placeId, placeName, venueType]);

  const renderItem = useCallback(
    ({ item }) => (
      <VibeCard vibe={item} venueName={placeName} venueType={venueType} />
    ),
    [placeName, venueType]
  );

  const listEmpty = useCallback(() => {
    if (loading) return null;
    return (
      <View style={styles.emptyWrap}>
        <EmptyState variant="compact" {...EmptyStates.venueFirstVibe} />
        <TouchableOpacity
          style={styles.postVibeBtn}
          onPress={handlePostVibe}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle-outline" size={22} color={COLORS.textPrimary} />
          <Text style={styles.postVibeBtnText}>Post Vibe</Text>
        </TouchableOpacity>
      </View>
    );
  }, [loading, handlePostVibe]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {placeName}
          </Text>
          <Text style={styles.subtitle}>Vibes from the last 8 hours</Text>
        </View>
        <TouchableOpacity
          style={styles.headerPostBtn}
          onPress={handlePostVibe}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={vibes}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 24 },
            vibes.length === 0 && styles.listContentEmpty,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadVibes(true)}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={listEmpty}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  headerPostBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
  postVibeBtn: {
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
  postVibeBtnText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
});
