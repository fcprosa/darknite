import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const ONBOARDING_COMPLETE_KEY = "@darknite_onboarding_complete";

const SLIDES = [
  {
    id: "1",
    emoji: "🌙",
    title: "Welcome to DarkNite",
    subtitle: "Your guide to the best nightlife in the city",
    description: "Find out what's happening at clubs and bars right now, in real-time.",
  },
  {
    id: "2",
    emoji: "📍",
    title: "Check In",
    subtitle: "Let others know you're there",
    description: "Check in at venues to share live updates like crowd levels and line wait times.",
  },
  {
    id: "3",
    emoji: "✨",
    title: "Drop a Vibe",
    subtitle: "Share what's really happening",
    description: "Post vibes with music, crowd energy, cover prices, and more. Help others find the perfect spot.",
  },
  {
    id: "4",
    emoji: "🔥",
    title: "Find What's Hot",
    subtitle: "Never miss a good night",
    description: "See real-time updates from venues across the city. Discover where the party's at.",
  },
];

export default function OnboardingScreen({ onComplete }) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleNext = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}

    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      // Complete onboarding
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
      onComplete();
    }
  };

  const handleSkip = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
    onComplete();
  };

  const renderSlide = ({ item, index }) => {
    return (
      <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
        <View style={styles.emojiContainer}>
          <Text style={styles.emoji}>{item.emoji}</Text>
        </View>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
        <Text style={styles.description}>{item.description}</Text>
      </View>
    );
  };

  const renderDots = () => {
    return (
      <View style={styles.dotsContainer}>
        {SLIDES.map((_, index) => {
          const inputRange = [
            (index - 1) * SCREEN_WIDTH,
            index * SCREEN_WIDTH,
            (index + 1) * SCREEN_WIDTH,
          ];

          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [8, 24, 8],
            extrapolate: "clamp",
          });

          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: "clamp",
          });

          return (
            <Animated.View
              key={index}
              style={[
                styles.dot,
                {
                  width: dotWidth,
                  opacity,
                },
              ]}
            />
          );
        })}
      </View>
    );
  };

  const isLastSlide = currentIndex === SLIDES.length - 1;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0A0015", "#050013", "#0A0020"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Skip button */}
      {!isLastSlide && (
        <TouchableOpacity
          style={[styles.skipButton, { top: insets.top + 16 }]}
          onPress={handleSkip}
          activeOpacity={0.7}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentIndex(index);
        }}
        scrollEventThrottle={16}
        bounces={false}
      />

      {/* Bottom section */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 24 }]}>
        {renderDots()}

        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={["#A855F7", "#9333EA"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.nextButtonGradient}
          >
            <Text style={styles.nextButtonText}>
              {isLastSlide ? "Get Started" : "Next"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Export helper to check if onboarding is complete
export async function isOnboardingComplete() {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
    return value === "true";
  } catch (e) {
    return false;
  }
}

// Export helper to reset onboarding (for testing)
export async function resetOnboarding() {
  try {
    await AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY);
  } catch (e) {
    console.warn("Failed to reset onboarding:", e);
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050013",
  },
  skipButton: {
    position: "absolute",
    right: 20,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  skipText: {
    color: "#9CA3AF",
    fontSize: 16,
    fontWeight: "500",
  },
  slide: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emojiContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 40,
    borderWidth: 2,
    borderColor: "rgba(168, 85, 247, 0.3)",
  },
  emoji: {
    fontSize: 56,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#A855F7",
    textAlign: "center",
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 24,
  },
  bottomSection: {
    paddingHorizontal: 24,
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#A855F7",
    marginHorizontal: 4,
  },
  nextButton: {
    borderRadius: 16,
    overflow: "hidden",
  },
  nextButtonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: "center",
  },
  nextButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
});
