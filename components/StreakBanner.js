import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useGamification } from "../src/hooks/useGamification";
import { COLORS } from "../constants";

export default function StreakBanner() {
  const insets = useSafeAreaInsets();
  const { streak } = useGamification();
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.15,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.75,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [scale, opacity]);

  if (!streak || streak < 1) return null;

  return (
    <View style={[styles.banner, { top: insets.top + 8 }]}>
      <Animated.View style={{ transform: [{ scale }], opacity }}>
        <Ionicons name="flame" size={18} color={COLORS.accentGlow} />
      </Animated.View>
      <Text style={styles.text}>
        {streak} day{streak === 1 ? "" : "s"} streak
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.mapOverlay,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    zIndex: 10,
  },
  text: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
});
