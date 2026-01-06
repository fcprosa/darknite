import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function VenueCardLovable({ venue, guys, girls, onPress, onRate, latestVibe }) {
  // Use venue.image_url if available, else local placeholder
  const imageSource = venue?.image_url
    ? { uri: venue.image_url }
    : require("../assets/splash-icon.png");

  // Normalize guys and girls values - default to 50/50 if null/undefined/NaN
  const normalizedGuys = (typeof guys === 'number' && !isNaN(guys)) ? guys : 50;
  const normalizedGirls = (typeof girls === 'number' && !isNaN(girls)) ? girls : 50;

  // Get crowd data from latestVibe
  const crowdLevel = latestVibe?.crowd || null;
  
  const getCrowdEmoji = (crowd) => {
    switch (crowd) {
      case "Dead": return "💀";
      case "Chill": return "😌";
      case "Fun": return "😄";
      case "Packed": return "🔥";
      case "Chaos": return "⚡";
      default: return "❓";
    }
  };

  const crowdEmoji = crowdLevel ? getCrowdEmoji(crowdLevel) : "❓";
  const crowdLabel = crowdLevel || "Unknown";

  const lineText = latestVibe?.line || "No line";
  const coverText = latestVibe?.cover || "Free";
  const heatEmoji = "🔥";

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {/* Hero Image */}
      <View style={styles.imageContainer}>
        <ImageBackground
          source={imageSource}
          style={styles.imageBackground}
          imageStyle={styles.imageStyle}
        >
          <View style={styles.overlay} />
        </ImageBackground>
      </View>

      {/* Content Container */}
      <View style={styles.contentContainer}>
        {/* Venue Name + Address Row */}
        <View style={styles.venueHeaderRow}>
          <View style={styles.venueNameRow}>
            <Text style={styles.venueName}>{venue.name}</Text>
            <Ionicons name="location" size={16} color="#9CA3AF" style={styles.locationIcon} />
            <Text style={styles.venueAddress}>{venue.neighborhood}</Text>
          </View>
        </View>

        {/* Status Pill */}
        <View style={styles.statusPillContainer}>
          <View style={styles.statusPill}>
            <Text style={styles.statusEmoji}>{crowdEmoji}</Text>
            <Text style={styles.statusLabel}>{crowdLabel}</Text>
          </View>
        </View>

        {/* Gender Ratio Section */}
        <View style={styles.ratioSection}>
          <View style={styles.ratioHeaderRow}>
            <Text style={styles.ratioHeaderText}>GENDER RATIO (LAST 2H)</Text>
            <Text style={styles.ratioPercentText}>
              {normalizedGuys}% / {normalizedGirls}%
            </Text>
          </View>
          
          {/* Ratio Bar */}
          <View style={styles.ratioBarContainer}>
            <View style={styles.ratioBar}>
              <View style={[styles.ratioSegmentGuys, { flex: normalizedGuys }]} />
              <View style={[styles.ratioSegmentGirls, { flex: normalizedGirls }]} />
            </View>
            <View style={styles.ratioIconsRow}>
              <View style={styles.ratioIconContainer}>
                <Text style={styles.ratioIcon}>👤</Text>
              </View>
              <View style={styles.ratioIconContainer}>
                <Text style={styles.ratioIcon}>👤</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Bottom Tiles Row */}
        <View style={styles.tilesRow}>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>Line</Text>
            <Text style={styles.tileValue}>{lineText}</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>Cover</Text>
            <Text style={styles.tileValue}>{coverText}</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileIcon}>{heatEmoji}</Text>
            <Text style={styles.tileLabel}>Crowd</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0B0625",
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.4)",
    overflow: "hidden",
    shadowColor: "#A855F7",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  imageContainer: {
    height: 180,
    width: "100%",
  },
  imageBackground: {
    flex: 1,
    width: "100%",
  },
  imageStyle: {
    resizeMode: "cover",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  contentContainer: {
    padding: 16,
    backgroundColor: "#0B0625",
  },
  venueHeaderRow: {
    marginBottom: 12,
  },
  venueNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  venueName: {
    color: "#F9FAFB",
    fontSize: 20,
    fontWeight: "700",
    marginRight: 6,
  },
  locationIcon: {
    marginRight: 4,
  },
  venueAddress: {
    color: "#9CA3AF",
    fontSize: 14,
  },
  statusPillContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(168,85,247,0.15)",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statusEmoji: {
    fontSize: 18,
    marginRight: 6,
  },
  statusLabel: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "600",
  },
  ratioSection: {
    marginBottom: 16,
  },
  ratioHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  ratioHeaderText: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  ratioPercentText: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "600",
  },
  ratioBarContainer: {
    marginTop: 4,
  },
  ratioBar: {
    flexDirection: "row",
    height: 12,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#111827",
    marginBottom: 6,
  },
  ratioSegmentGuys: {
    backgroundColor: "#38BDF8", // blue
  },
  ratioSegmentGirls: {
    backgroundColor: "#F973FF", // pink
  },
  ratioIconsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  ratioIconContainer: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  ratioIcon: {
    fontSize: 14,
  },
  tilesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  tile: {
    flex: 1,
    backgroundColor: "rgba(168,85,247,0.1)",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.2)",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tileIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  tileLabel: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "500",
    marginBottom: 2,
  },
  tileValue: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "600",
  },
});
