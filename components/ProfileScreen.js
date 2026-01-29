import React, { useState, useEffect } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../contexts/AuthContext";
import { getUserVibes } from "../services/vibeService";
import { getUserProfile } from "../services/profileService";
import { getUserCheckIns, getUserStats } from "../services/userService";
import { formatTimeAgo } from "../utils/timeHelpers";
import {
  calculatePoints,
  getLevelFromPoints,
  formatPercentile,
  calculateStreak,
  countNightsOut,
  checkBadges,
} from "../utils/profileHelpers";
import { getVenueById } from "../services/venueService";
import { mapRatioToPercent } from "../utils/vibeHelpers";
import { mapCoverPriceToUI } from "../utils/priceMapping";
import EmptyState, { EmptyStates } from "./EmptyState";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Helper: Format large numbers (1234 -> 1.2k)
const formatNumber = (num) => {
  if (!num || isNaN(num)) return 0;
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "k";
  return num;
};

// Helper: Validate percentile rank (0-100)
const isValidPercentile = (rank) => {
  return rank !== null && rank !== undefined && rank >= 0 && rank <= 100;
};

// Helper: Get initials from username (2 letters)
const getInitials = (name) => {
  if (!name || name.length === 0) return "U";
  if (name.length === 1) return name.toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

export default function ProfileScreen({ navigation: navigationProp, isGuest = false }) {
  const navigation = navigationProp || useNavigation();
  const { user, isAuthenticated, signOut, setShowAuthModal } = useAuth();
  
  // State
  const [userVibes, setUserVibes] = useState([]);
  const [userCheckIns, setUserCheckIns] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [badges, setBadges] = useState([]);
  const [checkInVenues, setCheckInVenues] = useState({}); // Map venue_id -> venue name
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [activeTab, setActiveTab] = useState("vibes"); // "vibes" | "checkins" | "badges"
  const [preferencesExpanded, setPreferencesExpanded] = useState(true); // Expanded by default

  const loadProfileData = async () => {
    if (isAuthenticated && user?.id && !isGuest) {
      setLoading(true);
      setLoadError(false);
      
      try {
        const [vibes, checkIns, profile, stats] = await Promise.all([
          getUserVibes(user.id, 50),
          getUserCheckIns(user.id, 100),
          getUserProfile(user.id),
          getUserStats(user.id),
        ]);

        setUserVibes(vibes || []);
        setUserCheckIns(checkIns.data || []);
        setUserProfile(profile);
        setUserStats(stats);

        // Fetch venue names for check-ins
        if (checkIns.data && checkIns.data.length > 0) {
          const venueIds = [...new Set(checkIns.data.map(c => c.venue_id))];
          const venueMap = {};
          await Promise.all(
            venueIds.map(async (venueId) => {
              try {
                const venue = await getVenueById(venueId);
                if (venue && venue.name) {
                  venueMap[venueId] = venue.name;
                } else {
                  // Fallback if venue not found or has no name
                  venueMap[venueId] = "Unknown Venue";
                }
              } catch (error) {
                console.warn("[Profile] Error fetching venue:", venueId, error);
                venueMap[venueId] = "Unknown Venue";
              }
            })
          );
          setCheckInVenues(venueMap);
        }

        // Calculate badges
        if (stats) {
          const userBadges = checkBadges(stats);
          setBadges(userBadges);
        }
      } catch (error) {
        console.error("Error loading profile data:", error);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    } else {
      setUserVibes([]);
      setUserCheckIns([]);
      setUserProfile(null);
      setUserStats(null);
      setBadges([]);
      setCheckInVenues({});
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfileData();
  }, [isAuthenticated, user?.id, isGuest]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (isAuthenticated && user?.id && !isGuest) {
        loadProfileData();
      }
    });
    return unsubscribe;
  }, [navigation, isAuthenticated, user?.id, isGuest]);

  const handleSignIn = () => {
    setShowAuthModal(true);
  };

  const handleSettings = () => {
    navigation.navigate("Settings");
  };

  const handleEditProfile = () => {
    navigation.navigate("ProfileSetup");
  };

  // Guest profile view
  if (isGuest || !isAuthenticated) {
    return (
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarGlow} />
            <View style={styles.avatar}>
              <Ionicons name="person" size={48} color="#A855F7" />
            </View>
          </View>
          <Text style={styles.userName}>Guest</Text>
          <TouchableOpacity style={styles.signInButton} onPress={handleSignIn}>
            <Text style={styles.signInButtonText}>Sign in to post vibes</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.guestCard}>
            <Ionicons name="information-circle-outline" size={32} color="#A855F7" style={{ marginBottom: 16 }} />
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
      </ScrollView>
    );
  }

  // Calculate derived values with validation
  const userName = userProfile?.username || user?.email?.split("@")[0] || "User";
  const location = userProfile?.city || "NYC";
  const points = userStats?.points || 0;
  const levelInfo = getLevelFromPoints(points);
  
  // FIX: Validate percentile before showing
  const userRank = userStats?.userRank;
  const showPercentile = isValidPercentile(userRank);
  const percentile = showPercentile ? formatPercentile(userRank) : null;
  
  const bio = userProfile?.bio || "";

  // Stats with validation
  const vibeCount = userStats?.vibeCount || 0;
  const checkInCount = userStats?.checkInCount || 0;
  const streak = userStats?.streak || 0;
  const nightsOut = userStats?.nightsOut || 0;

  // Preferences
  const preferredScene = userProfile?.preferred_scene || "both";
  const favoriteGenres = userProfile?.favorite_genres || [];
  const favoriteNeighborhoods = userProfile?.favorite_neighborhoods || [];
  const goingOutDays = userProfile?.going_out_days || [];

  // Format preferences
  const sceneLabel = preferredScene === "bars" ? "Bars" : preferredScene === "clubs" ? "Clubs" : "Clubs & Bars";
  const genresLabel = favoriteGenres.length > 0 ? favoriteGenres.join(", ") : "Not set";
  const neighborhoodsLabel = favoriteNeighborhoods.length > 0 ? favoriteNeighborhoods.join(", ") : "Not set";
  const daysLabel = goingOutDays.length > 0 ? goingOutDays.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(", ") : "Not set";

  // Protect progress bar (max 100%)
  const progressPercent = Math.min(
    100,
    Math.max(0, (levelInfo.progress / Math.max(1, levelInfo.progressMax)) * 100)
  );

  // Render activity tab content
  const renderActivityContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#A855F7" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      );
    }

    if (loadError) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" style={{ marginBottom: 12 }} />
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
            const ratioPercent = vibe.ratio ? mapRatioToPercent(vibe.ratio) : null;
            
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
                  <Text style={styles.activityItemTitle}>
                    {venue.venue_type === "bar" ? "🏈" : "🪩"} {venue.name}
                  </Text>
                  <Text style={styles.activityItemTime}>{formatTimeAgo(vibe.created_at, true)}</Text>
                </View>
                <Text style={styles.activityItemLocation}>{venue.neighborhood}</Text>
                <View style={styles.activityItemDetails}>
                  {venue.venue_type === "bar" ? (
                    <>
                      {vibe.bar_type && <Text style={styles.activityItemDetail}>{vibe.bar_type}</Text>}
                      {vibe.drinks_price_tier && <Text style={styles.activityItemDetail}>• {vibe.drinks_price_tier}</Text>}
                      {vibe.music && <Text style={styles.activityItemDetail}>• {vibe.music}</Text>}
                    </>
                  ) : (
                    <>
                      {vibe.line && <Text style={styles.activityItemDetail}>{vibe.line}</Text>}
                      {vibe.cover && <Text style={styles.activityItemDetail}>• {mapCoverPriceToUI(vibe.cover)}</Text>}
                      {vibe.music && <Text style={styles.activityItemDetail}>• {vibe.music}</Text>}
                    </>
                  )}
                </View>
                {ratioPercent && (
                  <Text style={styles.activityItemRatio}>
                    👥 {ratioPercent.guys}% / {ratioPercent.girls}%
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }

    if (activeTab === "checkins") {
      if (checkInCount === 0) {
        return (
          <EmptyState
            {...EmptyStates.noCheckIns}
            variant="compact"
          />
        );
      }

      return (
        <View style={styles.activityList}>
          {userCheckIns.slice(0, 50).map((checkIn, index) => {
            const checkInDate = new Date(checkIn.created_at);
            const isToday = checkInDate.toDateString() === new Date().toDateString();
            const timeStr = isToday 
              ? `Tonight at ${checkInDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`
              : formatTimeAgo(checkIn.created_at, true);

            const venueName = checkInVenues[checkIn.venue_id] || checkIn.venue_id;

            return (
              <TouchableOpacity
                key={index}
                style={styles.activityItem}
                onPress={async () => {
                  const venue = await getVenueById(checkIn.venue_id);
                  if (venue) {
                    navigation.navigate("Explore", {
                      screen: "VenueDetails",
                      params: { venueId: checkIn.venue_id },
                    });
                  }
                }}
              >
                <View style={styles.checkInItem}>
                  <Text style={styles.checkInIcon}>✓</Text>
                  <View style={styles.checkInContent}>
                    <Text style={styles.checkInVenue}>{venueName}</Text>
                    <Text style={styles.checkInTime}>{timeStr}</Text>
                  </View>
                </View>
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
            <Text style={styles.emptySubtext}>Keep posting vibes and checking in to unlock badges</Text>
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
        <ActivityIndicator size="large" color="#A855F7" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  // Authenticated user profile view
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Section */}
      <View style={styles.headerSection}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>DarkNite</Text>
          <TouchableOpacity onPress={handleSettings} style={styles.settingsIconButton}>
            <Ionicons name="settings-outline" size={24} color="#A855F7" />
          </TouchableOpacity>
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

        {/* Points, Level, Percentile */}
        <View style={styles.statsRow}>
          <View style={styles.statBadge}>
            <Text style={styles.statBadgeEmoji}>🔥</Text>
            <Text style={styles.statBadgeValue}>{formatNumber(points)}</Text>
            <Text style={styles.statBadgeLabel}>pts</Text>
          </View>
          <View style={styles.statBadge}>
            <Text style={styles.statBadgeEmoji}>{levelInfo.badge}</Text>
            <Text style={styles.statBadgeValue}>Level {levelInfo.level}</Text>
          </View>
          {showPercentile && (
            <View style={styles.statBadge}>
              <Text style={styles.statBadgeEmoji}>🏆</Text>
              <Text style={styles.statBadgeValue}>{percentile}</Text>
            </View>
          )}
        </View>

        {/* Level Progress Bar */}
        <View style={styles.levelProgressContainer}>
          <View style={styles.levelProgressBar}>
            <LinearGradient
              colors={["#A855F7", "#EC4899"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.levelProgressFill, { width: `${progressPercent}%` }]}
            />
          </View>
          <Text style={styles.levelProgressText}>
            {levelInfo.pointsNeeded} pts to Level {levelInfo.level + 1}
          </Text>
        </View>

        {/* Bio - only show if exists */}
        {bio.trim() && (
          <Text style={styles.bioText}>"{bio}"</Text>
        )}
      </View>

      {/* Stats Row (Horizontal Scrollable) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.statsScrollContainer}
      >
        <View style={styles.statCard}>
          <Text style={styles.statCardEmoji}>🎉</Text>
          <Text style={styles.statCardValue}>{formatNumber(vibeCount)}</Text>
          <Text style={styles.statCardLabel}>Vibes{'\n'}Posted</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statCardEmoji}>📍</Text>
          <Text style={styles.statCardValue}>{formatNumber(checkInCount)}</Text>
          <Text style={styles.statCardLabel}>Check-{'\n'}ins</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statCardEmoji}>🔥</Text>
          <Text style={styles.statCardValue}>{formatNumber(streak)}</Text>
          <Text style={styles.statCardLabel}>Streak{'\n'}Days</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statCardEmoji}>📅</Text>
          <Text style={styles.statCardValue}>{formatNumber(nightsOut)}</Text>
          <Text style={styles.statCardLabel}>Nights{'\n'}Out</Text>
        </View>
      </ScrollView>

      {/* Preferences Section */}
      <View style={styles.preferencesSection}>
        <TouchableOpacity
          style={styles.preferencesHeader}
          onPress={() => setPreferencesExpanded(!preferencesExpanded)}
        >
          <Text style={styles.preferencesTitle}>🎵 MY VIBE</Text>
          <TouchableOpacity onPress={handleEditProfile} style={styles.editButton}>
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        </TouchableOpacity>
        
        {preferencesExpanded && (
          <View style={styles.preferencesContent}>
            <View style={styles.preferenceRow}>
              <Text style={styles.preferenceLabel}>Music:</Text>
              <Text style={styles.preferenceValue}>{genresLabel}</Text>
            </View>
            <View style={styles.preferenceRow}>
              <Text style={styles.preferenceLabel}>Venues:</Text>
              <Text style={styles.preferenceValue}>{sceneLabel}</Text>
            </View>
            <View style={styles.preferenceRow}>
              <Text style={styles.preferenceLabel}>Hoods:</Text>
              <Text style={styles.preferenceValue}>{neighborhoodsLabel}</Text>
            </View>
            <View style={styles.preferenceRow}>
              <Text style={styles.preferenceLabel}>Days:</Text>
              <Text style={styles.preferenceValue}>{daysLabel}</Text>
            </View>
          </View>
        )}
      </View>

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
            style={[styles.tab, activeTab === "checkins" && styles.tabActive]}
            onPress={() => setActiveTab("checkins")}
          >
            <Text style={[styles.tabText, activeTab === "checkins" && styles.tabTextActive]}>
              Check-ins
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050013",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
  loadingText: {
    fontSize: 14,
    color: "#94A3B8",
    marginTop: 12,
  },
  headerSection: {
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  settingsIconButton: {
    padding: 4,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 12,
  },
  avatarGlow: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#A855F7",
    opacity: 0.3,
    top: -5,
    left: -5,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(168,85,247,0.2)",
    borderWidth: 3,
    borderColor: "#A855F7",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 36,
    fontWeight: "800",
    color: "#A855F7",
  },
  usernameText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  locationText: {
    fontSize: 14,
    color: "#94A3B8",
    fontWeight: "500",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 16,
  },
  statBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(168,85,247,0.15)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
    gap: 6,
  },
  statBadgeEmoji: {
    fontSize: 16,
  },
  statBadgeValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  statBadgeLabel: {
    fontSize: 11,
    color: "#94A3B8",
  },
  levelProgressContainer: {
    marginBottom: 12,
  },
  levelProgressBar: {
    height: 6,
    backgroundColor: "rgba(168,85,247,0.2)",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 6,
  },
  levelProgressFill: {
    height: "100%",
    borderRadius: 3,
  },
  levelProgressText: {
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center",
  },
  bioText: {
    fontSize: 14,
    color: "#94A3B8",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 8,
  },
  statsScrollContainer: {
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: 100,
    backgroundColor: "#1E1B2E",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.3)",
  },
  statCardEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  statCardValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  statCardLabel: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "600",
    textAlign: "center",
  },
  preferencesSection: {
    marginHorizontal: 16,
    marginBottom: 24,
    backgroundColor: "#1E1B2E",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.3)",
    overflow: "hidden",
  },
  preferencesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  preferencesTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(168,85,247,0.2)",
    borderRadius: 8,
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#A855F7",
  },
  preferencesContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  preferenceRow: {
    flexDirection: "row",
    gap: 8,
  },
  preferenceLabel: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "600",
    minWidth: 60,
  },
  preferenceValue: {
    fontSize: 13,
    color: "#FFFFFF",
    fontWeight: "500",
    flex: 1,
  },
  activitySection: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#1E1B2E",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.3)",
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: "#A855F7",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94A3B8",
  },
  tabTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  activityList: {
    gap: 12,
  },
  activityItem: {
    backgroundColor: "#1E1B2E",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.3)",
  },
  activityItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  activityItemTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    flex: 1,
  },
  activityItemTime: {
    fontSize: 12,
    color: "#94A3B8",
  },
  activityItemLocation: {
    fontSize: 13,
    color: "#94A3B8",
    marginBottom: 8,
  },
  activityItemDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 6,
  },
  activityItemDetail: {
    fontSize: 13,
    color: "#E9D5FF",
  },
  activityItemRatio: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 4,
  },
  checkInItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkInIcon: {
    fontSize: 24,
    color: "#10B981",
    fontWeight: "700",
  },
  checkInContent: {
    flex: 1,
  },
  checkInVenue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  checkInTime: {
    fontSize: 13,
    color: "#94A3B8",
  },
  badgeItem: {
    backgroundColor: "#1E1B2E",
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
    color: "#FFFFFF",
    marginBottom: 4,
  },
  badgeDescription: {
    fontSize: 13,
    color: "#94A3B8",
  },
  badgeStatus: {
    fontSize: 24,
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#94A3B8",
    fontWeight: "600",
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#64748B",
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: "#A855F7",
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  // Guest styles
  guestCard: {
    backgroundColor: "#0B0625",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
  },
  guestCardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F9FAFB",
    marginBottom: 12,
    textAlign: "center",
  },
  guestCardText: {
    fontSize: 15,
    color: "#9CA3AF",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  guestSignInButton: {
    backgroundColor: "#A855F7",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  guestSignInButtonText: {
    color: "#FFFFFF",
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
    color: "#F9FAFB",
    marginBottom: 12,
  },
  signInButton: {
    backgroundColor: "#A855F7",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  signInButtonText: {
    color: "#F9FAFB",
    fontSize: 14,
    fontWeight: "600",
  },
  section: {
    paddingHorizontal: 16,
  },
});
