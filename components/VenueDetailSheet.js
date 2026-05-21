import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import Modal from "react-native-modal";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getPlaceDetails, getPlacePhoto } from "../services/googlePlacesService";
import { getFeedForPlace } from "../services/feedService";
import { COLORS } from "../constants";
import EmptyState, { EmptyStates } from "./EmptyState";
import VibeCard from "./VibeCard";

const PREVIEW_VIBE_COUNT = 5;

export default function VenueDetailSheet({ place, onClose, onPostVibe }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [placeVibes, setPlaceVibes] = useState([]);
  const [vibesLoading, setVibesLoading] = useState(false);

  const visible = !!place?.place_id;

  useEffect(() => {
    if (!place?.place_id) {
      setDetails(null);
      return;
    }

    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const data = await getPlaceDetails(place.place_id);
        if (mounted) setDetails(data);
      } catch (err) {
        console.error("[VenueDetailSheet] load error:", err);
        if (mounted) setDetails(place);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [place?.place_id]);

  useEffect(() => {
    if (!place?.place_id) {
      setPlaceVibes([]);
      return;
    }

    let mounted = true;

    async function loadVibes() {
      setVibesLoading(true);
      try {
        const vibes = await getFeedForPlace(place.place_id);
        if (mounted) setPlaceVibes(vibes);
      } catch (err) {
        console.error("[VenueDetailSheet] vibes load error:", err);
        if (mounted) setPlaceVibes([]);
      } finally {
        if (mounted) setVibesLoading(false);
      }
    }

    loadVibes();
    return () => {
      mounted = false;
    };
  }, [place?.place_id]);

  const display = details || place;
  const photoUrl = display?.photoReference
    ? getPlacePhoto(display.photoReference, 480)
    : null;
  const venueTypeLabel =
    display?.venue_type === "club" ? "Night Club" : "Bar";
  const venueType = display?.venue_type || "bar";
  const venueName = display?.name || "Venue";
  const previewVibes = placeVibes.slice(0, PREVIEW_VIBE_COUNT);
  const hasMoreVibes = placeVibes.length > PREVIEW_VIBE_COUNT;

  const handlePostVibe = () => {
    if (!display) return;
    onPostVibe?.({
      place_id: display.place_id,
      name: display.name,
      venue_type: venueType,
    });
  };

  const handleSeeAllVibes = useCallback(() => {
    if (!display?.place_id) return;
    onClose?.();
    navigation.navigate("VenueVibes", {
      placeId: display.place_id,
      placeName: venueName,
      venueType,
    });
  }, [navigation, display?.place_id, venueName, venueType, onClose]);

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      onSwipeComplete={onClose}
      swipeDirection={["down"]}
      style={styles.modal}
      propagateSwipe
      animationIn="slideInUp"
      animationOut="slideOutDown"
      animationInTiming={400}
      animationOutTiming={300}
      backdropTransitionInTiming={400}
      backdropTransitionOutTiming={300}
      backdropOpacity={0.55}
      useNativeDriver
    >
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {loading && !display?.formatted_address ? (
            <ActivityIndicator
              size="large"
              color={COLORS.primary}
              style={styles.loader}
            />
          ) : (
            <>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, styles.photoPlaceholder]}>
                  <Ionicons
                    name="wine-outline"
                    size={40}
                    color={COLORS.textMuted}
                  />
                </View>
              )}

              <Text style={styles.name}>{display?.name}</Text>
              <Text style={styles.type}>{venueTypeLabel}</Text>
              <Text style={styles.address}>
                {display?.formatted_address || display?.vicinity || ""}
              </Text>

              {display?.rating != null ? (
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={16} color={COLORS.accent} />
                  <Text style={styles.ratingText}>
                    {display.rating.toFixed(1)}
                    {display.user_ratings_total
                      ? ` (${display.user_ratings_total})`
                      : ""}
                  </Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.ctaButton}
                onPress={handlePostVibe}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={22}
                  color={COLORS.textPrimary}
                />
                <Text style={styles.ctaText}>Post Vibe</Text>
              </TouchableOpacity>

              <View style={styles.vibesSection}>
                <Text style={styles.vibesSectionTitle}>Recent vibes</Text>
                {vibesLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={COLORS.primary}
                    style={styles.vibesLoader}
                  />
                ) : placeVibes.length === 0 ? (
                  <EmptyState
                    variant="compact"
                    {...EmptyStates.venueFirstVibe}
                  />
                ) : (
                  <>
                    {previewVibes.map((vibe) => (
                      <VibeCard
                        key={String(vibe.id)}
                        vibe={vibe}
                        venueName={venueName}
                        venueType={venueType}
                      />
                    ))}
                    <TouchableOpacity
                        style={styles.seeAllBtn}
                        onPress={handleSeeAllVibes}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.seeAllText}>
                          {hasMoreVibes
                            ? `See all ${placeVibes.length} vibes`
                            : "See all vibes"}
                        </Text>
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color={COLORS.primaryGlow}
                        />
                      </TouchableOpacity>
                  </>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    justifyContent: "flex-end",
    margin: 0,
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginTop: 10,
    marginBottom: 8,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  loader: {
    marginVertical: 40,
  },
  photo: {
    width: "100%",
    height: 160,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: COLORS.surfaceRaised,
  },
  photoPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  type: {
    color: COLORS.primaryGlow,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  address: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 6,
  },
  ratingText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    minHeight: 44,
    gap: 8,
  },
  ctaText: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: "700",
  },
  vibesSection: {
    marginTop: 24,
  },
  vibesSectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  vibesLoader: {
    marginVertical: 12,
  },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    minHeight: 44,
    marginTop: 4,
    gap: 6,
  },
  seeAllText: {
    color: COLORS.primaryGlow,
    fontSize: 15,
    fontWeight: "700",
  },
});
