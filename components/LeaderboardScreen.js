import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useGamification } from "../src/hooks/useGamification";
import { getWeeklyLeaderboard } from "../services/gamificationService";
import { useAuth } from "../contexts/AuthContext";
import { COLORS } from "../constants";

export default function LeaderboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { lastCity } = useGamification();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const city = lastCity || null;
      const rows = await getWeeklyLeaderboard(city);
      if (mounted) {
        setEntries(rows);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [lastCity, user?.id]);

  const cityLabel = lastCity || "all cities";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Leaderboard</Text>
        <View style={{ width: 28 }} />
      </View>

      <Text style={styles.subtitle}>Top XP this week · {cityLabel}</Text>

      {loading ? (
        <ActivityIndicator
          color={COLORS.primary}
          style={{ marginTop: 40 }}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {entries.length === 0 ? (
            <Text style={styles.empty}>No XP yet this week. Post a vibe!</Text>
          ) : (
            entries.map((row) => (
              <View
                key={row.userId}
                style={[
                  styles.row,
                  row.userId === user?.id && styles.rowHighlight,
                ]}
              >
                <Text style={styles.rank}>#{row.rank}</Text>
                <Text style={styles.name} numberOfLines={1}>
                  {row.displayName}
                  {row.userId === user?.id ? " (you)" : ""}
                </Text>
                <Text style={styles.xp}>{row.weeklyXp} XP</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
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
    paddingBottom: 8,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: "center",
    marginBottom: 16,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rowHighlight: {
    borderColor: COLORS.primary,
  },
  rank: {
    color: COLORS.accent,
    fontWeight: "800",
    width: 36,
    fontSize: 16,
  },
  name: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  xp: {
    color: COLORS.accentGlow,
    fontWeight: "700",
    fontSize: 14,
  },
  empty: {
    color: COLORS.textMuted,
    textAlign: "center",
    marginTop: 24,
  },
});
