import React, { useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import * as Haptics from "expo-haptics";

function getMusicEmoji(music) {
  if (!music) return "🎵";
  if (music.includes("Hip-Hop")) return "🎤";
  if (music.includes("Afrobeats")) return "🥁";
  if (music.includes("House") || music.includes("Techno")) return "🎛️";
  if (music.includes("Reggaeton")) return "🪇";
  if (music.includes("Top Hits")) return "🔥";
  if (music.includes("Mixed")) return "🎶";
  return "🎵";
}

function getCrowdEmoji(crowd) {
  switch (crowd) {
    case "Dead": return "💀";
    case "Chill": return "😌";
    case "Fun": return "😄";
    case "Packed": return "🔥";
    case "Chaos": return "⚡";
    default: return "❓";
  }
}

function formatTimeAgoCompact(dateString) {
  if (!dateString) return "";
  const now = new Date();
  const then = new Date(dateString);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function VenueCardLovable({ venue, guys, girls, onPress, latestVibe }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Normalize guys and girls values - default to 50/50 if null/undefined/NaN
  const normalizedGuys = (typeof guys === 'number' && !isNaN(guys)) ? guys : 50;
  const normalizedGirls = (typeof girls === 'number' && !isNaN(girls)) ? girls : 50;

  // Get data from latestVibe
  const crowdLevel = latestVibe?.crowd || null;
  const crowdEmoji = crowdLevel ? getCrowdEmoji(crowdLevel) : "❓";
  const lineText = latestVibe?.line || "No line";
  const coverText = latestVibe?.cover || "Free";
  const musicText = latestVibe?.music || null;
  const musicEmoji = musicText ? getMusicEmoji(musicText) : "🎵";
  const timeAgo = latestVibe?.created_at ? formatTimeAgoCompact(latestVibe.created_at) : null;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  const handlePress = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      // Haptics not available
    }
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={styles.card}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        {/* Top Row: Name + Crowd Emoji + Live Status */}
        <View style={styles.topRow}>
          <View style={styles.leftSection}>
            <Text style={styles.venueName}>{venue.name}</Text>
            <Text style={styles.venueNeighborhood}>{venue.neighborhood}</Text>
          </View>
          <View style={styles.rightSection}>
            {/* Prominent Crowd Emoji */}
            <Text style={styles.crowdEmoji}>{crowdEmoji}</Text>
            {/* LIVE dot + time */}
            {timeAgo && (
              <View style={styles.liveStatus}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Updated {timeAgo}</Text>
              </View>
            )}
            {!timeAgo && (
              <Text style={styles.liveTextInactive}>—</Text>
            )}
          </View>
        </View>

        {/* Compact Icon Row */}
        <View style={styles.iconRow}>
          <View style={styles.iconItem}>
            <Text style={styles.iconEmoji}>⏱</Text>
            <Text style={styles.iconText}>{lineText}</Text>
          </View>
          <View style={styles.iconItem}>
            <Text style={styles.iconEmoji}>💵</Text>
            <Text style={styles.iconText}>{coverText}</Text>
          </View>
          {musicText && (
            <View style={styles.iconItem}>
              <Text style={styles.iconEmoji}>{musicEmoji}</Text>
              <Text style={styles.iconText} numberOfLines={1}>{musicText}</Text>
            </View>
          )}
        </View>

        {/* Thin Ratio Bar */}
        <View style={styles.ratioBar}>
          <View style={[styles.ratioSegmentGuys, { flex: normalizedGuys }]} />
          <View style={[styles.ratioSegmentGirls, { flex: normalizedGirls }]} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0B0625",
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.4)",
    padding: 10,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  leftSection: {
    flex: 1,
    marginRight: 12,
  },
  venueName: {
    color: "#F9FAFB",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  venueNeighborhood: {
    color: "#9CA3AF",
    fontSize: 12,
  },
  rightSection: {
    alignItems: "flex-end",
  },
  crowdEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  liveStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  liveText: {
    color: "#9CA3AF",
    fontSize: 10,
    fontWeight: "500",
  },
  liveTextInactive: {
    color: "#6B7280",
    fontSize: 10,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  iconItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  iconEmoji: {
    fontSize: 14,
  },
  iconText: {
    color: "#E5E7EB",
    fontSize: 11,
    fontWeight: "500",
    maxWidth: 80,
  },
  ratioBar: {
    flexDirection: "row",
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: "#111827",
  },
  ratioSegmentGuys: {
    backgroundColor: "#38BDF8", // blue
  },
  ratioSegmentGirls: {
    backgroundColor: "#F973FF", // pink
  },
});
