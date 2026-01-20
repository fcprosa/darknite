/**
 * VenueCardLovable - Premium venue card component with flip functionality
 * 
 * BAR vs CLUB Tile Mapping:
 * - CLUB tiles: Line, Cover, Music
 * - BAR tiles: Bar Type, Drinks Price, Music
 * 
 * Props:
 * @param {Object} venue - Venue object
 * @param {Object|null} latestVibe - Latest vibe data for the venue
 * @param {Function} onPress - Called when card or Details button is pressed
 * @param {Function} [onPostVibe] - Optional: Called when "Post My Vibe" button is pressed
 * @param {Function} [onDetails] - Optional: Called when Details button is pressed (overrides onPress)
 * @param {number} [guys] - Deprecated: not used, kept for backward compatibility
 * @param {number} [girls] - Deprecated: not used, kept for backward compatibility
 */

import React, { useRef, useState, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView } from "react-native";
import * as Haptics from "expo-haptics";
import { validateVenueType, isBar as isBarHelper } from "../utils/venueHelpers";
import { mapCoverPriceToUI, mapBarTierToSymbol, mapBarTierToUI, mapLegacyDrinksPriceToTier } from "../utils/priceMapping";
import { formatTimeAgo } from "../utils/timeHelpers";
import { getDisplayValue } from "../utils/displayHelpers";
import { getDisplayRatio } from "../utils/vibeHelpers";

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
    case "Fun": return "🎉";
    case "Packed": return "🔥";
    case "Chaos": return "🌪️";
    default: return "❓";
  }
}

