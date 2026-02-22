import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "../contexts/AuthContext";
import { useAppContext } from "../contexts/AppContext";
import { createMove, getMyActiveMove, cancelMyMove } from "../services/moveService";
import { getVenueKeySafe } from "../utils/venueHelpers";

const TIME_BANDS = [
  { id: "early", label: "Early (9pm - 11pm)", emoji: "🌆" },
  { id: "prime", label: "Prime (11pm - 1am)", emoji: "🔥" },
  { id: "late", label: "Late (1am - 3am)", emoji: "🌙" },
  { id: "spontaneous", label: "Spontaneous (whenever)", emoji: "⚡" },
];

export default function SetMoveScreen({ navigation, route }) {
  const { user, isAuthenticated } = useAuth();
  const { venues } = useAppContext();
  const [step, setStep] = useState(1); // 1: venue, 2: time band, 3: confirm
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [selectedTimeBand, setSelectedTimeBand] = useState(null);
  const [loading, setLoading] = useState(false);
  const [existingMove, setExistingMove] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Get venue from route params if provided
  useEffect(() => {
    if (route?.params?.venue) {
      setSelectedVenue(route.params.venue);
      setStep(2); // Skip to time band selection
    }
  }, [route?.params?.venue]);

  // Check for existing active move
  useEffect(() => {
    async function checkExistingMove() {
      if (!isAuthenticated || !user?.id) return;

      const { data } = await getMyActiveMove(user.id);
      if (data) {
        setExistingMove(data);
      }
    }

    checkExistingMove();
  }, [isAuthenticated, user?.id]);

  // Filter venues by search
  const filteredVenues = venues.filter((venue) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = (venue.name || "").toLowerCase().includes(q);
    const neighborhoodMatch = (venue.neighborhood || "").toLowerCase().includes(q);
    return nameMatch || neighborhoodMatch;
  });

  const handleVenueSelect = (venue) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
    setSelectedVenue(venue);
    setStep(2);
  };

  const handleTimeBandSelect = (timeBand) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
    setSelectedTimeBand(timeBand);
    setStep(3);
  };

  const handleConfirm = async () => {
    if (!isAuthenticated || !user?.id || !selectedVenue || !selectedTimeBand) {
      Alert.alert("Error", "Please complete all steps");
      return;
    }

    setLoading(true);

    try {
      // Cancel existing move if any
      if (existingMove) {
        await cancelMyMove(user.id);
      }

      const venueKey = getVenueKeySafe(selectedVenue) || selectedVenue.id;
      const { data, error } = await createMove({
        userId: user.id,
        venueId: venueKey,
        timeBand: selectedTimeBand,
      });

      if (error) {
        Alert.alert("Error", error.message || "Failed to set move");
        setLoading(false);
        return;
      }

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {}

      // Navigate back
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate("HomeList");
      }
    } catch (error) {
      console.error("[SetMove] Error:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 1) {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate("HomeList");
      }
    } else {
      setStep(step - 1);
    }
  };

  const handleCancel = async () => {
    if (!existingMove) return;

    Alert.alert(
      "Cancel Move?",
      "Are you sure you want to cancel your current move?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            await cancelMyMove(user.id);
            setExistingMove(null);
            setLoading(false);
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate("HomeList");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#E5E7EB" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {step === 1 && "Choose Venue"}
          {step === 2 && "When?"}
          {step === 3 && "Confirm"}
        </Text>
        <View style={styles.backButton} />
      </View>

      {/* Progress indicator */}
      <View style={styles.progressContainer}>
        {[1, 2, 3].map((s) => (
          <View
            key={s}
            style={[
              styles.progressDot,
              s <= step && styles.progressDotActive,
            ]}
          />
        ))}
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#A855F7" />
        </View>
      )}

      {/* Step 1: Venue Selection */}
      {step === 1 && (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {existingMove && (
            <View style={styles.existingMoveBanner}>
              <Text style={styles.existingMoveText}>
                You already have an active move. Setting a new one will replace it.
              </Text>
              <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Cancel Current Move</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#94A3B8" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search venues..."
              placeholderTextColor="#64748B"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {filteredVenues.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No venues found</Text>
            </View>
          ) : (
            filteredVenues.map((venue) => (
              <TouchableOpacity
                key={venue.id}
                style={styles.venueItem}
                onPress={() => handleVenueSelect(venue)}
              >
                <View style={styles.venueInfo}>
                  <Text style={styles.venueName}>{venue.name}</Text>
                  {venue.neighborhood && (
                    <Text style={styles.venueNeighborhood}>{venue.neighborhood}</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* Step 2: Time Band Selection */}
      {step === 2 && (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <View style={styles.selectedVenueCard}>
            <Text style={styles.selectedVenueLabel}>Selected Venue</Text>
            <Text style={styles.selectedVenueName}>{selectedVenue?.name}</Text>
            {selectedVenue?.neighborhood && (
              <Text style={styles.selectedVenueNeighborhood}>{selectedVenue.neighborhood}</Text>
            )}
          </View>

          <Text style={styles.sectionTitle}>When are you heading there?</Text>

          {TIME_BANDS.map((band) => (
            <TouchableOpacity
              key={band.id}
              style={[
                styles.timeBandItem,
                selectedTimeBand === band.id && styles.timeBandItemSelected,
              ]}
              onPress={() => handleTimeBandSelect(band.id)}
            >
              <Text style={styles.timeBandEmoji}>{band.emoji}</Text>
              <Text
                style={[
                  styles.timeBandLabel,
                  selectedTimeBand === band.id && styles.timeBandLabelSelected,
                ]}
              >
                {band.label}
              </Text>
              {selectedTimeBand === band.id && (
                <Ionicons name="checkmark-circle" size={24} color="#A855F7" />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Step 3: Confirmation */}
      {step === 3 && (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Confirm Your Move</Text>

            <View style={styles.confirmSection}>
              <Text style={styles.confirmLabel}>Venue</Text>
              <Text style={styles.confirmValue}>{selectedVenue?.name}</Text>
              {selectedVenue?.neighborhood && (
                <Text style={styles.confirmSubValue}>{selectedVenue.neighborhood}</Text>
              )}
            </View>

            <View style={styles.confirmSection}>
              <Text style={styles.confirmLabel}>Time</Text>
              <Text style={styles.confirmValue}>
                {TIME_BANDS.find((b) => b.id === selectedTimeBand)?.label}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleConfirm}
              disabled={loading}
            >
              <Text style={styles.confirmButtonText}>Set Move</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050013",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(168, 85, 247, 0.2)",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    color: "#F9FAFB",
    fontSize: 18,
    fontWeight: "700",
  },
  progressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(168, 85, 247, 0.3)",
  },
  progressDotActive: {
    backgroundColor: "#A855F7",
    width: 24,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(5, 0, 19, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  existingMoveBanner: {
    backgroundColor: "rgba(168, 85, 247, 0.1)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.3)",
  },
  existingMoveText: {
    color: "#E9D5FF",
    fontSize: 14,
    marginBottom: 12,
  },
  cancelButton: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: "flex-start",
  },
  cancelButtonText: {
    color: "#FCA5A5",
    fontSize: 14,
    fontWeight: "600",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(168, 85, 247, 0.1)",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.3)",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: "#F9FAFB",
    fontSize: 16,
    paddingVertical: 12,
  },
  emptyState: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    color: "#94A3B8",
    fontSize: 16,
  },
  venueItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0F0B1E",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.3)",
  },
  venueInfo: {
    flex: 1,
  },
  venueName: {
    color: "#F9FAFB",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  venueNeighborhood: {
    color: "#94A3B8",
    fontSize: 14,
  },
  selectedVenueCard: {
    backgroundColor: "rgba(168, 85, 247, 0.1)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.3)",
  },
  selectedVenueLabel: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  selectedVenueName: {
    color: "#F9FAFB",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  selectedVenueNeighborhood: {
    color: "#94A3B8",
    fontSize: 14,
  },
  sectionTitle: {
    color: "#F9FAFB",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 16,
  },
  timeBandItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F0B1E",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.3)",
  },
  timeBandItemSelected: {
    backgroundColor: "rgba(168, 85, 247, 0.2)",
    borderColor: "#A855F7",
  },
  timeBandEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  timeBandLabel: {
    flex: 1,
    color: "#F9FAFB",
    fontSize: 16,
    fontWeight: "600",
  },
  timeBandLabelSelected: {
    color: "#E9D5FF",
  },
  confirmCard: {
    backgroundColor: "#0F0B1E",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.3)",
  },
  confirmTitle: {
    color: "#F9FAFB",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 24,
    textAlign: "center",
  },
  confirmSection: {
    marginBottom: 20,
  },
  confirmLabel: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  confirmValue: {
    color: "#F9FAFB",
    fontSize: 18,
    fontWeight: "700",
  },
  confirmSubValue: {
    color: "#94A3B8",
    fontSize: 14,
    marginTop: 4,
  },
  confirmButton: {
    backgroundColor: "#A855F7",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
