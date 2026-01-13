import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabsNavigator from "./MainTabsNavigator";
import SettingsScreen from "../components/SettingsScreen";
import ProfileSetupScreen from "../components/ProfileSetupScreen";

const Stack = createNativeStackNavigator();

export default function AppStackNavigator() {
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
      <Stack.Screen name="ProfileSetup">
        {({ navigation, route }) => <ProfileSetupScreen navigation={navigation} route={route} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

