import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { useAppContext } from "../contexts/AppContext";

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
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
        Animated.timing(glowAnim, {
          toValue: 1,
            duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
          Animated.timing(scaleAnim, {
            toValue: 1.1,
            duration: 3000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ]),
        Animated.parallel([
        Animated.timing(glowAnim, {
          toValue: 0.3,
            duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 3000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ]),
      ])
    ).start();
  }, []);

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0.3, 1],
    outputRange: [0.3, 0.6],
  });

  return (
    <View style={styles.landingRoot}>
      {/* Gradient Background Layers */}
      <View style={styles.landingGradient1} />
      <View style={styles.landingGradient2} />
      
      {/* Animated Blob Behind Logo */}
          <Animated.View
            style={[
          styles.landingBlob,
              {
                opacity: glowOpacity,
            transform: [{ scale: scaleAnim }],
              },
            ]}
          />
      
      <ScrollView
        contentContainerStyle={styles.landingContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo with animated glow */}
        <View style={styles.landingLogoContainer}>
          <Text style={styles.landingLogo}>DarkNite</Text>
        </View>

        <Text style={styles.landingTagline}>Know Before You Go</Text>
        <Text style={styles.landingSubtitle}>
          Live vibes, ratios & lines — NYC
        </Text>

        {/* Benefit Chips */}
        <View style={styles.landingChipsContainer}>
          <View style={styles.landingChip}>
            <Text style={styles.landingChipText}>Live crowd</Text>
          </View>
          <View style={styles.landingChip}>
            <Text style={styles.landingChipText}>Lines</Text>
          </View>
          <View style={styles.landingChip}>
            <Text style={styles.landingChipText}>Music</Text>
          </View>
        </View>

        <View style={styles.landingButtonsContainer}>
          <TouchableOpacity style={styles.landingPrimary} onPress={onDiscover}>
            <Text style={styles.landingPrimaryText}>
              Discover Tonight&apos;s Vibe
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.landingSecondary} onPress={() => setShowAuthModal(true)}>
            <Text style={styles.landingSecondaryText}>Sign In</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.landingPeek}>
          Just looking around?{" "}
          <Text style={styles.landingPeekLink} onPress={onDiscover}>
            Peek the vibes
          </Text>
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  landingRoot: {
    flex: 1,
    backgroundColor: "#050013",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  landingGradient1: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(168,85,247,0.15)",
  },
  landingGradient2: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(249,115,255,0.08)",
  },
  landingContent: {
    paddingHorizontal: 24,
    width: "100%",
    alignItems: "center",
    zIndex: 1,
  },
  landingBlob: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#A855F7",
    top: "20%",
    alignSelf: "center",
    zIndex: 0,
  },
  landingLogoContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    position: "relative",
    zIndex: 1,
  },
  landingLogo: {
    fontSize: 56,
    fontWeight: "900",
    color: "#F973FF",
    letterSpacing: -1.5,
    textShadowColor: "rgba(249,115,255,0.5)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  landingTagline: {
    fontSize: 28,
    color: "#F9FAFB",
    fontWeight: "800",
    marginBottom: 12,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  landingSubtitle: {
    color: "#E5E7EB",
    textAlign: "center",
    fontSize: 16,
    marginBottom: 32,
    fontWeight: "500",
  },
  landingChipsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 40,
    flexWrap: "wrap",
  },
  landingChip: {
    backgroundColor: "rgba(168,85,247,0.15)",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  landingChipText: {
    color: "#A855F7",
    fontSize: 13,
    fontWeight: "600",
  },
  landingButtonsContainer: {
    width: "100%",
    marginBottom: 24,
  },
  landingPrimary: {
    backgroundColor: "#A855F7",
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#A855F7",
    shadowOpacity: 0.8,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  landingPrimaryText: {
    color: "#F9FAFB",
    fontWeight: "700",
    fontSize: 17,
    letterSpacing: 0.3,
  },
  landingSecondary: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#A855F7",
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "rgba(168,85,247,0.1)",
  },
  landingSecondaryText: {
    color: "#E5E7EB",
    fontWeight: "700",
    fontSize: 16,
  },
  landingPeek: {
    color: "#9CA3AF",
    fontSize: 14,
    textAlign: "center",
  },
  landingPeekLink: {
    color: "#F973FF",
    fontWeight: "600",
  },
});

export default LandingScreenWrapper;

