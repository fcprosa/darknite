import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ScrollView,
  Animated,
  Easing,
} from "react-native";
import { createClient } from "@supabase/supabase-js";
import * as Haptics from "expo-haptics";

const SUPABASE_URL = "https://uttcnvqhhmkfkccwjgnt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_FRoLIm9eLIJYnjSMJ68KCw_hwr4zuiF";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper functions for emojis
function getCrowdEmoji(crowd) {
  switch (crowd) {
    case "Dead": return "💀";
    case "Chill": return "😌";
    case "Fun": return "🎉";
    case "Packed": return "🔥";
    case "Chaos": return "⚡";
    default: return "❓";
  }
}

function getRatioEmoji(ratio) {
  if (!ratio) return "⚖️";
  if (ratio.includes("guys")) return "👥";
  if (ratio.includes("girls")) return "👭";
  return "⚖️";
}

function getLineEmoji(line) {
  if (!line) return "⏱️";
  if (line.includes("No line")) return "✅";
  if (line.includes("30+")) return "⏳";
  return "⏱️";
}

function getCoverEmoji(cover) {
  if (!cover) return "💰";
  if (cover.includes("Free")) return "🆓";
  if (cover.includes("$20+")) return "💎";
  return "💰";
}

function getMusicEmoji(music) {
  if (!music) return "🎵";
  if (music.includes("Hip-Hop")) return "🎤";
  if (music.includes("Afrobeats")) return "🥁";
  if (music.includes("House") || music.includes("Techno")) return "🎧";
  if (music.includes("Reggaeton")) return "🎺";
  if (music.includes("Top Hits")) return "⭐";
  return "🎵";
}

