import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { useAuth } from "../contexts/AuthContext";
import { getUserProfile, updateProfile } from "../services/profileService";
import {
  requestNotificationPermission,
  scheduleWeeklyReminders,
  cancelExistingReminders,
} from "../utils/notificationScheduler";

// Map day codes to display names
const DAY_NAMES = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export default function NotificationSettingsScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // System permission state
  const [systemPermissionGranted, setSystemPermissionGranted] = useState(true);

  // User settings
  const [goingOutReminders, setGoingOutReminders] = useState(false);
  const [vibeReminders, setVibeReminders] = useState(true);
  const [goingOutDays, setGoingOutDays] = useState([]);
  const [preferredScene, setPreferredScene] = useState(null);

  useEffect(() => {
    checkSystemPermission();
    loadSettings();
  }, []);

  const checkSystemPermission = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setSystemPermissionGranted(status === "granted");
    } catch (error) {
      console.error("[NotificationSettings] Error checking permission:", error);
    }
  };

  const loadSettings = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const profile = await getUserProfile(user.id);
      if (profile) {
        setGoingOutReminders(profile.reminders_enabled ?? false);
        setGoingOutDays(profile.going_out_days || []);
        setPreferredScene(profile.preferred_scene || null);
        // Load vibe reminders from notification_settings JSON (defaults to true)
        setVibeReminders(profile.notification_settings?.vibeRemindersEnabled ?? true);
      }
    } catch (error) {
      console.error("[NotificationSettings] Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSystemSettings = () => {
    if (Platform.OS === "ios") {
      Linking.openURL("app-settings:");
    } else {
      Linking.openSettings();
    }
  };

  const handleToggleGoingOutReminders = async (enabled) => {
    if (!user?.id) return;

    // Check if user has set up going out days
    if (enabled && (!goingOutDays || goingOutDays.length === 0)) {
      Alert.alert(
        "Set Up Your Schedule",
        "To receive going out reminders, you need to set your going out days first.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Set Up",
            onPress: () => navigation.navigate("ProfileSetup"),
          },
        ]
      );
      return;
    }

    // Check system permission
    if (enabled && !systemPermissionGranted) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(
          "Permission Required",
          "Please enable notifications in your device settings to receive reminders.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: handleOpenSystemSettings },
          ]
        );
        return;
      }
      setSystemPermissionGranted(true);
    }

    setSaving(true);
    setGoingOutReminders(enabled);

    try {
      if (enabled) {
        // Schedule reminders
        await scheduleWeeklyReminders({
          preferredScene: preferredScene || "both",
          goingOutDays,
          userId: user.id,
        });
      } else {
        // Cancel reminders
        await cancelExistingReminders(user.id);
      }

      // Save to profile
      await updateProfile({
        id: user.id,
        reminders_enabled: enabled,
      });

      console.log(`[NotificationSettings] Going out reminders ${enabled ? "enabled" : "disabled"}`);
    } catch (error) {
      console.error("[NotificationSettings] Error toggling reminders:", error);
      setGoingOutReminders(!enabled); // Revert on error
      Alert.alert("Error", "Failed to update settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVibeReminders = async (enabled) => {
    if (!user?.id) return;

    // Check system permission
    if (enabled && !systemPermissionGranted) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(
          "Permission Required",
          "Please enable notifications in your device settings to receive reminders.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: handleOpenSystemSettings },
          ]
        );
        return;
      }
      setSystemPermissionGranted(true);
    }

    setSaving(true);
    setVibeReminders(enabled);

    try {
      // Get current notification_settings and merge
      const profile = await getUserProfile(user.id);
      const currentSettings = profile?.notification_settings || {};
      const newSettings = {
        ...currentSettings,
        vibeRemindersEnabled: enabled,
      };

      await updateProfile({
        id: user.id,
        notification_settings: newSettings,
      });
      console.log(`[NotificationSettings] Vibe reminders ${enabled ? "enabled" : "disabled"}`);
    } catch (error) {
      console.error("[NotificationSettings] Error toggling vibe reminders:", error);
      setVibeReminders(!enabled); // Revert on error
      Alert.alert("Error", "Failed to update settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const formatDays = (days) => {
    if (!days || days.length === 0) return "Not set";
    return days.map((d) => DAY_NAMES[d] || d).join(", ");
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#A855F7" />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#A855F7" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.backButton} />
      </View>

      {/* System Permission Warning */}
      {!systemPermissionGranted && (
        <TouchableOpacity style={styles.warningCard} onPress={handleOpenSystemSettings}>
          <Ionicons name="warning" size={24} color="#F59E0B" style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.warningTitle}>Notifications Disabled</Text>
            <Text style={styles.warningText}>
              Tap here to enable notifications in your device settings.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#F59E0B" />
        </TouchableOpacity>
      )}

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Ionicons name="notifications" size={32} color="#A855F7" style={{ marginBottom: 12 }} />
        <Text style={styles.infoTitle}>Stay in the Loop</Text>
        <Text style={styles.infoText}>
          Get reminded to check the vibes before you head out, and share what's happening when you're at a venue.
        </Text>
      </View>

      {/* Reminder Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>REMINDERS</Text>

        {/* Going Out Reminders */}
        <View style={styles.settingCard}>
          <View style={styles.settingHeader}>
            <View style={styles.settingIcon}>
              <Ionicons name="calendar-outline" size={22} color="#A855F7" />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Going Out Reminders</Text>
              <Text style={styles.settingDescription}>
                Get notified on your going out days to check what's live
              </Text>
            </View>
            <Switch
              value={goingOutReminders}
              onValueChange={handleToggleGoingOutReminders}
              trackColor={{ false: "#475569", true: "#A855F7" }}
              thumbColor="#FFFFFF"
              disabled={saving || !systemPermissionGranted}
            />
          </View>

          {/* Show configured days */}
          {goingOutReminders && goingOutDays.length > 0 && (
            <View style={styles.settingMeta}>
              <Text style={styles.settingMetaLabel}>Active on:</Text>
              <Text style={styles.settingMetaValue}>{formatDays(goingOutDays)}</Text>
            </View>
          )}

          {/* Edit days button */}
          {goingOutReminders && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => navigation.navigate("ProfileSetup")}
            >
              <Text style={styles.editButtonText}>Edit Schedule</Text>
              <Ionicons name="chevron-forward" size={16} color="#A855F7" />
            </TouchableOpacity>
          )}
        </View>

        {/* Vibe Reminders */}
        <View style={styles.settingCard}>
          <View style={styles.settingHeader}>
            <View style={styles.settingIcon}>
              <Ionicons name="sparkles-outline" size={22} color="#A855F7" />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Vibe Reminders</Text>
              <Text style={styles.settingDescription}>
                Get a reminder to share the vibe after checking in at a venue
              </Text>
            </View>
            <Switch
              value={vibeReminders}
              onValueChange={handleToggleVibeReminders}
              trackColor={{ false: "#475569", true: "#A855F7" }}
              thumbColor="#FFFFFF"
              disabled={saving || !systemPermissionGranted}
            />
          </View>
        </View>
      </View>

      {/* How It Works */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>HOW IT WORKS</Text>

        <View style={styles.howItWorksCard}>
          <View style={styles.howItWorksItem}>
            <View style={styles.howItWorksIcon}>
              <Text style={styles.howItWorksEmoji}>📅</Text>
            </View>
            <View style={styles.howItWorksText}>
              <Text style={styles.howItWorksTitle}>Going Out Reminders</Text>
              <Text style={styles.howItWorksDescription}>
                On your selected days, we'll remind you to check which spots are popping before you head out.
              </Text>
            </View>
          </View>

          <View style={styles.howItWorksDivider} />

          <View style={styles.howItWorksItem}>
            <View style={styles.howItWorksIcon}>
              <Text style={styles.howItWorksEmoji}>📍</Text>
            </View>
            <View style={styles.howItWorksText}>
              <Text style={styles.howItWorksTitle}>Vibe Reminders</Text>
              <Text style={styles.howItWorksDescription}>
                After you check in, we'll nudge you 15-20 min later to share the vibe and help others.
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Saving Indicator */}
      {saving && (
        <View style={styles.savingIndicator}>
          <ActivityIndicator size="small" color="#A855F7" style={{ marginRight: 8 }} />
          <Text style={styles.savingText}>Saving...</Text>
        </View>
      )}

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
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 14,
    color: "#94A3B8",
    marginTop: 12,
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
  warningCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: "rgba(245,158,11,0.15)",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "rgba(245,158,11,0.4)",
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#F59E0B",
    marginBottom: 2,
  },
  warningText: {
    fontSize: 13,
    color: "#FCD34D",
    lineHeight: 18,
  },
  infoCard: {
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: "#1E1B2E",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.3)",
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 20,
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
  settingCard: {
    backgroundColor: "#1E1B2E",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.3)",
  },
  settingHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(168,85,247,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: "#94A3B8",
    lineHeight: 18,
  },
  settingMeta: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(168,85,247,0.15)",
  },
  settingMetaLabel: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 4,
  },
  settingMetaValue: {
    fontSize: 14,
    color: "#E5E7EB",
    fontWeight: "500",
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(168,85,247,0.15)",
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#A855F7",
    marginRight: 4,
  },
  howItWorksCard: {
    backgroundColor: "#1E1B2E",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.3)",
  },
  howItWorksItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  howItWorksIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(168,85,247,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  howItWorksEmoji: {
    fontSize: 20,
  },
  howItWorksText: {
    flex: 1,
  },
  howItWorksTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  howItWorksDescription: {
    fontSize: 13,
    color: "#94A3B8",
    lineHeight: 18,
  },
  howItWorksDivider: {
    height: 1,
    backgroundColor: "rgba(168,85,247,0.15)",
    marginVertical: 16,
  },
  savingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    paddingVertical: 12,
  },
  savingText: {
    fontSize: 14,
    color: "#A855F7",
    fontWeight: "600",
  },
});
