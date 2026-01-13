import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../utils/supabase";
import { formatTimeAgo } from "../utils/timeHelpers";

// Get AppContext - we'll need to import it from App.js or create a hook
// For now, we'll check isAuthenticated to determine guest mode


export default function ProfileScreen({ navigation: navigationProp, isGuest = false }) {
  const navigation = navigationProp || useNavigation();
  const { user, isAuthenticated, signOut, setShowAuthModal } = useAuth();
  const [userVibes, setUserVibes] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadProfileData = () => {
    if (isAuthenticated && user?.id && !isGuest) {
      setLoading(true);
      setProfileLoading(true);
      
      Promise.all([
        getUserVibes(user.id, 10),
        getUserProfile(user.id)
      ]).then(([vibes, profile]) => {
        setUserVibes(vibes);
        setUserProfile(profile);
        setLoading(false);
        setProfileLoading(false);
      });
    } else {
      setUserVibes([]);
      setUserProfile(null);
      setLoading(false);
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    loadProfileData();
  }, [isAuthenticated, user?.id, isGuest]);

  // Refresh profile when screen comes into focus (e.g., returning from ProfileSetup)
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

  const handleSavedVenues = () => {
    if (!isAuthenticated || isGuest) {
      Alert.alert(
        "Sign in required",
        "Please sign in to save venues",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Sign in", onPress: handleSignIn },
        ]
      );
      return;
    }
    // TODO: Navigate to saved venues screen
    Alert.alert("Coming soon", "Saved venues feature coming soon!");
  };

  const handleSettings = () => {
    navigation.navigate("Settings");
  };

  const handleEditProfile = () => {
    navigation.navigate("ProfileSetup");
  };

  const vibeCount = userVibes.length;
  const userName = isAuthenticated && !isGuest
    ? (userProfile?.username || user?.email?.split("@")[0] || "User")
    : "Guest";
  
  // Check if profile is incomplete
  const isProfileIncomplete = userProfile && (
    !userProfile.preferred_scene || 
    !userProfile.favorite_genres || 
    userProfile.favorite_genres.length === 0 ||
    !userProfile.favorite_neighborhoods || 
    userProfile.favorite_neighborhoods.length === 0
  );

  // Guest profile view
  if (isGuest || !isAuthenticated) {
    return (
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header with Avatar */}
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

        {/* Guest Info Card */}
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

  // Authenticated user profile view
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header with Avatar */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatarGlow} />
          <View style={styles.avatar}>
            <Ionicons name="person" size={48} color="#A855F7" />
          </View>
        </View>
        <Text style={styles.userName}>{userName}</Text>
        <TouchableOpacity style={styles.settingsButton} onPress={handleSettings}>
          <Ionicons name="settings-outline" size={20} color="#A855F7" />
          <Text style={styles.settingsButtonText}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Mini Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{vibeCount}</Text>
          <Text style={styles.statLabel}>Vibes posted</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>—</Text>
          <Text style={styles.statLabel}>Streak</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>—</Text>
          <Text style={styles.statLabel}>Top vibe</Text>
        </View>
      </View>

      {/* Complete Profile CTA */}
      {isProfileIncomplete && (
        <View style={styles.section}>
          <TouchableOpacity style={styles.completeProfileCard} onPress={handleEditProfile}>
            <Ionicons name="information-circle-outline" size={24} color="#A855F7" />
            <View style={styles.completeProfileContent}>
              <Text style={styles.completeProfileTitle}>Complete your profile</Text>
              <Text style={styles.completeProfileText}>
                Add your preferences to get better recommendations
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#A855F7" />
          </TouchableOpacity>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={handleEditProfile}>
          <Ionicons name="create-outline" size={20} color="#A855F7" />
          <Text style={styles.actionButtonText}>Edit profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleSavedVenues}>
          <Ionicons name="bookmark-outline" size={20} color="#A855F7" />
          <Text style={styles.actionButtonText}>Saved venues</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Vibes Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My recent vibes</Text>
        {vibeCount === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No vibes yet</Text>
            <Text style={styles.emptySubtext}>
              Start posting vibes to see them here
            </Text>
          </View>
        ) : (
          <View style={styles.vibesList}>
            {userVibes.map((vibe, index) => (
              <View key={index} style={styles.vibeItem}>
                <View style={styles.vibeContent}>
                  <Text style={styles.vibeVenue}>{vibe.venue_id}</Text>
                  <Text style={styles.vibeDetails}>
                    {vibe.crowd} • {vibe.ratio} {vibe.music ? `• ${vibe.music}` : ""}
                  </Text>
                  <Text style={styles.vibeTime}>{formatTimeAgo(vibe.created_at)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  container: {
    flex: 1,
    backgroundColor: "#050013",
  },
  header: {
    alignItems: "center",
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 16,
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
  settingsButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(168,85,247,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
    gap: 6,
  },
  settingsButtonText: {
    color: "#A855F7",
    fontSize: 14,
    fontWeight: "600",
  },
  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#0B0625",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.2)",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#F9FAFB",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  actionsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(168,85,247,0.1)",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  actionButtonText: {
    color: "#A855F7",
    fontSize: 14,
    fontWeight: "600",
  },
  section: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F9FAFB",
    marginBottom: 16,
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#9CA3AF",
    fontWeight: "600",
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#6B7280",
  },
  vibesList: {
    gap: 8,
  },
  vibeItem: {
    backgroundColor: "#0B0625",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.2)",
  },
  vibeContent: {
    gap: 4,
  },
  vibeVenue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F9FAFB",
  },
  vibeDetails: {
    fontSize: 14,
    color: "#E5E7EB",
  },
  vibeTime: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
  },
  completeProfileCard: {
    backgroundColor: "#0B0625",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
    gap: 12,
  },
  completeProfileContent: {
    flex: 1,
  },
  completeProfileTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F9FAFB",
    marginBottom: 4,
  },
  completeProfileText: {
    fontSize: 13,
    color: "#9CA3AF",
  },
});

