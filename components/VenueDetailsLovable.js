import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Linking,
  Dimensions,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../contexts/AuthContext";
import { useAppContext } from "../contexts/AppContext";
import { getLatestVibe, getRecentVibes } from "../services/vibeService";
import { getCheckInCount, createCheckIn, getLatestBarCrowdCheckIn, getLatestLineWait, getRecentCheckIns } from "../services/checkInService";
import { scheduleVibeReminder } from "../services/notificationService";
import { formatTimeAgo } from "../utils/timeHelpers";
import { getDisplayRatio } from "../utils/vibeHelpers";
import { mapCoverPriceToUI, mapBarTierToUI, mapBarTierToSymbol, mapBarTierToFullLabel } from "../utils/priceMapping";
import CheckInModal from "./CheckInModal";
import EmptyState, { EmptyStates } from "./EmptyState";

const { width } = Dimensions.get("window");

function getCrowdEmoji(crowd) {
  switch (crowd) {
    case "Dead": return "💀";
    case "Chill": return "😌";
    case "Fun": return "🎉";
    case "Buzzing": return "🐝";
    case "Packed": return "🔥";
    case "Chaos": return "⚡";
    default: return null;
  }
}

function getCrowdGradient(crowd) {
  switch (crowd) {
    case "Dead": return ["#6B7280", "#4B5563"];
    case "Chill": return ["#3B82F6", "#2563EB"];
    case "Fun": return ["#A855F7", "#9333EA"];
    case "Buzzing": return ["#F59E0B", "#D97706"]; // Amber/yellow for buzzing bee
    case "Packed": return ["#EF4444", "#DC2626"];
    case "Chaos": return ["#F97316", "#EA580C"];
    default: return ["#64748B", "#475569"];
  }
}

