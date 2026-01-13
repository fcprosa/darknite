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
import { validateVenueType, getVenueKey, getVenueKeySafe } from "../utils/venueHelpers";
import { mapCoverPriceToDB, BAR_TIER_UI_LABELS, BAR_DRINKS_TIER_OPTIONS } from "../utils/priceMapping";
import Toast from "./Toast";

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

const VibeSummary = memo(function VibeSummary({
  crowdLevel,
  ratio,
  line,
  cover,
  drinksPrice,
  music,
  barType,
  bartenderVibe,
  stayDuration,
  selectedTags,
  isFinalStep,
  isFormValid,
  isBar,
  animations,
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
  
  // Build summary fields based on isBar boolean (not barType presence)
  const requiredFields = [];
  
  if (isBar) {
    // Bar summary: bar_type, crowd, drinks_price, music, (ratio if present), (bartender_vibe if present)
    if (barType) {
      requiredFields.push({
        label: getBarTypeLabel(barType),
        value: getBarTypeLabel(barType),
        emoji: getBarTypeEmoji(barType),
      });
    }
    requiredFields.push({ label: "Crowd", value: crowdLevel, emoji: getCrowdEmoji(crowdLevel) });
    if (drinksPrice) {
      requiredFields.push({ label: "Drinks", value: drinksPrice, emoji: "🍹" });
    }
    requiredFields.push({ label: "Music", value: music, emoji: getMusicEmoji(music) });
    // Optional extras for bars
    if (ratio) {
      requiredFields.push({ label: "Ratio", value: ratio, emoji: getRatioEmoji(ratio) });
    }
    if (bartenderVibe) {
      requiredFields.push({ label: "Bartender", value: bartenderVibe, emoji: "👨‍🍳" });
    }
  } else {
    // Club summary: crowd, ratio, line, cover, music, (stay_duration/tags if present)
    requiredFields.push({ label: "Crowd", value: crowdLevel, emoji: getCrowdEmoji(crowdLevel) });
    requiredFields.push({ label: "Ratio", value: ratio, emoji: getRatioEmoji(ratio) });
    requiredFields.push({ label: "Line", value: line, emoji: getLineEmoji(line) });
    if (cover) {
      requiredFields.push({ label: "Cover", value: cover, emoji: getCoverEmoji(cover) });
    }
    requiredFields.push({ label: "Music", value: music, emoji: getMusicEmoji(music) });
    // Optional extras for clubs (only show if currently shown)
    if (stayDuration) {
      requiredFields.push({ label: "Stay", value: stayDuration, emoji: "⏱" });
    }
    if (selectedTags && selectedTags.length > 0) {
      requiredFields.push({ label: "Tags", value: selectedTags.join(", "), emoji: "🏷" });
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
  const [currentStep, setCurrentStep] = useState(0);
  const [crowdLevel, setCrowdLevel] = useState(null);
  const [ratio, setRatio] = useState(null);
  const [line, setLine] = useState(null);
  const [cover, setCover] = useState(null); // For clubs only
  const [drinksPrice, setDrinksPrice] = useState(null); // For bars only
  const [music, setMusic] = useState(null);
  const [barType, setBarType] = useState(null);
  const [bartenderVibe, setBartenderVibe] = useState(null); // For bars only, optional
  const [stayDuration, setStayDuration] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const [showExtras, setShowExtras] = useState(false);
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
          [{ text: "OK" }]
        );
        setVenueType(null);
        setVenueTypeLoading(false);
        return;
      }
      
      if (venue?.venue_type) {
        // Validate venue_type from prop
        const validation = validateVenueType(venue.venue_type);
        if (!validation.valid) {
          console.error(`[PostVibe] Invalid venue_type: ${validation.error} for venue "${venue.name}"`);
          Alert.alert(
            "Invalid Venue Type",
            `This venue has an invalid or missing type: ${validation.error}.\n\nPlease contact support or update the venue information before posting a vibe.`,
            [{ text: "OK" }]
          );
          setVenueType(null);
          setVenueTypeLoading(false);
          return;
        }
        console.log("[PostVibe] Using venue_type from prop:", validation.type);
        setVenueType(validation.type);
        setVenueTypeLoading(false);
      } else {
        // Fetch venue_type from database - REQUIRED for step building
        const venueKey = getVenueKeySafe(venue);
        if (!venueKey) {
          console.error("[PostVibe] Venue missing ID:", venue);
          Alert.alert("Error", "Invalid venue: missing ID. Please try again.");
          setVenueTypeLoading(false);
          return;
        }
        console.log("[PostVibe] Fetching venue_type for:", venueKey);
        const fetchedVenueType = await getVenueType(venueKey);
        
        if (fetchedVenueType) {
          const validation = validateVenueType(fetchedVenueType);
          if (!validation.valid) {
            console.error(`[PostVibe] Invalid venue_type in database: ${validation.error} for venue "${venue.name}"`);
            Alert.alert(
              "Invalid Venue Type",
              `This venue has an invalid or missing type in the database: ${validation.error}.\n\nPlease contact support or update the venue information before posting a vibe.`,
              [{ text: "OK" }]
            );
            setVenueType(null);
            setVenueTypeLoading(false);
            return;
          }
          console.log("[PostVibe] Fetched venue_type:", validation.type);
          setVenueType(validation.type);
          setVenueTypeLoading(false);
        } else {
          console.error("[PostVibe] Error fetching venue_type");
          Alert.alert(
            "Venue Type Error",
            `Unable to determine this venue's type. Please try again or contact support.`,
            [{ text: "OK" }]
          );
          setVenueType(null);
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
    setBartenderVibe(null);
    setStayDuration(null);
    setSelectedTags([]);
    setShowExtras(false);
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
    BAR_TIER_UI_LABELS.cheap,
    BAR_TIER_UI_LABELS.normal,
    BAR_TIER_UI_LABELS.expensive,
    BAR_TIER_UI_LABELS.crazy,
  ];
  
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
  const bartenderOptions = ["Polite", "Neutral", "Rude"];
  
  // Show loading state while venue type is being determined
  if (venueTypeLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.backButton} />
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>Post your vibe 🔥</Text>
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
      id: "crowd",
      title: "Crowd level",
      value: crowdLevel,
      options: crowdOptions,
      setValue: setCrowdLevel,
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
  // For bars: only 4 required steps (bar_type, crowd, drinks_price, music)
  // For clubs: 5 required steps (crowd, ratio, line, cover, music)
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

    // Validation: clubs need crowd, ratio, line, cover, music
    // Bars need barType, crowd, drinksPrice, music (bartenderVibe is optional)
    const requiredFieldsComplete = isBar
      ? barType && crowdLevel && drinksPrice && music
      : crowdLevel && ratio && line && cover && music;
    
    if (!requiredFieldsComplete) {
      const message = isBar
        ? "Please select bar type, crowd, drinks price, and music."
        : "Please select crowd, ratio, line, cover, and music.";
      Alert.alert("Oops", message);
      return;
    }

    const venueKey = getVenueKey(venue); // Throws if venue.id is missing
    hasSubmittedRef.current = true;
    try {
      setSubmitting(true);

      const vibeData = {
        venue_id: venueKey,
        user_id: user.id, // Set user_id from authenticated user
        crowd: crowdLevel,
        music,
      };
      
      // Bar-specific fields
      if (isBar) {
        vibeData.bar_type = barType;
        // Map UI label (e.g., "$ Cheap") to tier value (e.g., "cheap") for drinks_price_tier
        if (drinksPrice) {
          // Find which tier this UI label corresponds to
          const tierKey = Object.keys(BAR_TIER_UI_LABELS).find(
            key => BAR_TIER_UI_LABELS[key] === drinksPrice
          );
          if (tierKey && BAR_DRINKS_TIER_OPTIONS.includes(tierKey)) {
            vibeData.drinks_price_tier = tierKey;
          } else {
            console.warn("[PostVibe] Invalid drinksPrice tier for bar:", drinksPrice);
            vibeData.drinks_price_tier = null;
          }
        } else {
          vibeData.drinks_price_tier = null;
        }
        // Bars do NOT use drinks_price (that's for club cover charges)
        vibeData.drinks_price = null;
        // Optional ratio for bars (from extras) - only include if set
        if (ratio) {
          vibeData.ratio = ratio;
        }
        // Optional bartender_vibe for bars (from extras) - only include if set
        if (bartenderVibe) {
          vibeData.bartender_vibe = bartenderVibe;
        }
        // Ensure club-only fields are null for bars
        vibeData.line = null;
        vibeData.cover = null;
        vibeData.tags = null;
        vibeData.stay_duration = null;
      } else {
        // Club-specific fields
        vibeData.ratio = ratio;
        vibeData.line = line;
        // Map cover UI label to DB value for clubs
        const dbCoverPrice = mapCoverPriceToDB(cover);
        if (dbCoverPrice !== null) {
          vibeData.cover = dbCoverPrice;
        } else {
          vibeData.cover = null;
        }
        // Clubs do NOT use drinks_price_tier (that's for bars)
        vibeData.drinks_price_tier = null;
        // Club-specific optional extras
        if (stayDuration) vibeData.stay_duration = stayDuration;
        if (selectedTags.length > 0) vibeData.tags = selectedTags;
        // Ensure bar-only fields are null for clubs
        vibeData.bar_type = null;
        vibeData.drinks_price = null;
        vibeData.bartender_vibe = null;
      }

      // Log final payload before insert (without secrets)
      console.log("[PostVibe] Final payload:", JSON.stringify(vibeData, null, 2));

      const { data, error, userMessage } = await createVibe(vibeData);

      if (error) {
        console.error("Error inserting vibe:", error);
        
        // Show user-friendly message if available, otherwise generic error
        const message = userMessage || "Could not post vibe. Try again.";
        Alert.alert("Error", message);
        hasSubmittedRef.current = false;
        setSubmitting(false);
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
      console.error("Error:", e);
      Alert.alert("Error", "Something went wrong.");
      hasSubmittedRef.current = false;
      setSubmitting(false);
    }
  };

  const navigateAfterSuccess = () => {
    try {
      // First, try to navigate to VenueDetails for this venue
      if (venue?.id) {
        try {
          if (navigation?.navigate) {
            navigation.navigate("VenueDetails", {
              venue: venue,
              venueId: venue.id,
            });
            return;
          }
        } catch (navError) {
          console.warn("[PostVibe] Could not navigate to VenueDetails, trying fallback:", navError);
        }
      }

      // Fallback: Try to go back
      if (navigation?.canGoBack?.()) {
        navigation.goBack();
        return;
      }

      // Last resort: Navigate to Home
      try {
        const tabNav = navigation?.getParent?.();
        if (tabNav?.navigate) {
          tabNav.navigate("HomeTab");
          return;
        }
      } catch (e) {
        console.warn("[PostVibe] Could not get tab navigation:", e);
      }

      // Final fallback: Try direct navigate to HomeList
      if (navigation?.navigate) {
        navigation.navigate("HomeList");
        return;
      }

      // If all else fails, use onBack callback
      if (onBack) {
        onBack();
      } else {
        console.error("[PostVibe] All navigation methods failed");
      }
    } catch (error) {
      console.error("[PostVibe] Navigation error:", error);
      // Use onBack as absolute last resort
      if (onBack) {
        onBack();
      }
    }
  };

  const advanceToNextStep = () => {
    if (currentStep < REQUIRED_STEPS - 1) {
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
    // No Extras step - stay on step 5 (final step)
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

  const progress = Math.min((currentStep + 1) / REQUIRED_STEPS, 1);
  // Only show final step when we're on the last required step AND all required fields are filled
  // For bars: barType, crowdLevel, drinksPrice, music are required (bartenderVibe is optional)
  // For clubs: crowdLevel, ratio, line, cover, music are required
  const requiredFieldsValid = isBar
    ? barType && crowdLevel && drinksPrice && music
    : crowdLevel && ratio && line && cover && music;
  const isOnFinalStep = currentStep === REQUIRED_STEPS - 1 && requiredFieldsValid;
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
                {isBar ? (
                  // Bar extras: ratio (optional) and bartender_vibe (optional)
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

                    {/* Bartender Vibe (optional for bars) */}
                    <View style={styles.extrasItem}>
                      <Text style={styles.extrasLabel}>Bartender vibe</Text>
                      <View style={styles.extrasOptionsRow}>
                        {bartenderOptions.map((opt) => (
                          <TouchableOpacity
                            key={opt}
                            style={[
                              styles.extrasChip,
                              bartenderVibe === opt && styles.extrasChipSelected,
                            ]}
                            onPress={() => {
                              setBartenderVibe(bartenderVibe === opt ? null : opt);
                              try {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              } catch (e) {}
                            }}
                          >
                            <Text
                              style={[
                                styles.extrasChipText,
                                bartenderVibe === opt && styles.extrasChipTextSelected,
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
                  // Club extras: stay_duration and tags (existing)
                  <>
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
                  </>
                )}
              </View>
            )}
          </View>
        </View>
      );
    }

    // Regular step content for steps 0-4
    const step = steps[currentStep];
    const hasSelection = step.value !== null;
    
    // Debug logging for music step
    if (step.id === "music") {
      console.log("Music step debug:", {
        currentStep,
        requiredKey: step.id,
        musicValue: music,
        optionsLength: step.options.length,
        options: step.options,
      });
    }
    
    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{step.title}</Text>
        <View style={styles.optionsRow}>
          {step.options.map((opt) => {
            const isSelected = step.value === opt;
            const isLastStep = currentStep === REQUIRED_STEPS - 1;
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
                    // Only auto-advance if NOT on the last step
                    // On the last step, selecting a value will show the confirmation screen via isOnFinalStep
                    // For optional steps (bartender_vibe), also allow advancing to final step
                    // Auto-advance if not on last step
                    // On the last step, selecting a value will show the confirmation screen via isOnFinalStep
                    if (!isLastStep) {
                      // Small delay to show selection animation before advancing
                      setTimeout(() => {
                        advanceToNextStep();
                      }, 200);
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
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.container}>
          {/* Drag Handle */}
          <View style={styles.dragHandleContainer}>
            <View style={styles.dragHandle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.backButton} />
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>Post your vibe 🔥</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={handleCancel}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Error State */}
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
            <Text style={{ color: "#E5E7EB", fontSize: 18, fontWeight: "600", marginBottom: 8, textAlign: "center" }}>
              Invalid Venue Type
            </Text>
            <Text style={{ color: "#9CA3AF", fontSize: 14, marginBottom: 24, textAlign: "center" }}>
              This venue has an invalid or missing type. Please contact support or update the venue information before posting a vibe.
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: "#A855F7",
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 8,
              }}
              onPress={handleCancel}
            >
              <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
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
            drinksPrice={drinksPrice}
            music={music}
            barType={barType}
            bartenderVibe={bartenderVibe}
            stayDuration={stayDuration}
            selectedTags={selectedTags}
            isFinalStep={isOnFinalStep}
            isFormValid={isFormValid}
            isBar={isBar}
            animations={animations}
          />

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
});
