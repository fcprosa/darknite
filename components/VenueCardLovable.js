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

import React, { useRef, useState, useMemo, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView, Easing, Pressable, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { validateVenueType, isBar as isBarHelper } from "../utils/venueHelpers";
import { mapCoverPriceToUI, mapBarTierToSymbol, mapBarTierToUI, mapLegacyDrinksPriceToTier } from "../utils/priceMapping";
import { formatTimeAgo, formatVibeRecency } from "../utils/timeHelpers";
import { getDisplayValue } from "../utils/displayHelpers";
import { getDisplayRatio } from "../utils/vibeHelpers";
import { useAuth } from "../contexts/AuthContext";
import { useAppContext } from "../contexts/AppContext";
import { getCheckInCount, getLatestLineWait, getLatestBarCrowdCheckIn } from "../services/checkInService";

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
    case "Buzzing": return "🐝";
    case "Packed": return "🔥";
    case "Chaos": return "🌪️";
    default: return null;
  }
}

function getCrowdBadgeStyle(crowd) {
  switch (crowd) {
    case "Dead": return { bg: "rgba(156, 163, 175, 0.2)", border: "rgba(156, 163, 175, 0.3)" };
    case "Chill": return { bg: "rgba(59, 130, 246, 0.2)", border: "rgba(59, 130, 246, 0.3)" };
    case "Fun": return { bg: "rgba(168, 85, 247, 0.2)", border: "rgba(168, 85, 247, 0.3)" };
    case "Buzzing": return { bg: "rgba(245, 158, 11, 0.2)", border: "rgba(245, 158, 11, 0.3)" }; // Amber/yellow for buzzing bee
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
    case "rooftop": return "🌆";
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
  if (!ratio) return "👥";
  if (ratio.includes("guys")) return "👨";
  if (ratio.includes("girls")) return "👩";
  return "👥";
}

function getLineEmoji(line) {
  if (!line) return "⏱️";
  if (line.includes("No line")) return "✅";
  if (line.includes("30+")) return "⏳";
  return "⏱️";
}

function getCoverEmoji(coverLabel) {
  if (!coverLabel) return "💰";
  if (coverLabel.includes("Free")) return "🆓";
  if (coverLabel.includes("$20+") || coverLabel.includes("30+")) return "💎";
  return "💰";
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
  const { user, isAuthenticated } = useAuth();
  const { latestBarCrowdByVenueId, latestLineWaitByVenueId, upsertLatestBarCrowd, upsertLatestLineWait } = useAppContext();  const scaleAnim = useRef(new Animated.Value(1)).current;
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const bannerTranslateY = useRef(new Animated.Value(-100)).current;
  const livePulseAnim = useRef(new Animated.Value(1)).current;
  const [showLastVibe, setShowLastVibe] = useState(false);
  const [checkInCount, setCheckInCount] = useState(0);
  const [latestLineWait, setLatestLineWait] = useState(null); // For clubs: line from check_ins
  const [latestBarCrowd, setLatestBarCrowd] = useState(null); // For bars: crowd from check_ins

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
  const isRecent = latestVibe?.isRecent === true;
  
  // Log error if venue type is invalid
  if (!venueTypeValidation.valid) {
    console.error(`[VenueCard] Invalid venue_type for "${venue?.name}": ${venueTypeValidation.error}`);
  }
  
  // Derive display data - headline badge source per venue type
  // CLUB: crowd from latestVibe (Post Vibe)
  // BAR: crowd from latestBarCrowd (I'm here check-in)
  const clubCrowd = latestVibe?.crowd;
  const barCrowd = latestBarCrowd?.crowd_level;
  const showHeadline = isClub ? !!clubCrowd : !!barCrowd;
  const headlineCrowd = isClub ? clubCrowd : barCrowd;
  const headlineTime = isClub ? latestVibe?.created_at : latestBarCrowd?.created_at;
  
  const crowdEmoji = getCrowdEmoji(headlineCrowd) || "👥";
  const crowdLabel = headlineCrowd || null; // Never show "Unknown" - hide badge if null
  const crowdBadgeStyle = getCrowdBadgeStyle(headlineCrowd);
  
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
  console.log('[VenueCard DEBUG]', {
    venueName: venue?.name,
    isBar,
    hasVibe,
    drinks_price_tier: latestVibe?.drinks_price_tier,
    drinks_price: latestVibe?.drinks_price,
    drinksPrice
  });
  
  // For clubs: use line from check_ins (latestLineWait), fallback to vibe line
  // For bars: line is not displayed, so this doesn't matter
  const lineText = isClub 
    ? getDisplayValue(latestLineWait || latestVibe?.line, "—")
    : getDisplayValue(latestVibe?.line, "—");
  const coverText = getDisplayValue(latestVibe?.cover, "—");
  const musicText = latestVibe?.music || null;
  const musicEmoji = musicText ? getMusicEmoji(musicText) : "🎵";
  const ageRangeText = latestVibe?.age_range || null;

  // Build stat tiles based on venue type - always 3 tiles (Type/Drinks(or Cover)/Music)
  // CRITICAL: Always return 3 tiles, even if venue type is invalid (default to bar tiles)
  const statTiles = useMemo(() => {
    let tiles = [];
    
    if (isClub) {
      // CLUB tiles: Line (from check_ins), Cover, Music
      const displayLine = latestLineWait || (hasVibe ? lineText : "—");
      tiles = [
        { icon: "⏱", value: displayLine, label: "Line" },
        { icon: "💵", value: hasVibe ? coverText : "—", label: "Cover" },
        { icon: musicEmoji, value: hasVibe && musicText ? musicText : "—", label: "Music" },
      ];
    } else {
      // BAR tiles (or fallback for invalid venue types): Bar Type, Drinks, Music
      // Always render 3 tiles - never return empty array
      tiles = [
        { icon: barTypeEmoji || "🍸", value: hasVibe && barTypeLabel ? barTypeLabel : "—", label: "Type" },
        { icon: "🍹", value: hasVibe && drinksPrice ? drinksPrice : "—", label: "Drinks" },
        { icon: musicEmoji, value: hasVibe && musicText ? musicText : "—", label: "Music" },
      ];
    }
    
    // Debug logging to verify tiles are always populated
    if (!tiles || tiles.length !== 3) {
      console.error(`[VenueCard] CRITICAL: statTiles invalid for "${venue?.name}":`, tiles);
      // Force return 3 tiles as fallback
      return [
        { icon: "🍸", value: "—", label: "Type" },
        { icon: "🍹", value: "—", label: "Drinks" },
        { icon: "🎵", value: "—", label: "Music" },
      ];
    }
    
    return tiles;
  }, [hasVibe, isClub, latestLineWait, lineText, coverText, musicText, musicEmoji, barTypeEmoji, barTypeLabel, drinksPrice, venue?.name]);

  // Handle banner animation
  const handleSeeLastVibe = () => {
    if (!hasVibe) return;
    
    setShowLastVibe(true);
    
    // Animate in
    Animated.parallel([
      Animated.timing(bannerOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(bannerTranslateY, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
  };

  const handleCloseBanner = () => {
    // Animate out
    Animated.parallel([
      Animated.timing(bannerOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(bannerTranslateY, {
        toValue: -100,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowLastVibe(false);
    });
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
  };

  const handlePressIn = () => {
    if (!showLastVibe) {
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
    if (!showLastVibe) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {}
      onPress();
    }
  };

  const handlePostVibe = () => {
    // Navigate to post vibe screen - NEVER flip the card
    console.log('[VenueCard] handlePostVibe called, hasVibe:', hasVibe, 'onPostVibe exists:', !!onPostVibe);
    if (onPostVibe) {
      onPostVibe();
    } else {
      console.warn('[VenueCard] onPostVibe not provided!');
    }
  };

  const handleDetails = () => {
    // Navigate to venue details - NEVER flip the card
    if (onDetails) {
      onDetails();
    } else {
      onPress();
    }
  };


  // Pulsing animation for LIVE indicator
  useEffect(() => {
    if (!isRecent) {
      livePulseAnim.setValue(1);
      return;
    }

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulseAnim, {
          toValue: 1.15,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(livePulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    pulseAnimation.start();
    return () => pulseAnimation.stop();
  }, [isRecent, livePulseAnim]);

  // Load check-in count on mount
  useEffect(() => {
    let mounted = true;
    async function loadCount() {
      if (!venue?.id) return;
      const { count } = await getCheckInCount(venue.id, 60);
      if (mounted) setCheckInCount(count || 0);
    }
    loadCount();
    return () => { mounted = false; };
  }, [venue?.id]);

  // Load check-ins from AppContext cache + fetch as backup
useEffect(() => {
  let mounted = true;
  
  async function loadCheckIns() {
    if (!venue?.id) return;
    
    // ✨ First, try to get from AppContext (instant)
    const cachedBarCrowd = latestBarCrowdByVenueId?.[venue.id];
    const cachedLineWait = latestLineWaitByVenueId?.[venue.id];
    
    if (cachedBarCrowd && mounted) {
      setLatestBarCrowd(cachedBarCrowd);
    }
    
    if (cachedLineWait && mounted) {
      setLatestLineWait(cachedLineWait);
    }
    
    // Then fetch fresh data as backup
    if (isBar) {
      const { data, error } = await getLatestBarCrowdCheckIn(venue.id, 240);
      if (mounted) {
        if (error) {
          console.error("[VenueCard] Error loading bar crowd:", error);
        } else {
          setLatestBarCrowd(data || null);
        }
      }
    }
    
    if (isClub) {
      const { data, error } = await getLatestLineWait(venue.id, 120);
      if (mounted) {
        if (error) {
          console.error("[VenueCard] Error loading line wait:", error);
        } else {
          setLatestLineWait(data?.line_wait || null);
        }
      }
    }
  }
  
  loadCheckIns();
  return () => { mounted = false; };
}, [venue?.id, isBar, isClub, latestBarCrowdByVenueId, latestLineWaitByVenueId]);


  const address = venue?.address || null;
  const neighborhood = venue?.neighborhood || null;
  const locationText = address 
    ? `${neighborhood || ""}${neighborhood && address ? " • " : ""}${address}` 
    : (neighborhood || "");

  // Back card data
  const hasBackData = venue?.hours || venue?.music_profile || venue?.dress_code || 
                      venue?.vibe_description || venue?.avg_age || musicText;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }} collapsable={false}>
      <View style={styles.cardContainer} collapsable={false}>
        {/* Main Card Content */}
        <Pressable onPress={handleCardPress} style={[styles.card, isRecent && styles.cardLive]}>
          {/* LIVE Border Glow - Pulsing gold border when recent */}
          {isRecent && (
            <Animated.View
              style={[
                styles.liveBorderGlow,
                {
                  opacity: livePulseAnim.interpolate({
                    inputRange: [1, 1.15],
                    outputRange: [0.6, 1],
                  }),
                  transform: [
                    {
                      scale: livePulseAnim.interpolate({
                        inputRange: [1, 1.15],
                        outputRange: [1, 1.02],
                      }),
                    },
                  ],
                },
              ]}
              pointerEvents="none"
            />
          )}
          <View style={styles.cardContent}>
            {/* Scrollable Content Area */}
            <View style={styles.cardScrollableContent}>
              {/* Top Badge Row - LIVE Badge + Crowd Headline */}
              <View style={styles.topBadgeRow}>
                {/* LIVE Badge - Show when vibe is recent */}
                {isRecent && (
                  <Animated.View
                    style={[
                      styles.liveBadge,
                      {
                        opacity: livePulseAnim.interpolate({
                          inputRange: [1, 1.15],
                          outputRange: [0.9, 1],
                        }),
                      },
                    ]}
                  >
                    <View style={styles.liveBadgeDot} />
                    <Text style={styles.liveBadgeText}>LIVE</Text>
                  </Animated.View>
                )}
                {/* Crowd Headline - Show only if headline exists */}
                {showHeadline && (
                  <View style={[styles.crowdBadge, { backgroundColor: crowdBadgeStyle.bg, borderColor: crowdBadgeStyle.border }]}>
                    <Text style={styles.crowdBadgeEmoji}>{crowdEmoji}</Text>
                    <Text style={styles.crowdBadgeText}>
                      {crowdLabel}
                      {headlineTime && (
                        <> • {formatVibeRecency(headlineTime)}</>
                      )}
                    </Text>
                  </View>
                )}
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
                  {ageRangeText && (
                    <View style={styles.ageBadge}>
                      <Text style={styles.ageBadgeText}>Age: {ageRangeText}</Text>
                    </View>
                  )}
                </View>
                {locationText && (
                  <Text style={styles.locationText}>{locationText}</Text>
                )}
              </View>

              {/* Check-in Count Badge - Only show when count > 0 */}
                {checkInCount > 0 && (
                  <View style={styles.checkInBadge}>
                    <Text style={styles.checkInBadgeText}>
                      👥 {checkInCount} here recently
                    </Text>
                  </View>
                )}

                {/* Ratio Block - Conditional rendering: clubs always show, bars only if ratioInfo.show */}
                {/* For bars without vibes: completely removed (saves 65px) */}
                {(isClub || ratioInfo.show) && (
                  <View style={styles.ratioContainer}>
                    <View style={styles.ratioBar}>
                      <LinearGradient
                        colors={["#3B82F6", "#A855F7"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.ratioSegmentGuys, { flex: ratioInfo.guys }]}
                      />
                      <LinearGradient
                        colors={["#A855F7", "#EC4899"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.ratioSegmentGirls, { flex: ratioInfo.girls }]}
                      />
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

                {/* Stats Tiles Row - ALWAYS RENDER - Always 3 tiles (Type/Drinks(or Cover)/Music) */}
                {/* CRITICAL: This section MUST always render, never conditionally */}
                <View style={styles.statTilesRow}>
                  {statTiles.map((tile, index) => (
                    <View key={index} style={styles.statTile}>
                      <Text style={styles.statIcon}>{tile.icon}</Text>
                      <Text style={styles.statValue}>{tile.value || "—"}</Text>
                      <Text style={styles.statLabel}>{tile.label}</Text>
                    </View>
                  ))}
                </View>

                {/* Status line when no vibes - show historical prediction instead of empty state */}
                {!hasVibe && venue?.venue_type && (
                  <View style={{ paddingVertical: 4, alignItems: "center", marginTop: 2, marginBottom: 4 }}>
                    <Text style={{ color: "#94A3B8", fontSize: 13, fontWeight: "600" }}>
                      {venue?.venue_type?.toLowerCase() === "club" 
                        ? "Usually peaks around 11:30 on Friday nights"
                        : "Usually picks up around 10 on Friday nights"}
                    </Text>
                  </View>
                )}
              </View>

              {/* Actions Row - ALWAYS rendered at bottom, regardless of vibe/check-in status */}
              {/* Shows for both clubs and bars, with or without vibes, with or without check-ins */}
              <View style={styles.actionsRow} onStartShouldSetResponder={() => true}>
                {/* I'm Here Button - ALWAYS show for both clubs and bars */}
                {/* Always visible regardless of vibe status, check-in status, or venue type */}
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => {
                    console.log('[VenueCard] + Post Vibe button pressed directly');
                    handlePostVibe();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.primaryButtonText}>📍 I'm Here</Text>
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
                    style={[styles.secondaryButton, !hasVibe && styles.secondaryButtonDisabled]}
                    onPress={() => {
                      console.log('[VenueCard] See Last Vibe button pressed directly');
                      handleSeeLastVibe();
                    }}
                    activeOpacity={0.7}
                    disabled={!hasVibe}
                  >
                    <Text style={styles.secondaryButtonText}>See Last Vibe</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
        </Pressable>

        {/* Compact Banner - Last Vibe Details */}
        {showLastVibe && hasVibe && (
          <Animated.View
            style={[
              styles.lastVibeBanner,
              {
                opacity: bannerOpacity,
                transform: [{ translateY: bannerTranslateY }],
              },
            ]}
          >
            <View style={styles.bannerContent}>
              <View style={styles.bannerHeader}>
                <Text style={styles.bannerTitle}>
                  🔥 LAST VIBE • {formatVibeRecency(latestVibe.created_at).toUpperCase()}
                </Text>
                <TouchableOpacity
                  onPress={handleCloseBanner}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.bannerClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.bannerDetails}>
                {isBar && latestVibe.bar_type && (
                  <Text style={styles.bannerDetail}>🏈 {getBarTypeLabel(latestVibe.bar_type)}</Text>
                )}
                {ratioInfo.show && (
                  <Text style={styles.bannerDetail}>• 👨 {ratioInfo.guys}% / {ratioInfo.girls}% 👩</Text>
                )}
                {isBar && drinksPrice && (
                  <Text style={styles.bannerDetail}>• 🍺 {drinksPrice}</Text>
                )}
                {!isBar && latestVibe.cover && (
                  <Text style={styles.bannerDetail}>• 💵 {mapCoverPriceToUI(latestVibe.cover)}</Text>
                )}
                {latestVibe.music && (
                  <Text style={styles.bannerDetail}>• {getMusicEmoji(latestVibe.music)} {latestVibe.music}</Text>
                )}
              </View>
            </View>
          </Animated.View>
        )}
      </View>
      
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    width: "100%",
    position: "relative",
    // Removed fixed height - card grows with content
    marginBottom: 0, // Spacing handled by FlatList ItemSeparatorComponent
    marginTop: 0,
    marginHorizontal: 0,
    flexShrink: 0,
  },
  card: {
    backgroundColor: "#0F0B1E", // Slightly lighter dark
    borderRadius: 20, // More rounded
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.4)", // Brighter border
    padding: 16,
    width: "100%",
    // Removed height: "100%" - let it size naturally
    overflow: "hidden",
    flexDirection: "column",
    shadowColor: "#A855F7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    position: "relative",
  },
  cardLive: {
    borderColor: "rgba(245, 158, 11, 0.6)", // Gold border when live
    borderWidth: 2,
    shadowColor: "#F59E0B",
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  liveBorderGlow: {
    position: "absolute",
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#F59E0B", // Gold
    backgroundColor: "transparent",
    zIndex: -1,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1.5,
    borderColor: "rgba(245, 158, 11, 0.5)",
    gap: 6,
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  liveBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F59E0B",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 3,
  },
  liveBadgeText: {
    color: "#FBBF24", // Brighter gold text
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  cardContent: {
    width: "100%",
    // Removed height: "100%" - let it size naturally
    flexDirection: "column",
    justifyContent: "space-between", // Push buttons to bottom
    minHeight: 0, // Allow flex shrinking
  },
  cardScrollableContent: {
    flex: 1,
    width: "100%",
    minHeight: 0, // Allow flex shrinking
    // Removed overflow: "hidden" - allow content to grow naturally
  },
  // Reserve space but hide visually (for consistent layout)
  reserveSpaceHidden: {
    opacity: 0,
    pointerEvents: "none", // Disable touch events when hidden
    // Keep minHeight and margins - don't collapse
  },
  // Completely collapse (remove from layout)
  collapsedHidden: {
    opacity: 0,
    height: 0,
    marginBottom: 0,
    marginTop: 0,
    overflow: "hidden",
    pointerEvents: "none",
  },
  // Legacy hiddenElement - kept for backwards compatibility but prefer reserveSpaceHidden
  hiddenElement: {
    opacity: 0,
    height: 0,
    marginBottom: 0,
    marginTop: 0,
    overflow: "hidden",
    pointerEvents: "none",
  },
  topBadgeRow: {
    marginBottom: 6, // REDUCED from 8 to 6
    minHeight: 26, // REDUCED from 28 to 26
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  crowdBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 20, // More pill-shaped
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1.5,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  crowdBadgeEmoji: {
    fontSize: 16,
  },
  crowdBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  titleBlock: {
    marginBottom: 8, // REDUCED from 10 to 8
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 6,
  },
  venueName: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  locationText: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(168,85,247,0.2)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.5)",
    gap: 4,
  },
  typeBadgeEmoji: {
    fontSize: 13,
  },
  typeBadgeText: {
    color: "#E9D5FF",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  typeBadgeError: {
    color: "#EF4444",
  },
  ageBadge: {
    backgroundColor: "rgba(59,130,246,0.2)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1.5,
    borderColor: "rgba(59,130,246,0.5)",
  },
  ageBadgeText: {
    color: "#BFDBFE",
    fontSize: 11,
    fontWeight: "700",
  },
  checkInBadge: {
    backgroundColor: "rgba(16,185,129,0.2)",
    borderRadius: 14,
    paddingVertical: 3, // REDUCED from 4 to 3
    paddingHorizontal: 8, // REDUCED from 10 to 8
    marginBottom: 6, // REDUCED from 8 to 6
    alignSelf: "flex-start",
    minHeight: 26, // REDUCED from 28 to 26
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(16,185,129,0.4)",
  },
  checkInBadgeText: {
    color: "#6EE7B7",
    fontSize: 12,
    fontWeight: "700",
  },
  ratioContainer: {
    marginBottom: 10, // REDUCED from 12 to 10
    minHeight: 65, // REDUCED from 70 to 65
    justifyContent: "flex-start",
  },
  ratioBar: {
    flexDirection: "row",
    height: 6, // REDUCED from 8 to 6
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: "#1E1B2E",
    marginBottom: 6, // REDUCED from 8 to 6
    shadowColor: "#A855F7",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  ratioSegmentGuys: {},
  ratioSegmentGirls: {},
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
    fontSize: 16,
  },
  ratioLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  ratioCaption: {
    color: "#64748B",
    fontSize: 10,
    marginTop: 4,
    textAlign: "center",
    fontWeight: "500",
  },
  statTilesRow: {
    flexDirection: "row",
    gap: 6, // REDUCED from 8 to 6
    marginBottom: 8, // REDUCED from 10 to 8
    marginTop: 4, // REDUCED from 6 to 4
    height: 70, // REDUCED from 75 to 70
    alignItems: "stretch",
    justifyContent: "space-between",
    paddingHorizontal: 0,
    width: "100%",
    flexShrink: 0, // NEVER SHRINK - ALWAYS RENDER
  },
  statTile: {
    flex: 1,
    backgroundColor: "rgba(168,85,247,0.15)",
    borderRadius: 12, // REDUCED from 14 to 12
    padding: 5, // REDUCED from 6 to 5
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.3)",
    minHeight: 65, // REDUCED from 70 to 65
    maxHeight: 70, // REDUCED from 75 to 70
    shadowColor: "#A855F7",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    flexShrink: 0, // NEVER SHRINK
  },
  statIcon: {
    fontSize: 18, // REDUCED from 20 to 18
    marginBottom: 2, // REDUCED from 3 to 2
  },
  statValue: {
    color: "#FFFFFF",
    fontSize: 10, // REDUCED from 11 to 10
    fontWeight: "700",
    marginBottom: 1,
    textAlign: "center",
    flexShrink: 0, // NEVER SHRINK
  },
  statLabel: {
    color: "#94A3B8",
    fontSize: 8, // REDUCED from 9 to 8
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.2, // REDUCED from 0.3 to 0.2
    flexShrink: 0, // NEVER SHRINK
  },
  noVibesContainer: {
    paddingVertical: 4, // REDUCED from 6 to 4
    alignItems: "center",
    marginTop: 2,
    marginBottom: 4, // REDUCED from 6 to 4
    minHeight: 30, // REDUCED from 35 to 30
    justifyContent: "center",
  },
  noVibesText: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  noVibesSubtext: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "500",
  },
  actionsRow: {
    width: "100%",
    gap: 5, // REDUCED from 6 to 5
    flexShrink: 0,
    marginTop: 0,
    paddingTop: 4, // REDUCED from 6 to 4
    minHeight: 120, // REDUCED from 130 to 120
  },
  checkInButton: {
    backgroundColor: "rgba(16,185,129,0.2)",
    borderRadius: 12, // REDUCED from 14 to 12
    paddingVertical: 8, // REDUCED from 10 to 8
    paddingHorizontal: 10,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(16,185,129,0.5)",
    width: "100%",
    height: 38, // REDUCED from 42 to 38
    justifyContent: "center",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  checkInButtonText: {
    color: "#6EE7B7",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  primaryButton: {
    backgroundColor: "#A855F7",
    borderRadius: 12, // REDUCED from 14 to 12
    paddingVertical: 10, // REDUCED from 12 to 10
    alignItems: "center",
    width: "100%",
    height: 40, // REDUCED from 44 to 40
    justifyContent: "center",
    shadowColor: "#A855F7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  secondaryActions: {
    flexDirection: "row",
    gap: 5, // REDUCED from 6 to 5
    height: 36, // REDUCED from 40 to 36
    marginTop: 0,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "rgba(168,85,247,0.15)",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.4)",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#E9D5FF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  secondaryButtonDisabled: {
    opacity: 0.5,
  },
  expandedContainer: {
    overflow: "hidden",
    marginTop: 8,
  },
  expandedContent: {
    backgroundColor: "#0B0625",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
    shadowColor: "#A855F7",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  expandedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  expandedTitle: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  closeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(168,85,247,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    color: "#A855F7",
    fontSize: 16,
    fontWeight: "600",
  },
  expandedMetrics: {
    gap: 12,
    marginBottom: 16,
  },
  expandedMetricRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  expandedMetricEmoji: {
    fontSize: 18,
    width: 24,
  },
  expandedMetricLabel: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "500",
    minWidth: 60,
  },
  expandedMetricValue: {
    color: "#E5E7EB",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  expandedFooter: {
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(168,85,247,0.1)",
  },
  expandedFooterText: {
    color: "#6B7280",
    fontSize: 11,
    textAlign: "center",
  },
  expandedCloseButton: {
    backgroundColor: "rgba(168,85,247,0.15)",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
  },
  expandedCloseButtonText: {
    color: "#A855F7",
    fontSize: 13,
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
  // Compact banner styles
  lastVibeBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(168, 85, 247, 0.95)",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: "#A855F7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 100,
  },
  bannerContent: {
    gap: 6,
  },
  bannerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bannerTitle: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  bannerClose: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    width: 24,
    height: 24,
    textAlign: "center",
  },
  bannerDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  bannerDetail: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
});