import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants";

export default function PlaceCard({ place, onPress }) {
  const mainText =
    place?.structured_formatting?.main_text || place?.name || "Unknown";
  const secondaryText =
    place?.structured_formatting?.secondary_text ||
    place?.vicinity ||
    place?.formatted_address ||
    "";

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(place)}
      activeOpacity={0.7}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="wine-outline" size={20} color={COLORS.primaryGlow} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title} numberOfLines={1}>
          {mainText}
        </Text>
        {secondaryText ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {secondaryText}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    minHeight: 44,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  textWrap: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
});
