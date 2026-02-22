import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { createVibe } from "../services/vibeService";
import { useAppContext } from "../contexts/AppContext";
import * as Haptics from "expo-haptics";

export default function VibeReportScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuth();
  const { upsertLatestVibe } = useAppContext();
  const { venue, venueId, venueName } = route.params || {};
  
  const [crowd, setCrowd] = useState(null);
  const [ratio, setRatio] = useState(null);
  const [music, setMusic] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const crowdOptions = ["Dead", "Chill", "Fun", "Packed", "Chaos"];
  const ratioOptions = ["Mostly guys", "Balanced", "Mostly girls"];
  const musicOptions = ["Hip-Hop / R&B", "Afrobeats", "House / Techno", "Reggaeton", "Top Hits", "Mixed"];

  const canSubmit = crowd && ratio && music;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;

    if (!isAuthenticated || !user) {
      Alert.alert("Error", "You must be signed in");
      return;
    }

    setSubmitting(true);

    try {
      const vibeData = {
        venue_id: venueId || venue?.id,
        user_id: user.id,
        crowd,
        ratio,
        music,
      };

      const { data, error } = await createVibe(vibeData);

      if (error) {
        const message = error.userMessage || "Could not post vibe";
        Alert.alert("Error", message);
        setSubmitting(false);
        return;
      }

      // Update context
      if (data) {
        upsertLatestVibe(data);
      }

      // Success!
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {}

      Alert.alert(
        "Vibe posted! 🔥",
        "+3 points earned",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error("[VibeReport] Error:", error);
      Alert.alert("Error", "Something went wrong");
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    Alert.alert(
      "Skip vibe check?",
      "You won't earn points this time",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Skip", onPress: () => navigation.goBack(), style: "destructive" },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quick vibe check</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.content}>
        <Text style={styles.venueName}>{venueName || venue?.name || "Venue"}</Text>
        <Text style={styles.subtitle}>How's it? (10 sec)</Text>

        {/* Crowd */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Crowd</Text>
          <View style={styles.optionsRow}>
            {crowdOptions.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.optionChip, crowd === opt && styles.optionChipSelected]}
                onPress={() => {
                  setCrowd(opt);
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch (e) {}
                }}
              >
                <Text style={[styles.optionText, crowd === opt && styles.optionTextSelected]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Ratio */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Ratio</Text>
          <View style={styles.optionsRow}>
            {ratioOptions.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.optionChip, ratio === opt && styles.optionChipSelected]}
                onPress={() => {
                  setRatio(opt);
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch (e) {}
                }}
              >
                <Text style={[styles.optionText, ratio === opt && styles.optionTextSelected]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Music */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Music</Text>
          <View style={styles.optionsRow}>
            {musicOptions.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.optionChip, music === opt && styles.optionChipSelected]}
                onPress={() => {
                  setMusic(opt);
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch (e) {}
                }}
              >
                <Text style={[styles.optionText, music === opt && styles.optionTextSelected]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, (!canSubmit || submitting) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Submit (+3 pts) 🔥</Text>
          )}
        </TouchableOpacity>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(168,85,247,0.3)",
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipButtonText: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "600",
  },
  headerTitle: {
    color: "#F9FAFB",
    fontSize: 18,
    fontWeight: "700",
  },
  headerRight: {
    width: 60,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  venueName: {
    color: "#F9FAFB",
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    color: "#9CA3AF",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 32,
  },
  section: {
    marginBottom: 32,
  },
  sectionLabel: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(156,163,175,0.5)",
    backgroundColor: "transparent",
  },
  optionChipSelected: {
    borderColor: "#A855F7",
    backgroundColor: "rgba(168,85,247,0.2)",
  },
  optionText: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "500",
  },
  optionTextSelected: {
    color: "#E5E7EB",
    fontWeight: "600",
  },
  submitButton: {
    backgroundColor: "#A855F7",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 16,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
