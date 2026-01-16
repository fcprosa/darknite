import React, { useState } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ExploreScreen from "../components/ExploreScreen";
import NeighborhoodScreen from "../components/NeighborhoodScreen";
import NeighborhoodVenuesScreen from "../components/NeighborhoodVenuesScreen";
import ExploreVenueDetailsScreen from "../components/ExploreVenueDetailsScreen";
import AnimatedPostVibeSheet from "../components/AnimatedPostVibeSheet";
import { useAppContext } from "../contexts/AppContext";
import { useAuth } from "../contexts/AuthContext";

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
          {() => (
            <ExploreVenueDetailsScreen
              selectedVenueFromState={selectedVenue}
              onSetSelectedVenue={setSelectedVenue}
              onSetShowPostVibe={setShowPostVibe}
            />
          )}
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
