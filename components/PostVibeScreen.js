import React, { useState, useRef, useEffect, memo } from "react";
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
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useAuth } from "../contexts/AuthContext";
import { useAppContext } from "../contexts/AppContext";
import { createVibe } from "../services/vibeService";
import { getVenueType } from "../services/venueService";
import { validateVenueType, getVenueKey, getVenueKeySafe, inferVenueType } from "../utils/venueHelpers";
import { getLatestBarCrowdCheckIn } from "../services/checkInService";
import { mapCoverPriceToDB, BAR_TIER_UI_LABELS, BAR_DRINKS_TIER_OPTIONS } from "../utils/priceMapping";
import Toast from "./Toast";

// Helper functions for emojis
function getCrowdEmoji(crowd) {
  switch (crowd) {
    case "Dead": return "💀";
    case "Chill": return "😌";
    case "Fun": return "🎉";
    case "Buzzing": return "🐝";
    case "Packed": return "🔥";
    case "Chaos": return "⚡";
    default: return null;
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

function getBarTypeEmoji(bt) {
  if (!bt) return "";
  switch (bt) {
    case "cocktail": return "🍸";
    case "sports": return "🏈";
    case "dive": return "🍺";
    case "wine": return "🍷";
    case "speakeasy": return "🕵️";
    default: return "";
  }
}

function getBarTypeLabel(bt) {
  if (!bt) return "";
  return bt.charAt(0).toUpperCase() + bt.slice(1);
}

// Build header chips based on venue type and form state
// Only shows chips for steps that are in the flow AND have values
function buildHeaderChips({ venueType, formState, steps = null }) {
  const { crowdLevel, ratio, line, cover, drinksPrice, music, barType } = formState;
  const isBar = venueType === "bar";
  const chips = [];

  // If steps array is provided, use it to determine which chips to show
  if (steps && Array.isArray(steps)) {
    steps.forEach((step) => {
      if (step.optional && !step.value) {
        // Skip optional steps that don't have values
        return;
      }

      switch (step.id) {
        case "bar_type":
          chips.push({
            key: "bar_type",
            label: "Type",
            emoji: barType ? getBarTypeEmoji(barType) : null,
            valueLabel: barType ? getBarTypeLabel(barType) : null,
            selected: !!barType,
          });
          break;
        case "crowd":
          chips.push({
            key: "crowd",
            label: "Crowd",
            emoji: crowdLevel ? getCrowdEmoji(crowdLevel) : null,
            valueLabel: crowdLevel || null,
            selected: !!crowdLevel,
          });
          break;
        case "drinks_price":
          chips.push({
            key: "price",
            label: "Price",
            emoji: drinksPrice ? "🍹" : null,
            valueLabel: drinksPrice || null,
            selected: !!drinksPrice,
          });
          break;
        case "music":
          chips.push({
            key: "music",
            label: "Music",
            emoji: music ? getMusicEmoji(music) : null,
            valueLabel: music || null,
            selected: !!music,
          });
          break;
        case "ratio":
          chips.push({
            key: "ratio",
            label: "Ratio",
            emoji: ratio ? getRatioEmoji(ratio) : null,
            valueLabel: ratio || null,
            selected: !!ratio,
          });
          break;
        case "cover":
          chips.push({
            key: "cover",
            label: "Cover",
            emoji: cover ? getCoverEmoji(cover) : null,
            valueLabel: cover || null, // cover state is already in UI format
            selected: !!cover,
          });
          break;
        // Note: "line" case removed - Line is now handled in check-in flow for clubs
      }
    });
    return chips;
  }

  // Fallback to old logic if steps not provided (backward compatibility)
  if (isBar) {
    // Bar: Bar Type, Crowd, Price, Music
    chips.push({
      key: "bar_type",
      label: "Type",
      emoji: barType ? getBarTypeEmoji(barType) : null,
      valueLabel: barType ? getBarTypeLabel(barType) : null,
      selected: !!barType,
    });
    chips.push({
      key: "crowd",
      label: "Crowd",
      emoji: crowdLevel ? getCrowdEmoji(crowdLevel) : null,
      valueLabel: crowdLevel || null,
      selected: !!crowdLevel,
    });
    chips.push({
      key: "price",
      label: "Price",
      emoji: drinksPrice ? "🍹" : null,
      valueLabel: drinksPrice || null,
      selected: !!drinksPrice,
    });
    chips.push({
      key: "music",
      label: "Music",
      emoji: music ? getMusicEmoji(music) : null,
      valueLabel: music || null,
      selected: !!music,
    });
  } else {
    // Club: Crowd, Ratio, Price, Music (Line removed - moved to check-in)
    chips.push({
      key: "crowd",
      label: "Crowd",
      emoji: crowdLevel ? getCrowdEmoji(crowdLevel) : null,
      valueLabel: crowdLevel || null,
      selected: !!crowdLevel,
    });
    chips.push({
      key: "ratio",
      label: "Ratio",
      emoji: ratio ? getRatioEmoji(ratio) : null,
      valueLabel: ratio || null,
      selected: !!ratio,
    });
    chips.push({
      key: "price",
      label: "Cover",
      emoji: cover ? getCoverEmoji(cover) : null,
      valueLabel: cover || null, // cover state is already in UI format
      selected: !!cover,
    });
    chips.push({
      key: "music",
      label: "Music",
      emoji: music ? getMusicEmoji(music) : null,
      valueLabel: music || null,
      selected: !!music,
    });
  }

  return chips;
}

// Reusable VibeChip component for header and summary
const VibeChip = memo(function VibeChip({ chip, muted = false }) {
  const { label, emoji, valueLabel, selected } = chip;
  const displayLabel = selected && valueLabel ? valueLabel : label;
  const displayEmoji = selected && emoji ? emoji : null;

  return (
    <View style={[styles.vibeChip, muted && !selected && styles.vibeChipMuted]}>
      {displayEmoji && <Text style={styles.vibeChipEmoji}>{displayEmoji}</Text>}
      <Text
        style={[
          styles.vibeChipText,
          muted && !selected && styles.vibeChipTextMuted,
        ]}
      >
        {displayLabel}
      </Text>
    </View>
  );
});

const VibeSummary = memo(function VibeSummary({
  crowdLevel,
  ratio,
  line,
  cover,
  drinksPrice,
  music,
  barType,
  selectedTags,
  isFinalStep,
  isFormValid,
  isBar,
  animations,
  steps, // Add steps prop to ensure chips match actual steps
}) {
  const summaryScale = animations.summaryScale;
  const summaryGlow = animations.summaryGlow;

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

  // Build summary chips using buildHeaderChips for required fields, then add optional extras
  const requiredChips = buildHeaderChips({
    venueType: isBar ? "bar" : "club",
    formState: { crowdLevel, ratio, line, cover, drinksPrice, music, barType },
    steps: steps, // Pass steps array to ensure chips match actual steps
  });

  const allChips = [...requiredChips];

  // Add optional extras
  if (isBar) {
    if (ratio) {
      allChips.push({
        key: "ratio_extra",
        label: "Ratio",
        emoji: getRatioEmoji(ratio),
        valueLabel: ratio,
        selected: true,
      });
    }
  } else {
    if (selectedTags && selectedTags.length > 0) {
      allChips.push({
        key: "tags_extra",
        label: "Tags",
        emoji: "🏷",
        valueLabel: selectedTags.join(", "),
        selected: true,
      });
    }
  }

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
        {allChips.map((chip) => (
          <VibeChip key={chip.key} chip={chip} />
        ))}
      </View>
    </Animated.View>
  );
});

const OptionChip = memo(function OptionChip({ label, selected, onPress, large = false, hasSelection = false }) {
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
});

const BAR_TYPE_OPTIONS = ["cocktail", "sports", "dive", "wine", "speakeasy"];

export default function PostVibeScreen({ venue, navigation: navigationProp, onBack, onSuccess, route }) {
  const { user, isAuthenticated, setShowAuthModal } = useAuth();
  const { upsertLatestVibe } = useAppContext();
  const navigationHook = useNavigation();
  // Use prop navigation if available, otherwise fall back to hook
  const navigation = navigationProp || navigationHook;
  const insets = useSafeAreaInsets();

  // Detect if we're in full-screen mode (no onBack = navigated directly, not in sheet)
  const isFullScreen = !onBack;
  const [currentStep, setCurrentStep] = useState(0);
  const [crowdLevel, setCrowdLevel] = useState(null);
  const [ratio, setRatio] = useState(null);
  const [line, setLine] = useState(null);
  const [cover, setCover] = useState(null); // For clubs only
  const [drinksPrice, setDrinksPrice] = useState(null); // For bars only
  const [music, setMusic] = useState(null);
  const [barType, setBarType] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const [ageRange, setAgeRange] = useState(null); // Optional for both bars and clubs
  const [showExtras, setShowExtras] = useState(true); // Always expanded by default
  const [submitting, setSubmitting] = useState(false);
  const [venueType, setVenueType] = useState(null);
  const [venueTypeLoading, setVenueTypeLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  
  // Ref to prevent double submission
  const hasSubmittedRef = useRef(false);

  // Consolidate all animation values
  const animations = useRef({
    fade: new Animated.Value(1),
    summaryScale: new Animated.Value(1),
    summaryGlow: new Animated.Value(0),
  }).current;

  // Fetch venue_type if not provided - CRITICAL: must know venue type to build correct steps
  useEffect(() => {
    async function fetchVenueType() {
      setVenueTypeLoading(true);
      
      if (!venue) {
        console.error("[PostVibe] No venue object provided - cannot determine venue_type");
        Alert.alert(
          "Missing Venue Information",
          "No venue information provided. Cannot proceed with posting a vibe.",
          [{ text: "OK", onPress: () => {
            if (onBack) {
              onBack();
            } else if (navigation?.canGoBack?.()) {
              navigation.goBack();
            }
          }}]
        );
        setVenueType(null);
        setVenueTypeLoading(false);
        return;
      }
      
      if (venue?.venue_type) {
        // Validate venue_type from prop
        const validation = validateVenueType(venue.venue_type);
        if (!validation.valid) {
          // Use smart inference as fallback
          const inferred = inferVenueType(venue);
          console.warn(`[PostVibe] Invalid venue_type "${venue.venue_type}" for "${venue.name}", using inferred type: ${inferred}`);
          setVenueType(inferred);
          setVenueTypeLoading(false);
          return;
        }
        console.log("[PostVibe] Using venue_type from prop:", validation.type);
        setVenueType(validation.type);
        setVenueTypeLoading(false);
      } else {
        // Try to fetch venue_type from database
        const venueKey = getVenueKeySafe(venue);
        if (!venueKey) {
          // No venue ID - use inference
          const inferred = inferVenueType(venue);
          console.warn(`[PostVibe] Venue missing ID, using inferred type: ${inferred}`);
          setVenueType(inferred);
          setVenueTypeLoading(false);
          return;
        }
        console.log("[PostVibe] Fetching venue_type for:", venueKey);
        const fetchedVenueType = await getVenueType(venueKey);

        if (fetchedVenueType) {
          const validation = validateVenueType(fetchedVenueType);
          if (!validation.valid) {
            // Use smart inference as fallback
            const inferred = inferVenueType(venue);
            console.warn(`[PostVibe] Invalid venue_type in DB "${fetchedVenueType}" for "${venue.name}", using inferred type: ${inferred}`);
            setVenueType(inferred);
            setVenueTypeLoading(false);
            return;
          }
          console.log("[PostVibe] Fetched venue_type:", validation.type);
          setVenueType(validation.type);
          setVenueTypeLoading(false);
        } else {
          // DB fetch failed or returned null - use inference
          const inferred = inferVenueType(venue);
          console.warn(`[PostVibe] Could not fetch venue_type for "${venue.name}", using inferred type: ${inferred}`);
          setVenueType(inferred);
          setVenueTypeLoading(false);
        }
      }
    }
    fetchVenueType();
  }, [venue]);

  // Check authentication on mount (only after venue type is loaded to avoid multiple alerts)
  useEffect(() => {
    if (!venueTypeLoading && !isAuthenticated) {
      Alert.alert(
        "Authentication required",
        "Please sign in to post vibes",
        [{ text: "OK", onPress: () => {
          if (onBack) {
            onBack();
          } else if (navigation.canGoBack()) {
            navigation.goBack();
          }
          setShowAuthModal(true);
        }}]
      );
    }
  }, [isAuthenticated, venueTypeLoading, onBack, navigation, setShowAuthModal]);

  // Reset all form state when component mounts or venue changes
  useEffect(() => {
    setCurrentStep(0);
    setCrowdLevel(null);
    setRatio(null);
    setLine(null);
    setCover(null);
    setDrinksPrice(null);
    setMusic(null);
    setBarType(null);
    setSelectedTags([]);
    setAgeRange(null);
    setShowExtras(true); // Keep extras expanded
    setSubmitting(false);
    hasSubmittedRef.current = false; // Reset submission flag
    setShowToast(false); // Hide any visible toast
  }, [venue?.id, venue?.name]);

  const crowdOptions = ["Dead", "Chill", "Fun", "Packed", "Chaos"];
  const ratioOptions = ["Mostly guys", "Balanced", "Mostly girls"];
  const lineOptions = ["No line", "Short", "30+ min"];
  
  // Cover options for clubs (cover charge)
  const clubCoverOptions = ["Free", "< $10", "$10-20", "$20-30", "$30+"];
  // Drink price tier options for bars (display labels)
  const barDrinkPriceOptions = [
    "Cheap $",
    "Moderate $$",
    "Pricey $$$",
    "Expensive $$$$"
  ];
  
  const musicOptions = [
    "Hip-Hop / R&B",
    "Afrobeats",
    "House / Techno",
    "Reggaeton",
    "Top Hits",
    "Mixed",
  ];
  const ageRangeOptions = ["18–25", "25–30", "30–35", "35+", "Mixed"];
  const tagOptions = [
    "Good for groups",
    "Good for couples",
    "Hard to get in",
    "Cheap drinks",
    "Strong drinks",
  ];
  
  // Show loading state while venue type is being determined
  if (venueTypeLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, isFullScreen && styles.safeAreaFullScreen]} edges={isFullScreen ? ['top', 'bottom'] : ['top']}>
        <View style={[styles.container, isFullScreen && styles.containerFullScreen]}>
          <View style={[styles.header, isFullScreen && styles.headerFullScreen]}>
            {isFullScreen ? (
              <TouchableOpacity style={styles.backButton} onPress={() => {
                if (navigation.canGoBack()) navigation.goBack();
              }}>
                <Text style={styles.backButtonText}>←</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.backButton} />
            )}
            <View style={styles.headerTitleContainer}>
              {isFullScreen && venue?.name && (
                <Text style={styles.headerVenueName} numberOfLines={1}>{venue.name}</Text>
              )}
              <Text style={[styles.headerTitle, isFullScreen && styles.headerTitleFullScreen]}>
                {isFullScreen ? "Drop a vibe" : "Post your vibe 🔥"}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={() => {
              if (onBack) {
                onBack();
              } else if (navigation.canGoBack()) {
                navigation.goBack();
              }
            }}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.loadingContainer}>
            <View style={styles.loadingContent}>
              <ActivityIndicator size="large" color="#A855F7" style={styles.loadingSpinner} />
              <Text style={styles.loadingText}>Loading venue information...</Text>
              <Text style={styles.loadingSubtext}>Please wait a moment</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }
  
  // Determine if venue is a bar
  const isBar = venueType === "bar";
  
  // Separate step definitions for clubs vs bars
  // CLUBS: Removed "Line" step (now handled in check-in flow)
  const CLUB_STEPS = [
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
      id: "cover",
      title: "Cover",
      value: cover,
      options: clubCoverOptions,
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
  
  const BAR_STEPS = [
    {
      id: "bar_type",
      title: "What type of bar is it tonight?",
      value: barType,
      options: BAR_TYPE_OPTIONS, // ["cocktail","sports","dive","wine","speakeasy"]
      setValue: setBarType,
    },
    {
      id: "drinks_price",
      title: "Price of drinks",
      value: drinksPrice,
      options: barDrinkPriceOptions, // ["$","$$","$$$","$$$$"]
      setValue: setDrinksPrice,
    },
    {
      id: "music",
      title: "Type of Music",
      value: music,
      options: musicOptions,
      setValue: setMusic,
    },
  ];  
  
  // Use appropriate step array based on venue type
  // For bars: 3 required steps (bar_type, drinks_price, music) - crowd removed, handled in check-in
  // For clubs: 4 required steps (crowd, ratio, cover, music) - line moved to check-in
  const steps = isBar ? BAR_STEPS : CLUB_STEPS;
  // Calculate required steps (exclude optional ones from count)
  const REQUIRED_STEPS = steps.filter(step => !step.optional).length;

  const handleSubmitVibe = async () => {
    // Prevent double submission
    if (hasSubmittedRef.current || submitting) {
      console.log("[PostVibe] Submission already in progress, ignoring duplicate call");
      return;
    }

    // Validate authentication first
    if (!isAuthenticated || !user || !user.id) {
      Alert.alert(
        "Sign in required",
        "You must be signed in to post vibes. Would you like to sign in now?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Sign in",
            onPress: () => {
              // Close this screen and show auth modal
              if (onBack) {
                onBack();
              } else if (navigation?.canGoBack?.()) {
                navigation.goBack();
              }
              // Trigger auth modal
              setShowAuthModal(true);
            }
          }
        ]
      );
      return;
    }

    if (!venue) {
      Alert.alert("Error", "No venue selected.");
      return;
    }

    // Validation: clubs need crowd, ratio, cover, music (line removed - handled in check-in)
    // Bars need barType, drinksPrice, music only (crowd removed - handled in check-in)
    const requiredFieldsComplete = isBar
      ? barType && drinksPrice && music
      : crowdLevel && ratio && cover && music;
    
    if (!requiredFieldsComplete) {
      const message = isBar
        ? "Please select bar type, drinks price, and music."
        : "Please select crowd, ratio, cover, and music.";
      Alert.alert("Oops", message);
      return;
    }

    // Safely get venue key with error handling
    let venueKey;
    try {
      venueKey = getVenueKey(venue);
    } catch (venueKeyError) {
      console.error("[PostVibe] Failed to get venue key:", venueKeyError);
      Alert.alert("Error", "Invalid venue data. Please try selecting the venue again.");
      return;
    }

    // Set submission state to prevent double submission
    hasSubmittedRef.current = true;
    setSubmitting(true);

    try {
      const vibeData = {
        venue_id: venueKey,
        user_id: user.id, // Set user_id from authenticated user
        music,
        verified: false, // Will be set to true if user completed check-in
      };
      
// Bar-specific fields
if (isBar) {
  // FIRST: Try to get crowd from latest check-in
  let barCrowd = null;
  try {
    const barCrowdResult = await getLatestBarCrowdCheckIn(venueKey, 240);
    if (barCrowdResult?.data?.crowd_level) {
      barCrowd = barCrowdResult.data.crowd_level;
      console.log("[PostVibe] Using crowd from latest bar check-in:", barCrowd);
    }
  } catch (error) {
    console.log("[PostVibe] Could not fetch bar crowd from check-in:", error);
  }
  
  vibeData.bar_type = barType;
  
// Map UI label to tier value for drinks_price_tier
if (drinksPrice) {
  // Extract tier from "Cheap $" → "cheap"
  const tierMap = {
    "Cheap $": "cheap",
    "Moderate $$": "moderate",
    "Pricey $$$": "pricey",
    "Expensive $$$$": "expensive"
  };
  
  vibeData.drinks_price_tier = tierMap[drinksPrice] || null;
  
  if (!vibeData.drinks_price_tier) {
    console.warn("[PostVibe] Invalid drinksPrice tier for bar:", drinksPrice);
  }
} else {
  vibeData.drinks_price_tier = null;
}
  
  // Optional ratio for bars (from extras)
  if (ratio) {
    vibeData.ratio = ratio;
  }
  
  // Optional age_range for bars (from extras)
  if (ageRange) {
    vibeData.age_range = ageRange;
  }
  
  // SET CROWD from check-in (if found)
  vibeData.crowd = barCrowd || null;
  
  // Ensure club-only fields are null for bars
  vibeData.line = null;
  vibeData.cover = null;
} else {
  // Club-specific fields
  vibeData.crowd = crowdLevel;
  vibeData.ratio = ratio;
  vibeData.line = null;
  
  // Map cover UI label to DB value for clubs
  const dbCoverPrice = mapCoverPriceToDB(cover);
  if (dbCoverPrice !== null) {
    vibeData.cover = dbCoverPrice;
  } else {
    vibeData.cover = null;
  }
  
  // Clubs do NOT use drinks_price_tier
  vibeData.drinks_price_tier = null;
  
  // Optional age_range for clubs (from extras)
  if (ageRange) {
    vibeData.age_range = ageRange;
  }
  
  // Ensure bar-only fields are null for clubs
  vibeData.bar_type = null;
} 

      // Log basic info for debugging (no sensitive data)
      console.log("[PostVibe] Submitting vibe for venue:", vibeData.venue_id);

      const { data, error, userMessage } = await createVibe(vibeData);

      if (error) {
        // Reset submission state immediately on error
        hasSubmittedRef.current = false;
        setSubmitting(false);
        
        // Check for RATE_LIMIT_EXCEEDED - treat as expected validation (no console.error)
        const isRateLimitError = error.message?.includes("RATE_LIMIT_EXCEEDED") || error.message?.includes("Rate limit exceeded");
        
        if (!isRateLimitError) {
          console.error("Error inserting vibe:", error);
        }
        
        // Show user-friendly message if available, otherwise generic error
        const message = userMessage || "Could not post vibe. Try again.";
        Alert.alert("Error", message);
        return;
      }

      // Success! Show toast and navigate
      console.log("Vibe saved:", data);
      
      // Update central latest vibes map immediately
      if (data) {
        upsertLatestVibe(data);
      }
      
      // Show toast notification
      setToastMessage("Vibe posted ✅");
      setShowToast(true);
      
      // Call onSuccess callback (which should refresh feed)
      try {
        if (onSuccess) {
          onSuccess();
        }
      } catch (e) {
        console.error("[PostVibe] Error in onSuccess callback:", e);
      }
      
      // Navigate after a short delay to let toast appear
      setTimeout(() => {
        navigateAfterSuccess();
      }, 1600); // Slightly longer than toast duration
      
    } catch (e) {
      // Reset submission state immediately on error
      hasSubmittedRef.current = false;
      setSubmitting(false);
      
      // Check for RATE_LIMIT_EXCEEDED - treat as expected validation (no console.error)
      const isRateLimitError = e.message?.includes("RATE_LIMIT_EXCEEDED") || e.message?.includes("Rate limit exceeded");
      
      if (!isRateLimitError) {
        console.error("Error:", e);
      }
      
      // Show appropriate message
      const message = isRateLimitError 
        ? "You've posted recently for this venue — try again in ~60 minutes."
        : "Something went wrong.";
      Alert.alert("Error", message);
    }
  };

  const navigateAfterSuccess = () => {
    // Use onBack callback if available (preferred - closes the sheet/modal)
    if (onBack) {
      onBack();
      return;
    }

    // Fallback: Try to go back
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }

    // Last resort: Navigate to VenueDetails or Home
    try {
      if (venue?.id && navigation?.navigate) {
        navigation.navigate("VenueDetails", {
          venue: venue,
          venueId: venue.id,
        });
      } else {
        const tabNav = navigation?.getParent?.();
        if (tabNav?.navigate) {
          tabNav.navigate("HomeTab");
        } else if (navigation?.navigate) {
          navigation.navigate("HomeList");
        }
      }
    } catch (error) {
      console.error("[PostVibe] Navigation error:", error);
    }
  };

  const advanceToNextStep = () => {
    // Advance to next step in the actual steps array (includes optional steps)
    if (currentStep < steps.length - 1) {
      // Fade out then advance
      Animated.timing(animations.fade, {
        toValue: 0,
        duration: 150,
        easing: Easing.ease,
        useNativeDriver: false,
      }).start(() => {
        setCurrentStep(currentStep + 1);
        // Fade in
        Animated.timing(animations.fade, {
          toValue: 1,
          duration: 200,
          easing: Easing.ease,
          useNativeDriver: false,
        }).start();
      });
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      Animated.timing(animations.fade, {
        toValue: 0,
        duration: 150,
        easing: Easing.ease,
        useNativeDriver: false,
      }).start(() => {
        setCurrentStep(currentStep - 1);
        Animated.timing(animations.fade, {
          toValue: 1,
          duration: 200,
          easing: Easing.ease,
          useNativeDriver: false,
        }).start();
      });
    }
  };

  const handleCancel = () => {
    // Safe back handler - use onBack if provided (which should be the safe handler from App.js)
    if (onBack) {
      onBack();
    } else if (navigation?.canGoBack?.()) {
      navigation.goBack();
    } else if (navigation) {
      // Fallback if onBack not provided but navigation is available
      if (navigation?.canGoBack?.()) {
        navigation.goBack();
      } else {
        // Navigate to Home tab
        const tabNav = navigation.getParent();
        if (tabNav) {
          tabNav.navigate("HomeTab");
        } else {
          navigation.navigate("HomeList");
        }
      }
    }
  };

  // Calculate progress based on required steps only (for display)
  // Count how many required steps we've completed up to currentStep
  let completedRequiredSteps = 0;
  for (let i = 0; i <= currentStep && i < steps.length; i++) {
    if (!steps[i].optional) {
      completedRequiredSteps++;
    }
  }
  const progress = REQUIRED_STEPS > 0 ? Math.min(completedRequiredSteps / REQUIRED_STEPS, 1) : 0;
  
  // Calculate current required step number for display (1-indexed)
  let currentRequiredStepNumber = 0;
  for (let i = 0; i <= currentStep && i < steps.length; i++) {
    if (!steps[i].optional) {
      currentRequiredStepNumber++;
    }
  }
  
  // Only show final step when we're on the last step in the array AND all required fields are filled
  // For bars: barType, drinksPrice, music are required (crowd removed - handled in check-in)
  // For clubs: crowdLevel, ratio, cover, music are required (line moved to check-in)
  const requiredFieldsValid = isBar
    ? barType && drinksPrice && music
    : crowdLevel && ratio && cover && music;
  // Check if we're on the last step in the actual steps array (not filtered)
  const isOnLastStepInArray = currentStep === steps.length - 1;
  const isOnFinalStep = isOnLastStepInArray && requiredFieldsValid;
  const isFormValid = requiredFieldsValid;

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

          {/* Extras Section - Always visible */}
          <View style={styles.extrasAccordion}>
            <View style={styles.extrasAccordionHeader}>
              <Text style={styles.extrasAccordionTitle}>
                Extras (optional)
              </Text>
            </View>
            <View style={styles.extrasAccordionContent}>
                {isBar ? (
                  // Bar extras: ratio (optional)
                  <>
                    {/* Ratio (optional for bars) */}
                    <View style={styles.extrasItem}>
                      <Text style={styles.extrasLabel}>Ratio (optional)</Text>
                      <View style={styles.extrasOptionsRow}>
                        {ratioOptions.map((opt) => (
                          <TouchableOpacity
                            key={opt}
                            style={[
                              styles.extrasChip,
                              ratio === opt && styles.extrasChipSelected,
                            ]}
                            onPress={() => {
                              setRatio(ratio === opt ? null : opt);
                              try {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              } catch (e) {}
                            }}
                          >
                            <Text
                              style={[
                                styles.extrasChipText,
                                ratio === opt && styles.extrasChipTextSelected,
                              ]}
                            >
                              {opt}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* Age Range (optional for both bars and clubs) */}
                    <View style={styles.extrasItem}>
                      <Text style={styles.extrasLabel}>Age range</Text>
                      <View style={styles.extrasOptionsRow}>
                        {ageRangeOptions.map((opt) => (
                          <TouchableOpacity
                            key={opt}
                            style={[
                              styles.extrasChip,
                              ageRange === opt && styles.extrasChipSelected,
                            ]}
                            onPress={() => {
                              setAgeRange(ageRange === opt ? null : opt);
                              try {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              } catch (e) {}
                            }}
                          >
                            <Text
                              style={[
                                styles.extrasChipText,
                                ageRange === opt && styles.extrasChipTextSelected,
                              ]}
                            >
                              {opt}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </>
                ) : (
                  // Club extras: tags (existing)
                  <>
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

                    {/* Age Range (optional for both bars and clubs) */}
                    <View style={styles.extrasItem}>
                      <Text style={styles.extrasLabel}>Age range</Text>
                      <View style={styles.extrasOptionsRow}>
                        {ageRangeOptions.map((opt) => (
                          <TouchableOpacity
                            key={opt}
                            style={[
                              styles.extrasChip,
                              ageRange === opt && styles.extrasChipSelected,
                            ]}
                            onPress={() => {
                              setAgeRange(ageRange === opt ? null : opt);
                              try {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              } catch (e) {}
                            }}
                          >
                            <Text
                              style={[
                                styles.extrasChipText,
                                ageRange === opt && styles.extrasChipTextSelected,
                              ]}
                            >
                              {opt}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </>
                )}
            </View>
          </View>
        </View>
      );
    }

    // Regular step content for steps 0-4
    const step = steps[currentStep];
    if (!step) {
      // Safety check - should not happen
      console.error("[PostVibe] Step not found at index:", currentStep);
      return null;
    }
    const hasSelection = step.value !== null;
    
    // Check if this is the last step in the actual steps array
    const isLastStepInArray = currentStep === steps.length - 1;
    // Check if all required fields are filled (for showing final confirmation)
    const allRequiredFieldsFilled = requiredFieldsValid;
    
    // Debug logging for music step
    if (step.id === "music") {
      console.log("Music step debug:", {
        currentStep,
        stepsLength: steps.length,
        stepId: step.id,
        musicValue: music,
        optionsLength: step.options.length,
        isLastStepInArray,
        allRequiredFieldsFilled,
      });
    }
    
    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{step.title}</Text>
        <View style={styles.optionsRow}>
          {step.options.map((opt) => {
            const isSelected = step.value === opt;
            // Use actual last step in array, not REQUIRED_STEPS
            const isLastStep = isLastStepInArray;
            // Format label for bar_type options (capitalize first letter)
            const displayLabel = step.id === "bar_type"
              ? opt.charAt(0).toUpperCase() + opt.slice(1)
              : opt;
            return (
              <OptionChip
                key={opt}
                label={displayLabel}
                selected={isSelected}
                onPress={() => {
                  if (isSelected) {
                    // Deselect and stay on same step
                    step.setValue(null);
                  } else {
                    // Select the value (use original opt value, not displayLabel)
                    step.setValue(opt);
                    // Auto-advance if not on last step in array
                    // On the last step, selecting a value will show the confirmation screen if all required fields are filled
                    if (!isLastStep) {
                      // Small delay to show selection animation before advancing
                      setTimeout(() => {
                        advanceToNextStep();
                      }, 200);
                    } else if (allRequiredFieldsFilled) {
                      // On last step with all required fields filled, trigger final step view
                      // This is handled by isOnFinalStep logic
                    }
                  }
                }}
                large={step.id === "music" || step.id === "bar_type"}
                hasSelection={hasSelection}
              />
            );
          })}
        </View>
      </View>
    );
  };

  // Block form rendering if venueType is invalid/null
  if (!venueType) {
    return (
      <SafeAreaView style={[styles.safeArea, isFullScreen && styles.safeAreaFullScreen]} edges={isFullScreen ? ['top', 'bottom'] : ['top']}>
        <View style={[styles.container, isFullScreen && styles.containerFullScreen]}>
          {/* Drag Handle - Only show in sheet mode */}
          {!isFullScreen && (
            <View style={styles.dragHandleContainer}>
              <View style={styles.dragHandle} />
            </View>
          )}

          {/* Header */}
          <View style={[styles.header, isFullScreen && styles.headerFullScreen]}>
            {isFullScreen ? (
              <TouchableOpacity style={styles.backButton} onPress={handleCancel}>
                <Text style={styles.backButtonText}>←</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.backButton} />
            )}
            <View style={styles.headerTitleContainer}>
              {isFullScreen && venue?.name && (
                <Text style={styles.headerVenueName} numberOfLines={1}>{venue.name}</Text>
              )}
              <Text style={[styles.headerTitle, isFullScreen && styles.headerTitleFullScreen]}>
                {isFullScreen ? "Drop a vibe" : "Post your vibe 🔥"}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={handleCancel}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Error State */}
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>
              Invalid Venue Type
            </Text>
            <Text style={styles.errorSubtext}>
              This venue has an invalid or missing type. Please contact support or update the venue information before posting a vibe.
            </Text>
            <TouchableOpacity
              style={styles.errorButton}
              onPress={handleCancel}
            >
              <Text style={styles.errorButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, isFullScreen && styles.safeAreaFullScreen]} edges={isFullScreen ? ['top', 'bottom'] : ['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <View style={[styles.container, isFullScreen && styles.containerFullScreen]}>
          {/* Drag Handle - Only show in sheet mode */}
          {!isFullScreen && (
            <View style={styles.dragHandleContainer}>
              <View style={styles.dragHandle} />
            </View>
          )}

          {/* Header */}
          <View style={[styles.header, isFullScreen && styles.headerFullScreen]}>
            {currentStep > 0 ? (
              <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                <Text style={styles.backButtonText}>←</Text>
              </TouchableOpacity>
            ) : isFullScreen ? (
              <TouchableOpacity style={styles.backButton} onPress={handleCancel}>
                <Text style={styles.backButtonText}>←</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.backButton} />
            )}
            <View style={styles.headerTitleContainer}>
              {/* Show venue name in full-screen mode */}
              {isFullScreen && venue?.name && (
                <Text style={styles.headerVenueName} numberOfLines={1}>{venue.name}</Text>
              )}
              <Text style={[styles.headerTitle, isFullScreen && styles.headerTitleFullScreen]}>
                {isFullScreen ? "Drop a vibe" : "Post your vibe 🔥"}
              </Text>
              {/* Header Chips */}
              {venueType && (
                <View style={styles.headerChipsContainer}>
                  {buildHeaderChips({
                    venueType,
                    formState: { crowdLevel, ratio, line, cover, drinksPrice, music, barType },
                    steps: steps, // Pass steps array to ensure chips match actual steps
                  }).map((chip) => (
                    <VibeChip key={chip.key} chip={chip} muted={true} />
                  ))}
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={handleCancel}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Progress Indicator - Hide on final step */}
          {!isOnFinalStep && (
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>
                Step {currentRequiredStepNumber}/{REQUIRED_STEPS}
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

          {/* Step Content */}
          <View style={styles.contentWrapper}>
            {isOnFinalStep ? (
              <ScrollView
                style={styles.contentContainerScrollView}
                contentContainerStyle={[
                  styles.contentContainerScroll,
                  { paddingBottom: Math.max(insets.bottom, 120) }
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {renderStepContent()}
              </ScrollView>
            ) : (
              <Animated.View
                style={[
                  styles.contentContainer,
                  {
                    opacity: animations.fade,
                  },
                ]}
              >
                {renderStepContent()}
              </Animated.View>
            )}
          </View>

          {/* Sticky Submit Button - Always visible at bottom */}
          {isOnFinalStep && (
            <View style={[styles.submitButtonContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!isFormValid || submitting || hasSubmittedRef.current) && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmitVibe}
                disabled={!isFormValid || submitting || hasSubmittedRef.current}
                activeOpacity={0.8}
              >
                <Text style={styles.submitButtonText}>
                  {submitting ? "Submitting..." : "Submit vibe 🔥"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
      <Toast
        message={toastMessage}
        visible={showToast}
        onDismiss={() => setShowToast(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050013",
  },
  // Full-screen mode styles
  safeAreaFullScreen: {
    backgroundColor: "#050013",
  },
  containerFullScreen: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  headerFullScreen: {
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(168,85,247,0.3)",
  },
  headerVenueName: {
    color: "#A855F7",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  headerTitleFullScreen: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 6,
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
    marginBottom: 4,
  },
  headerChipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
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
  vibeChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(168,85,247,0.15)",
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
  },
  vibeChipMuted: {
    backgroundColor: "transparent",
    borderColor: "rgba(156,163,175,0.3)",
  },
  vibeChipEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  vibeChipText: {
    color: "#E5E7EB",
    fontSize: 11,
    fontWeight: "600",
  },
  vibeChipTextMuted: {
    color: "rgba(156,163,175,0.7)",
    fontWeight: "500",
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
    paddingBottom: 100, // Space for sticky submit button
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
  safeArea: {
    flex: 1,
    backgroundColor: "#050013",
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  submitButtonContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(5,0,19,0.95)",
    borderTopWidth: 1,
    borderTopColor: "rgba(124,58,237,0.3)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
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
    paddingVertical: 16,
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  loadingContent: {
    alignItems: "center",
  },
  loadingSpinner: {
    marginBottom: 24,
  },
  loadingText: {
    color: "#F9FAFB",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  loadingSubtext: {
    color: "#9CA3AF",
    fontSize: 13,
    textAlign: "center",
  },
  // Error state styles
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorTitle: {
    color: "#E5E7EB",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  errorSubtext: {
    color: "#9CA3AF",
    fontSize: 14,
    marginBottom: 24,
    textAlign: "center",
  },
  errorButton: {
    backgroundColor: "#A855F7",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
