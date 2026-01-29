import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { getUserProfile } from "../services/profileService";
import { getUserStats } from "../services/userService";
import { getLevelFromPoints } from "../utils/profileHelpers";
import ChangePasswordModal from "./ChangePasswordModal";
import LegalModal from "./LegalModal";
import { resetOnboarding } from "./OnboardingScreen";

// Helper: Get initials from username (2 letters)
const getInitials = (name) => {
  if (!name || name.length === 0) return "U";
  if (name.length === 1) return name.toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

// Helper: Format date
const formatMemberSince = (date) => {
  if (!date) return "Recently";
  const d = new Date(date);
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const year = d.getFullYear();
  return `${month} ${year}`;
};

export default function SettingsScreen({ navigation }) {
  const { user, signOut, deleteAccount } = useAuth();
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  
  // Modals
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  const [legalType, setLegalType] = useState("terms"); // "terms" or "privacy"

  useEffect(() => {
    loadUserData();
  }, [user?.id]);

  const loadUserData = async () => {
    if (user?.id) {
      setLoadingProfile(true);
      try {
        const [profile, stats] = await Promise.all([
          getUserProfile(user.id),
          getUserStats(user.id),
        ]);
        setUserProfile(profile);
        setUserStats(stats);
      } catch (error) {
        console.error("Error loading user data:", error);
      } finally {
        setLoadingProfile(false);
      }
    }
  };

  const handleBack = () => {
    if (navigation?.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("ProfileTab");
    }
  };

  const handleEditProfile = () => {
    // Fix: Navigate to ProfileSetup properly
    try {
      navigation.navigate("ProfileSetup");
    } catch (error) {
      // Fallback: try with ProfileTab parent
      const parent = navigation.getParent();
      if (parent) {
        parent.navigate("ProfileTab", { screen: "ProfileSetup" });
      }
    }
  };

  const handlePrivacySettings = () => {
    navigation.navigate("PrivacySettings");
  };

  const handleNotificationSettings = () => {
    navigation.navigate("NotificationSettings");
  };

  const handleContactSupport = () => {
    Alert.alert(
      "Contact Support 📧",
      "Need help? We're here for you!\n\n📧 Email: support@darknite.app\n\nWe typically respond within 24 hours.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Open Email",
          onPress: () => {
            Linking.openURL("mailto:support@darknite.app?subject=DarkNite Support Request");
          },
        },
      ]
    );
  };

  const handleShowTerms = () => {
    navigation.navigate("TermsOfService");
  };

  const handleShowPrivacy = () => {
    navigation.navigate("PrivacyPolicy");
  };

  const handleSignOut = async () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            const { error } = await signOut();
            setLoading(false);
            if (error) {
              Alert.alert("Error", "Failed to sign out. Please try again.");
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      "Delete Account",
      "⚠️ This will permanently delete your account, all your vibes, check-ins, and data. This action cannot be undone.\n\nAre you absolutely sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            const { error } = await deleteAccount();
            setLoading(false);
            if (error) {
              Alert.alert(
                "Error",
                "Failed to delete account. Please try again or contact support."
              );
            }
          },
        },
      ]
    );
  };

  // Calculate user info
  const userName = userProfile?.username || user?.email?.split("@")[0] || "User";
  const userEmail = user?.email || "No email";
  const memberSince = formatMemberSince(user?.created_at);
  const points = userStats?.points || 0;
  const levelInfo = getLevelFromPoints(points);

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#A855F7" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={styles.backButton} />
        </View>

        {/* User Info Card */}
        <View style={styles.userInfoSection}>
          <View style={styles.userInfoCard}>
            <View style={styles.avatarSmall}>
              <Text style={styles.avatarSmallText}>{getInitials(userName)}</Text>
            </View>
            <View style={styles.userInfoText}>
              {loadingProfile ? (
                <ActivityIndicator size="small" color="#A855F7" />
              ) : (
                <>
                  <Text style={styles.userInfoName}>@{userName}</Text>
                  <Text style={styles.userInfoEmail}>{userEmail}</Text>
                  <Text style={styles.userInfoMember}>Member since {memberSince}</Text>
                </>
              )}
            </View>
          </View>

          {/* Quick Stats */}
          {!loadingProfile && userStats && (
            <View style={styles.quickStats}>
              <View style={styles.quickStatItem}>
                <Text style={styles.quickStatEmoji}>🔥</Text>
                <Text style={styles.quickStatValue}>{points}</Text>
                <Text style={styles.quickStatLabel}>Points</Text>
              </View>
              <View style={styles.quickStatDivider} />
              <View style={styles.quickStatItem}>
                <Text style={styles.quickStatEmoji}>{levelInfo.badge}</Text>
                <Text style={styles.quickStatValue}>Level {levelInfo.level}</Text>
                <Text style={styles.quickStatLabel}>Current</Text>
              </View>
              <View style={styles.quickStatDivider} />
              <View style={styles.quickStatItem}>
                <Text style={styles.quickStatEmoji}>🎉</Text>
                <Text style={styles.quickStatValue}>{userStats.vibeCount || 0}</Text>
                <Text style={styles.quickStatLabel}>Vibes</Text>
              </View>
            </View>
          )}
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <TouchableOpacity
            style={[styles.actionRow, loading && styles.actionRowDisabled]}
            onPress={handleEditProfile}
            disabled={loading}
          >
            <View style={styles.actionRowIcon}>
              <Ionicons name="create-outline" size={20} color="#A855F7" />
            </View>
            <Text style={styles.actionRowText}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={20} color="#64748B" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionRow, loading && styles.actionRowDisabled]}
            onPress={() => setShowChangePassword(true)}
            disabled={loading}
          >
            <View style={styles.actionRowIcon}>
              <Ionicons name="lock-closed-outline" size={20} color="#A855F7" />
            </View>
            <Text style={styles.actionRowText}>Change Password</Text>
            <Ionicons name="chevron-forward" size={20} color="#64748B" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionRow, loading && styles.actionRowDisabled]}
            onPress={handlePrivacySettings}
            disabled={loading}
          >
            <View style={styles.actionRowIcon}>
              <Ionicons name="shield-outline" size={20} color="#A855F7" />
            </View>
            <Text style={styles.actionRowText}>Privacy Settings</Text>
            <Ionicons name="chevron-forward" size={20} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PREFERENCES</Text>
          <TouchableOpacity
            style={[styles.actionRow, loading && styles.actionRowDisabled]}
            onPress={handleEditProfile}
            disabled={loading}
          >
            <View style={styles.actionRowIcon}>
              <Ionicons name="musical-notes-outline" size={20} color="#A855F7" />
            </View>
            <Text style={styles.actionRowText}>Update My Vibe</Text>
            <Ionicons name="chevron-forward" size={20} color="#64748B" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionRow, loading && styles.actionRowDisabled]}
            onPress={handleNotificationSettings}
            disabled={loading}
          >
            <View style={styles.actionRowIcon}>
              <Ionicons name="notifications-outline" size={20} color="#A855F7" />
            </View>
            <Text style={styles.actionRowText}>Notifications</Text>
            <Ionicons name="chevron-forward" size={20} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SUPPORT & LEGAL</Text>
          
          <TouchableOpacity
            style={[styles.actionRow, loading && styles.actionRowDisabled]}
            onPress={handleContactSupport}
            disabled={loading}
          >
            <View style={styles.actionRowIcon}>
              <Ionicons name="mail-outline" size={20} color="#94A3B8" />
            </View>
            <Text style={styles.actionRowText}>Contact Support</Text>
            <Ionicons name="chevron-forward" size={20} color="#64748B" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionRow, loading && styles.actionRowDisabled]}
            onPress={handleShowTerms}
            disabled={loading}
          >
            <View style={styles.actionRowIcon}>
              <Ionicons name="document-text-outline" size={20} color="#94A3B8" />
            </View>
            <Text style={styles.actionRowText}>Terms of Service</Text>
            <Ionicons name="chevron-forward" size={20} color="#64748B" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionRow, loading && styles.actionRowDisabled]}
            onPress={handleShowPrivacy}
            disabled={loading}
          >
            <View style={styles.actionRowIcon}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#94A3B8" />
            </View>
            <Text style={styles.actionRowText}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={20} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitleDanger}>⚠️ DANGER ZONE</Text>
          
          <TouchableOpacity
            style={[styles.actionRowDanger, loading && styles.actionRowDisabled]}
            onPress={handleSignOut}
            disabled={loading}
          >
            <View style={styles.actionRowIcon}>
              {loading ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              )}
            </View>
            <Text style={styles.actionRowTextDanger}>
              {loading ? "Signing out..." : "Sign Out"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionRowDanger, loading && styles.actionRowDisabled]}
            onPress={handleDeleteAccount}
            disabled={loading}
          >
            <View style={styles.actionRowIcon}>
              {loading ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              )}
            </View>
            <Text style={styles.actionRowTextDanger}>
              {loading ? "Deleting..." : "Delete Account"}
            </Text>
          </TouchableOpacity>

          <Text style={styles.dangerZoneWarning}>
            ⚠️ Deleting your account will permanently remove all your data, vibes, check-ins, and cannot be undone.
          </Text>
        </View>

        {/* Dev Tools (for testing) */}
        {__DEV__ && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dev Tools</Text>
            <TouchableOpacity
              style={styles.actionRow}
              onPress={async () => {
                await resetOnboarding();
                Alert.alert(
                  "Onboarding Reset",
                  "Restart the app to see the onboarding screens again.",
                  [{ text: "OK" }]
                );
              }}
            >
              <View style={styles.actionRowIcon}>
                <Ionicons name="refresh-outline" size={20} color="#A855F7" />
              </View>
              <Text style={styles.actionRowText}>Reset Onboarding</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>DarkNite</Text>
          <Text style={styles.footerVersion}>Version 1.0.0 (Beta)</Text>
          <Text style={styles.footerCopyright}>© 2025 DarkNite. All rights reserved.</Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Modals */}
      <ChangePasswordModal
        visible={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />

      <LegalModal
        visible={showLegal}
        type={legalType}
        onClose={() => setShowLegal(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050013",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(168,85,247,0.15)",
  },
  backButton: {
    padding: 4,
    width: 36,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  userInfoSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
  },
  userInfoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1B2E",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.3)",
    marginBottom: 12,
  },
  avatarSmall: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(168,85,247,0.2)",
    borderWidth: 2,
    borderColor: "#A855F7",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  avatarSmallText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#A855F7",
  },
  userInfoText: {
    flex: 1,
  },
  userInfoName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  userInfoEmail: {
    fontSize: 14,
    color: "#94A3B8",
    marginBottom: 4,
  },
  userInfoMember: {
    fontSize: 12,
    color: "#64748B",
  },
  quickStats: {
    flexDirection: "row",
    backgroundColor: "#1E1B2E",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.3)",
  },
  quickStatItem: {
    flex: 1,
    alignItems: "center",
  },
  quickStatEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  quickStatValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  quickStatLabel: {
    fontSize: 11,
    color: "#94A3B8",
  },
  quickStatDivider: {
    width: 1,
    backgroundColor: "rgba(168,85,247,0.2)",
    marginHorizontal: 12,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#94A3B8",
    marginBottom: 12,
    letterSpacing: 1,
  },
  sectionTitleDanger: {
    fontSize: 13,
    fontWeight: "700",
    color: "#EF4444",
    marginBottom: 12,
    letterSpacing: 1,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1B2E",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.3)",
  },
  actionRowDanger: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239,68,68,0.1)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: "rgba(239,68,68,0.3)",
  },
  actionRowDisabled: {
    opacity: 0.5,
  },
  actionRowIcon: {
    width: 32,
    alignItems: "center",
    marginRight: 12,
  },
  actionRowText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "600",
    flex: 1,
  },
  actionRowTextDanger: {
    fontSize: 16,
    color: "#EF4444",
    fontWeight: "600",
    flex: 1,
  },
  dangerZoneWarning: {
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  footer: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 16,
    marginTop: 24,
  },
  footerText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#A855F7",
    marginBottom: 8,
  },
  footerVersion: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 4,
  },
  footerCopyright: {
    fontSize: 11,
    color: "#475569",
  },
});