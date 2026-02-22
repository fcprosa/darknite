/**
 * AppScreen — Standardized screen wrapper for consistent safe area handling,
 * background layers, and content spacing across all screens.
 * 
 * Ensures:
 * - Consistent safe area insets
 * - Decorative layers don't block touches (pointerEvents="none")
 * - Proper content padding for headers
 * - Works on all iPhone sizes without device-specific code
 */

import React from "react";
import { View, StyleSheet, ScrollView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { HEADER_PADDING_TOP } from "../constants/layout";

export default function AppScreen({
  children,
  scrollable = false,
  background = "solid",
  backgroundColor = "#050013",
  gradientColors,
  blurIntensity,
  blurTint,
  contentContainerStyle,
  headerHeight,
  style,
  screenName, // For debugging
}) {
  const insets = useSafeAreaInsets();

  // Calculate content top padding
  // If headerHeight is provided (absolute header), use it + insets.top
  // Otherwise, use standard insets.top + HEADER_PADDING_TOP
  const contentTopPadding = headerHeight 
    ? headerHeight + insets.top 
    : insets.top + HEADER_PADDING_TOP;

  // Debug logging (temporary)
  if (__DEV__ && screenName) {
    console.log(`[AppScreen:${screenName}] insets.top: ${insets.top}, headerHeight: ${headerHeight || 'none'}, contentTopPadding: ${contentTopPadding}`);
  }

  const containerStyle = [
    styles.container,
    { backgroundColor: background === "solid" ? backgroundColor : "transparent" },
    style,
  ];

  const contentStyle = scrollable
    ? [
        { paddingTop: contentTopPadding },
        contentContainerStyle,
      ]
    : [
        { flex: 1, paddingTop: contentTopPadding },
        contentContainerStyle,
      ];

  return (
    <View style={containerStyle}>
      {/* Decorative background layers - must not block touches */}
      {background === "gradient" && gradientColors && (
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}

      {background === "blur" && (
        <BlurView
          intensity={blurIntensity || 25}
          tint={blurTint || "dark"}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}

      {/* Content area */}
      {scrollable ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={contentStyle}
          contentInsetAdjustmentBehavior={Platform.OS === "ios" ? "never" : undefined}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={contentStyle}>
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
});
