import React, { useEffect, useRef } from "react";
import { Animated, Text, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../constants";

export default function XPToast({ visible, lines = [], onDismiss }) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return undefined;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        friction: 7,
        tension: 80,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 80,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => onDismiss?.());
    }, 2500);

    return () => clearTimeout(timer);
  }, [visible, translateY, opacity, onDismiss]);

  if (!visible || !lines.length) return null;

  const total = lines.reduce((s, l) => s + (l.xp || 0), 0);
  const headline = lines.find((l) => l.xp > 0);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom: insets.bottom + 24,
          opacity,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="none"
    >
      <View style={styles.toast}>
        <Text style={styles.total}>+{total} XP</Text>
        {headline ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {lines.map((l) => (l.xp > 0 ? l.label : null)).filter(Boolean).join(" · ")}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: "center",
  },
  toast: {
    backgroundColor: COLORS.surfaceRaised,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: COLORS.accent,
    minWidth: "80%",
    alignItems: "center",
  },
  total: {
    color: COLORS.accentGlow,
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
  },
});