function getCrowdBadgeStyle(crowd) {
  switch (crowd) {
    case "Dead": return { bg: "rgba(156, 163, 175, 0.2)", border: "rgba(156, 163, 175, 0.3)" };
    case "Chill": return { bg: "rgba(59, 130, 246, 0.2)", border: "rgba(59, 130, 246, 0.3)" };
    case "Fun": return { bg: "rgba(168, 85, 247, 0.2)", border: "rgba(168, 85, 247, 0.3)" };
    case "Packed": return { bg: "rgba(239, 68, 68, 0.2)", border: "rgba(239, 68, 68, 0.3)" };
    case "Chaos": return { bg: "rgba(251, 146, 60, 0.2)", border: "rgba(251, 146, 60, 0.3)" };
    default: return { bg: "rgba(156, 163, 175, 0.15)", border: "rgba(156, 163, 175, 0.25)" };
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

function isHotVibe(vibe) {
  if (!vibe) return false;
  const crowd = vibe.crowd;
  const isIntense = crowd === "Packed" || crowd === "Chaos";
  
  if (!isIntense) return false;
  
  // Check if updated < 30 minutes
  if (vibe.created_at) {
    const now = new Date();
    const vibeTime = new Date(vibe.created_at);
    const diffMs = now - vibeTime;
    const diffMinutes = diffMs / (1000 * 60);
    return diffMinutes < 30;
  }
  
  return false;
}

export default function VenueCardLovable({ venue, latestVibe, onPress, onPostVibe, onDetails, guys, girls }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const flipAnim = useRef(new Animated.Value(0)).current;
  const [isFlipped, setIsFlipped] = useState(false);

  // Validate and determine venue type
  const venueTypeValidation = useMemo(() => validateVenueType(venue?.venue_type), [venue?.venue_type]);
  const venueType = venueTypeValidation.valid ? venueTypeValidation.type : null;
  const isBar = useMemo(() => isBarHelper(venue?.venue_type), [venue?.venue_type]);
  const isClub = venueType === 'club';
  
  // Get ratio display info using helper
  const ratioInfo = useMemo(() => getDisplayRatio(venue, latestVibe), [venue, latestVibe]);
  
  // Check if we have vibe data
  const hasVibe = !!latestVibe;
  const isHot = useMemo(() => isHotVibe(latestVibe), [latestVibe]);
  
  // Log error if venue type is invalid
  if (!venueTypeValidation.valid) {
    console.error(`[VenueCard] Invalid venue_type for "${venue?.name}": ${venueTypeValidation.error}`);
  }
  
  // Derive display data
  const crowdLevel = latestVibe?.crowd || null;
  const crowdEmoji = crowdLevel ? getCrowdEmoji(crowdLevel) : "❓";
  const crowdLabel = crowdLevel || "Unknown";
  const crowdBadgeStyle = getCrowdBadgeStyle(crowdLevel);
  
  // Bar-specific fields
  const barType = latestVibe?.bar_type || null;
  const barTypeEmoji = barType ? getBarTypeEmoji(barType) : "🍸";
  const barTypeLabel = barType ? getBarTypeLabel(barType) : "—";
  
  // For bars: use drinks_price_tier (new system), fallback to legacy drinks_price
  let drinksPrice = null;
  if (isBar) {
    if (latestVibe?.drinks_price_tier) {
      drinksPrice = mapBarTierToSymbol(latestVibe.drinks_price_tier);
    } else if (latestVibe?.drinks_price) {
      const tier = mapLegacyDrinksPriceToTier(latestVibe.drinks_price);
      drinksPrice = tier ? mapBarTierToSymbol(tier) : null;
    }
  }
  
  const lineText = getDisplayValue(latestVibe?.line, "—");
  const coverText = getDisplayValue(latestVibe?.cover, "—");
  const musicText = latestVibe?.music || null;
  const musicEmoji = musicText ? getMusicEmoji(musicText) : "🎵";

  // Build stat tiles based on venue type - always show 3 tiles, use "—" when no data
  const statTiles = useMemo(() => {
    if (isClub) {
      // CLUB tiles: Line, Cover, Music
      return [
        { icon: "⏱", value: hasVibe ? lineText : "—", label: "Line" },
        { icon: "💵", value: hasVibe ? coverText : "—", label: "Cover" },
        { icon: musicEmoji, value: hasVibe && musicText ? musicText : "—", label: "Music" },
      ];
    } else if (isBar) {
      // BAR tiles: Bar Type, Drinks, Music
      return [
        { icon: barTypeEmoji || "🍸", value: hasVibe && barTypeLabel ? barTypeLabel : "—", label: "Type" },
        { icon: "🍹", value: hasVibe && drinksPrice ? drinksPrice : "—", label: "Drinks" },
        { icon: musicEmoji, value: hasVibe && musicText ? musicText : "—", label: "Music" },
      ];
    }
    
    // Fallback: return empty array if neither bar nor club
    return [];
  }, [hasVibe, isClub, isBar, lineText, coverText, musicText, musicEmoji, barTypeEmoji, barTypeLabel, drinksPrice]);

  // Handle flip animation - using opacity-based flip since RN doesn't support rotateY
  const handleFlip = () => {
    const toValue = isFlipped ? 0 : 1;
    Animated.timing(flipAnim, {
      toValue,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setIsFlipped(!isFlipped);
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
  };

  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });

  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });

  const handlePressIn = () => {
    if (!isFlipped) {
      Animated.spring(scaleAnim, {
        toValue: 0.98,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }).start();
    }
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  const handleCardPress = () => {
    if (!isFlipped) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {}
      onPress();
    }
  };

  const handlePostVibe = (e) => {
    e?.stopPropagation();
    if (onPostVibe) {
      onPostVibe();
    } else {
      onPress();
    }
  };

  const handleDetails = (e) => {
    e?.stopPropagation();
    if (onDetails) {
      onDetails();
    } else {
      onPress();
    }
  };

  const address = venue?.address || null;
  const neighborhood = venue?.neighborhood || null;
  const locationText = address 
    ? `${neighborhood || ""}${neighborhood && address ? " • " : ""}${address}` 
    : (neighborhood || "");

  // Back card data
  const hasBackData = venue?.hours || venue?.music_profile || venue?.dress_code || 
                      venue?.vibe_description || venue?.avg_age || musicText;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      {/* Root cause: position: 'absolute' on cardSide removed cards from layout flow, causing overlap in FlatList */}
      <View style={styles.cardContainer}>
        {/* Front of Card - Conditional render instead of absolute positioning */}
        {!isFlipped && (
          <Animated.View
            style={{
              opacity: frontOpacity,
            }}
          >
          <TouchableOpacity
            style={styles.card}
            onPress={handleCardPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={1}
          >
            {/* Top Badge Row - Crowd Headline */}
            <View style={styles.topBadgeRow}>
              <View style={[styles.crowdBadge, { backgroundColor: crowdBadgeStyle.bg, borderColor: crowdBadgeStyle.border }]}>
                <Text style={styles.crowdBadgeEmoji}>{crowdEmoji}</Text>
                <Text style={styles.crowdBadgeText}>{crowdLabel}</Text>
              </View>
            </View>

            {/* Title Block */}
            <View style={styles.titleBlock}>
              <View style={styles.nameRow}>
                <Text style={styles.venueName}>{venue?.name || "Unknown"}</Text>
                <View style={styles.typeBadge}>
                  {!venueTypeValidation.valid ? (
                    <>
                      <Text style={styles.typeBadgeEmoji}>⚠️</Text>
                      <Text style={[styles.typeBadgeText, styles.typeBadgeError]}>ERROR</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.typeBadgeEmoji}>{isClub ? "🪩" : "🍸"}</Text>
                      <Text style={styles.typeBadgeText}>{isClub ? "CLUB" : "BAR"}</Text>
                    </>
                  )}
                </View>
              </View>
              {locationText && (
                <Text style={styles.locationText}>{locationText}</Text>
              )}
            </View>

            {/* CLUB Ratio Block - ONLY for clubs */}
            {isClub && ratioInfo.show && (
              <View style={styles.ratioContainer}>
                <View style={styles.ratioBar}>
                  <View style={[styles.ratioSegmentGuys, { flex: ratioInfo.guys }]} />
                  <View style={[styles.ratioSegmentGirls, { flex: ratioInfo.girls }]} />
                </View>
                <View style={styles.ratioLabels}>
                  <View style={styles.ratioLabelLeft}>
                    <Text style={styles.ratioEmoji}>👨</Text>
                    <Text style={styles.ratioLabel}>{ratioInfo.guys}%</Text>
                  </View>
                  <View style={styles.ratioLabelRight}>
                    <Text style={styles.ratioLabel}>{ratioInfo.girls}%</Text>
                    <Text style={styles.ratioEmoji}>👩</Text>
                  </View>
                </View>
                {ratioInfo.isDefault && (
                  <Text style={styles.ratioCaption}>No data yet — guessed 50/50</Text>
                )}
              </View>
            )}

            {/* Stats Tiles Row - Always show 3 tiles, use "—" when no vibe */}
            <View style={styles.statTilesRow}>
              {statTiles.map((tile, index) => (
                <View key={index} style={styles.statTile}>
                  <Text style={styles.statIcon}>{tile.icon}</Text>
                  <Text style={styles.statValue} numberOfLines={1}>{tile.value || "—"}</Text>
                  <Text style={styles.statLabel}>{tile.label}</Text>
                </View>
              ))}
            </View>

            {/* No Vibes State Message - Show when no vibe */}
            {!hasVibe && (
              <View style={styles.noVibesContainer}>
                <Text style={styles.noVibesText}>There are no vibes yet</Text>
                <Text style={styles.noVibesSubtext}>Be the first one</Text>
              </View>
            )}

            {/* Actions Row */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handlePostVibe}
                activeOpacity={0.7}
              >
                <Text style={styles.primaryButtonText}>+ Post Vibe</Text>
              </TouchableOpacity>
              <View style={styles.secondaryActions}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleDetails}
                  activeOpacity={0.7}
                >
                  <Text style={styles.secondaryButtonText}>Details</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleFlip}
                  activeOpacity={0.7}
                >
                  <Text style={styles.secondaryButtonText}>More Info</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
          </Animated.View>
        )}

        {/* Back of Card - Conditional render instead of absolute positioning */}
        {isFlipped && (
          <Animated.View
            style={{
              opacity: backOpacity,
            }}
          >
          <View style={styles.card}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.backTitle}>About {venue?.name || "Venue"}</Text>
              
              {hasBackData ? (
                <View style={styles.backContent}>
                  {venue?.hours && (
                    <View style={styles.backRow}>
                      <Text style={styles.backLabel}>Hours</Text>
                      <Text style={styles.backValue}>{venue.hours}</Text>
                    </View>
                  )}
                  {(venue?.music_profile || musicText) && (
                    <View style={styles.backRow}>
                      <Text style={styles.backLabel}>Music</Text>
                      <Text style={styles.backValue}>{venue?.music_profile || musicText}</Text>
                    </View>
                  )}
                  {venue?.dress_code && (
                    <View style={styles.backRow}>
                      <Text style={styles.backLabel}>Dress Code</Text>
                      <Text style={styles.backValue}>{venue.dress_code}</Text>
                    </View>
                  )}
                  {(drinksPrice || coverText !== "—") && (
                    <View style={styles.backRow}>
                      <Text style={styles.backLabel}>Price Range</Text>
                      <Text style={styles.backValue}>
                        {isBar ? (drinksPrice || "—") : (coverText !== "—" ? coverText : "—")}
                      </Text>
                    </View>
                  )}
                  {venue?.vibe_description && (
                    <View style={styles.backRow}>
                      <Text style={styles.backLabel}>Vibe</Text>
                      <Text style={styles.backValue}>{venue.vibe_description}</Text>
                    </View>
                  )}
                  {venue?.avg_age && (
                    <View style={styles.backRow}>
                      <Text style={styles.backLabel}>Avg Age</Text>
                      <Text style={styles.backValue}>{venue.avg_age}</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.backPlaceholder}>
                  <Text style={styles.backPlaceholderText}>More details coming soon</Text>
                  <Text style={styles.backPlaceholderSubtext}>Post a vibe to help others</Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.backButton}
                onPress={handleFlip}
                activeOpacity={0.7}
              >
                <Text style={styles.backButtonText}>← Back</Text>
              </TouchableOpacity>
              </ScrollView>
          </View>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: 12,
    // Removed position: 'absolute' from cardSide - this was causing FlatList items to overlap
    // Now using conditional rendering instead for the flip effect
  },
  card: {
    backgroundColor: "#0B0625",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
    padding: 16,
  },
  topBadgeRow: {
    marginBottom: 12,
  },
  crowdBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    gap: 6,
  },
  crowdBadgeEmoji: {
    fontSize: 14,
  },
  crowdBadgeText: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "600",
  },
  titleBlock: {
    marginBottom: 16,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 6,
  },
  venueName: {
    color: "#F9FAFB",
    fontSize: 20,
    fontWeight: "700",
  },
  locationText: {
    color: "#9CA3AF",
    fontSize: 13,
    marginTop: 2,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(168,85,247,0.15)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
    gap: 4,
  },
  typeBadgeEmoji: {
    fontSize: 12,
  },
  typeBadgeText: {
    color: "#A855F7",
    fontSize: 10,
    fontWeight: "600",
  },
  typeBadgeError: {
    color: "#EF4444",
  },
  ratioContainer: {
    marginBottom: 16,
  },
  ratioBar: {
    flexDirection: "row",
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: "#1F2937",
    marginBottom: 8,
  },
  ratioSegmentGuys: {
    backgroundColor: "#3B82F6", // Blue
  },
  ratioSegmentGirls: {
    backgroundColor: "#EC4899", // Pink
  },
  ratioLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ratioLabelLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratioLabelRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratioEmoji: {
    fontSize: 14,
  },
  ratioLabel: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "600",
  },
  ratioCaption: {
    color: "#9CA3AF",
    fontSize: 10,
    marginTop: 4,
    textAlign: "center",
  },
  statTilesRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statTile: {
    flex: 1,
    backgroundColor: "rgba(168,85,247,0.1)",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.2)",
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  statValue: {
    color: "#F9FAFB",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
    textAlign: "center",
  },
  statLabel: {
    color: "#9CA3AF",
    fontSize: 10,
  },
  noVibesContainer: {
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  noVibesText: {
    color: "rgba(156, 163, 175, 0.6)",
    fontSize: 12,
    fontWeight: "400",
    marginBottom: 2,
  },
  noVibesSubtext: {
    color: "rgba(156, 163, 175, 0.5)",
    fontSize: 11,
  },
  actionsRow: {
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: "#A855F7",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  secondaryActions: {
    flexDirection: "row",
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "rgba(168,85,247,0.1)",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
  },
  secondaryButtonText: {
    color: "#A855F7",
    fontSize: 12,
    fontWeight: "600",
  },
  backTitle: {
    color: "#F9FAFB",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 16,
  },
  backContent: {
    gap: 16,
    marginBottom: 16,
  },
  backRow: {
    gap: 4,
  },
  backLabel: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  backValue: {
    color: "#E5E7EB",
    fontSize: 14,
  },
  backPlaceholder: {
    alignItems: "center",
    paddingVertical: 32,
    marginBottom: 16,
  },
  backPlaceholderText: {
    color: "#9CA3AF",
    fontSize: 14,
    marginBottom: 4,
  },
  backPlaceholderSubtext: {
    color: "#6B7280",
    fontSize: 12,
  },
  backButton: {
    backgroundColor: "rgba(168,85,247,0.1)",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
    marginTop: 8,
  },
  backButtonText: {
    color: "#A855F7",
    fontSize: 14,
    fontWeight: "600",
  },
});
