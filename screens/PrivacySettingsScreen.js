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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../utils/supabase";

export default function PrivacySettingsScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Privacy settings
  const [profilePublic, setProfilePublic] = useState(true);
  const [showActivity, setShowActivity] = useState(true);
  const [showCheckIns, setShowCheckIns] = useState(true);
  const [allowMessages, setAllowMessages] = useState(true);

  useEffect(() => {
    loadPrivacySettings();
  }, []);

  const loadPrivacySettings = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("privacy_settings")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      if (data?.privacy_settings) {
        const settings = data.privacy_settings;
        setProfilePublic(settings.profilePublic ?? true);
        setShowActivity(settings.showActivity ?? true);
        setShowCheckIns(settings.showCheckIns ?? true);
        setAllowMessages(settings.allowMessages ?? true);
      }
    } catch (error) {
      console.error("Error loading privacy settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const savePrivacySettings = async (settings) => {
    if (!user?.id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({
          privacy_settings: settings,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;
    } catch (error) {
      console.error("Error saving privacy settings:", error);
      Alert.alert("Error", "Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (key, value) => {
    const newSettings = {
      profilePublic,
      showActivity,
      showCheckIns,
      allowMessages,
      [key]: value,
    };

    // Update local state immediately
    switch (key) {
      case "profilePublic":
        setProfilePublic(value);
        break;
      case "showActivity":
        setShowActivity(value);
        break;
      case "showCheckIns":
        setShowCheckIns(value);
        break;
      case "allowMessages":
        setAllowMessages(value);
        break;
    }

    // Save to database
    await savePrivacySettings(newSettings);
  };

  const handleBack = () => {
    navigation.goBack();
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
        <Text style={styles.headerTitle}>Privacy Settings</Text>
        <View style={styles.backButton} />
      </View>

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Ionicons name="shield-checkmark" size={32} color="#A855F7" style={{ marginBottom: 12 }} />
        <Text style={styles.infoTitle}>Your Privacy Matters</Text>
        <Text style={styles.infoText}>
          Control who can see your activity and how others can interact with you on DarkNite.
        </Text>
      </View>

      {/* Profile Visibility */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>PROFILE VISIBILITY</Text>
        
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Public Profile</Text>
            <Text style={styles.settingDescription}>
              Allow other users to view your profile and vibes
            </Text>
          </View>
          <Switch
            value={profilePublic}
            onValueChange={(value) => handleToggle("profilePublic", value)}
            trackColor={{ false: "#475569", true: "#A855F7" }}
            thumbColor="#FFFFFF"
            disabled={saving}
          />
        </View>
      </View>

      {/* Activity Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACTIVITY</Text>
        
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Show Activity</Text>
            <Text style={styles.settingDescription}>
              Display your vibes and activity on your public profile
            </Text>
          </View>
          <Switch
            value={showActivity}
            onValueChange={(value) => handleToggle("showActivity", value)}
            trackColor={{ false: "#475569", true: "#A855F7" }}
            thumbColor="#FFFFFF"
            disabled={saving || !profilePublic}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Show Check-ins</Text>
            <Text style={styles.settingDescription}>
              Display your venue check-ins to other users
            </Text>
          </View>
          <Switch
            value={showCheckIns}
            onValueChange={(value) => handleToggle("showCheckIns", value)}
            trackColor={{ false: "#475569", true: "#A855F7" }}
            thumbColor="#FFFFFF"
            disabled={saving || !profilePublic}
          />
        </View>
      </View>

      {/* Communication Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>COMMUNICATION</Text>
        
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Allow Messages</Text>
            <Text style={styles.settingDescription}>
              Let other users send you messages (Coming soon)
            </Text>
          </View>
          <Switch
            value={allowMessages}
            onValueChange={(value) => handleToggle("allowMessages", value)}
            trackColor={{ false: "#475569", true: "#A855F7" }}
            thumbColor="#FFFFFF"
            disabled={saving}
          />
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
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1B2E",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.3)",
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