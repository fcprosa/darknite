import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { ICON_HIT_SLOP, MIN_TOUCH_TARGET } from "../constants/layout";

export default function IconButton({ onPress, children, style, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={ICON_HIT_SLOP}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        pressed && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: "center",
    alignItems: "center",
  },
  pressed: {
    opacity: 0.6,
  },
});
