import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";

export default function SettingsScreen({ navigation }) {
  const { user, signOut, deleteAccount } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleBack = () => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
    } else {
      const tabNav = navigation?.getParent();
      if (tabNav) {
        tabNav.navigate("ProfileTab");
      }
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      "Sign out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            const { error } = await signOut();
            setLoading(false);
            if (error) {
              Alert.alert("Error", "Failed to sign out. Please try again.");
            }
            // Note: RootNavigator automatically switches to Landing when session becomes null
            // No manual navigation needed - the key-based remount resets navigation history
          },
        },
      ]
    );
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      "Delete account",
      "Are you sure you want to delete your account? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            const { error } = await deleteAccount();
            setLoading(false);
            if (error) {
              Alert.alert("Error", "Failed to delete account. Please try again.");
            }
            // Note: RootNavigator automatically switches to Landing when session becomes null
            // No manual navigation needed - the key-based remount resets navigation history
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#A855F7" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.backButton} />
      </View>

      {/* Account Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{user?.email || "—"}</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.actionRow, loading && styles.actionRowDisabled]}
          onPress={handleSignOut}
          disabled={loading}
        >
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.actionRowTextDestructive}>Sign out</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionRow, loading && styles.actionRowDisabled]}
          onPress={handleDeleteAccount}
          disabled={loading}
        >
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
          <Text style={styles.actionRowTextDestructive}>Delete account</Text>
        </TouchableOpacity>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(168,85,247,0.2)",
  },
  backButton: {
    padding: 4,
    width: 36,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#F9FAFB",
    textAlign: "center",
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#9CA3AF",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoCard: {
    backgroundColor: "#0B0625",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.2)",
  },
  infoLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: "#F9FAFB",
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0B0625",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.2)",
    gap: 12,
  },
  actionRowDisabled: {
    opacity: 0.5,
  },
  actionRowTextDestructive: {
    fontSize: 16,
    color: "#EF4444",
    fontWeight: "600",
    flex: 1,
  },
});

