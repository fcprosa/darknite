import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useGamification } from "../src/hooks/useGamification";
import { useAuth } from "../contexts/AuthContext";
import { COLORS } from "../constants";

export default function AchievementsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { badges, refreshGamification } = useGamification();

  useEffect(() => {
    if (user?.id) refreshGamification(user.id);
  }, [user?.id, refreshGamification]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Achievements</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.grid}>
        {badges.map((badge) => (
          <View
            key={badge.key}
            style={[
              styles.card,
              !badge.unlocked && styles.cardLocked,
            ]}
          >
            <Text style={[styles.emoji, !badge.unlocked && styles.greyscale]}>
              {badge.emoji}
            </Text>
            <Text style={styles.cardTitle}>{badge.title}</Text>
            <Text style={styles.cardDesc}>{badge.description}</Text>
            {badge.unlocked && badge.unlockedAt ? (
              <Text style={styles.unlockedAt}>
                Unlocked {new Date(badge.unlockedAt).toLocaleDateString()}
              </Text>
            ) : (
              <Text style={styles.lockedLabel}>Locked</Text>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 12,
    gap: 12,
  },
  card: {
    width: "47%",
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  cardLocked: {
    borderColor: COLORS.border,
    opacity: 0.75,
  },
  emoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  greyscale: {
    opacity: 0.35,
  },
  cardTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  cardDesc: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  unlockedAt: {
    color: COLORS.accent,
    fontSize: 11,
    marginTop: 8,
  },
  lockedLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 8,
  },
});
