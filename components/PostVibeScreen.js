/**
 * PostVibe / I'm Here Flow
 * 
 * Replaces the old multi-step PostVibe flow with a fast 3-step structured vibe report.
 * 
 * Bar flow:  Crowd → Music → Extras (Drinks, Crowd vibe, Age) → Confirmation
 * Club flow: Crowd → Line  → Extras (Music, Cover, Crowd vibe, Age) → Confirmation
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { useAppContext } from "../contexts/AppContext";
import { createVibe } from "../services/vibeService";
import { mapCoverPriceToDB } from "../utils/priceMapping";

// ════════════════════════════════════════════════════════════
// OPTION CONFIGS — DO NOT ADD MORE STEPS OR OPTIONS
// ════════════════════════════════════════════════════════════

const CROWD_OPTIONS = [
  { value: "Dead",   emoji: "💀", label: "Dead",   sub: "Empty, barely anyone" },
  { value: "Chill",  emoji: "😌", label: "Chill",  sub: "Relaxed, room to breathe" },
  { value: "Fun",    emoji: "😄", label: "Fun",    sub: "Good energy, filling up" },
  { value: "Packed", emoji: "🔥", label: "Packed", sub: "Shoulder to shoulder" },
  { value: "Chaos",  emoji: "🤯", label: "Chaos",  sub: "Can barely move" },
];

const MUSIC_OPTIONS = [
  { value: "Hip-Hop / R&B",     label: "Hip-Hop / R&B" },
  { value: "House / Techno",    label: "House / Techno" },
  { value: "Afrobeats",         label: "Afrobeats" },
  { value: "Latin / Reggaeton", label: "Latin / Reggaeton" },
  { value: "Pop / Top Hits",    label: "Pop / Top Hits" },
  { value: "Indie / Rock",      label: "Indie / Rock" },
  { value: "Mixed",             label: "Mixed" },
];

const LINE_OPTIONS = [
  { value: "No line",       emoji: "✅", label: "No line",       sub: "Walk right in" },
  { value: "Short wait",    emoji: "⏱️", label: "Short wait",   sub: "5-10 minutes" },
  { value: "Long line",     emoji: "😤", label: "Long line",     sub: "15+ minutes" },
  { value: "Not worth it",  emoji: "🚫", label: "Not worth it", sub: "Go somewhere else" },
];

const DRINKS_OPTIONS = [
  { value: "cheap",   label: "$ Cheap" },
  { value: "moderate", label: "$$ Moderate" },
  { value: "pricey",  label: "$$$ Pricey" },
  { value: "expensive",   label: "$$$$ Expensive" },
];

const COVER_OPTIONS = [
  { value: "Free",    label: "Free" },
  { value: "$10-20",  label: "$10-20" },
  { value: "$20-30",  label: "$20-30" },
  { value: "$30+",    label: "$30+" },
];

const RATIO_OPTIONS = [
  { value: "mostly_guys",  emoji: "👦", label: "Mostly guys" },
  { value: "mostly_girls", emoji: "👩", label: "Mostly girls" },
  { value: "good_mix",     emoji: "✨", label: "Good mix" },
  { value: "couples",      emoji: "💑", label: "Couples night" },
];

const AGE_OPTIONS = [
  { value: "18–25", emoji: "🎓", label: "Young (21-25)" },
  { value: "Mixed", emoji: "🎯", label: "Mixed ages" },
  { value: "35+", emoji: "🥂", label: "Older (30+)" },
];

// ════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════

export default function PostVibeScreen({ venue, navigation: navigationProp, onBack, onSuccess, route }) {
  // ── Extract venue info from route params or props ──
  const params = route?.params || {};
  const placeId =
    venue?.place_id ||
    venue?.id ||
    params.placeId ||
    params.place_id ||
    params.id;
  const venueName =
    venue?.name || params.placeName || params.place_name || params.name || "this spot";
  const venueType = (
    venue?.venue_type || params.venueType || params.venue_type || "bar"
  ).toLowerCase();
  const isClub = venueType === "club";

  // ── Use navigation prop or hook ──
  const navigation = navigationProp || route?.navigation;

  // ── Auth & context ──
  const { user } = useAuth();
  const { vibesByPlaceId, upsertVibeForPlace } = useAppContext();
  const insets = useSafeAreaInsets();

  // ── Step state (1-4) ──
  const [step, setStep] = useState(1);

  // ── Data state ──
  const [crowd, setCrowd] = useState(null);
  const [music, setMusic] = useState(null);
  const [line, setLine] = useState(null);
  const [drinksTier, setDrinksTier] = useState(null);
  const [cover, setCover] = useState(null);
  const [crowdVibe, setCrowdVibe] = useState(null);
  const [ageRange, setAgeRange] = useState(null);

  // ── Submit state ──
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  // Ref-based guard prevents double-tap / concurrent submits that slip past the
  // state-based check (React state batching can allow two taps through before
  // the re-render updates `submitting` to true).
  const isSubmittingRef = useRef(false);

  // ── Rate-limit state ──
  // Set when the RPC returns a rate limit error; kept for the lifetime of this
  // screen instance so the button stays disabled without further server calls.
  const [rateLimitInfo, setRateLimitInfo] = useState(null); // { type: 'venue'|'global', minutesRemaining: number|null }
  const [toastVisible, setToastVisible] = useState(false);
  const toastFade = useRef(new Animated.Value(0)).current;
  const toastTimerRef = useRef(null);

  // ── Confirmation state ──
  const [previousVibeForConfirm, setPreviousVibeForConfirm] = useState(null);
  const [tonightVibeCount, setTonightVibeCount] = useState(1);

  // ── Animation ──
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // ── Toast helper ──
  const showRateLimitToast = useCallback((info) => {
    setRateLimitInfo(info);
    setToastVisible(true);
    toastFade.setValue(0);
    Animated.timing(toastFade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      Animated.timing(toastFade, { toValue: 0, duration: 300, useNativeDriver: true }).start(() =>
        setToastVisible(false)
      );
    }, 4500);
  }, [toastFade]);

  // Cleanup toast timer on unmount
  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  const goToStep = useCallback((nextStep) => {
      Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -20, duration: 100, useNativeDriver: true }),
    ]).start(() => {
      setStep(nextStep);
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    });
  }, [fadeAnim, slideAnim]);

  // ── Confirmation message helpers ──
  function getOrdinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  /**
   * Generate a contextual confirmation message based on tonight's vibe state.
   *
   * @param {string|null} crowd
   * @param {string} venueName
   * @param {Object|null} previousVibe
   * @param {number} tonightVibeCount
   */
  function getConfirmationMessage(crowd, venueName, previousVibe, tonightVibeCount) {
    // Case 1: First vibe of the night
    if (tonightVibeCount <= 1) {
      return {
        emoji: "🔥",
        title: "First report tonight",
        subtitle: `You lit up ${venueName}`,
      };
    }

    // Case 2: Agree with previous vibe
    if (previousVibe?.crowd && crowd && previousVibe.crowd === crowd) {
      return {
        emoji: "✅",
        title: "Confirmed",
        subtitle: `${tonightVibeCount} people agree: ${crowd}`,
      };
    }

    // Case 3: Vibe changed vs previous
    if (previousVibe?.crowd && crowd && previousVibe.crowd !== crowd) {
      return {
        emoji: "🔄",
        title: "Vibe updated",
        subtitle: `${venueName}: ${previousVibe.crowd} → ${crowd}`,
      };
    }

    // Fallback
    return {
      emoji: "🔥",
      title: `${getOrdinal(tonightVibeCount)} check-in tonight`,
      subtitle: `${venueName} is heating up`,
    };
  }

  // ── Submit handler ──
  const submitVibe = useCallback(async () => {
    // Ref-based guard: synchronous check that fires before React re-renders,
    // preventing duplicate DB writes from rapid double-taps.
    if (isSubmittingRef.current) return;

    // Local rate-limit guard: if we already received a rate limit this session,
    // re-show the toast instead of hitting the server again.
    if (rateLimitInfo) {
      showRateLimitToast(rateLimitInfo);
      return;
    }

    if (!user?.id || !placeId) {
      if (!user?.id) {
        Alert.alert("Sign in required", "Please sign in to post a vibe.");
      }
      return;
    }

    isSubmittingRef.current = true;
    setSubmitting(true);
    setError(null);

    // Capture previous vibe BEFORE submitting (for confirmation UI)
    const prevVibe = vibesByPlaceId?.[placeId] || null;

    try {
      // Map cover UI label to DB value for clubs
      const dbCover = cover ? mapCoverPriceToDB(cover) : null;

      const vibeData = {
        venue_id: placeId,
        user_id: user.id,
        crowd: crowd,
        music: music || null,
        line: line || null,
        cover: dbCover,
        drinks_price_tier: drinksTier || null,
        crowd_vibe: crowdVibe || null,
        age_range: ageRange || null,
      };

      const result = await createVibe(vibeData);

      if (result?.error) {
        if (result.rateLimitType) {
          showRateLimitToast({
            type: result.rateLimitType,
            minutesRemaining: result.minutesRemaining,
          });
          return;
        }
        const errorMessage = result?.userMessage || "Failed to post. Try again.";
        setError(errorMessage);
        return;
      }

      // Update feed cache
      if (result?.data && upsertVibeForPlace) {
        upsertVibeForPlace({ ...result.data, place_id: placeId });
      }

      // Save previous vibe for confirmation UI
      setPreviousVibeForConfirm(prevVibe);

      // Approximate tonight count: 1st vs 2nd+ vibe in last 8h
      let count = 1;
      if (prevVibe?.created_at) {
        const prevMs = Date.now() - new Date(prevVibe.created_at).getTime();
        const eightHoursMs = 8 * 60 * 60 * 1000;
        if (prevMs < eightHoursMs) {
          count = 2;
        }
      }
      setTonightVibeCount(count);

      // Call onSuccess if provided
      if (onSuccess) {
        onSuccess(result?.data);
      }

      // Show confirmation, then auto-dismiss
      goToStep(4);
      setTimeout(() => {
        if (onBack) {
          onBack();
        } else if (navigation?.canGoBack?.()) {
          navigation.goBack();
        }
      }, 1500);
    } catch (err) {
      console.error("[ImHereFlow] Submit error:", err);
      setError("Something went wrong.");
    } finally {
      // Always reset the ref so recovery from errors re-enables the button
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  }, [crowd, music, line, cover, drinksTier, crowdVibe, ageRange, placeId, user, navigation, goToStep, upsertVibeForPlace, onBack, onSuccess, vibesByPlaceId, rateLimitInfo, showRateLimitToast]);

  // ════════════════════════════════════════════════════════════
  // STEP 1: CROWD (mandatory, both types)
  // ════════════════════════════════════════════════════════════
  const renderStep1 = () => (
    <View style={s.body}>
      <Text style={s.question}>How's the crowd?</Text>
      <Text style={s.subtitle}>at {venueName}</Text>
      <View style={s.options}>
        {CROWD_OPTIONS.map((o) => (
          <TouchableOpacity
            key={o.value}
            style={[s.optionRow, crowd === o.value && s.optionRowActive]}
            onPress={() => { setCrowd(o.value); goToStep(2); }}
            activeOpacity={0.7}
          >
            <Text style={s.optionEmoji}>{o.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.optionLabel, crowd === o.value && s.optionLabelActive]}>{o.label}</Text>
            </View>
            <Text style={s.optionSub}>{o.sub}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // ════════════════════════════════════════════════════════════
  // STEP 2: MUSIC (bars) or LINE (clubs)
  // ════════════════════════════════════════════════════════════
  const renderStep2 = () => {
    if (isClub) {
      return (
        <View style={s.body}>
          <Text style={s.question}>How's the line?</Text>
          <Text style={s.subtitle}>at {venueName}</Text>
          <View style={s.options}>
            {LINE_OPTIONS.map((o) => (
                          <TouchableOpacity
                key={o.value}
                style={[s.optionRow, line === o.value && s.optionRowActive]}
                onPress={() => { setLine(o.value); goToStep(3); }}
                activeOpacity={0.7}
              >
                <Text style={s.optionEmoji}>{o.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.optionLabel, line === o.value && s.optionLabelActive]}>{o.label}</Text>
                </View>
                <Text style={s.optionSub}>{o.sub}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
      );
    }

    // Bar: music
    return (
      <View style={s.body}>
        <Text style={s.question}>What's playing?</Text>
        <Text style={s.subtitle}>at {venueName}</Text>
        <View style={s.chipGrid}>
          {MUSIC_OPTIONS.map((o) => (
                          <TouchableOpacity
              key={o.value}
              style={[s.musicChip, music === o.value && s.musicChipActive]}
              onPress={() => { setMusic(o.value); goToStep(3); }}
              activeOpacity={0.7}
            >
              <Text style={[s.musicChipText, music === o.value && s.musicChipTextActive]}>
                {o.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
    );
  };

  // ════════════════════════════════════════════════════════════
  // STEP 3: OPTIONAL EXTRAS (different per type)
  // ════════════════════════════════════════════════════════════
  const renderStep3 = () => (
    <ScrollView style={s.body} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <Text style={s.question}>Anything else?</Text>
      <Text style={s.subtitle}>Optional — tap what you know, skip the rest</Text>

      {/* CLUB EXTRAS: Cover */}
      {isClub && (
        <>
          <Text style={s.sectionLabel}>💰 Cover</Text>
          <View style={s.chipGrid}>
            {COVER_OPTIONS.map((o) => (
                          <TouchableOpacity
                key={o.value}
                style={[s.extraChip, cover === o.value && s.extraChipActive]}
                onPress={() => setCover(o.value)}
                activeOpacity={0.7}
              >
                <Text style={[s.extraChipText, cover === o.value && s.extraChipTextActive]}>{o.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                  </>
                )}

      {/* BAR EXTRAS: Drinks */}
      {!isClub && (
        <>
          <Text style={s.sectionLabel}>💵 Drinks</Text>
          <View style={s.chipGrid}>
            {DRINKS_OPTIONS.map((o) => (
                          <TouchableOpacity
                key={o.value}
                style={[s.extraChip, drinksTier === o.value && s.extraChipActive]}
                onPress={() => setDrinksTier(o.value)}
                activeOpacity={0.7}
              >
                <Text style={[s.extraChipText, drinksTier === o.value && s.extraChipTextActive]}>{o.label}</Text>
                          </TouchableOpacity>
                        ))}
                    </View>
                  </>
                )}

      {/* BOTH: Crowd vibe */}
      <Text style={s.sectionLabel}>✨ Crowd vibe</Text>
      <View style={s.chipGrid}>
        {RATIO_OPTIONS.map((o) => (
          <TouchableOpacity
            key={o.value}
            style={[s.extraChip, crowdVibe === o.value && s.extraChipActive]}
            onPress={() => setCrowdVibe(o.value)}
            activeOpacity={0.7}
          >
            <Text style={[s.extraChipText, crowdVibe === o.value && s.extraChipTextActive]}>
              {o.emoji} {o.label}
              </Text>
            </TouchableOpacity>
        ))}
        </View>

      {/* BOTH: Age range */}
      <Text style={s.sectionLabel}>🎯 Age range</Text>
      <View style={s.chipGrid}>
        {AGE_OPTIONS.map((o) => (
          <TouchableOpacity
            key={o.value}
            style={[s.extraChip, ageRange === o.value && s.extraChipActive]}
            onPress={() => setAgeRange(o.value)}
            activeOpacity={0.7}
          >
            <Text style={[s.extraChipText, ageRange === o.value && s.extraChipTextActive]}>
              {o.emoji} {o.label}
              </Text>
            </TouchableOpacity>
        ))}
          </View>

      {/* ACTION BUTTONS */}
      <View style={s.actions}>
        <TouchableOpacity
          style={[s.skipBtn, (submitting || !!rateLimitInfo) && { opacity: 0.45 }]}
          onPress={submitVibe}
          activeOpacity={0.7}
          disabled={submitting || !!rateLimitInfo}
        >
          <Text style={s.skipBtnText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.doneBtn, (submitting || !!rateLimitInfo) && { opacity: 0.45 }]}
          onPress={submitVibe}
          activeOpacity={0.7}
          disabled={submitting || !!rateLimitInfo}
        >
          <Text style={s.doneBtnText}>
            {submitting ? "Posting..." : rateLimitInfo ? "Cooldown Active" : "Done ✓"}
          </Text>
        </TouchableOpacity>
      </View>

      {error && <Text style={s.error}>{error}</Text>}
    </ScrollView>
  );

  // ════════════════════════════════════════════════════════════
  // STEP 4: CONFIRMATION (auto-dismiss)
  // ════════════════════════════════════════════════════════════
  const renderStep4 = () => {
    const confirmation = getConfirmationMessage(
      crowd,
      venueName,
      previousVibeForConfirm,
      tonightVibeCount
    );

    return (
      <View style={s.confirmWrap}>
        <Text style={{ fontSize: 64 }}>{confirmation.emoji}</Text>
        <Text style={s.confirmTitle}>{confirmation.title}</Text>
        <Text style={s.confirmSub}>{confirmation.subtitle}</Text>
        </View>
    );
  };

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════
  const handleBack = () => {
    if (step > 1) {
      goToStep(step - 1);
    } else {
      if (onBack) {
        onBack();
      } else if (navigation?.canGoBack?.()) {
        navigation.goBack();
      }
    }
  };

  const handleClose = () => {
    if (onBack) {
      onBack();
    } else if (navigation?.canGoBack?.()) {
      navigation.goBack();
    }
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* HEADER — only on steps 1-3 */}
      {step <= 3 && (
        <View style={s.header}>
          <TouchableOpacity
            onPress={handleBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name={step > 1 ? "arrow-back" : "close"} size={24} color="#9CA3AF" />
              </TouchableOpacity>

          {/* Progress: 3 dots */}
          <View style={s.dots}>
            {[1, 2, 3].map((n) => (
              <View
                key={n}
                  style={[
                  s.dot,
                  n <= step && s.dotDone,
                  n === step && s.dotCurrent,
                ]}
              />
            ))}
              </View>

              <TouchableOpacity
            onPress={handleClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          )}

      {/* ANIMATED STEP CONTENT */}
      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </Animated.View>

      {/* RATE-LIMIT TOAST */}
      {toastVisible && rateLimitInfo && (
        <Animated.View style={[s.toast, { opacity: toastFade }]}>
          <Text style={s.toastTitle}>
            {rateLimitInfo.type === "speed"
              ? "Moving too fast! 🏃‍♂️"
              : rateLimitInfo.type === "venue"
              ? "Vibe Check on Cooldown ⏳"
              : "Night Owl Limit Reached 🦉"}
          </Text>
          <Text style={s.toastBody}>
            {rateLimitInfo.type === "speed"
              ? `You just dropped a vibe. Walk to the next spot and try again in ${rateLimitInfo.minutesRemaining} min${rateLimitInfo.minutesRemaining !== 1 ? "s" : ""}.`
              : rateLimitInfo.type === "venue"
              ? `You just updated the vibe here! Let the dust settle. Try again in ${rateLimitInfo.minutesRemaining} min${rateLimitInfo.minutesRemaining !== 1 ? "s" : ""}.`
              : "You've been everywhere tonight! Take a breather. You can drop more vibes tomorrow."}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

// ════════════════════════════════════════════════════════════
// STYLES
// ════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0614",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dots: { flexDirection: "row", gap: 8 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(168,85,247,0.2)",
  },
  dotDone: {
    backgroundColor: "rgba(168,85,247,0.5)",
  },
  dotCurrent: {
    width: 24,
    borderRadius: 4,
    backgroundColor: "#A855F7",
  },

  // ── Body ──
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  question: {
    fontSize: 28,
    fontWeight: "800",
    color: "#F5F3FF",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: "#9CA3AF",
    fontWeight: "500",
    marginTop: 4,
    marginBottom: 24,
  },

  // ── Option rows (Step 1 & 2 line) ──
  options: { gap: 10 },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(168,85,247,0.08)",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.2)",
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  optionRowActive: {
    backgroundColor: "rgba(168,85,247,0.2)",
    borderColor: "#A855F7",
  },
  optionEmoji: { fontSize: 24, width: 32, textAlign: "center" },
  optionLabel: { fontSize: 17, fontWeight: "700", color: "#E5E7EB" },
  optionLabelActive: { color: "#F5F3FF" },
  optionSub: { fontSize: 12, color: "#6B7280", fontWeight: "500" },

  // ── Music chips (Step 2 bar) ──
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  musicChip: {
    backgroundColor: "rgba(168,85,247,0.08)",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.2)",
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  musicChipActive: {
    backgroundColor: "rgba(168,85,247,0.25)",
    borderColor: "#A855F7",
  },
  musicChipText: { fontSize: 15, fontWeight: "600", color: "#D1D5DB" },
  musicChipTextActive: { color: "#F3E8FF", fontWeight: "700" },

  // ── Extras (Step 3) ──
  sectionLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#D1D5DB",
    marginTop: 18,
    marginBottom: 8,
  },
  extraChip: {
    backgroundColor: "rgba(148,163,184,0.08)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  extraChipActive: {
    backgroundColor: "rgba(168,85,247,0.2)",
    borderColor: "#A855F7",
  },
  extraChipText: { fontSize: 13, fontWeight: "600", color: "#9CA3AF" },
  extraChipTextActive: { color: "#E9D5FF" },

  // ── Action buttons ──
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  skipBtn: {
    flex: 1,
    backgroundColor: "rgba(148,163,184,0.1)",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
  },
  skipBtnText: { fontSize: 16, fontWeight: "600", color: "#9CA3AF" },
  doneBtn: {
    flex: 2,
    backgroundColor: "#A855F7",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  doneBtnText: { fontSize: 16, fontWeight: "700", color: "#FFF" },
  error: { color: "#EF4444", fontSize: 13, textAlign: "center", marginTop: 12 },

  // ── Confirmation ──
  confirmWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 80,
  },
  confirmTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#F5F3FF",
    marginTop: 16,
  },
  confirmSub: {
    fontSize: 15,
    color: "#9CA3AF",
    marginTop: 8,
    fontWeight: "500",
  },

  // ── Rate-limit Toast ──
  toast: {
    position: "absolute",
    bottom: 36,
    left: 20,
    right: 20,
    backgroundColor: "#1A0D2E",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.4)",
    paddingVertical: 16,
    paddingHorizontal: 18,
    shadowColor: "#A855F7",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  toastTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#E9D5FF",
    marginBottom: 4,
  },
  toastBody: {
    fontSize: 13,
    fontWeight: "500",
    color: "#9CA3AF",
    lineHeight: 18,
  },
});