function VibeSummary({
  crowdLevel,
  ratio,
  line,
  cover,
  music,
  stayDuration,
  selectedTags,
  isFinalStep,
  isFormValid,
}) {
  const summaryScale = useRef(new Animated.Value(1)).current;
  const summaryGlow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isFinalStep && isFormValid) {
      // Animate to "ready to submit" state
      // Use non-native driver for all to avoid conflicts
      Animated.parallel([
        Animated.spring(summaryScale, {
          toValue: 1.02,
          useNativeDriver: false,
          tension: 200,
          friction: 10,
        }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(summaryGlow, {
              toValue: 1,
              duration: 1500,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: false,
            }),
            Animated.timing(summaryGlow, {
              toValue: 0,
              duration: 1500,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: false,
            }),
          ])
        ),
      ]).start();
    } else {
      // Stop any running animations before resetting
      summaryScale.stopAnimation();
      summaryGlow.stopAnimation();
      summaryScale.setValue(1);
      summaryGlow.setValue(0);
    }
  }, [isFinalStep, isFormValid]);

  const shadowOpacity = summaryGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.6],
  });

  const requiredFields = [
    { label: "Crowd", value: crowdLevel, emoji: getCrowdEmoji(crowdLevel) },
    { label: "Ratio", value: ratio, emoji: getRatioEmoji(ratio) },
    { label: "Line", value: line, emoji: getLineEmoji(line) },
    { label: "Cover", value: cover, emoji: getCoverEmoji(cover) },
    { label: "Music", value: music, emoji: getMusicEmoji(music) },
  ];

  return (
    <Animated.View
      style={[
        styles.vibeSummaryContainer,
        {
          transform: [{ scale: summaryScale }],
          shadowColor: "#A855F7",
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 8,
          shadowOpacity,
        },
      ]}
    >
      <View style={styles.vibeSummary}>
        {requiredFields.map((field, index) => {
          const hasValue = field.value !== null && field.value !== undefined;
          return (
            <View key={index} style={styles.summaryPill}>
              <Text style={styles.summaryEmoji}>{field.emoji}</Text>
              <Text
                style={[
                  styles.summaryText,
                  !hasValue && styles.summaryTextPlaceholder,
                ]}
              >
                {hasValue ? field.value : "?"}
              </Text>
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
}

function OptionChip({ label, selected, onPress, large = false, hasSelection = false }) {
  const pressScaleAnim = useRef(new Animated.Value(1)).current;
  const selectedScaleAnim = useRef(new Animated.Value(selected ? 1.05 : 1)).current;
  const borderAnim = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const bgAnim = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const opacityAnim = useRef(new Animated.Value(selected || !hasSelection ? 1 : 0.5)).current;
  const glowAnim = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(borderAnim, {
        toValue: selected ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(bgAnim, {
        toValue: selected ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.spring(selectedScaleAnim, {
        toValue: selected ? 1.05 : 1,
        useNativeDriver: false,
        tension: 300,
        friction: 20,
      }),
      Animated.timing(opacityAnim, {
        toValue: selected || !hasSelection ? 1 : 0.5,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(glowAnim, {
        toValue: selected ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, [selected, hasSelection]);

  const handlePressIn = () => {
    Animated.spring(pressScaleAnim, {
      toValue: 0.95,
      useNativeDriver: false,
      tension: 300,
      friction: 10,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScaleAnim, {
      toValue: 1,
      useNativeDriver: false,
      tension: 300,
      friction: 10,
    }).start();
  };

  const handlePress = (e) => {
    e?.stopPropagation?.();
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      // Haptics not available, skip gracefully
    }
    
    onPress();
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(156,163,175,0.7)", "#A855F7"],
  });

  const backgroundColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["transparent", "#A855F7"],
  });

  const shadowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.6],
  });

  const shadowRadius = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 12],
  });

  // Combine press scale and selected scale using multiply
  const combinedScale = Animated.multiply(pressScaleAnim, selectedScaleAnim);

  const chipStyle = large ? styles.largeOptionChip : styles.optionChip;
  const textStyle = large ? styles.largeOptionText : styles.optionText;

  return (
    <Animated.View
      style={[
        large ? styles.largeOptionChipContainer : styles.optionChipContainer,
        {
          transform: [{ scale: combinedScale }],
          opacity: opacityAnim,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={styles.optionChipTouchable}
        delayPressIn={0}
        delayPressOut={0}
      >
        <Animated.View
          style={[
            chipStyle,
            {
              borderColor,
              backgroundColor,
              shadowColor: "#A855F7",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity,
              shadowRadius,
              elevation: selected ? 8 : 0,
            },
          ]}
        >
          <Text style={[textStyle, selected && styles.optionTextActive]}>
            {label}
          </Text>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function PostVibeScreen({ venue, onBack, onSuccess }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [crowdLevel, setCrowdLevel] = useState(null);
  const [ratio, setRatio] = useState(null);
  const [line, setLine] = useState(null);
  const [cover, setCover] = useState(null);
  const [music, setMusic] = useState(null);
  const [stayDuration, setStayDuration] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const [showExtras, setShowExtras] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Animation for step transitions
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const crowdOptions = ["Dead", "Chill", "Fun", "Packed", "Chaos"];
  const ratioOptions = ["Mostly guys", "Balanced", "Mostly girls"];
  const lineOptions = ["No line", "0–10 min", "10–30 min", "30+ min"];
  const coverOptions = ["Free", "< $10", "$10–20", "$20+"];
  const musicOptions = [
    "Hip-Hop / R&B",
    "Afrobeats",
    "House / Techno",
    "Reggaeton",
    "Top Hits",
    "Mixed",
  ];
  const stayDurationOptions = ["15 min", "30 min", "1 hour", "2+ hours"];
  const tagOptions = [
    "Good for groups",
    "Good for couples",
    "Hard to get in",
    "Cheap drinks",
    "Strong drinks",
  ];
  // Step definitions
  const REQUIRED_STEPS = 5;
  const steps = [
    {
      id: "crowd",
      title: "Crowd level",
      value: crowdLevel,
      options: crowdOptions,
      setValue: setCrowdLevel,
    },
    {
      id: "ratio",
      title: "Ratio",
      value: ratio,
      options: ratioOptions,
      setValue: setRatio,
    },
    {
      id: "line",
      title: "Line",
      value: line,
      options: lineOptions,
      setValue: setLine,
    },
    {
      id: "cover",
      title: "Cover",
      value: cover,
      options: coverOptions,
      setValue: setCover,
    },
    {
      id: "music",
      title: "Type of Music",
      value: music,
      options: musicOptions,
      setValue: setMusic,
    },
  ];

  const handleSubmitVibe = async () => {
    if (!venue) {
      Alert.alert("Error", "No venue selected.");
      return;
    }

    if (!crowdLevel || !ratio || !line || !cover || !music) {
      Alert.alert("Oops", "Please select crowd, ratio, line, cover, and music.");
      return;
    }

    const venueKey = venue.id || venue.name;
    try {
      setSubmitting(true);

      const vibeData = {
        venue_id: venueKey,
        crowd: crowdLevel,
        ratio,
        line,
        cover,
        music,
      };
      if (stayDuration) vibeData.stay_duration = stayDuration;
      if (selectedTags.length > 0) vibeData.tags = selectedTags;

      const { data, error } = await supabase.from("vibes").insert([vibeData]);

      if (error) {
        console.error("Erro ao inserir vibe:", error);
        Alert.alert("Error", "Could not post vibe. Try again.");
        setSubmitting(false);
        return;
      }

      // Only trigger success and navigate after successful insert
      console.log("Vibe gravado:", data);
      Alert.alert("Thanks!", "Your vibe was posted.");
      if (onSuccess) onSuccess();
      // Small delay to ensure state updates before navigation
      setTimeout(() => {
        onBack();
      }, 100);
    } catch (e) {
      console.error("Erro:", e);
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const advanceToNextStep = () => {
    if (currentStep < REQUIRED_STEPS - 1) {
      // Fade out then advance
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        easing: Easing.ease,
        useNativeDriver: false,
      }).start(() => {
        setCurrentStep(currentStep + 1);
        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.ease,
          useNativeDriver: false,
        }).start();
      });
    }
    // No Extras step - stay on step 5 (final step)
  };

  const handleBack = () => {
    if (currentStep > 0) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        easing: Easing.ease,
        useNativeDriver: false,
      }).start(() => {
        setCurrentStep(currentStep - 1);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.ease,
          useNativeDriver: false,
        }).start();
      });
    }
  };

  const handleCancel = () => {
    // Ensure venue state is preserved when canceling
    onBack();
  };

  const progress = Math.min((currentStep + 1) / REQUIRED_STEPS, 1);
  const isOnFinalStep = currentStep === REQUIRED_STEPS - 1; // Step 5 (index 4) is the final step
  const isFormValid = crowdLevel && ratio && line && cover && music;

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      // Haptics not available
    }
  };

  const renderStepContent = () => {
    // Show "You're done" confirmation screen on final step
    if (isOnFinalStep) {
      return (
        <View style={styles.confirmationContent}>
          <Text style={styles.confirmationTitle}>You're done ✅</Text>

          {/* Extras Accordion */}
          <View style={styles.extrasAccordion}>
            <TouchableOpacity
              style={styles.extrasAccordionHeader}
              onPress={() => setShowExtras(!showExtras)}
              activeOpacity={0.7}
            >
              <Text style={styles.extrasAccordionTitle}>
                Add extras (optional)
              </Text>
              <Text style={styles.extrasAccordionIcon}>
                {showExtras ? "⌄" : "›"}
              </Text>
            </TouchableOpacity>
            {showExtras && (
              <View style={styles.extrasAccordionContent}>
                {/* Stay Duration */}
                <View style={styles.extrasItem}>
                  <Text style={styles.extrasLabel}>Stay duration</Text>
                  <View style={styles.extrasOptionsRow}>
                    {stayDurationOptions.map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        style={[
                          styles.extrasChip,
                          stayDuration === opt && styles.extrasChipSelected,
                        ]}
                        onPress={() => {
                          setStayDuration(stayDuration === opt ? null : opt);
                          try {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          } catch (e) {}
                        }}
                      >
                        <Text
                          style={[
                            styles.extrasChipText,
                            stayDuration === opt && styles.extrasChipTextSelected,
                          ]}
                        >
                          {opt}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Quick Tags */}
                <View style={styles.extrasItem}>
                  <Text style={styles.extrasLabel}>Quick tags</Text>
                  <View style={styles.extrasOptionsRow}>
                    {tagOptions.map((tag) => (
                      <TouchableOpacity
                        key={tag}
                        style={[
                          styles.extrasChip,
                          selectedTags.includes(tag) && styles.extrasChipSelected,
                        ]}
                        onPress={() => toggleTag(tag)}
                      >
                        <Text
                          style={[
                            styles.extrasChipText,
                            selectedTags.includes(tag) && styles.extrasChipTextSelected,
                          ]}
                        >
                          {tag}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      );
    }

    // Regular step content for steps 0-4
    const step = steps[currentStep];
    const hasSelection = step.value !== null;
    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{step.title}</Text>
        <View style={styles.optionsRow}>
          {step.options.map((opt) => {
            const isSelected = step.value === opt;
            return (
              <OptionChip
                key={opt}
                label={opt}
                selected={isSelected}
                onPress={() => {
                  if (isSelected) {
                    // Deselect and stay on same step
                    step.setValue(null);
                  } else {
                    // Select and auto-advance
                    step.setValue(opt);
                    // Small delay to show selection animation before advancing
                    setTimeout(() => {
                      advanceToNextStep();
                    }, 200);
                  }
                }}
                large={true}
                hasSelection={hasSelection}
              />
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Drag Handle */}
      <View style={styles.dragHandleContainer}>
        <View style={styles.dragHandle} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        {currentStep > 0 ? (
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backButton} />
        )}
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Post your vibe 🔥</Text>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={handleCancel}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Progress Indicator - Hide on final step */}
      {!isOnFinalStep && (
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            Step {currentStep + 1}/{REQUIRED_STEPS}
          </Text>
          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: `${progress * 100}%`,
                },
              ]}
            />
          </View>
        </View>
      )}

      {/* Vibe Summary - Prominent on final step */}
      <VibeSummary
        crowdLevel={crowdLevel}
        ratio={ratio}
        line={line}
        cover={cover}
        music={music}
        stayDuration={stayDuration}
        selectedTags={selectedTags}
        isFinalStep={isOnFinalStep}
        isFormValid={isFormValid}
      />

      {/* Step Content */}
      <View style={styles.contentWrapper}>
        {isOnFinalStep ? (
          <ScrollView
            style={styles.contentContainerScrollView}
            contentContainerStyle={styles.contentContainerScroll}
            showsVerticalScrollIndicator={false}
          >
            {renderStepContent()}
          </ScrollView>
        ) : (
          <Animated.View
            style={[
              styles.contentContainer,
              {
                opacity: fadeAnim,
              },
            ]}
          >
            {renderStepContent()}
          </Animated.View>
        )}
      </View>

      {/* Navigation Footer - Submit button on final step */}
      {isOnFinalStep && (
        <SafeAreaView style={styles.footerSafeArea}>
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!isFormValid || submitting) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmitVibe}
              disabled={!isFormValid || submitting}
              activeOpacity={0.8}
            >
              <Text style={styles.submitButtonText}>
                {submitting ? "Submitting..." : "Submit vibe 🔥"}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050013",
  },
  dragHandleContainer: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 6,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(156,163,175,0.5)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(124,58,237,0.3)",
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonText: {
    color: "#E5E7EB",
    fontSize: 20,
    fontWeight: "500",
  },
  headerTitleContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    color: "#F9FAFB",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  progressText: {
    color: "#E5E7EB",
    fontSize: 13,
    textAlign: "center",
    fontWeight: "600",
    marginBottom: 8,
  },
  progressBar: {
    height: 3,
    backgroundColor: "rgba(124,58,237,0.2)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#A855F7",
    borderRadius: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    color: "#E5E7EB",
    fontSize: 18,
    fontWeight: "500",
  },
  vibeSummaryContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  vibeSummary: {
    backgroundColor: "rgba(168,85,247,0.1)",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  summaryPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(168,85,247,0.15)",
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
  },
  summaryEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  summaryText: {
    color: "#E5E7EB",
    fontSize: 11,
    fontWeight: "600",
  },
  summaryTextPlaceholder: {
    color: "rgba(156,163,175,0.5)",
    fontWeight: "400",
  },
  contentWrapper: {
    flex: 1,
    paddingHorizontal: 16,
  },
  contentContainer: {
    flex: 1,
    justifyContent: "center",
  },
  contentContainerScrollView: {
    flex: 1,
  },
  contentContainerScroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: 16,
  },
  stepContent: {
    paddingVertical: 20,
  },
  stepTitle: {
    color: "#F9FAFB",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 32,
  },
  sectionLabel: {
    color: "#E5E7EB",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
  },
  extrasSection: {
    marginBottom: 32,
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
  },
  optionChipContainer: {
    marginBottom: 12,
  },
  largeOptionChipContainer: {
    marginBottom: 16,
    minWidth: 140,
  },
  optionChipTouchable: {
    borderRadius: 999,
  },
  optionChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  largeOptionChip: {
    borderRadius: 16,
    borderWidth: 2,
    paddingVertical: 16,
    paddingHorizontal: 24,
    minWidth: 140,
  },
  optionText: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "500",
  },
  largeOptionText: {
    color: "#E5E7EB",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  optionTextActive: {
    color: "#F9FAFB",
    fontWeight: "700",
  },
  footerSafeArea: {
    backgroundColor: "#050013",
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(124,58,237,0.3)",
    backgroundColor: "#050013",
  },
  footerButtonsRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  navButton: {
    flex: 1,
    backgroundColor: "rgba(148,163,184,0.15)",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)",
  },
  navButtonPrimary: {
    backgroundColor: "#A855F7",
    borderColor: "#A855F7",
  },
  navButtonDisabled: {
    backgroundColor: "#374151",
    borderColor: "#374151",
    opacity: 0.5,
  },
  navButtonText: {
    color: "#E5E7EB",
    fontWeight: "600",
    fontSize: 16,
  },
  navButtonPrimaryText: {
    color: "#F9FAFB",
    fontWeight: "700",
  },
  navButtonDisabledText: {
    color: "#6B7280",
  },
  skipButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  skipButtonText: {
    color: "#9CA3AF",
    fontWeight: "600",
    fontSize: 16,
  },
  submitButton: {
    flex: 1,
    backgroundColor: "#A855F7",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#A855F7",
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    elevation: 4,
  },
  submitButtonText: {
    color: "#F9FAFB",
    fontWeight: "700",
    fontSize: 16,
  },
  submitButtonDisabled: {
    backgroundColor: "#374151",
    borderColor: "#374151",
    opacity: 0.5,
  },
  confirmationContent: {
    paddingVertical: 24,
    alignItems: "center",
  },
  confirmationTitle: {
    color: "#F9FAFB",
    fontSize: 32,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 24,
  },
  extrasAccordion: {
    width: "100%",
    backgroundColor: "#0B0625",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.3)",
    overflow: "hidden",
    marginTop: 16,
  },
  extrasAccordionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  extrasAccordionTitle: {
    color: "#E5E7EB",
    fontSize: 16,
    fontWeight: "600",
  },
  extrasAccordionIcon: {
    color: "#A855F7",
    fontSize: 24,
    fontWeight: "700",
  },
  extrasAccordionContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(124,58,237,0.2)",
  },
  extrasItem: {
    marginTop: 20,
  },
  extrasLabel: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },
  extrasOptionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  extrasChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(156,163,175,0.5)",
    backgroundColor: "transparent",
  },
  extrasChipSelected: {
    borderColor: "#A855F7",
    backgroundColor: "rgba(168,85,247,0.2)",
  },
  extrasChipText: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "500",
  },
  extrasChipTextSelected: {
    color: "#E5E7EB",
    fontWeight: "600",
  },
});
