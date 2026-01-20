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
    case "Fun": return "😄";
    case "Packed": return "🔥";
    case "Chaos": return "⚡";
    default: return null;
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
  const timeAgo = latestVibe?.created_at ? formatTimeAgo(latestVibe.created_at, true) : null;
  
  // Bar-specific fields
  const barType = latestVibe?.bar_type || null;
  const barTypeEmoji = barType ? getBarTypeEmoji(barType) : "";
  const barTypeLabel = barType ? getBarTypeLabel(barType) : null;
  
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

  // Build stat tiles based on venue type
  const statTiles = useMemo(() => {
    if (!hasVibe) return [];
    
    if (isClub) {
      // CLUB tiles: Line, Cover, Music
      return [
        { icon: "⏱", value: lineText, label: "Line" },
        { icon: "💵", value: coverText, label: "Cover" },
        { icon: musicEmoji, value: musicText || "—", label: "Music" },
      ];
    } else if (isBar) {
      // BAR tiles: Bar Type, Drinks, Music
      return [
        { icon: barTypeEmoji || "🍸", value: barTypeLabel || "—", label: "Type" },
        { icon: "🍹", value: drinksPrice || "—", label: "Drinks" },
        { icon: musicEmoji, value: musicText || "—", label: "Music" },
      ];
    }
    
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
  const subheaderText = address 
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
            {/* Header Row */}
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
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
                  {isHot && (
                    <View style={styles.hotPill}>
                      <Text style={styles.hotPillText}>HOT</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.headerRight}>
                {timeAgo ? (
                  <View style={styles.updatedRow}>
                    <View style={styles.statusDot} />
                    <Text style={styles.updatedText}>{timeAgo}</Text>
                  </View>
                ) : (
                  <Text style={styles.updatedTextInactive}>—</Text>
                )}
              </View>
            </View>

            {/* Subheader */}
            {subheaderText && (
              <Text style={styles.subheader}>{subheaderText}</Text>
            )}

            {/* Ratio Bar */}
            {ratioInfo.show && (
              <View style={styles.ratioContainer}>
                <View style={styles.ratioBar}>
                  <View style={[styles.ratioSegmentGuys, { flex: ratioInfo.guys }]} />
                  <View style={[styles.ratioSegmentGirls, { flex: ratioInfo.girls }]} />
                </View>
                <View style={styles.ratioLabels}>
                  <Text style={styles.ratioLabel}>{ratioInfo.guys}%</Text>
                  <Text style={styles.ratioLabel}>{ratioInfo.girls}%</Text>
                </View>
              </View>
            )}

            {/* Stats Tiles or No Vibe State */}
            {hasVibe ? (
              <View style={styles.statTilesRow}>
                {statTiles.map((tile, index) => (
                  <View key={index} style={styles.statTile}>
                    <Text style={styles.statIcon}>{tile.icon}</Text>
                    <Text style={styles.statValue} numberOfLines={1}>{tile.value}</Text>
                    <Text style={styles.statLabel}>{tile.label}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.noVibesContainer}>
                <Text style={styles.noVibesText}>There are no vibes yet</Text>
                <Text style={styles.noVibesSubtext}>Be the first one</Text>
              </View>
            )}

            {/* CTA Area */}
            <View style={styles.ctaArea}>
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
    minHeight: 200,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 4,
  },
  venueName: {
    color: "#F9FAFB",
    fontSize: 18,
    fontWeight: "700",
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
  hotPill: {
    backgroundColor: "rgba(239,68,68,0.2)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.4)",
  },
  hotPillText: {
    color: "#EF4444",
    fontSize: 10,
    fontWeight: "700",
  },
  headerRight: {
    alignItems: "flex-end",
  },
  updatedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  updatedText: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "500",
  },
  updatedTextInactive: {
    color: "#6B7280",
    fontSize: 11,
  },
  subheader: {
    color: "#9CA3AF",
    fontSize: 12,
    marginBottom: 12,
  },
  ratioContainer: {
    marginBottom: 12,
  },
  ratioBar: {
    flexDirection: "row",
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: "#1F2937",
    marginBottom: 4,
  },
  ratioSegmentGuys: {
    backgroundColor: "#38BDF8",
  },
  ratioSegmentGirls: {
    backgroundColor: "#F973FF",
  },
  ratioLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  ratioLabel: {
    color: "#6B7280",
    fontSize: 10,
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
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  noVibesText: {
    color: "rgba(156, 163, 175, 0.7)",
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 4,
  },
  noVibesSubtext: {
    color: "rgba(156, 163, 175, 0.5)",
    fontSize: 11,
  },
  ctaArea: {
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
