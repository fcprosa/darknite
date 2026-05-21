import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Marker } from "react-native-maps";
import { COLORS } from "../constants";

export default function VenueMapMarker({ place, vibeCount = 0, onPress }) {
  const { latitude, longitude } = place.geometry?.location || {};

  if (!latitude || !longitude) return null;

  return (
    <Marker
      coordinate={{ latitude, longitude }}
      onPress={() => onPress?.(place)}
      tracksViewChanges={false}
    >
      <View style={styles.pinContainer}>
        <View style={styles.pin}>
          <View style={styles.pinDot} />
        </View>
        {vibeCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {vibeCount > 99 ? "99+" : vibeCount}
            </Text>
          </View>
        ) : null}
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  pinContainer: {
    alignItems: "center",
  },
  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.primaryGlow,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 4,
  },
  pinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.textPrimary,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: COLORS.background,
  },
  badgeText: {
    color: COLORS.background,
    fontSize: 10,
    fontWeight: "700",
  },
});
