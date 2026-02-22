import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const ONBOARDING_COMPLETE_KEY = "@darknite_onboarding_complete";

const ACTIONS = [
  {
    emoji: "👀",
    title: "See what's happening",
    description: "Live crowd levels, music, and energy at every venue — updated by people who are there.",
  },
  {
    emoji: "📍",
    title: "Report what you see",
    description: "At a venue? Tap \"I'm Here\" and answer 2 quick questions. Your report helps everyone find the best night.",
  },
  {
    emoji: "🔥",
    title: "Set your Move",
    description: "Heading out tonight? Set a Move so others know where the night is building — before it starts.",
  },
];

export default function OnboardingScreen({ onComplete }) {
  const insets = useSafeAreaInsets();

  const handleEnter = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {}
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
    onComplete();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      {/* Gradient Background */}
      <LinearGradient
        colors={["#04000F", "#09001A", "#040010"]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>DarkNite</Text>
        <Text style={styles.tagline}>Real-time nightlife intelligence</Text>
      </View>

      {/* 3 Actions */}
      <BlurView intensity={25} tint="dark" style={styles.glassCard}>
        <View style={styles.actionsContainer}>
          {ACTIONS.map((action, index) => (
            <View key={index} style={styles.actionRow}>
              <View style={styles.emojiCircle}>
                <Text style={styles.actionEmoji}>{action.emoji}</Text>
              </View>
              <View style={styles.actionText}>
                <Text style={styles.actionTitle}>{action.title}</Text>
                <Text style={styles.actionDescription}>{action.description}</Text>
              </View>
            </View>
          ))}
        </View>
      </BlurView>

      {/* CTA */}
      <View style={styles.ctaContainer}>
        <TouchableOpacity
          style={styles.enterButton}
          onPress={handleEnter}
          activeOpacity={0.8}
        >
          <Text style={styles.enterButtonText}>Let's go</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Export helper to check if onboarding is complete
export async function isOnboardingComplete() {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
    return value === "true";
  } catch (e) {
    return false;
  }
}

// Export helper to reset onboarding (for testing)
export async function resetOnboarding() {
  try {
    await AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY);
  } catch (e) {
    console.warn("Failed to reset onboarding:", e);
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  header: {
    alignItems: "center",
    gap: 8,
  },
  logo: {
    fontSize: 36,
    fontWeight: "900",
    color: "#F973FF",
    letterSpacing: -1,
    textShadowColor: "rgba(249,115,255,0.3)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  tagline: {
    fontSize: 15,
    fontWeight: "500",
    color: "#9CA3AF",
  },
  glassCard: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  actionsContainer: {
    gap: 24,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },
  emojiCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(168,85,247,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  actionEmoji: {
    fontSize: 28,
  },
  actionText: {
    flex: 1,
    gap: 4,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F5F3FF",
  },
  actionDescription: {
    fontSize: 14,
    fontWeight: "400",
    color: "#9CA3AF",
    lineHeight: 20,
  },
  ctaContainer: {
    alignItems: "center",
  },
  enterButton: {
    backgroundColor: "#A855F7",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 48,
    width: "100%",
    alignItems: "center",
  },
  enterButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
});
