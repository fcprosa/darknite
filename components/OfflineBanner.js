import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetwork } from "../contexts/NetworkContext";
import * as Haptics from "expo-haptics";

/**
 * OfflineBanner - Shows a banner when the user is offline
 * Automatically appears/disappears based on network status
 * Can be placed at the top of any screen
 */
export default function OfflineBanner({ style }) {
  const { isOnline, checkNetworkStatus } = useNetwork();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      // Slide in when offline
      wasOffline.current = true;
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    } else if (wasOffline.current) {
      // Slide out when back online
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Haptic feedback when back online
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {}
    }
  }, [isOnline, slideAnim]);

  const handleRetry = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
    await checkNetworkStatus();
  };

  // Don't render if online and animation complete
  if (isOnline && !wasOffline.current) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { paddingTop: insets.top + 8 },
        { transform: [{ translateY: slideAnim }] },
        style,
      ]}
    >
      <View style={styles.content}>
        <Ionicons name="cloud-offline-outline" size={20} color="#FCD34D" />
        <Text style={styles.text}>You're offline</Text>
        <TouchableOpacity onPress={handleRetry} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

/**
 * OfflineOverlay - Full screen overlay for critical offline states
 */
export function OfflineOverlay({ message }) {
  const { isOnline, checkNetworkStatus } = useNetwork();

  if (isOnline) return null;

  const handleRetry = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {}
    await checkNetworkStatus();
  };

  return (
    <View style={styles.overlayContainer}>
      <View style={styles.overlayContent}>
        <Ionicons name="cloud-offline-outline" size={64} color="#6B7280" />
        <Text style={styles.overlayTitle}>No Connection</Text>
        <Text style={styles.overlayMessage}>
          {message || "Please check your internet connection and try again."}
        </Text>
        <TouchableOpacity style={styles.overlayButton} onPress={handleRetry}>
          <Ionicons name="refresh" size={20} color="#FFFFFF" />
          <Text style={styles.overlayButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Banner styles
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#78350F",
    zIndex: 1000,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  text: {
    color: "#FCD34D",
    fontSize: 14,
    fontWeight: "600",
  },
  retryButton: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "rgba(252, 211, 77, 0.2)",
    borderRadius: 12,
  },
  retryText: {
    color: "#FCD34D",
    fontSize: 13,
    fontWeight: "600",
  },

  // Overlay styles
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5, 0, 19, 0.95)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  overlayContent: {
    alignItems: "center",
    paddingHorizontal: 40,
  },
  overlayTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#F9FAFB",
    marginTop: 24,
    marginBottom: 8,
  },
  overlayMessage: {
    fontSize: 16,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
  },
  overlayButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#A855F7",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  overlayButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
