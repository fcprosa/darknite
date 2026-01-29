import React, { useEffect } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabsNavigator from "./MainTabsNavigator";
import SettingsScreen from "../components/SettingsScreen";
import ProfileSetupScreen from "../components/ProfileSetupScreen";
import VibeReportScreen from "../components/VibeReportScreen";
import PrivacySettingsScreen from "../screens/PrivacySettingsScreen";
import NotificationSettingsScreen from "../screens/NotificationSettingsScreen";
import PrivacyPolicyScreen from "../screens/PrivacyPolicyScreen";
import TermsOfServiceScreen from "../screens/TermsOfServiceScreen";
import { addNotificationResponseListener } from "../services/notificationService";
import { navigationRef } from "./navigationService";

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

    // ✅ remove o listener quando faz sign out / unmount
    return unsubscribe;
  }, []);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#050013" },
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
    </Stack.Navigator>
  );
}
