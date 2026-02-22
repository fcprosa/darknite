import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "../components/HomeScreen";
import VenuePickerScreen from "../components/VenuePickerScreen";
import PostVibeScreen from "../components/PostVibeScreen";
import VenueDetailsLovable from "../components/VenueDetailsLovable";
import AnimatedPostVibeSheet from "../components/AnimatedPostVibeSheet";
import SetMoveScreen from "../screens/SetMoveScreen";
import { useAppContext } from "../contexts/AppContext";
import { useAuth } from "../contexts/AuthContext";

const Stack = createNativeStackNavigator();

export default function HomeStackNavigator() {
  const { venues, refreshKey, setRefreshKey } = useAppContext();
  const { requireAuth, isAuthenticated } = useAuth();
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
        <Stack.Screen name="HomeList">
          {({ navigation }) => {
            const tabNavigation = navigation.getParent();
            return (
              <HomeScreen
                navigation={navigation}
                tabNavigation={tabNavigation}
                venues={venues}
                refreshKey={refreshKey}
                selectedVenue={selectedVenue}
                setSelectedVenue={setSelectedVenue}
                onOpenVenue={(venue) => {
                  setSelectedVenue(venue);
                  navigation.navigate("VenueDetails");
                }}
                onOpenSheet={(venue) => {
                  requireAuth(() => {
                    if (venue) setSelectedVenue(venue);
                    setShowPostVibe(true);
                  });
                }}
              />
            );
          }}
        </Stack.Screen>
        <Stack.Screen name="VenuePicker">
          {({ navigation, route }) => (
            <VenuePickerScreen
              navigation={navigation}
              route={route}
              onOpenSheet={(venue) => {
                setSelectedVenue(venue);
                setShowPostVibe(true);
              }}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="SetMove">
          {({ navigation, route }) => (
            <SetMoveScreen
              navigation={navigation}
              route={route}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="PostVibe">
          {({ navigation, route }) => {
            const params = route.params || {};
            if (!params.venueId && !params.venueName) {
              console.error("[Home] PostVibe opened without venue data, redirecting to picker");
              return (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>Please select a venue</Text>
                  <TouchableOpacity
                    style={styles.errorButton}
                    onPress={() => navigation.replace("VenuePicker")}
                  >
                    <Text style={styles.errorButtonText}>Choose Venue</Text>
                  </TouchableOpacity>
                </View>
              );
            }
            
            const venue = {
              id: params.venueId,
              name: params.venueName,
              venue_type: params.venueType,
              neighborhood: params.neighborhood,
            };
            
            const handleBack = () => {
              if (navigation?.canGoBack?.()) {
                navigation.goBack();
              } else {
                const tabNav = navigation.getParent();
                if (tabNav) {
                  tabNav.navigate("HomeTab");
                } else {
                  navigation.navigate("HomeList");
                }
              }
            };
            
            return (
              <PostVibeScreen
                venue={venue}
                navigation={navigation}
                route={route}
                onBack={handleBack}
                onSuccess={() => {
                  setRefreshKey();
                }}
              />
            );
          }}
        </Stack.Screen>
        <Stack.Screen name="VenueDetails">
          {({ navigation, route }) => {
            const venueFromState = selectedVenue;
            const venueFromParams = route?.params?.venue;
            
            const venue = venueFromState || venueFromParams;
            
            if (!venue) {
              return (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>Venue not found</Text>
                </View>
              );
            }
            
            return (
              <VenueDetailsLovable
                venue={venue}
                navigation={navigation}
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
          route={{ params: { origin: 'home' } }}
          onClose={() => {
            setShowPostVibe(false);
            // Don't clear selectedVenue here - it breaks VenueDetails when dismissing sheet
          }}
          onSuccess={() => {
            setRefreshKey();
            setShowPostVibe(false);
            // Don't clear selectedVenue - user stays on VenueDetails after posting
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
    marginBottom: 16,
  },
  errorButton: {
    backgroundColor: "#A855F7",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorButtonText: {
    color: "#F9FAFB",
    fontWeight: "600",
  },
});

