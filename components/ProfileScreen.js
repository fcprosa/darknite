import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Alert,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { getUserVibes } from "../services/vibeService";
import { getUserProfile } from "../services/profileService";
import { getUserStats } from "../services/userService";
import { formatTimeAgo, formatVibeRecency } from "../utils/timeHelpers";
import { countNightsOut } from "../utils/profileHelpers";
import { useGamification } from "../src/hooks/useGamification";
import { COLORS } from "../constants";
import { mapCoverPriceToUI } from "../utils/priceMapping";
import EmptyState, { EmptyStates } from "./EmptyState";
import IconButton from "./IconButton";
import AppScreen from "./AppScreen";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Helper: Format large numbers (1234 -> 1.2k)
const formatNumber = (num) => {
  if (!num || isNaN(num)) return 0;
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "k";
  return num;
};

// Helper: Get initials from username (2 letters)
const getInitials = (name) => {
  if (!name || name.length === 0) return "U";
  if (name.length === 1) return name.toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

export default function ProfileScreen({ navigation: navigationProp, isGuest = false }) {
  const navigation = navigationProp || useNavigation();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, signOut, setShowAuthModal } = useAuth();
  
  // State
  const [userVibes, setUserVibes] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const {
    gamification,
    refreshGamification,
    totalXp,
    level,
    streak: gamificationStreak,
    badges,
  } = useGamification();
  const [loadError, setLoadError] = useState(false);
  const [activeTab, setActiveTab] = useState("vibes"); // "vibes" | "badges"

  const loadProfileData = useCallback(async () => {
    if (isAuthenticated && user?.id && !isGuest) {
      setLoading(true);
      setLoadError(false);
      
      try {
        const [vibes, profile, stats] = await Promise.all([
          getUserVibes(user.id, 50),
          getUserProfile(user.id),
          getUserStats(user.id),
        ]);

        console.log("[Profile] loadProfileData called, profile:", profile?.going_out_days);

        setUserVibes(vibes || []);
        setUserProfile(profile);
        setUserStats(stats);
        await refreshGamification(user.id);
      } catch (error) {
        console.error("Error loading profile data:", error);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    } else {
      setUserVibes([]);
      setUserProfile(null);
      setUserStats(null);
      setLoading(false);
    }
  }, [isAuthenticated, user?.id, isGuest, refreshGamification]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log("[Profile] Focus listener triggered");
      if (isAuthenticated && user?.id && !isGuest) {
        console.log("[Profile] Calling loadProfileData from focus listener");
        loadProfileData();
      }
    });
    return unsubscribe;
  }, [navigation, isAuthenticated, user?.id, isGuest, loadProfileData]);

  const handleSignIn = () => {
    setShowAuthModal(true);
  };

  const handleSettings = () => {
    navigation.navigate("Settings");
  };

  const handleEditProfile = () => {
    navigation.navigate("ProfileSetup", { jumpToStep: "days" });
  };

  // Guest profile view
  if (isGuest || !isAuthenticated) {
    return (
      <AppScreen scrollable screenName="ProfileScreen-Guest" contentContainerStyle={{ paddingHorizontal: 0 }}>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarGlow} />
            <View style={styles.avatar}>
              <Ionicons name="person" size={48} color={COLORS.primary} />
            </View>
          </View>
          <Text style={styles.userName}>Guest</Text>
          <TouchableOpacity style={styles.signInButton} onPress={handleSignIn}>
            <Text style={styles.signInButtonText}>Sign in to post vibes</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.guestCard}>
            <Ionicons name="information-circle-outline" size={32} color={COLORS.primary} style={{ marginBottom: 16 }} />
            <Text style={styles.guestCardTitle}>Sign in to unlock features</Text>
            <Text style={styles.guestCardText}>
              Sign in to post vibes, save venues, and access your profile. It takes less than 10 seconds!
            </Text>
            <TouchableOpacity style={styles.guestSignInButton} onPress={handleSignIn}>
              <Text style={styles.guestSignInButtonText}>Sign in now</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </AppScreen>
    );
  }

  // Calculate derived values with validation
  const userName = userProfile?.username || user?.email?.split("@")[0] || "User";
  const location = userProfile?.city || "NYC";
  const bio = userProfile?.bio || "";

  // Stats with validation
  const vibeCount = userStats?.vibeCount || 0;
  const streak = gamificationStreak ?? 0;
  const nightsOut = userStats?.nightsOut || 0;
  const xpProgress = level?.progressToNext
    ? Math.min(1, (level.progressInLevel || 0) / level.progressToNext)
    : 0;
  const topBadges = (badges || []).slice(0, 6);

  // Going-out days (for MY NIGHTS row)
  const goingOutDays = userProfile?.going_out_days || [];
  const daysLabel = goingOutDays.length > 0 ? goingOutDays.filter(Boolean).map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(", ") : "Not set";

  // Render activity tab content
  const renderActivityContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      );
    }

    if (loadError) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.danger} style={{ marginBottom: 12 }} />
          <Text style={styles.emptyText}>Failed to load data</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadProfileData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (activeTab === "vibes") {
      if (vibeCount === 0) {
        return (
          <EmptyState
            {...EmptyStates.noVibes}
            variant="compact"
          />
        );
      }

      return (
        <View style={styles.activityList}>
          {userVibes.map((vibe, index) => {
            const venue = vibe.venue || { name: vibe.venue_id, neighborhood: "Unknown" };
            
            return (
              <TouchableOpacity
                key={index}
                style={styles.activityItem}
                onPress={() => {
                  // Navigate to venue details
                  navigation.navigate("Explore", {
                    screen: "VenueDetails",
                    params: { venueId: vibe.venue_id },
                  });
                }}
              >
                <View style={styles.activityItemHeader}>
                  <View style={styles.activityItemLeft}>
                    <Text style={styles.activityItemCrowd}>
                      {vibe.crowd || "—"}
                    </Text>
                    <Text style={styles.activityItemVenue}>
                      at {venue.name}
                    </Text>
                  </View>
                  <Text style={styles.activityItemTime}>{formatTimeAgo(vibe.created_at, true)}</Text>
                </View>
                {(vibe.music || vibe.cover || vibe.drinks_price_tier) && (
                  <View style={styles.activityChips}>
                    {vibe.music && (
                      <Text style={styles.activityChip}>🎵 {vibe.music}</Text>
                    )}
                    {vibe.cover && (
                      <Text style={styles.activityChip}>💵 {mapCoverPriceToUI(vibe.cover)}</Text>
                    )}
                    {vibe.drinks_price_tier && (
                      <Text style={styles.activityChip}>🍸 {vibe.drinks_price_tier}</Text>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }

    if (activeTab === "badges") {
      if (badges.length === 0) {
        return (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No badges yet</Text>
            <Text style={styles.emptySubtext}>Keep posting vibes to unlock badges</Text>
          </View>
        );
      }

      return (
        <View style={styles.activityList}>
          {badges.map((badge, index) => (
            <View key={index} style={styles.badgeItem}>
              <View style={styles.badgeHeader}>
                <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
                <View style={styles.badgeInfo}>
                  <Text style={styles.badgeTitle}>{badge.title}</Text>
                  <Text style={styles.badgeDescription}>{badge.description}</Text>
                </View>
                <Text style={styles.badgeStatus}>{badge.unlocked ? "✅" : "🔒"}</Text>
              </View>
            </View>
          ))}
        </View>
      );
    }

    return null;
  };

  // Loading skeleton
  if (loading && !userProfile) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  // Authenticated user profile view
  return (
    <AppScreen scrollable screenName="ProfileScreen" contentContainerStyle={{ paddingHorizontal: 0 }}>
      {/* Header Section */}
      <View style={styles.headerSection}>
        <View style={styles.headerTop}>
          <View style={{ width: 44 }} />
          <IconButton onPress={handleSettings}>
            <Ionicons name="settings-outline" size={22} color={COLORS.textSecondary} />
          </IconButton>
        </View>

        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarGlow} />
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(userName)}</Text>
            </View>
          </View>
          <Text style={styles.usernameText}>@{userName}</Text>
          <Text style={styles.locationText}>📍 {location}</Text>
        </View>

        {/* Bio - only show if exists */}
        {bio.trim() && (
          <Text style={styles.bioText}>"{bio}"</Text>
        )}
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statGridItem}>
          <Text style={styles.statGridValue}>{formatNumber(vibeCount)}</Text>
          <Text style={styles.statGridLabel}>Vibes</Text>
        </View>
        <View style={styles.statGridDivider} />
        <View style={styles.statGridItem}>
          <Text style={styles.statGridValue}>{formatNumber(streak)}</Text>
          <Text style={styles.statGridLabel}>Streak</Text>
        </View>
        <View style={styles.statGridDivider} />
        <View style={styles.statGridItem}>
          <Text style={styles.statGridValue}>{formatNumber(nightsOut)}</Text>
          <Text style={styles.statGridLabel}>Nights Out</Text>
        </View>
      </View>

      {/* XP progress */}
      <View style={styles.xpSection}>
        <View style={styles.xpHeader}>
          <Text style={styles.xpTitle}>
            Level {level?.level ?? 1} · {level?.title ?? "Rookie"}
          </Text>
          <Text style={styles.xpTotal}>{formatNumber(totalXp)} XP</Text>
        </View>
        <View style={styles.xpBarTrack}>
          <View
            style={[styles.xpBarFill, { width: `${Math.round(xpProgress * 100)}%` }]}
          />
        </View>
        {level?.nextLevelXp != null ? (
          <Text style={styles.xpSubtext}>
            {formatNumber(level.nextLevelXp - totalXp)} XP to next level
          </Text>
        ) : null}
      </View>

      <View style={styles.linkRow}>
        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => navigation.navigate("Achievements")}
        >
          <Text style={styles.linkButtonText}>All badges</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => navigation.navigate("Leaderboard")}
        >
          <Text style={styles.linkButtonText}>Leaderboard</Text>
        </TouchableOpacity>
      </View>

      {topBadges.length > 0 ? (
        <View style={styles.topBadgesRow}>
          {topBadges.map((b) => (
            <View
              key={b.key}
              style={[styles.miniBadge, !b.unlocked && styles.miniBadgeLocked]}
            >
              <Text style={styles.miniBadgeEmoji}>{b.emoji}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Going-Out Days */}
      <TouchableOpacity
        style={styles.goingOutRow}
        onPress={handleEditProfile}
        activeOpacity={0.7}
      >
        <View style={styles.goingOutLeft}>
          <Text style={styles.goingOutLabel}>MY NIGHTS</Text>
          <Text style={styles.goingOutValue}>
            {goingOutDays.length > 0 ? daysLabel : "Tap to set your going-out days"}
          </Text>
        </View>
        <Text style={styles.goingOutArrow}>›</Text>
      </TouchableOpacity>

      {/* Activity Tabs */}
      <View style={styles.activitySection}>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "vibes" && styles.tabActive]}
            onPress={() => setActiveTab("vibes")}
          >
            <Text style={[styles.tabText, activeTab === "vibes" && styles.tabTextActive]}>
              My Vibes
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "badges" && styles.tabActive]}
            onPress={() => setActiveTab("badges")}
          >
            <Text style={[styles.tabText, activeTab === "badges" && styles.tabTextActive]}>
              Badges
            </Text>
          </TouchableOpacity>
        </View>

        {renderActivityContent()}
      </View>

      <View style={{ height: 32 }} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  headerSection: {
    paddingTop: 8,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  settingsIconButton: {
    padding: 4,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 16,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 12,
  },
  avatarGlow: {
    position: "absolute",
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: COLORS.primary,
    opacity: 0.2,
    top: -3,
    left: -3,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(168,85,247,0.15)",
    borderWidth: 2.5,
    borderColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.primary,
  },
  usernameText: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  locationText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  bioText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.15)",
  },
  statGridItem: {
    flex: 1,
    alignItems: "center",
  },
  statGridValue: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  statGridLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  statGridDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(168, 85, 247, 0.12)",
  },
  goingOutRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingVertical: 14,
    minHeight: 44,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.12)",
  },
  goingOutLeft: {
    flex: 1,
    gap: 3,
  },
  goingOutLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  goingOutValue: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primaryGlow,
  },
  goingOutArrow: {
    fontSize: 20,
    color: COLORS.textMuted,
    fontWeight: "300",
  },
  activitySection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 3,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.15)",
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.textPrimary,
    fontWeight: "700",
  },
  activityList: {
    gap: 12,
  },
  activityItem: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.10)",
  },
  activityItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  activityItemLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  activityItemCrowd: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  activityItemVenue: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  activityItemTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  activityChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  activityChip: {
    fontSize: 12,
    color: COLORS.primaryGlow,
    fontWeight: "500",
  },
  badgeItem: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.3)",
    marginBottom: 12,
  },
  badgeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  badgeEmoji: {
    fontSize: 32,
  },
  badgeInfo: {
    flex: 1,
  },
  badgeTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  badgeDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  badgeStatus: {
    fontSize: 24,
  },
  xpSection: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  xpHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  xpTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  xpTotal: {
    color: COLORS.accentGlow,
    fontSize: 14,
    fontWeight: "700",
  },
  xpBarTrack: {
    height: 8,
    backgroundColor: COLORS.surfaceRaised,
    borderRadius: 4,
    overflow: "hidden",
  },
  xpBarFill: {
    height: "100%",
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  xpSubtext: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 6,
  },
  linkRow: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  linkButton: {
    flex: 1,
    backgroundColor: COLORS.surfaceRaised,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  linkButtonText: {
    color: COLORS.primaryGlow,
    fontWeight: "600",
    fontSize: 14,
  },
  topBadgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  miniBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  miniBadgeLocked: {
    opacity: 0.4,
    borderColor: COLORS.border,
  },
  miniBadgeEmoji: {
    fontSize: 22,
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: "600",
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  // Guest styles
  guestCard: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
  },
  guestCardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 12,
    textAlign: "center",
  },
  guestCardText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  guestSignInButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  guestSignInButtonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    alignItems: "center",
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  userName: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  signInButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  signInButtonText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  section: {
    paddingHorizontal: 16,
  },
});
