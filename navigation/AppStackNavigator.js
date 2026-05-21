import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabsNavigator from "./MainTabsNavigator";
import SettingsScreen from "../components/SettingsScreen";
import ProfileSetupScreen from "../components/ProfileSetupScreen";
import VibeReportScreen from "../components/VibeReportScreen";
import PostVibeScreen from "../components/PostVibeScreen";
import AchievementsScreen from "../components/AchievementsScreen";
import LeaderboardScreen from "../components/LeaderboardScreen";
import VenueVibesScreen from "../components/VenueVibesScreen";
import PrivacySettingsScreen from "../screens/PrivacySettingsScreen";
import NotificationSettingsScreen from "../screens/NotificationSettingsScreen";
import PrivacyPolicyScreen from "../screens/PrivacyPolicyScreen";
import TermsOfServiceScreen from "../screens/TermsOfServiceScreen";
import { addNotificationResponseListener } from "../services/notificationService";
import { navigationRef } from "./navigationService";
import { useAppContext } from "../contexts/AppContext";
import { COLORS } from "../constants";

const Stack = createNativeStackNavigator();

export default function AppStackNavigator() {
  useEffect(() => {
    const unsubscribe = addNotificationResponseListener((data) => {
      if (data?.type === "vibe_reminder" && navigationRef?.isReady?.()) {
        navigationRef.navigate("VibeReport", {
          venueId: data?.venueId,
          venueName: data?.venueName,
        });
      }
    });

    return unsubscribe;
  }, []);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Stack.Screen
        name="MainTabs"
        component={MainTabsNavigator}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="Settings">
        {({ navigation }) => <SettingsScreen navigation={navigation} />}
      </Stack.Screen>
      <Stack.Screen name="PrivacySettings">
        {({ navigation }) => <PrivacySettingsScreen navigation={navigation} />}
      </Stack.Screen>
      <Stack.Screen name="NotificationSettings">
        {({ navigation }) => <NotificationSettingsScreen navigation={navigation} />}
      </Stack.Screen>
      <Stack.Screen name="ProfileSetup">
        {({ navigation, route }) => (
          <ProfileSetupScreen navigation={navigation} route={route} />
        )}
      </Stack.Screen>
      <Stack.Screen name="PostVibe">
        {({ navigation, route }) => (
          <PostVibeScreenWrapper navigation={navigation} route={route} />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="VibeReport"
        component={VibeReportScreen}
        options={{
          presentation: "modal",
          headerShown: false,
        }}
      />
      <Stack.Screen name="PrivacyPolicy">
        {({ navigation }) => <PrivacyPolicyScreen navigation={navigation} />}
      </Stack.Screen>
      <Stack.Screen name="TermsOfService">
        {({ navigation }) => <TermsOfServiceScreen navigation={navigation} />}
      </Stack.Screen>
      <Stack.Screen
        name="Achievements"
        component={AchievementsScreen}
        options={{ presentation: "modal" }}
      />
      <Stack.Screen
        name="Leaderboard"
        component={LeaderboardScreen}
        options={{ presentation: "modal" }}
      />
      <Stack.Screen
        name="VenueVibes"
        component={VenueVibesScreen}
      />
    </Stack.Navigator>
  );
}

function PostVibeScreenWrapper({ navigation, route }) {
  const { setRefreshKey } = useAppContext();
  const params = route.params || {};

  if (params.venue) {
    return (
      <PostVibeScreen
        venue={params.venue}
        navigation={navigation}
        route={route}
        onBack={() => {
          if (navigation?.canGoBack?.()) {
            navigation.goBack();
          } else {
            navigation.navigate("MainTabs", { screen: "MapTab" });
          }
        }}
        onSuccess={() => setRefreshKey()}
      />
    );
  }

  if (!params.venueId && !params.venueName) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Please select a venue</Text>
        <TouchableOpacity
          style={styles.errorButton}
          onPress={() => navigation.navigate("MainTabs", { screen: "MapTab" })}
        >
          <Text style={styles.errorButtonText}>Back to Map</Text>
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

  return (
    <PostVibeScreen
      venue={venue}
      navigation={navigation}
      route={route}
      onBack={() => {
        if (navigation?.canGoBack?.()) {
          navigation.goBack();
        } else {
          navigation.navigate("MainTabs", { screen: "MapTab" });
        }
      }}
      onSuccess={() => setRefreshKey()}
    />
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  errorText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: 16,
  },
  errorButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorButtonText: {
    color: COLORS.textPrimary,
    fontWeight: "600",
  },
});
