import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { getPlaceDetails, getPlacePhoto } from "../services/googlePlacesService";
import { COLORS } from "../constants";

export default function VenueDetailSheet({ place, onClose, onPostVibe }) {
  const sheetRef = useRef(null);
  const snapPoints = useMemo(() => ["32%", "55%"], []);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!place?.place_id) {
      sheetRef.current?.close();
      return;
    }

    sheetRef.current?.snapToIndex(1);
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

  const handleSheetChange = useCallback(
    (index) => {
      if (index === -1) onClose?.();
    },
    [onClose]
  );

  const display = details || place;
  const photoUrl = display?.photoReference
    ? getPlacePhoto(display.photoReference, 480)
    : null;
  const venueTypeLabel =
    display?.venue_type === "club" ? "Night Club" : "Bar";

  const handlePostVibe = () => {
    if (!display) return;
    onPostVibe?.({
      place_id: display.place_id,
      name: display.name,
      venue_type: display.venue_type || "bar",
    });
  };

  if (!place) return null;

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onChange={handleSheetChange}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetScrollView contentContainerStyle={styles.content}>
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
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handle: {
    backgroundColor: COLORS.border,
    width: 40,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
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
    gap: 8,
  },
  ctaText: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: "700",
  },
});
