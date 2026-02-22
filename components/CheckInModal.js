import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { useAppContext } from "../contexts/AppContext";
import { createCheckIn } from "../services/checkInService";
import { scheduleVibeReminder } from "../services/notificationService";
import { areVibeRemindersEnabled } from "../services/profileService";
import * as Haptics from "expo-haptics";

/**
 * CheckInModal - Venue-type-specific check-in flow
 * CLUB: Single step - Line wait time
 * BAR: Single step - Crowd level (Dead/Chill/Buzzing/Packed)
 */
export default function CheckInModal({ visible, onClose, venue, onSuccess }) {
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuth();
  const { upsertLatestBarCrowd, upsertLatestLineWait } = useAppContext();
  const [loading, setLoading] = useState(false);
  
  // CLUB: Line wait time
  const [lineWait, setLineWait] = useState(null);
  const lineOptions = [
    { label: "No line!", emoji: "✅" },
    { label: "Chill (5-15 min)", emoji: "😎" },
    { label: "Worth it (15-30 min)", emoji: "🤷" },
    { label: "Long af (30-60 min)", emoji: "😅" },
    { label: "Don't bother (60+ min)", emoji: "💀" }
  ];
  
  // BAR: Crowd only (updated to match vibe language)
  const [crowdLevel, setCrowdLevel] = useState(null);
  const crowdOptions = [
    { label: "Dead", emoji: "💀" },
    { label: "Chill", emoji: "😌" },
    { label: "Buzzing", emoji: "🐝" },
    { label: "Packed", emoji: "🔥" }
  ];

  const isClub = venue?.venue_type === "club";
  const isBar = venue?.venue_type === "bar";
  const canProceed = isClub ? !!lineWait : !!crowdLevel;

  const handleNext = () => {
    // Both CLUB and BAR are single-step flows now
    handleSubmit();
  };

  const handleSubmit = async () => {
    if (!isAuthenticated || !user) {
      Alert.alert("Sign in required", "Please sign in to check in");
      return;
    }

    if (loading) return;
    setLoading(true);

    try {
      const venueId = venue?.id;
      if (!venueId) throw new Error("Invalid venue");

      // Prepare check-in data based on venue type
      const checkInData = {
        userId: user.id,
        venueId,
      };

      if (isClub) {
        checkInData.lineWait = lineWait;
      } else if (isBar) {
        checkInData.crowdLevel = crowdLevel;
        checkInData.noiseLevel = null;
      }

      const { data, error } = await createCheckIn(checkInData);

      if (error) {
        const msg = error.userMessage || error.message || "Could not check in";
        Alert.alert("Error", msg);
        setLoading(false);
        return;
      }

      // Schedule vibe reminder only if user has enabled them
      const vibeRemindersEnabled = await areVibeRemindersEnabled(user.id);
      if (vibeRemindersEnabled) {
        await scheduleVibeReminder({
          venueId,
          venueName: venue?.name || "Venue",
          checkInTime: new Date().toISOString(),
        });
      }

      // Success feedback
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {}

// ✨ Update AppContext IMMEDIATELY
if (isBar && crowdLevel) {
  upsertLatestBarCrowd(venueId, {
    crowd_level: crowdLevel,
    created_at: new Date().toISOString(),
  });
} else if (isClub && lineWait) {
  upsertLatestLineWait(venueId, lineWait);
}

if (onSuccess) {
  onSuccess({
    lineWait: isClub ? lineWait : null,
    crowdLevel: isBar ? crowdLevel : null,
    noiseLevel: null,
  });
}

// Reset and close
resetForm();
onClose();
    } catch (err) {
      console.error("[CheckInModal] Error:", err);
      Alert.alert("Error", "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setLineWait(null);
    setCrowdLevel(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSelect = (value) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}

    if (isClub) {
      setLineWait(value.label);
    } else {
      setCrowdLevel(value.label);
    }
  };

  const getCurrentOptions = () => {
    if (isClub) return lineOptions;
    return crowdOptions;
  };

  const getCurrentValue = () => {
    if (isClub) return lineWait;
    return crowdLevel;
  };

  const getTitle = () => {
    if (isClub) return "What's the line situation?";
    return "How's the crowd?";
  };

  const getSubtitle = () => {
    return "Quick check-in (5 sec)";
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>{getTitle()}</Text>
              <Text style={styles.headerSubtitle}>{getSubtitle()}</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.venueName}>{venue?.name || "Venue"}</Text>

            <View style={styles.optionsContainer}>
              {getCurrentOptions().map((option) => {
                const isSelected = getCurrentValue() === option.label;
                
                return (
                  <TouchableOpacity
                    key={option.label}
                    style={[styles.optionChip, isSelected && styles.optionChipSelected]}
                    onPress={() => handleSelect(option)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.optionContent}>
                      <Text style={styles.optionEmoji}>{option.emoji}</Text>
                      <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                        {option.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, (!canProceed || loading) && styles.submitButtonDisabled]}
              onPress={handleNext}
              disabled={!canProceed || loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>
                  Check in ✓
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: "#050013",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(168,85,247,0.3)",
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 60,
  },
  backButtonText: {
    color: "#A855F7",
    fontSize: 14,
    fontWeight: "600",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    color: "#F9FAFB",
    fontSize: 18,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: "#9CA3AF",
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 40,
    alignItems: "flex-end",
  },
  closeButtonText: {
    color: "#9CA3AF",
    fontSize: 20,
    fontWeight: "600",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  venueName: {
    color: "#F9FAFB",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 32,
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 32,
  },
  optionChip: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(156,163,175,0.5)",
    backgroundColor: "transparent",
  },
  optionChipSelected: {
    borderColor: "#A855F7",
    backgroundColor: "rgba(168,85,247,0.2)",
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  optionEmoji: {
    fontSize: 20,
  },
  optionText: {
    color: "#9CA3AF",
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
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
