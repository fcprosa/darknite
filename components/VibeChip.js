import React from "react";
import { View, Text, StyleSheet } from "react-native";

/**
 * VibeChip - Unified chip component for consistent styling across the app
 * 
 * @param {string} emoji - Emoji icon (optional)
 * @param {string} label - Text label
 * @param {string} variant - 'default' | 'live' | 'green' | 'purple' | 'moves'
 * @param {boolean} isLive - Whether this chip represents live data
 */
export default function VibeChip({ emoji, label, variant = "default", isLive = false }) {
  // Determine variant styling
  const variantStyle = isLive ? styles.chipLive : styles[variant] || styles.chipDefault;
  const textStyle = isLive ? styles.chipTextLive : styles[variant + "Text"] || styles.chipText;

  return (
    <View style={[styles.chip, variantStyle]}>
      {emoji && <Text style={styles.chipEmoji}>{emoji}</Text>}
      <Text style={textStyle} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    height: 32,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
    alignSelf: "flex-start",
    flexShrink: 0,
  },
  chipDefault: {
    backgroundColor: "rgba(148, 163, 184, 0.06)",
    borderColor: "rgba(148, 163, 184, 0.1)",
  },
  chipLive: {
    backgroundColor: "rgba(168, 85, 247, 0.08)",
    borderColor: "rgba(168, 85, 247, 0.25)",
  },
  chipGreen: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  chipPurple: {
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    borderColor: "rgba(168, 85, 247, 0.4)",
  },
  chipMoves: {
    backgroundColor: "rgba(155, 89, 182, 0.2)",
    borderColor: "rgba(155, 89, 182, 0.35)",
  },
  chipEmoji: {
    fontSize: 14,
    lineHeight: 14,
  },
  chipText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  chipTextLive: {
    color: "#E9D5FF",
    fontSize: 12,
    fontWeight: "600",
  },
  greenText: {
    color: "#6EE7B7",
    fontSize: 12,
    fontWeight: "600",
  },
  purpleText: {
    color: "#E9D5FF",
    fontSize: 12,
    fontWeight: "600",
  },
  movesText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
});
