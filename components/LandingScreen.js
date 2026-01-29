import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  Platform,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useAuth } from "../contexts/AuthContext";
import { useAppContext } from "../contexts/AppContext";

const { width: W } = Dimensions.get("window");

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
  const [activeChip, setActiveChip] = useState("Live crowd");
  const [segWidth, setSegWidth] = useState(0);

  // ✨ PERFECTED: Clean, mature Gen Z copy
  const segmentCopy = useMemo(
    () => ({
      "Live crowd": {
        emoji: "👥",
        headline: "See the crowd before you pull up",
        desc: "Live check-ins show if it's packed, chill, or dead — right now.",
        cta: "Check Tonight's Crowd",
      },
      Lines: {
        emoji: "⏱️",
        headline: "Skip the line guesswork",
        desc: "People report wait times so you know if it's worth going.",
        cta: "See Tonight's Lines",
      },
      Music: {
        emoji: "🎵",
        headline: "Know the music vibe",
        desc: "See what's playing tonight — reggaeton, house, afrobeats, 2000s…",
        cta: "Discover Tonight's Music",
      },
    }),
    []
  );

  // Motion drivers
  const t = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;
  const primaryScale = useRef(new Animated.Value(1)).current;
  const secondaryScale = useRef(new Animated.Value(1)).current;
  const highlightX = useRef(new Animated.Value(0)).current;

  const chips = ["Live crowd", "Lines", "Music"];
  const chipIndex = chips.indexOf(activeChip);

  const segPad = 4;
  const gap = 6;
  const itemW = segWidth > 0 ? (segWidth - segPad * 2 - gap * 2) / 3 : 0;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(t, {
          toValue: 1,
          duration: 5200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(t, {
          toValue: 0,
          duration: 5200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(shine, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(shine, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [t, shine]);

  useEffect(() => {
    if (!segWidth || !itemW) return;
    const x = segPad + chipIndex * (itemW + gap);
    Animated.spring(highlightX, {
      toValue: x,
      useNativeDriver: true,
      speed: 18,
      bounciness: 0,
    }).start();
  }, [chipIndex, itemW, segWidth, highlightX]);

  const driftX = t.interpolate({ inputRange: [0, 1], outputRange: [-10, 10] });
  const driftY = t.interpolate({ inputRange: [0, 1], outputRange: [8, -8] });
  const haloScale = t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const haloOpacity = t.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.16] });
  const cardFloat = t.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const shineX = shine.interpolate({ inputRange: [0, 1], outputRange: [-W * 0.7, W * 0.7] });

  const stars = useMemo(() => {
    const count = 22;
    return Array.from({ length: count }).map((_, i) => {
      const left = ((Math.sin(i * 999) * 0.5 + 0.5) * (W - 22)) | 0;
      const top = (60 + (Math.cos(i * 777) * 0.5 + 0.5) * 540) | 0;
      const size = 1.4 + ((i * 37) % 4) * 0.65;
      const opacity = 0.06 + ((i * 11) % 10) / 90;
      return { key: `s-${i}`, left, top, size, opacity };
    });
  }, []);

  const pressIn = (anim) => {
    Animated.spring(anim, {
      toValue: 0.985,
      useNativeDriver: true,
      speed: 28,
      bounciness: 0,
    }).start();
  };
  
  const pressOut = (anim) => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 22,
      bounciness: 0,
    }).start();
  };

  const current = segmentCopy[activeChip];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <LinearGradient
        colors={["#04000F", "#09001A", "#040010"]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.glowA,
          { transform: [{ translateX: driftX }, { translateY: driftY }] },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glowB,
          {
            transform: [
              { translateX: Animated.multiply(driftX, -1) },
              { translateY: driftY },
            ],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glowC,
          {
            transform: [
              { translateX: driftX },
              { translateY: Animated.multiply(driftY, -1) },
            ],
          },
        ]}
      />

      {stars.map((s) => (
        <View
          key={s.key}
          style={[
            styles.star,
            {
              left: s.left,
              top: s.top,
              width: s.size,
              height: s.size,
              opacity: s.opacity,
            },
          ]}
        />
      ))}

      <LinearGradient
        pointerEvents="none"
        colors={[
          "rgba(0,0,0,0.75)",
          "rgba(0,0,0,0.0)",
          "rgba(0,0,0,0.70)",
        ]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[StyleSheet.absoluteFill, { opacity: 0.65 }]}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* HERO */}
        <View style={styles.hero}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.halo,
              { opacity: haloOpacity, transform: [{ scale: haloScale }] },
            ]}
          />

          <Text style={styles.logo}>DarkNite</Text>

          <View style={styles.badge}>
            <LinearGradient
              colors={["rgba(249,115,255,0.22)", "rgba(168,85,247,0.12)"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.badgeGrad}
            >
              <Text style={styles.badgeText}>NYC • LIVE</Text>
            </LinearGradient>
          </View>

          <Text style={styles.tagline}>{current.headline}</Text>
          <Text style={styles.subtitle}>{current.desc}</Text>
        </View>

        {/* CARD */}
        <Animated.View style={{ width: "100%", transform: [{ translateY: cardFloat }] }}>
          <LinearGradient
            colors={[
              "rgba(249,115,255,0.32)",
              "rgba(168,85,247,0.14)",
              "rgba(255,255,255,0.10)",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardBorder}
          >
            <BlurView intensity={28} tint="dark" style={styles.card}>
              <LinearGradient
                pointerEvents="none"
                colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0.00)"]}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={styles.cardSheen}
              />

              {/* ✨ PERFECTED: Segmented with emojis, clean layout */}
              <View
                style={styles.segmentWrap}
                onLayout={(e) => setSegWidth(e.nativeEvent.layout.width)}
              >
                {segWidth > 0 && itemW > 0 && (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.segmentHighlight,
                      {
                        width: itemW,
                        transform: [{ translateX: highlightX }],
                      },
                    ]}
                  >
                    <LinearGradient
                      colors={["rgba(249,115,255,0.34)", "rgba(168,85,247,0.22)"]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={StyleSheet.absoluteFill}
                    />
                  </Animated.View>
                )}

                {chips.map((label) => {
                  const isActive = activeChip === label;
                  const emoji = segmentCopy[label].emoji;
                  return (
                    <TouchableOpacity
                      key={label}
                      activeOpacity={0.9}
                      onPress={() => setActiveChip(label)}
                      style={[styles.segmentItem, itemW ? { width: itemW } : { flex: 1 }]}
                    >
                      <View style={styles.segmentContent}>
                        <Text style={styles.segmentEmoji}>{emoji}</Text>
                        <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                          {label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Primary CTA */}
              <Animated.View style={{ transform: [{ scale: primaryScale }] }}>
                <TouchableOpacity
                  activeOpacity={0.94}
                  onPress={onDiscover}
                  onPressIn={() => pressIn(primaryScale)}
                  onPressOut={() => pressOut(primaryScale)}
                >
                  <LinearGradient
                    colors={["#A855F7", "#F973FF"]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.primaryBtn}
                  >
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.shineWrap,
                        { transform: [{ translateX: shineX }, { rotate: "12deg" }] },
                      ]}
                    >
                      <LinearGradient
                        colors={[
                          "rgba(255,255,255,0)",
                          "rgba(255,255,255,0.25)",
                          "rgba(255,255,255,0)",
                        ]}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={styles.shine}
                      />
                    </Animated.View>

                    <Text style={styles.primaryText}>{current.cta}</Text>
                    <View style={styles.primaryInnerBorder} pointerEvents="none" />
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>

              {/* Secondary CTA */}
              <Animated.View style={{ transform: [{ scale: secondaryScale }] }}>
                <TouchableOpacity
                  activeOpacity={0.95}
                  onPress={() => setShowAuthModal(true)}
                  onPressIn={() => pressIn(secondaryScale)}
                  onPressOut={() => pressOut(secondaryScale)}
                >
                  <LinearGradient
                    colors={["rgba(255,255,255,0.08)", "rgba(255,255,255,0.02)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.secondaryBorder}
                  >
                    <View style={styles.secondaryBtn}>
                      <Text style={styles.secondaryText}>Sign In</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>

              {/* ✨ PERFECTED: Better contrast, clean look */}
              <Text style={styles.peek}>
                Just looking around?{" "}
                <Text style={styles.peekLink} onPress={onDiscover}>
                  Peek the vibes
                </Text>
              </Text>
            </BlurView>
          </LinearGradient>
        </Animated.View>

        <View style={{ height: 18 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#04000F" },

  content: {
    paddingTop: 64,
    paddingBottom: 50,
    paddingHorizontal: 22,
    alignItems: "center",
  },

  glowA: {
    position: "absolute",
    width: 520,
    height: 520,
    borderRadius: 999,
    backgroundColor: "rgba(168,85,247,0.12)",
    top: -260,
    left: -320,
  },
  glowB: {
    position: "absolute",
    width: 560,
    height: 560,
    borderRadius: 999,
    backgroundColor: "rgba(249,115,255,0.09)",
    top: 180,
    right: -340,
  },
  glowC: {
    position: "absolute",
    width: 680,
    height: 680,
    borderRadius: 999,
    backgroundColor: "rgba(34,211,238,0.035)",
    bottom: -420,
    left: -380,
  },

  star: {
    position: "absolute",
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,1)",
  },

  hero: {
    width: "100%",
    alignItems: "center",
    marginBottom: 14,
  },

  halo: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 999,
    backgroundColor: "#A855F7",
    top: -44,
  },

  logo: {
    fontSize: 58,
    fontWeight: "900",
    color: "#F973FF",
    letterSpacing: -1.8,
    textShadowColor: "rgba(249,115,255,0.42)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },

  badge: { marginTop: 10 },
  badgeGrad: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  badgeText: {
    color: "rgba(249,250,251,0.90)",
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 0.7,
  },

  tagline: {
    marginTop: 14,
    fontSize: 26,
    fontWeight: "900",
    color: "#F9FAFB",
    letterSpacing: -0.7,
    textAlign: "center",
    maxWidth: 340,
    lineHeight: 30,
  },

  subtitle: {
    marginTop: 10,
    fontSize: 14.5,
    fontWeight: "700",
    color: "rgba(229,231,235,0.82)",
    textAlign: "center",
    maxWidth: 340,
    lineHeight: 19,
  },

  cardBorder: {
    width: "100%",
    borderRadius: 30,
    padding: 1.5,
  },

  card: {
    borderRadius: 29,
    padding: 16,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.26 : 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },

  cardSheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    opacity: 0.55,
  },

  segmentWrap: {
    width: "100%",
    height: 52,
    borderRadius: 999,
    padding: 4,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 14,
    position: "relative",
    overflow: "hidden",
  },

  segmentHighlight: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 0,
    borderRadius: 999,
    overflow: "hidden",
    shadowColor: "#F973FF",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },

  segmentItem: {
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },

  segmentContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  segmentEmoji: {
    fontSize: 15,
  },

  segmentText: {
    fontSize: 12,
    fontWeight: "900",
    color: "rgba(229,231,235,0.70)",
  },

  segmentTextActive: {
    color: "rgba(255,255,255,0.96)",
  },

  primaryBtn: {
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#A855F7",
    shadowOpacity: 0.44,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },

  primaryText: {
    color: "#FFFFFF",
    fontSize: 16.5,
    fontWeight: "900",
    letterSpacing: 0.2,
    textShadowColor: "rgba(0,0,0,0.22)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },

  primaryInnerBorder: {
    position: "absolute",
    top: 2,
    bottom: 2,
    left: 2,
    right: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  shineWrap: {
    position: "absolute",
    top: -30,
    bottom: -30,
    width: 120,
    opacity: 0.8,
  },

  shine: {
    flex: 1,
    borderRadius: 24,
  },

  secondaryBorder: {
    marginTop: 12,
    borderRadius: 999,
    padding: 1,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.22)",
  },

  secondaryBtn: {
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: "rgba(8,0,18,0.40)",
  },

  secondaryText: {
    color: "rgba(243,244,246,0.92)",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.2,
  },

  peek: {
    marginTop: 12,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(229,231,235,0.88)",
  },

  peekLink: {
    color: "#FCA5FF",
    fontWeight: "900",
    textDecorationLine: "underline",
    textShadowColor: "rgba(249,115,255,0.35)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
});

export default LandingScreenWrapper;
