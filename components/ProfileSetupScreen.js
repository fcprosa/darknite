import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Easing,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { getUserProfile, updateProfile, getUserProfileUsername } from "../services/profileService";
import { getNeighborhoods } from "../services/venueService";

const MUSIC_GENRES = [
  "Hip-Hop / R&B",
  "Afrobeats",
  "House / Techno",
  "Reggaeton",
  "Top Hits",
  "Mixed",
];

// Get unique neighborhoods from venues table (we'll fetch these)
const COMMON_NEIGHBORHOODS = [
  "SoHo",
  "Williamsburg",
  "Midtown",
  "Lower East Side",
  "East Village",
  "West Village",
  "Chelsea",
  "Upper East Side",
  "Upper West Side",
  "Brooklyn",
  "Queens",
];

const SCENE_OPTIONS = [
  { value: "bars", label: "Bars" },
  { value: "clubs", label: "Clubs" },
  { value: "both", label: "Both" },
];

// OptionChip component - using simple conditional styling to avoid animation conflicts
function OptionChip({ label, selected, onPress, disabled = false }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        styles.optionChip,
        selected && styles.optionChipSelected,
      ]}
    >
      <Text style={[styles.optionChipText, selected && styles.optionChipTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function ProfileSetupScreen({ navigation, route }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [preferredScene, setPreferredScene] = useState(null);
  const [favoriteGenres, setFavoriteGenres] = useState([]);
  const [favoriteNeighborhoods, setFavoriteNeighborhoods] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState(COMMON_NEIGHBORHOODS);
  
  const fadeAnim = useRef(new Animated.Value(1)).current;
  
  const TOTAL_STEPS = 3;

  // Store existing username to preserve it during save
  const [existingUsername, setExistingUsername] = useState(null);

  // Load existing profile
  useEffect(() => {
    async function loadProfile() {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        const profile = await getUserProfile(user.id);
        if (profile) {
          setExistingUsername(profile.username || null);
          setPreferredScene(profile.preferred_scene || null);
          setFavoriteGenres(profile.favorite_genres || []);
          setFavoriteNeighborhoods(profile.favorite_neighborhoods || []);
        }
        setLoading(false);
      } catch (e) {
        console.error("[ProfileSetup] Error:", e);
        setLoading(false);
      }
    }

    loadProfile();
  }, [user?.id]);

  // Fetch unique neighborhoods from venues
  useEffect(() => {
    async function fetchNeighborhoods() {
      try {
        const unique = await getNeighborhoods();
        if (unique.length > 0) {
          setNeighborhoods(unique);
        }
      } catch (e) {
        console.error("[ProfileSetup] Error fetching neighborhoods:", e);
      }
    }

    fetchNeighborhoods();
  }, []);

  const toggleGenre = (genre) => {
    setFavoriteGenres(prev => {
      if (prev.includes(genre)) {
        return prev.filter(g => g !== genre);
      } else if (prev.length < 3) {
        return [...prev, genre];
      }
      return prev;
    });
  };

  const toggleNeighborhood = (neighborhood) => {
    setFavoriteNeighborhoods(prev => {
      if (prev.includes(neighborhood)) {
        return prev.filter(n => n !== neighborhood);
      } else if (prev.length < 3) {
        return [...prev, neighborhood];
      }
      return prev;
    });
  };

  const handleNext = () => {
    advanceStep();
  };

  const advanceStep = () => {
    if (currentStep < TOTAL_STEPS - 1) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        easing: Easing.ease,
        useNativeDriver: false,
      }).start(() => {
        setCurrentStep(currentStep + 1);
        Animated.timing(fadeAnim, {
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

  const handleSave = async () => {
    if (!user?.id) return;

    // Fetch username if we don't have it (shouldn't happen, but handle gracefully)
    let usernameToSave = existingUsername;
    if (!usernameToSave) {
      try {
        const profile = await getUserProfileUsername(user.id);
        if (!profile || !profile.username) {
          Alert.alert("Error", "Your profile is incomplete. Please contact support.");
          setSaving(false);
          return;
        }
        usernameToSave = profile.username;
      } catch (e) {
        console.error("[ProfileSetup] Error fetching username:", e);
        Alert.alert("Error", "Could not save your profile. Please try again.");
        setSaving(false);
        return;
      }
    }

    setSaving(true);

    try {
      const { error } = await updateProfile({
        id: user.id,
        username: usernameToSave, // Preserve existing username
        preferred_scene: preferredScene || null,
        favorite_genres: favoriteGenres.length > 0 ? favoriteGenres : null,
        favorite_neighborhoods: favoriteNeighborhoods.length > 0 ? favoriteNeighborhoods : null,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error("[ProfileSetup] Error saving profile:", error);
        Alert.alert("Error", error.message || "Failed to save profile. Please try again.");
        setSaving(false);
        return;
      }

      // Navigate back
      navigation.goBack();
    } catch (e) {
      console.error("[ProfileSetup] Error:", e);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#A855F7" />
        </View>
      </View>
    );
  }

  const canProceed = 
    (currentStep === 0 && preferredScene) ||
    (currentStep === 1 && favoriteGenres.length > 0) ||
    (currentStep === 2 && favoriteNeighborhoods.length > 0);

  const progress = (currentStep + 1) / TOTAL_STEPS;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={insets.top}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#F9FAFB" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Profile Setup</Text>
          <Text style={styles.headerSubtitle}>
            Step {currentStep + 1} of {TOTAL_STEPS}
          </Text>
        </View>
        <View style={styles.backButton} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.stepContent, { opacity: fadeAnim }]}>
          {currentStep === 0 && (
            <View style={styles.step}>
              <Text style={styles.stepTitle}>Preferred scene</Text>
              <Text style={styles.stepDescription}>
                What type of venues do you prefer?
              </Text>
              <View style={styles.optionsContainer}>
                {SCENE_OPTIONS.map((option) => (
                  <OptionChip
                    key={option.value}
                    label={option.label}
                    selected={preferredScene === option.value}
                    onPress={() => {
                      // #region agent log
                      fetch('http://127.0.0.1:7242/ingest/cba8ee34-06e8-4e52-ac33-69cdc33161c4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ProfileSetupScreen.js:355',message:'OptionChip onPress',data:{optionValue:option.value,optionLabel:option.label,previousPreferredScene:preferredScene},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                      // #endregion
                      setPreferredScene(option.value);
                    }}
                  />
                ))}
              </View>
            </View>
          )}

          {currentStep === 1 && (
            <View style={styles.step}>
              <Text style={styles.stepTitle}>Favorite music genres</Text>
              <Text style={styles.stepDescription}>
                Select up to 3 genres you love ({favoriteGenres.length}/3)
              </Text>
              <View style={styles.optionsContainer}>
                {MUSIC_GENRES.map((genre) => (
                  <OptionChip
                    key={genre}
                    label={genre}
                    selected={favoriteGenres.includes(genre)}
                    onPress={() => toggleGenre(genre)}
                    disabled={!favoriteGenres.includes(genre) && favoriteGenres.length >= 3}
                  />
                ))}
              </View>
            </View>
          )}

          {currentStep === 2 && (
            <View style={styles.step}>
              <Text style={styles.stepTitle}>Favorite neighborhoods</Text>
              <Text style={styles.stepDescription}>
                Select up to 3 neighborhoods ({favoriteNeighborhoods.length}/3)
              </Text>
              <View style={styles.optionsContainer}>
                {neighborhoods.map((neighborhood) => (
                  <OptionChip
                    key={neighborhood}
                    label={neighborhood}
                    selected={favoriteNeighborhoods.includes(neighborhood)}
                    onPress={() => toggleNeighborhood(neighborhood)}
                    disabled={!favoriteNeighborhoods.includes(neighborhood) && favoriteNeighborhoods.length >= 3}
                  />
                ))}
              </View>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        {currentStep > 0 && (
          <TouchableOpacity style={styles.backButtonFooter} onPress={handleBack}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextButton, (!canProceed || saving) && styles.nextButtonDisabled]}
          onPress={currentStep === TOTAL_STEPS - 1 ? handleSave : handleNext}
          disabled={!canProceed || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.nextButtonText}>
              {currentStep === TOTAL_STEPS - 1 ? "Save" : "Next"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050013",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(168,85,247,0.2)",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F9FAFB",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  progressBarContainer: {
    height: 3,
    backgroundColor: "rgba(168,85,247,0.1)",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#A855F7",
  },
  content: {
    flex: 1,
  },
  stepContent: {
    padding: 20,
  },
  step: {
    minHeight: 400,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#F9FAFB",
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 16,
    color: "#9CA3AF",
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 24,
  },
  input: {
    backgroundColor: "#0B0625",
    borderRadius: 12,
    padding: 16,
    color: "#F9FAFB",
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.3)",
  },
  inputError: {
    borderColor: "#EF4444",
  },
  inputHint: {
    color: "#9CA3AF",
    fontSize: 12,
    marginTop: 8,
  },
  inputErrorText: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: 8,
  },
  suggestionsContainer: {
    marginTop: 12,
  },
  suggestionsLabel: {
    color: "#9CA3AF",
    fontSize: 12,
    marginBottom: 8,
  },
  suggestionsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: "rgba(168,85,247,0.1)",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  suggestionText: {
    color: "#A855F7",
    fontSize: 12,
    fontWeight: "500",
  },
  optionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  optionChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.3)",
    backgroundColor: "transparent",
    minWidth: 100,
    alignItems: "center",
  },
  optionChipSelected: {
    borderColor: "#A855F7",
    backgroundColor: "#A855F7",
  },
  optionChipText: {
    color: "#E5E7EB",
    fontSize: 15,
    fontWeight: "500",
  },
  optionChipTextSelected: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    padding: 16,
    paddingBottom: 32,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(168,85,247,0.2)",
  },
  backButtonFooter: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.3)",
  },
  backButtonText: {
    color: "#A855F7",
    fontSize: 16,
    fontWeight: "600",
  },
  nextButton: {
    flex: 2,
    backgroundColor: "#A855F7",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

