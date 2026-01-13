import React, { useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import * as Haptics from "expo-haptics";
import { validateVenueType, isBar as isBarHelper } from "../utils/venueHelpers";
import { mapCoverPriceToUI, mapBarTierToSymbol, mapBarTierToUI, mapLegacyDrinksPriceToTier } from "../utils/priceMapping";
import { formatTimeAgo } from "../utils/timeHelpers";
import { getDisplayValue } from "../utils/displayHelpers";

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


function getBarTypeEmoji(barType) {
  if (!barType) return "";
  switch (barType) {
    case "cocktail": return "🍸";
    case "sports": return "🏈";
    case "dive": return "🍺";
    case "wine": return "🍷";
    case "speakeasy": return "🕵️";
    default: return "🍸";
  }
}

function getBarTypeLabel(barType) {
  if (!barType) return "";
  return barType.charAt(0).toUpperCase() + barType.slice(1);
}

function getRatioEmoji(ratio) {
  if (!ratio) return null;
  if (ratio.includes("Mostly guys")) return "👥";
  if (ratio.includes("Mostly girls")) return "👭";
  if (ratio.includes("Balanced")) return "⚖️";
  return null;
}

export default function VenueCardLovable({ venue, guys, girls, onPress, latestVibe }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Normalize guys and girls values - default to 50/50 if null/undefined/NaN
  const normalizedGuys = (typeof guys === 'number' && !isNaN(guys)) ? guys : 50;
  const normalizedGirls = (typeof girls === 'number' && !isNaN(girls)) ? girls : 50;

  // Validate and determine venue type
  const venueTypeValidation = validateVenueType(venue?.venue_type);
  const venueType = venueTypeValidation.valid ? venueTypeValidation.type : null;
  const isBar = isBarHelper(venue?.venue_type);
  
  // Log error if venue type is invalid (for monitoring)
  if (!venueTypeValidation.valid) {
    console.error(`[VenueCard] Invalid venue_type for "${venue?.name}": ${venueTypeValidation.error}`);
    // In production, you'd send this to your monitoring service
    // e.g., Sentry.captureException(new Error(`Invalid venue_type: ${venueTypeValidation.error}`));
  }
  
  // Get data from latestVibe
  const crowdLevel = latestVibe?.crowd || null;
  const crowdEmoji = crowdLevel ? getCrowdEmoji(crowdLevel) : "❓";
  const lineText = getDisplayValue(latestVibe?.line, "No line");
  const coverText = getDisplayValue(latestVibe?.cover, "Free");
  const musicText = latestVibe?.music || null;
  const musicEmoji = musicText ? getMusicEmoji(musicText) : "🎵";
  const timeAgo = latestVibe?.created_at ? formatTimeAgo(latestVibe.created_at, true) : null;
  
  // Bar-specific fields
  const barType = latestVibe?.bar_type || null;
  const barTypeEmoji = barType ? getBarTypeEmoji(barType) : getDisplayValue(null);
  const barTypeLabel = barType ? getBarTypeLabel(barType) : getDisplayValue(null);
  
  // For bars: use drinks_price_tier (new system), fallback to legacy drinks_price
  // For clubs: drinks_price is actually cover charge, use that
  let drinksPrice = null;
  if (isBar) {
    if (latestVibe?.drinks_price_tier) {
      // New tier system: display symbol (e.g., "$$")
      drinksPrice = mapBarTierToSymbol(latestVibe.drinks_price_tier);
    } else if (latestVibe?.drinks_price) {
      // Backward compatibility: convert legacy drinks_price to tier symbol
      const tier = mapLegacyDrinksPriceToTier(latestVibe.drinks_price);
      drinksPrice = tier ? mapBarTierToSymbol(tier) : null;
    }
  } else {
    // Club: drinks_price is actually cover charge
    drinksPrice = latestVibe?.cover ? mapCoverPriceToUI(latestVibe.cover) : null;
  }
  
  const ratioText = latestVibe?.ratio || null;
  const ratioEmoji = ratioText ? getRatioEmoji(ratioText) : null;

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
            <View style={styles.nameRow}>
              <Text style={styles.venueName}>{venue.name}</Text>
              <View style={styles.typeBadge}>
                {(() => {
                  if (!venueTypeValidation.valid) {
                    // Show error badge for invalid venue type
                    return (
                      <>
                        <Text style={styles.typeBadgeEmoji}>⚠️</Text>
                        <Text style={[styles.typeBadgeText, styles.typeBadgeError]}>
                          ERROR
                        </Text>
                      </>
                    );
                  }
                  const isClub = venueType === "club";
                  return (
                    <>
                      <Text style={styles.typeBadgeEmoji}>
                        {isClub ? "🪩" : "🍸"}
                      </Text>
                      <Text style={styles.typeBadgeText}>
                        {isClub ? "CLUB" : "BAR"}
                      </Text>
                    </>
                  );
                })()}
              </View>
            </View>
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

        {/* Compact Icon Row - Different for bars vs clubs */}
        <View style={styles.iconRow}>
          {isBar ? (
            // Bar icons: bar_type, drinks_price, music, ratio (if exists)
            <>
              <View style={styles.iconItem}>
                <Text style={styles.iconEmoji}>{barTypeEmoji}</Text>
                <Text style={styles.iconText}>{barTypeLabel}</Text>
              </View>
              <View style={styles.iconItem}>
                <Text style={styles.iconEmoji}>🍹</Text>
                <Text style={styles.iconText}>{getDisplayValue(drinksPrice)}</Text>
              </View>
              <View style={styles.iconItem}>
                <Text style={styles.iconEmoji}>{musicEmoji}</Text>
                <Text style={styles.iconText} numberOfLines={1}>{getDisplayValue(musicText)}</Text>
              </View>
              {ratioText && ratioEmoji && (
                <View style={styles.iconItem}>
                  <Text style={styles.iconEmoji}>{ratioEmoji}</Text>
                  <Text style={styles.iconText} numberOfLines={1}>{ratioText}</Text>
                </View>
              )}
            </>
          ) : (
            // Club icons: line, cover, music
            <>
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
            </>
          )}
        </View>

        {/* Thin Ratio Bar - Show for clubs always, for bars only if ratio exists */}
        {(() => {
          // Determine if we should show the ratio bar
          // For clubs: always show (even if no vibe, show neutral state)
          // For bars: only show if ratio exists in the vibe
          const shouldShowRatioBar = !isBar || (isBar && ratioText);
          
          if (!shouldShowRatioBar) return null;
          
          return (
            <View style={styles.ratioBar}>
              {ratioText ? (
                // Show colored segments if ratio exists
                <>
                  <View style={[styles.ratioSegmentGuys, { flex: normalizedGuys }]} />
                  <View style={[styles.ratioSegmentGirls, { flex: normalizedGirls }]} />
                </>
              ) : (
                // Neutral style if ratio is missing (for clubs with no vibe yet)
                <View style={styles.ratioSegmentNeutral} />
              )}
            </View>
          );
        })()}
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
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
    flexWrap: "wrap",
  },
  venueName: {
    color: "#F9FAFB",
    fontSize: 16,
    fontWeight: "700",
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(168,85,247,0.15)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
    gap: 3,
  },
  typeBadgeEmoji: {
    fontSize: 10,
  },
  typeBadgeText: {
    color: "#A855F7",
    fontSize: 10,
    fontWeight: "600",
  },
  typeBadgeError: {
    color: "#EF4444",
  },
  venueNeighborhood: {
    color: "#9CA3AF",
    fontSize: 12,
    marginTop: 2,
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
  ratioSegmentNeutral: {
    flex: 1,
    backgroundColor: "#374151", // neutral gray
  },
});
