import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Linking,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../contexts/AuthContext";
import { useAppContext } from "../contexts/AppContext";
import { getLatestVibe, getRecentVibes, hasUserVibeTonight } from "../services/vibeService";
import { getCheckInCount, getLatestBarCrowdCheckIn, getLatestLineWait, getRecentCheckIns } from "../services/checkInService";
import { timeAgo } from "../src/utils/timeAgo";
import { mapCoverPriceToUI, mapBarTierToSymbol, formatAgeRange } from "../utils/priceMapping";
import { isVibeLiveForBorder } from "../utils/vibeDecay";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import CheckInModal from "./CheckInModal";
import EmptyState, { EmptyStates } from "./EmptyState";
import { Chip } from "../src/components/Chip";
import { spacing, radius, fontSize, fontWeight, color } from "../src/theme/tokens";
import { supabase } from "../utils/supabase";


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
    case "Buzzing": return ["#F59E0B", "#D97706"];
    case "Packed": return ["#EF4444", "#DC2626"];
    case "Chaos": return ["#F97316", "#EA580C"];
    default: return ["#64748B", "#475569"];
  }
}


export default function VenueDetailsLovable({ venue, onBack, onOpenSheet, refreshKey }) {
  const { user, isAuthenticated } = useAuth();
  const { latestVibesByVenueId, upsertLatestVibe, upsertLatestBarCrowd, upsertLatestLineWait, moveCountsByVenueId } = useAppContext();

  const latestVibe = latestVibesByVenueId?.[venue?.id] ?? null;

  const [recentUpdates, setRecentUpdates] = useState([]);
  const [, setCheckInCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [latestBarCrowd, setLatestBarCrowd] = useState(null);
  const [latestLineWait, setLatestLineWait] = useState(null);
  const [userHasVibeTonight, setUserHasVibeTonight] = useState(false);
  const [hiddenVibeIds, setHiddenVibeIds] = useState(new Set());
  const [blockedUserIds, setBlockedUserIds] = useState(new Set());

  const headerAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(50)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const shareCardRef = useRef(null);
  // Guard against concurrent loadData calls (useEffect + useFocusEffect both fire on mount)
  const isLoadingRef = useRef(false);

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

  const computeTrendForVibe = (vibe, allVibes) => {
    if (!vibe || !allVibes || allVibes.length < 2) return null;
    const ENERGY_MAP = { 'chaos': 5, 'packed': 4, 'buzzing': 3, 'fun': 3, 'chill': 2, 'dead': 1 };
    const vibeIndex = allVibes.findIndex(v => v._type === 'vibe' && v.id === vibe.id);
    if (vibeIndex === -1 || vibeIndex === allVibes.length - 1) return null;
    
    const previousVibe = allVibes[vibeIndex + 1];
    if (previousVibe?._type !== 'vibe' || !previousVibe.crowd) return null;
    
    const latest = ENERGY_MAP[vibe.crowd?.toLowerCase()] ?? 0;
    const previous = ENERGY_MAP[previousVibe.crowd?.toLowerCase()] ?? 0;
    if (latest > previous) return 'heating';
    if (latest < previous) return 'cooling';
    return null;
  };

  const loadData = async () => {
    if (!venue?.id) return;
    // Prevent concurrent calls: useEffect and useFocusEffect both fire on initial
    // mount — without this guard, two parallel fetches would double all DB reads.
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    setLoading(true);

    try {
      const venueKey = venue.id;

      const vibeData = await getLatestVibe(venueKey);
      if (vibeData) {
        upsertLatestVibe(vibeData);
      }

      const recentVibesData = await getRecentVibes(venueKey, 6);
      const vibesWithType = (recentVibesData || []).map(vibe => ({
        ...vibe,
        _type: 'vibe',
      }));

      const checkInsResult = await getRecentCheckIns(venueKey, 6, 20);
      const checkInsWithType = (checkInsResult?.data || []).map(checkIn => ({
        ...checkIn,
        _type: 'checkin',
      }));

      // Deduplicate by composite key (type + id) before sorting — prevents the same
      // row appearing twice if a race delivers it via both a direct fetch and a
      // realtime-triggered reload.
      const seen = new Set();
      const combined = [...vibesWithType, ...checkInsWithType]
        .filter((item) => {
          const key = `${item._type}:${item.id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setRecentUpdates(combined);

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

      if (user?.id) {
        const hasVibe = await hasUserVibeTonight(user.id, venueKey);
        setUserHasVibeTonight(hasVibe);
      }
    } catch (error) {
      console.error("[VenueDetails] Error loading data:", error);
      setRecentUpdates([]);
      setCheckInCount(0);
      setLatestBarCrowd(null);
      setLatestLineWait(null);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
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

  // Load this user's block list from Supabase on mount so blocked-user
  // vibes are filtered immediately, even across sessions.
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("user_blocks")
        .select("blocked_user_id")
        .eq("blocker_id", user.id);
      if (data?.length) {
        setBlockedUserIds(new Set(data.map((b) => b.blocked_user_id)));
      }
    })();
  }, [user?.id]);

  const handleCheckInSuccess = () => {
    setCheckInCount(prev => prev + 1);
    
    setTimeout(async () => {
      await loadData();
      
      if (venue?.venue_type === "bar" && latestBarCrowd) {
        upsertLatestBarCrowd(venue.id, latestBarCrowd);
      } else if (venue?.venue_type === "club" && latestLineWait) {
        upsertLatestLineWait(venue.id, latestLineWait);
      }
    }, 500);
  };

  // Step 1 — action sheet: Report or Block
  const handleVibeOptions = (vibeId, vibeUserId) => {
    const isOwnVibe = vibeUserId && vibeUserId === user?.id;

    const buttons = isOwnVibe
      ? [{ text: "Cancel", style: "cancel" }]
      : [
          { text: "Report Vibe", style: "destructive", onPress: () => handleReportVibe(vibeId) },
          { text: "Block User",  style: "destructive", onPress: () => handleBlockUser(vibeId, vibeUserId) },
          { text: "Cancel", style: "cancel" },
        ];
    Alert.alert("Vibe Options", null, buttons);
  };

  // Step 2 — reason picker for report (second Alert, stacks on iOS)
  const handleReportVibe = (vibeId) => {
    Alert.alert("Report Vibe", "What's wrong with this vibe?", [
      { text: "Spam",             onPress: () => submitVibeReport(vibeId, "spam") },
      { text: "Fake or inaccurate", onPress: () => submitVibeReport(vibeId, "fake_or_inaccurate") },
      { text: "Inappropriate",   style: "destructive", onPress: () => submitVibeReport(vibeId, "inappropriate") },
      { text: "Cancel",          style: "cancel" },
    ]);
  };

  // Persist report to vibe_reports table; optimistically hide the vibe regardless
  const submitVibeReport = async (vibeId, reason) => {
    // Optimistic hide — user shouldn't see the vibe they reported
    setHiddenVibeIds((prev) => new Set([...prev, vibeId]));

    try {
      if (user?.id) {
        await supabase.from("vibe_reports").insert({
          reporter_id:      user.id,
          reported_vibe_id: vibeId,
          reason,
        });
      }
    } catch (_) {
      // Silently absorb — duplicate reports hit the UNIQUE constraint which is fine.
      // The user sees the confirmation either way; the vibe stays hidden.
    }

    Alert.alert(
      "Thanks for reporting",
      "Our team will review this within 24 hours."
    );
  };

  // Persist block to user_blocks table; optimistically filter all their vibes
  const handleBlockUser = async (vibeId, vibeUserId) => {
    // Optimistic update — hide this vibe and all others from the same user
    setHiddenVibeIds((prev) => new Set([...prev, vibeId]));
    if (vibeUserId) {
      setBlockedUserIds((prev) => new Set([...prev, vibeUserId]));
    }

    try {
      if (user?.id && vibeUserId) {
        await supabase.from("user_blocks").insert({
          blocker_id:      user.id,
          blocked_user_id: vibeUserId,
        });
      }
    } catch (_) {
      // Silently absorb — UNIQUE constraint fires if already blocked, which is fine.
    }

    Alert.alert("User blocked", "You will no longer see vibes from this user.");
  };

  const handleOpenMaps = () => {
    const address = venue?.address || "";
    const query = encodeURIComponent(`${venue?.name ?? ""} ${address}`);
    const url = `https://maps.google.com/?q=${query}`;
    Linking.openURL(url);
  };

  const handleShare = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {}
    try {
      const uri = await captureRef(shareCardRef, { format: "jpg", quality: 0.92 });
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/jpeg",
          dialogTitle: `${venue?.name} on DarkNite`,
        });
      } else {
        Alert.alert("Sharing not available", "Your device doesn't support sharing.");
      }
    } catch (error) {
      console.error("[VenueDetails] Share error:", error);
      Alert.alert("Share failed", "Could not generate share card. Try again.");
    }
  };

  // handleSave removed for V1 — re-implement when saved_venues table is ready

  const isBar = venue?.venue_type === "bar";
  const isClub = venue?.venue_type === "club";
  
  const crowdLevel = isBar
    ? (latestBarCrowd?.crowd_level || latestVibe?.crowd || null)
    : (latestVibe?.crowd || null);
  
  const isLive = isVibeLiveForBorder(latestVibe?.created_at);
  
  const crowdTimeLabel = latestVibe?.created_at
    ? timeAgo(latestVibe.created_at) || 'right now'
    : null;

  const moveCount = moveCountsByVenueId?.[venue?.id] || 0;

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
              <View style={styles.headerTitleRow}>
                <Text style={styles.headerTitle}>{venue?.name || "Venue"}</Text>
                {isLive && (
                  <View style={styles.liveBadge}>
                    <View style={styles.liveBadgeDot} />
                    <Text style={styles.liveBadgeText}>LIVE</Text>
                  </View>
                )}
              </View>
              <View style={styles.headerSubtitleRow}>
                <Text style={styles.headerSubtitle}>{venue?.neighborhood || ""}</Text>
                {venue?.venue_type && (
                  <Text style={styles.headerTypeBadge}>
                    {venue.venue_type.toUpperCase()}
                  </Text>
                )}
              </View>
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
          {/* CROWD Section */}
          <View style={styles.metricsSection}>
            <View style={styles.metricsLeft}>
              <Text style={styles.metricsLabel}>CROWD VIBE</Text>
              <View style={styles.metricsValueRow}>
                {crowdLevel ? (
                  <>
                    <Text style={styles.metricsValue}>{crowdLevel}</Text>
                    {crowdTimeLabel && (
                      <>
                        <Text style={styles.metricsSeparator}>·</Text>
                        <Text style={styles.metricsTime}>{crowdTimeLabel}</Text>
                      </>
                    )}
                  </>
                ) : (
                  <Text style={styles.metricsValueMuted}>No vibes yet tonight</Text>
                )}
              </View>
            </View>
          </View>

          {/* TAGS Section */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.tagsScroll}
            contentContainerStyle={styles.tagsScrollContent}
          >
            {isBar ? (
              <>
                {(latestVibe?.music || venue?.default_music_genre) && (
                  <Chip
                    label={latestVibe?.music || venue?.default_music_genre}
                    icon={<Ionicons name="musical-notes-outline" size={14} color={color.textSecondary} />}
                    tinted={true}
                  />
                )}
                {latestVibe?.drinks_price_tier && (
                  <Chip
                    label={`Drinks: ${mapBarTierToSymbol(latestVibe.drinks_price_tier)}`}
                    icon={<MaterialCommunityIcons name="cash" size={14} color={color.textSecondary} />}
                  />
                )}
                {/* 🚀 TAG CROWD VIBE AQUI PARA BARES */}
                {latestVibe?.crowd_vibe && (
                  <Chip
                    label={latestVibe.crowd_vibe.replace(/_/g, ' ')}
                    icon={<MaterialCommunityIcons name="gender-male-female" size={14} color={color.textSecondary} />}
                  />
                )}
                {latestVibe?.age_range && (
                  <Chip
                    label={formatAgeRange(latestVibe.age_range)}
                    icon={<MaterialCommunityIcons name="account-group" size={14} color={color.textSecondary} />}
                  />
                )}
              </>
            ) : isClub ? (
              <>
                {(latestLineWait || latestVibe?.line) && (
                  <Chip
                    label={`Line: ${latestLineWait || latestVibe?.line}`}
                    icon={<Ionicons name="time-outline" size={14} color={color.textSecondary} />}
                  />
                )}
                {latestVibe?.cover && (
                  <Chip
                    label={`Cover: ${mapCoverPriceToUI(latestVibe.cover)}`}
                    icon={<MaterialCommunityIcons name="cash" size={14} color={color.textSecondary} />}
                  />
                )}
                {/* 🚀 TAG CROWD VIBE AQUI PARA CLUBS */}
                {latestVibe?.crowd_vibe && (
                  <Chip
                    label={latestVibe.crowd_vibe.replace(/_/g, ' ')}
                    icon={<MaterialCommunityIcons name="gender-male-female" size={14} color={color.textSecondary} />}
                  />
                )}
                {latestVibe?.music && (
                  <Chip
                    label={latestVibe.music}
                    icon={<Ionicons name="musical-notes-outline" size={14} color={color.textSecondary} />}
                    tinted={true}
                  />
                )}
                {latestVibe?.age_range && (
                  <Chip
                    label={formatAgeRange(latestVibe.age_range)}
                    icon={<MaterialCommunityIcons name="account-group" size={14} color={color.textSecondary} />}
                  />
                )}
              </>
            ) : null}
          </ScrollView>

          {/* CTA Area */}
          <View style={styles.ctaSection}>
            {isAuthenticated ? (
              <TouchableOpacity
                style={[styles.ctaPrimary, userHasVibeTonight && styles.ctaPrimaryOutlined]}
                onPress={() => {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  } catch (e) {}
                  onOpenSheet(venue);
                }}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={userHasVibeTonight ? [color.surface2, color.surface2] : [color.accent, color.accentDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.ctaGradient, userHasVibeTonight && styles.ctaGradientOutlined]}
                >
                  <Ionicons
                    name={userHasVibeTonight ? "create" : "location"}
                    size={20}
                    color={userHasVibeTonight ? color.textPrimary : "#FFFFFF"}
                  />
                  <Text style={[styles.ctaPrimaryText, userHasVibeTonight && { color: color.textPrimary }]}>
                    {userHasVibeTonight ? "Update Vibe" : "I'm Here"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.ctaPrimary}
                onPress={() => {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  } catch (e) {}
                  Alert.alert("Sign in required", "Please sign in to update vibes");
                }}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[color.accent, color.accentDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.ctaGradient}
                >
                  <Ionicons name="location" size={20} color="#FFFFFF" />
                  <Text style={styles.ctaPrimaryText}>I'm Here</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.locationCard}>
            <View style={styles.locationHeader}>
              <Ionicons name="location" size={24} color={color.accent} />
              <Text style={styles.sectionTitle}>Location</Text>
            </View>
            <Text style={styles.locationAddress}>{venue?.address || "Address unavailable"}</Text>
            
            <View style={styles.locationActionsRow}>
              <TouchableOpacity
                style={styles.locationActionButton}
                onPress={handleOpenMaps}
                activeOpacity={0.7}
              >
                <Ionicons name="navigate-outline" size={18} color={color.textPrimary} />
                <Text style={styles.locationActionText}>Navigate</Text>
              </TouchableOpacity>

              {/* Save button — hidden for V1, re-enable when saved_venues table is implemented */}
              {/* <TouchableOpacity
                style={styles.locationActionButton}
                onPress={handleSave}
                activeOpacity={0.7}
              >
                <Ionicons name="star-outline" size={18} color={color.textPrimary} />
                <Text style={styles.locationActionText}>Save</Text>
              </TouchableOpacity> */}
            </View>
          </View>

          {/* Move Indicator */}
          {moveCount > 0 && (
            <View style={styles.moveIndicator}>
              <Ionicons name="footsteps" size={18} color={color.accent} />
              <Text style={styles.moveIndicatorText}>
                {moveCount === 1
                  ? "1 person heading here tonight"
                  : `${moveCount} people heading here tonight`}
              </Text>
            </View>
          )}

          <View style={styles.recentSection}>
            <View style={styles.recentSectionHeader}>
              <Text style={styles.sectionTitle}>Recent Updates</Text>
              <View style={styles.recentSectionDivider} />
            </View>
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
              <View style={styles.timelineContainer}>
                {(recentUpdates.filter((u) => !hiddenVibeIds.has(u.id) && !blockedUserIds.has(u.user_id)).slice(0, 4) || []).map((item, index, arr) => {
                  const isLast = index === Math.min(3, arr.length - 1);
                  const trend = item._type === 'vibe' ? computeTrendForVibe(item, recentUpdates) : null;
                  
                  const formatTimelineTime = (timestamp) => {
                    const timeStr = timeAgo(timestamp);
                    return timeStr === 'right now' ? 'Now' : timeStr;
                  };

                  // Dot is "live" (accent color) if the entry is < 15 minutes old
                  const isRecentEntry = (timestamp) => {
                    if (!timestamp) return true;
                    return Date.now() - new Date(timestamp).getTime() < 15 * 60 * 1000;
                  };
                  
                  if (item._type === 'checkin') {
                    const checkInChips = [];

                    if (item.crowd_level) {
                      checkInChips.push({ 
                        label: item.crowd_level, 
                        icon: <MaterialCommunityIcons name="account-group" size={12} color={color.textTertiary} />,
                        priority: 1 
                      });
                    }
                    if (item.line_wait) {
                      checkInChips.push({ 
                        label: `Line: ${item.line_wait}`, 
                        icon: <Ionicons name="time-outline" size={12} color={color.textTertiary} />,
                        priority: 2 
                      });
                    }

                    const visibleChips = checkInChips.slice(0, 2);

                    const isNow = isRecentEntry(item.created_at);
                    return (
                      <View key={`checkin-${item.id || index}`} style={styles.timelineRow}>
                        {/* Track: dot + vertical connector line */}
                        <View style={styles.timelineTrack} pointerEvents="none">
                          <View style={[styles.timelineDot, isNow && styles.timelineDotNow]} />
                          {!isLast && <View style={styles.timelineLine} />}
                        </View>
                        {/* Content: time label stacked above chips */}
                        <View style={styles.timelineContent}>
                          <Text style={styles.timelineTime}>{formatTimelineTime(item.created_at) || 'Now'}</Text>
                          <View style={styles.timelineChips}>
                            {visibleChips.map((chip, chipIndex) => (
                              <View key={chipIndex} style={styles.timelineChip}>
                                {chip.icon && <View style={styles.timelineChipIcon}>{chip.icon}</View>}
                                <Text style={styles.timelineChipLabel} numberOfLines={1} ellipsizeMode="tail">
                                  {chip.label}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      </View>
                    );
                  }

                  const vibe = item;
                  const chips = [];

                  if (trend) {
                    chips.push({
                      label: trend === 'heating' ? 'Heating up' : 'Cooling down',
                      icon: trend === 'heating' 
                        ? <MaterialCommunityIcons name="fire" size={12} color={color.textTertiary} />
                        : <MaterialCommunityIcons name="snowflake" size={12} color={color.textTertiary} />,
                      priority: 1, 
                    });
                  } else if (vibe.crowd) {
                    chips.push({
                      label: vibe.crowd,
                      icon: <MaterialCommunityIcons name="account-group" size={12} color={color.textTertiary} />,
                      priority: 1,
                    });
                  }

                  // 🚀 TAG CROWD VIBE AQUI NA TIMELINE (COM PRIORIDADE)
                  if (chips.length < 2) {
                    if (vibe.crowd_vibe) {
                      chips.push({
                        label: vibe.crowd_vibe.replace(/_/g, ' '),
                        icon: <MaterialCommunityIcons name="gender-male-female" size={12} color={color.textTertiary} />,
                        priority: 2
                      });
                    } else if (isBar && vibe.music) {
                      chips.push({
                        label: vibe.music,
                        icon: <Ionicons name="musical-notes-outline" size={12} color={color.textTertiary} />,
                        type: 'genre',
                        priority: 2
                      });
                    } else if (!isBar && vibe.line) {
                      chips.push({
                        label: `Line: ${vibe.line}`,
                        icon: <Ionicons name="time-outline" size={12} color={color.textTertiary} />,
                        priority: 2
                      });
                    } else if (!isBar && vibe.music) {
                      chips.push({
                        label: vibe.music,
                        icon: <Ionicons name="musical-notes-outline" size={12} color={color.textTertiary} />,
                        type: 'genre',
                        priority: 2
                      });
                    }
                  }

                  const visibleChips = chips.slice(0, 2);

                  const isNow = isRecentEntry(vibe.created_at);
                  return (
                    <View key={`vibe-${vibe.id || index}`} style={styles.timelineRow}>
                      {/* Track: dot + vertical connector line */}
                      <View style={styles.timelineTrack} pointerEvents="none">
                        <View style={[styles.timelineDot, isNow && styles.timelineDotNow]} />
                        {!isLast && <View style={styles.timelineLine} />}
                      </View>
                      {/* Content: time label stacked above chips */}
                      <View style={styles.timelineContent}>
                        <Text style={styles.timelineTime}>{formatTimelineTime(vibe.created_at) || 'Now'}</Text>
                        <View style={styles.timelineChips}>
                          {visibleChips.map((chip, chipIndex) => (
                            <View key={chipIndex} style={[styles.timelineChip, chip.type === 'genre' && styles.timelineChipTinted]}>
                              {chip.icon && <View style={styles.timelineChipIcon}>{chip.icon}</View>}
                              <Text style={styles.timelineChipLabel} numberOfLines={1} ellipsizeMode="tail">
                                {chip.label}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                      {/* Three-dots report/block button */}
                      <TouchableOpacity
                        style={styles.vibeMenuButton}
                        onPress={() => handleVibeOptions(vibe.id, vibe.user_id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="ellipsis-horizontal" size={16} color="rgba(255,255,255,0.25)" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
                {recentUpdates.length > 4 && (
                  <TouchableOpacity style={styles.seeAllLink}>
                    <Text style={styles.seeAllText}>See all updates</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          <View style={{ height: 40 }} />
        </Animated.View>
      </ScrollView>

      <CheckInModal
        visible={showCheckInModal}
        onClose={() => setShowCheckInModal(false)}
        venue={venue}
        onSuccess={handleCheckInSuccess}
      />

      {/* ── Share Card (off-screen, captured by react-native-view-shot) ── */}
      <View style={styles.shareCardWrapper} pointerEvents="none">
        <View ref={shareCardRef} style={styles.shareCard}>
          <LinearGradient
            colors={["#0A0015", "#1A0340", "#0D0828"]}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.shareCardBrand}>◆  DARKNITE</Text>
          <View style={styles.shareCardDivider} />
          <Text style={styles.shareCardVenueName} numberOfLines={2}>
            {venue?.name || "Venue"}
          </Text>
          {venue?.neighborhood ? (
            <Text style={styles.shareCardNeighborhood}>
              {venue.neighborhood.toUpperCase()}
            </Text>
          ) : null}
          {crowdLevel ? (
            <LinearGradient
              colors={getCrowdGradient(crowdLevel)}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shareCardCrowdPill}
            >
              <Text style={styles.shareCardCrowdEmoji}>{getCrowdEmoji(crowdLevel)}</Text>
              <Text style={styles.shareCardCrowdLabel}>{crowdLevel}</Text>
            </LinearGradient>
          ) : (
            <View style={styles.shareCardNoPill}>
              <Text style={styles.shareCardNoData}>Check in tonight</Text>
            </View>
          )}
          <Text style={styles.shareCardWatermark}>darknite.app</Text>
        </View>
      </View>
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
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: color.live,
    borderRadius: radius.chip,
    paddingVertical: 3,
    paddingHorizontal: 8,
    gap: 5,
  },
  liveBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
    marginRight: 5,
  },
  liveBadgeText: {
    color: "#FFFFFF",
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },
  headerSubtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
  },
  headerTypeBadge: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  metricsSection: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  metricsLeft: {
    flex: 1,
  },
  metricsLabel: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: color.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  metricsValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  metricsValue: {
    fontSize: 28,
    fontWeight: fontWeight.bold,
    color: color.textPrimary,
  },
  metricsValueMuted: {
    fontSize: 24,
    fontWeight: fontWeight.bold,
    color: color.textTertiary,
  },
  metricsSeparator: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
    color: color.textSecondary,
  },
  metricsTime: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
    color: color.textSecondary,
  },
  tagsScroll: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    marginHorizontal: -spacing.lg, 
  },
  tagsScrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    alignItems: "center",
  },
  metricChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(148, 163, 184, 0.1)",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
    gap: 6,
    maxWidth: 120,
  },
  metricChipEmoji: {
    fontSize: 14,
  },
  metricChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
    flex: 1,
  },
  ratioSection: {
    marginVertical: spacing.md,
  },
  ratioBarContainer: {
    backgroundColor: color.surface2,
    borderRadius: radius.card,
    padding: spacing.lg,
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
  ctaSection: {
    marginBottom: 12,
  },
  ctaPrimary: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#A855F7",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  ctaPrimaryOutlined: {
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 24,
    gap: 8,
  },
  ctaGradientOutlined: {
    borderWidth: 1,
    borderColor: color.borderDefault,
    backgroundColor: 'transparent',
  },
  ctaPrimaryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  locationCard: {
    backgroundColor: "#0B0625",
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.3)",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
    backgroundColor: color.surface2,
    borderRadius: radius.button,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: color.borderDefault,
    gap: spacing.sm,
  },
  locationActionText: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
    color: color.textPrimary,
  },
  moveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(139,92,246,0.08)',
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.2)',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  moveIndicatorText: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: color.accent,
  },
  recentSection: {
    marginBottom: spacing.lg,
  },
  recentSectionHeader: {
    marginBottom: spacing.lg,
  },
  recentSectionDivider: {
    height: 1,
    backgroundColor: color.borderDefault,
    marginTop: spacing.sm,
  },
  recentSectionSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255,255,255,0.5)",
    marginTop: 4,
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
  timelineContainer: {
    backgroundColor: color.surface2,
    borderRadius: radius.card,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    paddingRight: spacing.lg,
    marginTop: spacing.lg,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  vibeMenuButton: {
    paddingTop: 10,
    paddingLeft: 8,
    paddingRight: 2,
    alignSelf: 'flex-start',
  },
  timelineRowDivider: {
    // No longer applied in renders — kept to avoid stale references
    borderBottomWidth: 1,
    borderBottomColor: color.borderDefault,
  },
  // ── Track column: the continuous vertical timeline spine ──
  timelineTrack: {
    width: 28,
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingTop: 13,         // aligns dot with the first line of text
  },
  timelineDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    zIndex: 1,
  },
  timelineDotNow: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: color.live,
    shadowColor: color.live,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 7,
    elevation: 4,
  },
  timelineLine: {
    flex: 1,
    width: 1.5,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginTop: 4,
    borderRadius: 1,
  },
  // ── Content column: time label stacked above chips ──
  timelineContent: {
    flex: 1,
    paddingLeft: 10,
    paddingTop: 8,
    paddingBottom: 16,
  },
  timelineTime: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: color.textTertiary,
    marginBottom: 6,
  },
  timelineChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'nowrap',
  },
  timelineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.chip,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: 140,
  },
  timelineChipTinted: {
    backgroundColor: 'rgba(139,92,246,0.08)',
    borderColor: 'rgba(139,92,246,0.15)',
  },
  timelineChipIcon: {
    marginRight: 4,
  },
  timelineChipLabel: {
    fontSize: 11,
    fontWeight: fontWeight.medium,
    color: color.textSecondary,
    maxWidth: 120,
  },
  seeAllLink: {
    marginTop: 12,
    paddingTop: 12,
    paddingBottom: 4,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(168,85,247,0.15)',
  },
  seeAllText: {
    color: '#C084FC',
    fontSize: 14,
    fontWeight: '600',
  },
  vibeCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(168,85,247,0.3)',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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

  // ── Share Card ──────────────────────────────────────────────────
  shareCardWrapper: {
    position: "absolute",
    top: -9999,
    left: 0,
    opacity: 0,
  },
  shareCard: {
    width: 340,
    height: 600,
    overflow: "hidden",
    borderRadius: 24,
    padding: 36,
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
  },
  shareCardBrand: {
    color: "rgba(168,85,247,0.9)",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 3.5,
    textTransform: "uppercase",
  },
  shareCardDivider: {
    width: 48,
    height: 1.5,
    backgroundColor: "rgba(168,85,247,0.35)",
    marginVertical: 4,
  },
  shareCardVenueName: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.5,
    lineHeight: 40,
  },
  shareCardNeighborhood: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 2,
  },
  shareCardCrowdPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 40,
    marginTop: 6,
  },
  shareCardCrowdEmoji: {
    fontSize: 22,
  },
  shareCardCrowdLabel: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  shareCardNoPill: {
    marginTop: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  shareCardNoData: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  shareCardWatermark: {
    position: "absolute",
    bottom: 28,
    color: "rgba(255,255,255,0.28)",
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 1.5,
  },
});