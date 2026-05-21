import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import MapScreen from "../components/MapScreen";
import ProfileScreen from "../components/ProfileScreen";
import { useAppContext } from "../contexts/AppContext";
import { COLORS } from "../constants";

const Tab = createBottomTabNavigator();

export default function MainTabsNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="MapTab"
      screenOptions={{
        headerShown: false,
        tabBarIconSize: 24,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
      }}
    >
      <Tab.Screen
        name="MapTab"
        component={MapScreen}
        options={{
          tabBarLabel: "Map",
          tabBarIcon: ({ color, size }) => {
            const numericSize = typeof size === "number" && !isNaN(size) ? size : 24;
            return <Ionicons name="map-outline" size={numericSize} color={color} />;
          },
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, size }) => {
            const numericSize = typeof size === "number" && !isNaN(size) ? size : 24;
            return <Ionicons name="person-outline" size={numericSize} color={color} />;
          },
        }}
      >
        {({ navigation }) => {
          const { guestMode } = useAppContext();
          return <ProfileScreen navigation={navigation} isGuest={guestMode} />;
        }}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