function getBarTypeEmoji(barType) {
  if (!barType) return "🍸";
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

export default function VenueDetailsLovable({ venue, onBack, onOpenSheet, refreshKey }) {
  const { user, isAuthenticated } = useAuth();
  const { latestVibesByVenueId, upsertLatestVibe, upsertLatestBarCrowd, upsertLatestLineWait } = useAppContext();

  // Use context as single source of truth for latest vibe (syncs with VenueCardLovable)
  const latestVibe = latestVibesByVenueId?.[venue?.id] ?? null;

  const [recentUpdates, setRecentUpdates] = useState([]); // Combined vibes + check-ins
  const [checkInCount, setCheckInCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [latestBarCrowd, setLatestBarCrowd] = useState(null);
  const [latestLineWait, setLatestLineWait] = useState(null);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(50)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(headerAnim, {
        toValue: 1,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.spring(contentAnim, {
        toValue: 0,
        delay: 100,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const loadData = async () => {
    if (!venue?.id) return;

    setLoading(true);

    try {
      const venueKey = venue.id;

      // Fetch latest vibe and update context (which updates latestVibe via derived state)
      const vibeData = await getLatestVibe(venueKey);
      if (vibeData) {
        upsertLatestVibe(vibeData);
      }

      // Fetch recent vibes (24 hours)
      const recentVibesData = await getRecentVibes(venueKey, 24);
      const vibesWithType = (recentVibesData || []).map(vibe => ({
        ...vibe,
        _type: 'vibe',
      }));

      // Fetch recent check-ins (24 hours)
      const checkInsResult = await getRecentCheckIns(venueKey, 24, 20);
      const checkInsWithType = (checkInsResult?.data || []).map(checkIn => ({
        ...checkIn,
        _type: 'checkin',
      }));

      // Merge and sort by created_at (newest first)
      const combined = [...vibesWithType, ...checkInsWithType]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 15); // Limit to 15 total items

      setRecentUpdates(combined);

      // Get check-in data based on venue type
      if (venue?.venue_type === "bar") {
        const latestCrowdRes = await getLatestBarCrowdCheckIn(venueKey, 60);
        const latestCrowdData = latestCrowdRes?.data ?? latestCrowdRes ?? null;
        setLatestBarCrowd(latestCrowdData);
        setLatestLineWait(null);
      } else if (venue?.venue_type === "club") {
        const latestLineRes = await getLatestLineWait(venueKey, 120);
        const latestLineData = latestLineRes?.data?.line_wait ?? null;
        setLatestLineWait(latestLineData);
        setLatestBarCrowd(null);
      } else {
        setLatestBarCrowd(null);
        setLatestLineWait(null);
      }

      const checkInResult = await getCheckInCount(venueKey, 60);
      setCheckInCount(checkInResult?.count || 0);
    } catch (error) {
      console.error("[VenueDetails] Error loading data:", error);
      setRecentUpdates([]);
      setCheckInCount(0);
      setLatestBarCrowd(null);
      setLatestLineWait(null);
    } finally {
      setLoading(false);
    }
  };

  const updateCheckInCount = async () => {
    if (!venue?.id) return;
    try {
      const result = await getCheckInCount(venue.id, 60);
      setCheckInCount(result?.count || 0);
    } catch (error) {
      console.error("[VenueDetails] Error updating check-in count:", error);
    }
  };

  useEffect(() => {
    loadData();
  }, [venue?.id, refreshKey]);

  useFocusEffect(
    React.useCallback(() => {
      console.log("[VenueDetails] Screen focused - reloading data");
      loadData();
    }, [venue?.id])
  );

  useEffect(() => {
    if (!venue?.id) return;
    
    const interval = setInterval(() => {
      console.log("[VenueDetails] Polling check-in count...");
      updateCheckInCount();
    }, 30000);

    return () => clearInterval(interval);
  }, [venue?.id]);

  const handleCheckIn = () => {
    if (!isAuthenticated || !user) {
      Alert.alert("Sign in required", "Please sign in to check in");
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {}

    setShowCheckInModal(true);
  };

  const handleCheckInSuccess = () => {
    setCheckInCount(prev => prev + 1);
    
    setTimeout(async () => {
      await loadData();
      
      // Propagate check-in data to AppContext
      if (venue?.venue_type === "bar" && latestBarCrowd) {
        upsertLatestBarCrowd(venue.id, latestBarCrowd);
      } else if (venue?.venue_type === "club" && latestLineWait) {
        upsertLatestLineWait(venue.id, latestLineWait);
      }
    }, 500);
  };

  const handleOpenMaps = () => {
    const address = venue?.address || "";
    const query = encodeURIComponent(`${venue.name} ${address}`);
    const url = `https://maps.google.com/?q=${query}`;
    Linking.openURL(url);
  };

  const handleShare = () => {
    Alert.alert("Share", "Share feature coming soon!");
  };

  const handleSave = () => {
    Alert.alert("Save", "Save feature coming soon!");
  };

  const ratioInfo = getDisplayRatio(venue, latestVibe);
  const isBar = venue?.venue_type === "bar";
  console.log('[VenueDetails DEBUG]', {
    venueName: venue?.name,
    isBar,
    drinks_price_tier: latestVibe?.drinks_price_tier,
    drinks_price: latestVibe?.drinks_price
  });
  
  // For bars: crowd comes from check_ins (latestBarCrowd)
  // For clubs: crowd comes from vibes (latestVibe)
  const crowdLevel = isBar
    ? (latestBarCrowd?.crowd_level || latestVibe?.crowd || null)
    : (latestVibe?.crowd || null);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.header,
          {
            transform: [
              {
                translateY: headerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-100, 0],
                }),
              },
            ],
          },
        ]}
      >
        <BlurView intensity={80} tint="dark" style={styles.headerBlur}>
          <View style={styles.headerContent}>
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>{venue?.name || "Venue"}</Text>
              <Text style={styles.headerSubtitle}>{venue?.neighborhood || ""}</Text>
            </View>

            <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </BlurView>
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            transform: [{ translateY: contentAnim }],
            opacity: opacityAnim,
          }}
        >
          <View style={styles.infoGrid}>
            {/* First Row: Crowd + Check-ins (or Bar Type + Drinks for bars) */}
            <View style={styles.infoRow}>
              {isBar ? (
                // BAR: Show Bar Type + Drinks Price
                <>
                  <View style={[styles.infoCard, { backgroundColor: '#EC4899' }]}>
                    <Text style={styles.infoCardEmoji}>
                      {latestVibe?.bar_type ? getBarTypeEmoji(latestVibe.bar_type) : "🍸"}
                    </Text>
                    <Text style={styles.infoCardValue}>
                      {latestVibe?.bar_type ? getBarTypeLabel(latestVibe.bar_type) : "—"}
                    </Text>
                    <Text style={styles.infoCardLabel}>Bar Type</Text>
                  </View>
                  
                  <View style={[styles.infoCard, { backgroundColor: '#F59E0B' }]}>
                    <Text style={styles.infoCardEmoji}>🍹</Text>
                    <Text style={styles.infoCardValue}>
                      {latestVibe?.drinks_price_tier ? mapBarTierToFullLabel(latestVibe.drinks_price_tier) : "—"}
                    </Text>
                    <Text style={styles.infoCardLabel}>Drinks</Text>
                  </View>
                </>
              ) : (
                // CLUB: Show Crowd + Line
                <>
                  <View style={[styles.infoCard, { backgroundColor: getCrowdGradient(crowdLevel)[0] }]}>
                    <Text style={styles.infoCardEmoji}>{getCrowdEmoji(crowdLevel) || "👥"}</Text>
                    <Text style={styles.infoCardValue}>{crowdLevel || "—"}</Text>
                    <Text style={styles.infoCardLabel}>Crowd</Text>
                  </View>

                  <View style={[styles.infoCard, { backgroundColor: '#10B981' }]}>
                    <Text style={styles.infoCardEmoji}>⏱</Text>
                    <Text style={styles.infoCardValue} numberOfLines={1}>
                      {latestLineWait || latestVibe?.line || "—"}
                    </Text>
                    <Text style={styles.infoCardLabel}>Line</Text>
                  </View>
                </>
              )}
            </View>

            {/* Second Row: Music + (Crowd for bars / Cover for clubs) */}
            <View style={styles.infoRow}>
              {isBar ? (
                // BAR: Show Crowd + Music
                <>
                  <View style={[styles.infoCard, { backgroundColor: getCrowdGradient(crowdLevel)[0] }]}>
                    <Text style={styles.infoCardEmoji}>{getCrowdEmoji(crowdLevel) || "👥"}</Text>
                    <Text style={styles.infoCardValue}>{crowdLevel || "—"}</Text>
                    <Text style={styles.infoCardLabel}>Crowd</Text>
                  </View>
                  
                  <View style={[styles.infoCard, { backgroundColor: '#8B5CF6' }]}>
                    <Text style={styles.infoCardEmoji}>🎵</Text>
                    <Text style={styles.infoCardValue} numberOfLines={1}>
                      {latestVibe?.music || "—"}
                    </Text>
                    <Text style={styles.infoCardLabel}>Music</Text>
                  </View>
                </>
              ) : (
                // CLUB: Show Cover + Music
                <>
                  <View style={[styles.infoCard, { backgroundColor: '#F59E0B' }]}>
                    <Text style={styles.infoCardEmoji}>💰</Text>
                    <Text style={styles.infoCardValue}>
                      {latestVibe?.cover ? mapCoverPriceToUI(latestVibe.cover) : "—"}
                    </Text>
                    <Text style={styles.infoCardLabel}>Cover</Text>
                  </View>
                  
                  <View style={[styles.infoCard, { backgroundColor: '#8B5CF6' }]}>
                    <Text style={styles.infoCardEmoji}>🎵</Text>
                    <Text style={styles.infoCardValue} numberOfLines={1}>
                      {latestVibe?.music || "—"}
                    </Text>
                    <Text style={styles.infoCardLabel}>Music</Text>
                  </View>
                </>
              )}
            </View>
            
            {/* Third Row: Check-ins Badge (for both bars and clubs) */}
            <View style={styles.checkInBadgeRow}>
              <View style={styles.checkInBadgeSmall}>
                <Text style={styles.checkInBadgeEmoji}>👥</Text>
                <Text style={styles.checkInBadgeTextSmall}>
                  {checkInCount > 0 ? `${checkInCount} checked in (60m)` : "No check-ins yet"}
                </Text>
              </View>
            </View>
          </View>

          {ratioInfo.show && (
            <View style={styles.ratioSection}>
              <View style={styles.ratioBarContainer}>
                <View style={styles.ratioBar}>
                  <LinearGradient
                    colors={["#3B82F6", "#A855F7"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.ratioSegment, { flex: ratioInfo.guys }]}
                  />
                  <LinearGradient
                    colors={["#A855F7", "#EC4899"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.ratioSegment, { flex: ratioInfo.girls }]}
                  />
                </View>
                <View style={styles.ratioLabels}>
                  <Text style={styles.ratioLabel}>👨 {ratioInfo.guys}%</Text>
                  <Text style={styles.ratioLabel}>{ratioInfo.girls}% 👩</Text>
                </View>
                {ratioInfo.isDefault && (
                  <Text style={styles.ratioCaption}>No data yet — guessed 50/50</Text>
                )}
              </View>
            </View>
          )}

          <View style={styles.primaryActionsSection}>
            <TouchableOpacity
              style={styles.postVibeButtonLarge}
              onPress={() => {
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                } catch (e) {}
                onOpenSheet(venue);
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#A855F7", "#9333EA"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.postVibeGradient}
              >
                <Ionicons name="create" size={28} color="#FFFFFF" />
                <Text style={styles.postVibeTextLarge}>Post your vibe 🔥</Text>
              </LinearGradient>
            </TouchableOpacity>

            {isAuthenticated && (
              <TouchableOpacity
                style={styles.checkInButtonLarge}
                onPress={handleCheckIn}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={["#10B981", "#059669"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.checkInGradient}
                >
                  <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
                  <Text style={styles.checkInTextLarge}>✓ I'm here (+1 pt)</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.locationCard}>
            <View style={styles.locationHeader}>
              <Ionicons name="location" size={24} color="#A855F7" />
              <Text style={styles.sectionTitle}>Location</Text>
            </View>
            <Text style={styles.locationAddress}>{venue?.address || "Address unavailable"}</Text>
            
            <View style={styles.locationActionsRow}>
              <TouchableOpacity
                style={styles.locationActionButton}
                onPress={handleOpenMaps}
                activeOpacity={0.7}
              >
                <Text style={styles.locationActionEmoji}>📍</Text>
                <Text style={styles.locationActionText}>Navigate</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.locationActionButton}
                onPress={handleSave}
                activeOpacity={0.7}
              >
                <Text style={styles.locationActionEmoji}>⭐</Text>
                <Text style={styles.locationActionText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>🔥 Recent Updates</Text>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#A855F7" size="small" />
                <Text style={styles.loadingText}>Loading updates...</Text>
              </View>
            ) : recentUpdates.length === 0 ? (
              <EmptyState
                {...EmptyStates.noRecentVibes}
                variant="card"
              />
            ) : (
              <View style={styles.vibeCardsContainer}>
                {recentUpdates.map((item, index) => {
                  // CHECK-IN CARD
                  if (item._type === 'checkin') {
                    const hasLineWait = item.line_wait;
                    const hasCrowdLevel = item.crowd_level;
                    const crowdEmoji = getCrowdEmoji(item.crowd_level);

                    return (
                      <View key={`checkin-${item.id || index}`} style={styles.checkInCard}>
                        <LinearGradient
                          colors={['rgba(16,185,129,0.15)', 'rgba(5,150,105,0.08)']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.vibeCardGradient}
                        >
                          <View style={styles.vibeCardHeader}>
                            <View style={styles.checkInHeaderLeft}>
                              <Text style={styles.checkInEmoji}>📍</Text>
                              <View>
                                <Text style={styles.checkInLabel}>Someone checked in</Text>
                                <Text style={styles.vibeCardTimeSmall}>{formatTimeAgo(item.created_at, true)}</Text>
                              </View>
                            </View>
                          </View>
                          {(hasLineWait || hasCrowdLevel) && (
                            <View style={styles.vibeCardDetails}>
                              {hasLineWait && (
                                <View style={styles.vibeCardTag}>
                                  <Text style={styles.vibeCardTagText}>⏱ {item.line_wait}</Text>
                                </View>
                              )}
                              {hasCrowdLevel && crowdEmoji && (
                                <View style={styles.vibeCardTag}>
                                  <Text style={styles.vibeCardTagText}>{crowdEmoji} {item.crowd_level}</Text>
                                </View>
                              )}
                            </View>
                          )}
                        </LinearGradient>
                      </View>
                    );
                  }

                  // VIBE CARD
                  const vibe = item;
                  const vibeRatioInfo = getDisplayRatio(venue, vibe);
                  const vibeCrowd = vibe.crowd;
                  const crowdEmoji = getCrowdEmoji(vibeCrowd);

                  {/* BAR VIBE LAYOUT */}
                  if (isBar) {
                    return (
                      <TouchableOpacity
                        key={`vibe-${vibe.id || index}`}
                        style={styles.vibeCard}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={['rgba(245,158,11,0.12)', 'rgba(168,85,247,0.08)']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.vibeCardGradient}
                        >
                          {/* Bar Header: Bar Type Icon + Time */}
                          <View style={styles.vibeCardHeader}>
                            <View style={styles.barVibeHeaderLeft}>
                              {vibe.bar_type && (
                                <Text style={styles.barVibeTypeEmoji}>{getBarTypeEmoji(vibe.bar_type)}</Text>
                              )}
                              <View>
                                {vibe.bar_type && (
                                  <Text style={styles.barVibeTypeText}>{getBarTypeLabel(vibe.bar_type)}</Text>
                                )}
                                <Text style={styles.vibeCardTimeSmall}>{formatTimeAgo(vibe.created_at, true)}</Text>
                              </View>
                            </View>
                            {vibe.drinks_price_tier && (
                              <View style={styles.barVibePriceBadge}>
                                <Text style={styles.barVibePriceText}>🍺 {mapBarTierToFullLabel(vibe.drinks_price_tier)}</Text>
                              </View>
                            )}
                          </View>

                          {/* Bar Details: Music + Ratio */}
                          {(vibe.music || (vibeRatioInfo.show && !vibeRatioInfo.isDefault)) && (
                            <View style={styles.vibeCardDetails}>
                              {vibe.music && (
                                <View style={styles.vibeCardTag}>
                                  <Text style={styles.vibeCardTagText}>{getMusicEmoji(vibe.music)} {vibe.music}</Text>
                                </View>
                              )}
                              {vibeRatioInfo.show && !vibeRatioInfo.isDefault && (
                                <View style={styles.vibeCardTag}>
                                  <Text style={styles.vibeCardTagText}>👨 {vibeRatioInfo.guys}% / {vibeRatioInfo.girls}% 👩</Text>
                                </View>
                              )}
                            </View>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    );
                  }

                  {/* CLUB VIBE LAYOUT */}
                  return (
                    <TouchableOpacity
                      key={`vibe-${vibe.id || index}`}
                      style={styles.vibeCard}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={['rgba(168,85,247,0.15)', 'rgba(147,51,234,0.08)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.vibeCardGradient}
                      >
                        {/* Header: Time + Crowd (if available) */}
                        <View style={styles.vibeCardHeader}>
                          <Text style={styles.vibeCardTime}>{formatTimeAgo(vibe.created_at, true)}</Text>
                          {vibeCrowd && crowdEmoji && (
                            <View style={styles.vibeCardCrowdBadge}>
                              <Text style={styles.vibeCardCrowdEmoji}>{crowdEmoji}</Text>
                              <Text style={styles.vibeCardCrowdText}>{vibeCrowd}</Text>
                            </View>
                          )}
                        </View>

                        {/* Club Details: Cover + Line + Music + Ratio */}
                        <View style={styles.vibeCardDetails}>
                          {vibe.cover && (
                            <View style={styles.vibeCardTag}>
                              <Text style={styles.vibeCardTagText}>💵 {mapCoverPriceToUI(vibe.cover)}</Text>
                            </View>
                          )}
                          {vibe.line && (
                            <View style={styles.vibeCardTag}>
                              <Text style={styles.vibeCardTagText}>⏱ {vibe.line}</Text>
                            </View>
                          )}
                          {vibe.music && (
                            <View style={styles.vibeCardTag}>
                              <Text style={styles.vibeCardTagText}>{getMusicEmoji(vibe.music)} {vibe.music}</Text>
                            </View>
                          )}
                          {vibeRatioInfo.show && !vibeRatioInfo.isDefault && (
                            <View style={styles.vibeCardTag}>
                              <Text style={styles.vibeCardTagText}>👨 {vibeRatioInfo.guys}% / {vibeRatioInfo.girls}% 👩</Text>
                            </View>
                          )}
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          <View style={{ height: 40 }} />
        </Animated.View>
      </ScrollView>

      {/* Check-in Modal */}
      <CheckInModal
        visible={showCheckInModal}
        onClose={() => setShowCheckInModal(false)}
        venue={venue}
        onSuccess={handleCheckInSuccess}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050013",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  headerBlur: {
    paddingTop: 50,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(168,85,247,0.2)",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(168,85,247,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 16,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    marginTop: 2,
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(168,85,247,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 120,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  infoGrid: {
    marginBottom: 24,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  infoCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  infoCardEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  infoCardValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  infoCardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  checkInBadgeRow: {
    marginTop: 12,
    alignItems: 'center',
  },
  checkInBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.2)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(16,185,129,0.4)',
    gap: 8,
  },
  checkInBadgeEmoji: {
    fontSize: 16,
  },
  checkInBadgeTextSmall: {
    color: '#6EE7B7',
    fontSize: 13,
    fontWeight: '700',
  },
  ratioSection: {
    marginBottom: 24,
  },
  ratioBarContainer: {
    backgroundColor: "#0B0625",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.3)",
  },
  ratioBar: {
    flexDirection: "row",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 12,
  },
  ratioSegment: {
    height: "100%",
  },
  ratioLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  ratioLabel: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "600",
  },
  ratioCaption: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 6,
    textAlign: "center",
    fontWeight: "500",
  },
  primaryActionsSection: {
    marginBottom: 24,
  },
  postVibeButtonLarge: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
    shadowColor: "#A855F7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  postVibeGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 24,
    gap: 12,
  },
  postVibeTextLarge: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  checkInButtonLarge: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  checkInGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 12,
  },
  checkInTextLarge: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  locationCard: {
    backgroundColor: "#0B0625",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.3)",
    marginBottom: 24,
  },
  locationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    color: "#F9FAFB",
    fontSize: 18,
    fontWeight: "700",
  },
  locationAddress: {
    color: "#9CA3AF",
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  locationActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  locationActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168,85,247,0.15)',
    borderRadius: 12,
    paddingVertical: 12,
borderWidth: 1.5,
borderColor: 'rgba(168,85,247,0.4)',
gap: 8,
},
locationActionEmoji: {
fontSize: 18,
},
locationActionText: {
fontSize: 14,
fontWeight: '700',
color: '#E9D5FF',
},
recentSection: {
marginBottom: 24,
},
loadingContainer: {
flexDirection: 'row',
alignItems: 'center',
justifyContent: 'center',
padding: 24,
gap: 12,
},
loadingText: {
color: '#94A3B8',
fontSize: 14,
fontWeight: '500',
},
vibeCardsContainer: {
  marginTop: 16,
  gap: 12,
},
vibeCard: {
  borderRadius: 16,
  overflow: 'hidden',
  borderWidth: 1.5,
  borderColor: 'rgba(168,85,247,0.3)',
},
vibeCardGradient: {
  padding: 16,
},
vibeCardHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 12,
},
vibeCardCrowdBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: 'rgba(0,0,0,0.3)',
  borderRadius: 20,
  paddingVertical: 6,
  paddingHorizontal: 12,
  gap: 6,
},
vibeCardCrowdEmoji: {
  fontSize: 16,
},
vibeCardCrowdText: {
  color: '#FFFFFF',
  fontSize: 14,
  fontWeight: '700',
},
vibeCardTime: {
  color: 'rgba(255,255,255,0.7)',
  fontSize: 12,
  fontWeight: '600',
},
vibeCardDetails: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 8,
},
vibeCardTag: {
  backgroundColor: 'rgba(0,0,0,0.4)',
  borderRadius: 12,
  paddingVertical: 6,
  paddingHorizontal: 10,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.1)',
},
vibeCardTagText: {
  color: '#FFFFFF',
  fontSize: 12,
  fontWeight: '600',
},
// Bar-specific vibe card styles
barVibeHeaderLeft: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
},
barVibeTypeEmoji: {
  fontSize: 32,
},
barVibeTypeText: {
  color: '#FFFFFF',
  fontSize: 16,
  fontWeight: '700',
},
vibeCardTimeSmall: {
  color: 'rgba(255,255,255,0.6)',
  fontSize: 11,
  fontWeight: '500',
  marginTop: 2,
},
barVibePriceBadge: {
  backgroundColor: 'rgba(245,158,11,0.25)',
  borderRadius: 12,
  paddingVertical: 8,
  paddingHorizontal: 12,
  borderWidth: 1,
  borderColor: 'rgba(245,158,11,0.4)',
},
barVibePriceText: {
  color: '#FCD34D',
  fontSize: 13,
  fontWeight: '700',
},
// Check-in card styles
checkInCard: {
  borderRadius: 16,
  overflow: 'hidden',
  borderWidth: 1.5,
  borderColor: 'rgba(16,185,129,0.4)',
},
checkInHeaderLeft: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
},
checkInEmoji: {
  fontSize: 24,
},
checkInLabel: {
  color: '#6EE7B7',
  fontSize: 14,
  fontWeight: '700',
},
emptyState: {
  backgroundColor: "#0B0625",
  borderRadius: 16,
  padding: 32,
  alignItems: "center",
  borderWidth: 1.5,
  borderColor: "rgba(168,85,247,0.3)",
  marginTop: 16,
},
emptyStateEmoji: {
  fontSize: 48,
  marginBottom: 12,
},
emptyStateText: {
  color: "#FFFFFF",
  fontSize: 18,
  fontWeight: "700",
  marginBottom: 4,
},
emptyStateSubtext: {
  color: "#94A3B8",
  fontSize: 14,
},
});