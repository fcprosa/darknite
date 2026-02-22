/**
 * SetMoveScreen — 2-step flow for declaring intent to visit a venue.
 * Step 1: Choose time band (when are you going?)
 * Step 2: Confirmation
 *
 * Venue is pre-selected before this screen opens (via VenuePickerSheet or card action).
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useAuth } from "../contexts/AuthContext";
import { useAppContext } from "../contexts/AppContext";
import { createMove } from "../services/moveService";
import AppScreen from "./AppScreen";
import HeaderIconButton from "./HeaderIconButton";

const TIME_BANDS = [
  {
    id: "early",
    emoji: "🌆",
    label: "Early",
    description: "8 – 10 PM",
  },
  {
    id: "prime",
    emoji: "🔥",
    label: "Prime Time",
    description: "10 PM – 12 AM",
  },
  {
    id: "late",
    emoji: "🌙",
    label: "Late Night",
    description: "After midnight",
  },
  {
    id: "spontaneous",
    emoji: "🎲",
    label: "Spontaneous",
    description: "No set time",
  },
];

export default function SetMoveScreen({ venue, onClose, onSuccess }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { incrementMoveCount } = useAppContext();
  const [step, setStep] = useState(1);
  const [selectedBand, setSelectedBand] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const venueName = venue?.name || "this venue";

  const handleSelectBand = useCallback((band) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    setSelectedBand(band);
    // Auto-advance to confirmation after short delay
    setTimeout(() => setStep(2), 200);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (submitting || !venue?.id || !user?.id) return;
    setSubmitting(true);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {}

    const { data, error } = await createMove({
      userId: user.id,
      venueId: venue.id,
      timeBand: selectedBand?.id || "spontaneous",
    });

    if (error) {
      setSubmitting(false);
      Alert.alert("Error", "Could not set your move. Try again.");
      return;
    }

    // Optimistic update: increment the venue's move count in the feed
    incrementMoveCount(venue.id);

    // Show confirmation briefly, then dismiss
    setStep(3);
    setTimeout(() => {
      if (onSuccess) onSuccess(data);
      if (onClose) onClose();
    }, 1500);
  }, [submitting, venue, user, selectedBand, incrementMoveCount, onSuccess, onClose]);

  // ─── Step 1: Time Band Selection ───
  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>When are you heading out?</Text>
      <Text style={styles.stepSubtitle}>to {venueName}</Text>

      <View style={styles.optionsList}>
        {TIME_BANDS.map((band) => (
          <TouchableOpacity
            key={band.id}
            style={[
              styles.optionRow,
              selectedBand?.id === band.id && styles.optionRowSelected,
            ]}
            onPress={() => handleSelectBand(band)}
            activeOpacity={0.7}
          >
            <Text style={styles.optionEmoji}>{band.emoji}</Text>
            <View style={styles.optionText}>
              <Text style={styles.optionLabel}>{band.label}</Text>
              <Text style={styles.optionDescription}>{band.description}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // ─── Step 2: Confirmation ───
  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Confirm your move</Text>

      <View style={styles.confirmCard}>
        <Text style={styles.confirmEmoji}>📍</Text>
        <Text style={styles.confirmVenue}>{venueName}</Text>
        <Text style={styles.confirmBand}>
          {selectedBand?.emoji} {selectedBand?.label} · {selectedBand?.description}
        </Text>
      </View>

      <View style={styles.confirmActions}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => setStep(1)}
          activeOpacity={0.7}
        >
          <Text style={styles.backBtnText}>Change</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmBtn, submitting && { opacity: 0.5 }]}
          onPress={handleConfirm}
          activeOpacity={0.7}
          disabled={submitting}
        >
          <Text style={styles.confirmBtnText}>
            {submitting ? "Setting..." : "Set Move"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ─── Step 3: Success ───
  const renderStep3 = () => (
    <View style={[styles.stepContainer, styles.successContainer]}>
      <Text style={{ fontSize: 48 }}>📍</Text>
      <Text style={styles.successTitle}>You're set</Text>
      <Text style={styles.successSubtitle}>
        Heading to {venueName} · {selectedBand?.label}
      </Text>
    </View>
  );

  return (
    <AppScreen
      backgroundColor="#0A0614"
      screenName="SetMoveScreen"
      contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
    >
      {/* Header */}
      <View style={styles.header}>
        {step < 3 && (
          <HeaderIconButton
            onPress={onClose}
            accessibilityLabel="Close"
            accessibilityHint="Closes the set move screen"
          >
            <Text style={styles.closeBtn}>✕</Text>
          </HeaderIconButton>
        )}
        <View style={styles.dots}>
          {[1, 2].map((s) => (
            <View
              key={s}
              style={[styles.dot, step >= s && styles.dotActive]}
            />
          ))}
        </View>
        {step < 3 ? <View style={{ width: 44 }} /> : null}
      </View>

      {/* Steps */}
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  closeBtn: {
    color: "#9CA3AF",
    fontSize: 20,
    fontWeight: "600",
  },
  dots: {
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(168, 85, 247, 0.2)",
  },
  dotActive: {
    backgroundColor: "#A855F7",
    width: 20,
    borderRadius: 4,
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  stepTitle: {
    color: "#F5F3FF",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  stepSubtitle: {
    color: "#9CA3AF",
    fontSize: 15,
    fontWeight: "500",
    marginTop: 4,
    marginBottom: 28,
  },
  optionsList: {
    gap: 10,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(168, 85, 247, 0.06)",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(168, 85, 247, 0.15)",
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 14,
  },
  optionRowSelected: {
    backgroundColor: "rgba(168, 85, 247, 0.12)",
    borderColor: "rgba(168, 85, 247, 0.5)",
  },
  optionEmoji: {
    fontSize: 24,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    color: "#F5F3FF",
    fontSize: 17,
    fontWeight: "700",
  },
  optionDescription: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
  },
  confirmCard: {
    backgroundColor: "rgba(168, 85, 247, 0.08)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.2)",
    padding: 24,
    alignItems: "center",
    gap: 8,
    marginTop: 24,
  },
  confirmEmoji: {
    fontSize: 40,
  },
  confirmVenue: {
    color: "#F5F3FF",
    fontSize: 20,
    fontWeight: "800",
  },
  confirmBand: {
    color: "#C4B5FD",
    fontSize: 14,
    fontWeight: "600",
  },
  confirmActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 32,
  },
  backBtn: {
    flex: 1,
    backgroundColor: "rgba(148, 163, 184, 0.1)",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
  },
  backBtnText: {
    color: "#9CA3AF",
    fontSize: 15,
    fontWeight: "600",
  },
  confirmBtn: {
    flex: 2,
    backgroundColor: "#A855F7",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  confirmBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  successContainer: {
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  successTitle: {
    color: "#F5F3FF",
    fontSize: 24,
    fontWeight: "800",
  },
  successSubtitle: {
    color: "#C4B5FD",
    fontSize: 15,
    fontWeight: "600",
  },
});
