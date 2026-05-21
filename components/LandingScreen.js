import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { useAppContext } from "../contexts/AppContext";
import { COLORS as themeColor } from "../constants";

const { width: W } = Dimensions.get("window");

const SEGMENTS = [
  {
    key: "crowd",
    label: "Live Crowd",
    headline: "See live crowds before you go",
    desc: "Real check-ins show if it's packed, chill, or dead — updated in real time.",
  },
  {
    key: "lines",
    label: "Lines",
    headline: "Skip the guesswork on lines",
    desc: "People report wait times so you know what you're walking into.",
  },
  {
    key: "music",
    label: "Music",
    headline: "Know the music before you arrive",
    desc: "See what's playing tonight — house, hip-hop, afrobeats, and more.",
  },
];

function LandingScreenWrapper() {
  const { setGuestMode } = useAppContext();

  const handleDiscover = () => {
    console.log("[Landing] Discover pressed - entering guest mode");
    setGuestMode(true);
  };

  return <LandingScreen onDiscover={handleDiscover} />;
}

function LandingScreen({ onDiscover }) {
  const { setShowAuthModal } = useAuth();
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const [segWidth, setSegWidth] = useState(0);

  // Single animation: segment indicator slide
  const indicatorX = useRef(new Animated.Value(0)).current;

  const segPad = 4;
  const gap = 4;
  const itemW = segWidth > 0 ? (segWidth - segPad * 2 - gap * (SEGMENTS.length - 1)) / SEGMENTS.length : 0;

  useEffect(() => {
    if (!segWidth || !itemW) return;
    const x = segPad + activeIndex * (itemW + gap);
    Animated.spring(indicatorX, {
      toValue: x,
      useNativeDriver: true,
      speed: 20,
      bounciness: 0,
    }).start();
  }, [activeIndex, itemW, segWidth, indicatorX]);

  // Subtle star field — static, no animation
  const stars = useMemo(() => {
    return Array.from({ length: 16 }).map((_, i) => ({
      key: `s-${i}`,
      left: ((Math.sin(i * 999) * 0.5 + 0.5) * (W - 8)) | 0,
      top: (40 + (Math.cos(i * 777) * 0.5 + 0.5) * 500) | 0,
      size: 1.2 + ((i * 37) % 3) * 0.5,
      opacity: 0.08 + ((i * 11) % 10) / 120,
    }));
  }, []);

  const current = SEGMENTS[activeIndex];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* Background */}
      <LinearGradient
        colors={[themeColor.background, themeColor.surface, themeColor.background]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Stars */}
      {stars.map((s) => (
        <View
          key={s.key}
          style={[
            styles.star,
            { left: s.left, top: s.top, width: s.size, height: s.size, opacity: s.opacity },
          ]}
        />
      ))}

      {/* Content */}
      <View style={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 20 }]}>

        {/* Logo + Subtitle */}
        <View style={styles.hero}>
          <Text style={styles.logo}>DarkNite</Text>
          <Text style={styles.tagline}>NYC nightlife, in real time</Text>
        </View>

        {/* Feature Showcase */}
        <View style={styles.showcase}>
          {/* Segmented Control */}
          <View
            style={styles.segmentWrap}
            onLayout={(e) => setSegWidth(e.nativeEvent.layout.width)}
          >
            {segWidth > 0 && itemW > 0 && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.segmentIndicator,
                  { width: itemW, transform: [{ translateX: indicatorX }] },
                ]}
              />
            )}

            {SEGMENTS.map((seg, index) => (
              <TouchableOpacity
                key={seg.key}
                activeOpacity={0.8}
                onPress={() => setActiveIndex(index)}
                style={[styles.segmentItem, itemW ? { width: itemW } : { flex: 1 }]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    activeIndex === index && styles.segmentTextActive,
                  ]}
                >
                  {seg.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Feature Copy */}
          <View style={styles.featureCopy}>
            <Text style={styles.featureHeadline}>{current.headline}</Text>
            <Text style={styles.featureDesc}>{current.desc}</Text>
          </View>
        </View>

        {/* Spacer pushes CTA to bottom */}
        <View style={{ flex: 1 }} />

        {/* CTA */}
        <View style={styles.ctaSection}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setShowAuthModal(true)}
            style={styles.primaryBtnWrap}
          >
            <LinearGradient
              colors={[themeColor.accent, themeColor.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryText}>Get Started</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onDiscover}
            style={styles.guestLink}
          >
            <Text style={styles.guestText}>Explore as guest</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: themeColor.background,
  },
  star: {
    position: "absolute",
    borderRadius: 99,
    backgroundColor: themeColor.textPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },

  // ─── Hero ───
  hero: {
    alignItems: "center",
    marginBottom: 48,
  },
  logo: {
    fontSize: 52,
    fontWeight: "900",
    color: themeColor.textPrimary,
    letterSpacing: -1.5,
  },
  tagline: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "600",
    color: themeColor.textSecondary,
    letterSpacing: 0.2,
  },

  // ─── Feature Showcase ───
  showcase: {
    width: "100%",
  },
  segmentWrap: {
    width: "100%",
    height: 48,
    borderRadius: 12,
    padding: 4,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: themeColor.border,
    position: "relative",
    overflow: "hidden",
  },
  segmentIndicator: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 0,
    borderRadius: 9,
    backgroundColor: themeColor.accent,
  },
  segmentItem: {
    height: 44,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentText: {
    fontSize: 14,
    fontWeight: "700",
    color: themeColor.textMuted,
  },
  segmentTextActive: {
    color: themeColor.textPrimary,
  },

  // ─── Feature Copy ───
  featureCopy: {
    marginTop: 32,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  featureHeadline: {
    fontSize: 24,
    fontWeight: "800",
    color: themeColor.textPrimary,
    textAlign: "center",
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  featureDesc: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: "500",
    color: themeColor.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 320,
  },

  // ─── CTA ───
  ctaSection: {
    width: "100%",
    alignItems: "center",
  },
  primaryBtnWrap: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: themeColor.accent,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  primaryBtn: {
    paddingVertical: 18,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  primaryText: {
    color: themeColor.textPrimary,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  guestLink: {
    marginTop: 20,
    paddingVertical: 8,
  },
  guestText: {
    fontSize: 15,
    fontWeight: "600",
    color: themeColor.textMuted,
  },
});

export default LandingScreenWrapper;
