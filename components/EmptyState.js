import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

/**
 * Reusable empty state component for lists and screens
 *
 * @param {string} icon - Ionicons icon name
 * @param {string} emoji - Emoji to show (alternative to icon)
 * @param {string} title - Main title text
 * @param {string} message - Description text
 * @param {string} actionLabel - Button label (optional)
 * @param {function} onAction - Button press handler (optional)
 * @param {string} variant - 'default' | 'compact' | 'card'
 */
export default function EmptyState({
  icon,
  emoji,
  title,
  message,
  actionLabel,
  onAction,
  variant = "default",
}) {
  const isCompact = variant === "compact";
  const isCard = variant === "card";

  if (isCard) {
    return (
      <View style={styles.cardContainer}>
        <LinearGradient
          colors={["rgba(168, 85, 247, 0.08)", "rgba(168, 85, 247, 0.02)"]}
          style={styles.cardGradient}
        >
          {emoji ? (
            <Text style={styles.cardEmoji}>{emoji}</Text>
          ) : icon ? (
            <Ionicons name={icon} size={32} color="#6B7280" />
          ) : null}
          <Text style={styles.cardTitle}>{title}</Text>
          {message && <Text style={styles.cardMessage}>{message}</Text>}
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={[styles.container, isCompact && styles.containerCompact]}>
      <View style={[styles.iconContainer, isCompact && styles.iconContainerCompact]}>
        {emoji ? (
          <Text style={[styles.emoji, isCompact && styles.emojiCompact]}>{emoji}</Text>
        ) : icon ? (
          <Ionicons
            name={icon}
            size={isCompact ? 40 : 56}
            color="#4B5563"
          />
        ) : null}
      </View>

      <Text style={[styles.title, isCompact && styles.titleCompact]}>{title}</Text>

      {message && (
        <Text style={[styles.message, isCompact && styles.messageCompact]}>
          {message}
        </Text>
      )}

      {actionLabel && onAction && (
        <TouchableOpacity
          style={[styles.actionButton, isCompact && styles.actionButtonCompact]}
          onPress={onAction}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={["#A855F7", "#9333EA"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.actionButtonGradient}
          >
            <Text style={styles.actionButtonText}>{actionLabel}</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Pre-configured empty states for common scenarios
export const EmptyStates = {
  // Home screen - no venues
  noVenues: {
    emoji: "🏙️",
    title: "No venues found",
    message: "We couldn't find any venues. Pull down to refresh.",
  },

  // Explore - no filter results
  noFilterResults: {
    emoji: "🔍",
    title: "No matches",
    message: "Try adjusting your filters to see more venues.",
  },

  // Profile - no vibes posted
  noVibes: {
    emoji: "✨",
    title: "No vibes yet",
    message: "Drop your first vibe to help others find the best spots!",
  },

  // Profile - no check-ins
  noCheckIns: {
    emoji: "📍",
    title: "No check-ins yet",
    message: "Check in at a venue to start tracking your nights out.",
  },

  // Venue details - no recent vibes
  noRecentVibes: {
    emoji: "🌙",
    title: "No recent updates",
    message: "Be the first to share what's happening here!",
  },

  // Search - no results
  noSearchResults: {
    emoji: "🔎",
    title: "No results",
    message: "We couldn't find anything matching your search.",
  },

  // Hot Now - nothing hot
  nothingHot: {
    emoji: "😴",
    title: "Quiet night so far",
    message: "No venues with recent activity. Check back later or drop the first vibe!",
  },

  // Offline
  offline: {
    icon: "cloud-offline-outline",
    title: "You're offline",
    message: "Connect to the internet to see the latest updates.",
  },

  // Error state
  error: {
    icon: "alert-circle-outline",
    title: "Something went wrong",
    message: "We couldn't load this content. Please try again.",
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  containerCompact: {
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(75, 85, 99, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  iconContainerCompact: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 16,
  },
  emoji: {
    fontSize: 48,
  },
  emojiCompact: {
    fontSize: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F9FAFB",
    textAlign: "center",
    marginBottom: 8,
  },
  titleCompact: {
    fontSize: 17,
    marginBottom: 6,
  },
  message: {
    fontSize: 15,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  messageCompact: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  actionButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  actionButtonCompact: {
    borderRadius: 10,
  },
  actionButtonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  // Card variant styles
  cardContainer: {
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.15)",
  },
  cardGradient: {
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  cardEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#E5E7EB",
    textAlign: "center",
    marginBottom: 4,
  },
  cardMessage: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
  },
});
