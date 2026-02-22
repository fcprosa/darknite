/**
 * HeaderIconButton — Standardized header button component with proper touch targets.
 * 
 * Ensures:
 * - 44x44 minimum touch target (Apple HIG)
 * - Proper hitSlop for easier tapping
 * - Consistent styling across all headers
 * - Accessibility support
 */

import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { MIN_TOUCH_TARGET, ICON_HIT_SLOP } from "../constants/layout";

export default function HeaderIconButton({
  onPress,
  children,
  icon,
  style,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={ICON_HIT_SLOP}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.button,
        {
          minWidth: MIN_TOUCH_TARGET,
          minHeight: MIN_TOUCH_TARGET,
        },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon || children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    justifyContent: "center",
    alignItems: "center",
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.4,
  },
});
