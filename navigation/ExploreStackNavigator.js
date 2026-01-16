import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ExploreScreen from "../components/ExploreScreen";
import NeighborhoodScreen from "../components/NeighborhoodScreen";
import NeighborhoodVenuesScreen from "../components/NeighborhoodVenuesScreen";
import VenueDetailsLovable from "../components/VenueDetailsLovable";
import AnimatedPostVibeSheet from "../components/AnimatedPostVibeSheet";
import { useAppContext } from "../contexts/AppContext";
import { useAuth } from "../contexts/AuthContext";
import { getVenueById } from "../services/venueService";

const Stack = createNativeStackNavigator();

export default function ExploreStackNavigator() {
  const { refreshKey, setRefreshKey } = useAppContext();
  const { requireAuth } = useAuth();
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [showPostVibe, setShowPostVibe] = useState(false);

  return (
    <>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#050013" },
        }}
      >
        <Stack.Screen name="ExploreList">
          {({ navigation }) => {
            const tabNavigation = navigation.getParent?.() || null;
            return (
              <ExploreScreen
                navigation={navigation}
                tabNavigation={tabNavigation}
                onOpenVenue={(venue) => {
                  setSelectedVenue(venue);
                  navigation.navigate("VenueDetails");
                }}
              />
            );
          }}
        </Stack.Screen>
        <Stack.Screen name="NeighborhoodVenues">
          {({ navigation, route }) => (
            <NeighborhoodVenuesScreen navigation={navigation} route={route} />
          )}
        </Stack.Screen>
        <Stack.Screen name="VenueDetails">
          {({ navigation, route }) => {
            const venueFromState = selectedVenue;
            const venueFromParams = route?.params?.venue;
            const venueIdFromParams = route?.params?.venueId;
            
            const venue = venueFromState || venueFromParams;
            
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
                    console.error("[ExploreStackNavigator] Error fetching venue:", error);
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
                    setSelectedVenue(venue);
                    setShowPostVibe(true);
                  });
                }}
                refreshKey={refreshKey}
              />
            );
          }}
        </Stack.Screen>
      </Stack.Navigator>
      {showPostVibe && selectedVenue && (
        <AnimatedPostVibeSheet
          venue={selectedVenue}
          navigation={null}
          route={{ params: { origin: 'explore' } }}
          onClose={() => setShowPostVibe(false)}
          onSuccess={() => {
            setRefreshKey();
            setShowPostVibe(false);
          }}
        />
      )}
    </>
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

