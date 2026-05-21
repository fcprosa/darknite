import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { COLORS } from "../constants";
import { formatTimeAgo } from "../utils/timeHelpers";
import { mapCoverPriceToUI } from "../utils/priceMapping";

function venueTypeLabel(type) {
  return type === "club" ? "Night Club" : "Bar";
}

function buildSnippet(vibe) {
  const parts = [];
  if (vibe?.crowd) parts.push(vibe.crowd);
  if (vibe?.music) parts.push(vibe.music);
  return parts.length ? parts.join(" · ") : "Vibe posted";
}

function VibeCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.skeletonBlock, styles.skeletonTitle]} />
          <View style={[styles.skeletonBlock, styles.skeletonChip]} />
        </View>
        <View style={[styles.skeletonBlock, styles.skeletonBadge]} />
      </View>
      <View style={styles.chipsRow}>
        <View style={[styles.skeletonBlock, styles.skeletonChipLine]} />
        <View style={[styles.skeletonBlock, styles.skeletonChipLine]} />
      </View>
      <View style={[styles.skeletonBlock, styles.skeletonSnippet]} />
      <View style={styles.footer}>
        <View style={[styles.skeletonBlock, styles.skeletonFooter]} />
        <View style={[styles.skeletonBlock, styles.skeletonFooterShort]} />
      </View>
    </View>
  );
}

export default function VibeCard({
  vibe,
  venueName = "Unknown venue",
  venueType = "bar",
  showXpBadge,
  skeleton = false,
  onVenuePress,
}) {
  if (skeleton) {
    return <VibeCardSkeleton />;
  }

  const username = vibe?.username ? `@${vibe.username}` : "@anonymous";
  const xpTotal = vibe?.feed_xp_total ?? 0;
  const showBadge = showXpBadge !== false && xpTotal > 20;

  const chips = [];
  if (vibe?.crowd) chips.push({ key: "crowd", label: vibe.crowd });
  if (vibe?.music) chips.push({ key: "music", label: `🎵 ${vibe.music}` });
  if (vibe?.line) chips.push({ key: "line", label: `⏱ ${vibe.line}` });
  if (vibe?.cover) chips.push({ key: "cover", label: `💵 ${mapCoverPriceToUI(vibe.cover)}` });
  if (vibe?.drinks_price_tier) {
    chips.push({ key: "drinks", label: `🍸 ${vibe.drinks_price_tier}` });
  }

  const venueNameEl = (
    <Text style={styles.venueName} numberOfLines={1}>
      {venueName}
    </Text>
  );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {onVenuePress ? (
            <TouchableOpacity onPress={onVenuePress} activeOpacity={0.7}>
              {venueNameEl}
            </TouchableOpacity>
          ) : (
            venueNameEl
          )}
          <View style={styles.typeChip}>
            <Text style={styles.typeChipText}>{venueTypeLabel(venueType)}</Text>
          </View>
        </View>
        {showBadge ? (
          <View style={styles.xpBadge}>
            <Text style={styles.xpBadgeText}>+{xpTotal} XP</Text>
          </View>
        ) : null}
      </View>

      {chips.length > 0 ? (
        <View style={styles.chipsRow}>
          {chips.map((chip) => (
            <Text key={chip.key} style={styles.chip}>
              {chip.label}
            </Text>
          ))}
        </View>
      ) : null}

      <Text style={styles.snippet} numberOfLines={2}>
        {buildSnippet(vibe)}
      </Text>

      <View style={styles.footer}>
        <Text style={styles.username}>{username}</Text>
        <Text style={styles.time}>{formatTimeAgo(vibe?.created_at, true)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 8,
  },
  headerLeft: {
    flex: 1,
    gap: 6,
  },
  venueName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  typeChip: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.surfaceRaised,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typeChipText: {
    color: COLORS.primaryGlow,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  xpBadge: {
    backgroundColor: COLORS.surfaceRaised,
    borderWidth: 1,
    borderColor: COLORS.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  xpBadgeText: {
    color: COLORS.accentGlow,
    fontSize: 12,
    fontWeight: "800",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    fontSize: 12,
    color: COLORS.primaryGlow,
    fontWeight: "500",
  },
  snippet: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 10,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  username: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },
  time: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  skeletonBlock: {
    backgroundColor: COLORS.surfaceRaised,
    borderRadius: 6,
  },
  skeletonTitle: {
    width: "70%",
    height: 18,
  },
  skeletonChip: {
    width: 56,
    height: 14,
    marginTop: 6,
  },
  skeletonBadge: {
    width: 52,
    height: 24,
    borderRadius: 8,
  },
  skeletonChipLine: {
    width: 64,
    height: 12,
  },
  skeletonSnippet: {
    width: "90%",
    height: 14,
    marginBottom: 10,
  },
  skeletonFooter: {
    width: 80,
    height: 12,
  },
  skeletonFooterShort: {
    width: 48,
    height: 12,
  },
});
