import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import VenueDetailsLovable from "./VenueDetailsLovable";
import { useAppContext } from "../contexts/AppContext";
import { useAuth } from "../contexts/AuthContext";
import { getVenueById } from "../services/venueService";

export default function ExploreVenueDetailsScreen({ selectedVenueFromState, onSetSelectedVenue, onSetShowPostVibe }) {
  const route = useRoute();
  const navigation = useNavigation();
  const { refreshKey } = useAppContext();
  const { requireAuth } = useAuth();

  const venueFromParams = route?.params?.venue;
  const venueIdFromParams = route?.params?.venueId;
  const venue = selectedVenueFromState || venueFromParams;

  const [fetchedVenue, setFetchedVenue] = useState(null);
  const [fetchingVenue, setFetchingVenue] = useState(false);

  useEffect(() => {
    if (!venue && venueIdFromParams && !fetchingVenue) {
      setFetchingVenue(true);
      getVenueById(venueIdFromParams)
        .then((venueData) => {
          if (venueData) {
            setFetchedVenue({
              ...venueData,
              neighborhood: venueData.neighborhood || "Unknown",
            });
          }
          setFetchingVenue(false);
        })
        .catch((error) => {
          console.error("[ExploreVenueDetailsScreen] Error fetching venue:", error);
          setFetchingVenue(false);
        });
    }
  }, [venue, venueIdFromParams, fetchingVenue]);

  const finalVenue = venue || fetchedVenue;

  if (!finalVenue) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Loading venue...</Text>
      </View>
    );
  }

  return (
    <VenueDetailsLovable
      venue={finalVenue}
      onBack={() => navigation.goBack()}
      onOpenSheet={(venue) => {
        requireAuth(() => {
          onSetSelectedVenue(venue);
          onSetShowPostVibe(true);
        });
      }}
      refreshKey={refreshKey}
    />
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#050013",
  },
  errorText: {
    color: "#F9FAFB",
    fontSize: 16,
  },
});
