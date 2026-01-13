import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import HomeStackNavigator from "./HomeStackNavigator";
import ExploreStackNavigator from "./ExploreStackNavigator";
import ProfileScreen from "../components/ProfileScreen";
import { useAppContext } from "../contexts/AppContext";

const Tab = createBottomTabNavigator();

export default function MainTabsNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarIconSize: 24,
        tabBarStyle: {
          backgroundColor: "#0B0625",
          borderTopColor: "rgba(168,85,247,0.3)",
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
        },
        tabBarActiveTintColor: "#A855F7",
        tabBarInactiveTintColor: "#6B7280",
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color, size }) => {
            let numericSize = 24;
            if (typeof size === 'number' && !isNaN(size)) {
              numericSize = size;
            } else if (typeof size === 'string') {
              const parsed = parseInt(size, 10);
              if (!isNaN(parsed)) {
                numericSize = parsed;
              }
            }
            return <Ionicons name="home-outline" size={numericSize} color={color} />;
          },
        }}
      />
      <Tab.Screen
        name="ExploreTab"
        component={ExploreStackNavigator}
        options={{
          tabBarLabel: "Explore",
          tabBarIcon: ({ color, size }) => {
            let numericSize = 24;
            if (typeof size === 'number' && !isNaN(size)) {
              numericSize = size;
            } else if (typeof size === 'string') {
              const parsed = parseInt(size, 10);
              if (!isNaN(parsed)) {
                numericSize = parsed;
              }
            }
            return <Ionicons name="compass-outline" size={numericSize} color={color} />;
          },
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, size }) => {
            let numericSize = 24;
            if (typeof size === 'number' && !isNaN(size)) {
              numericSize = size;
            } else if (typeof size === 'string') {
              const parsed = parseInt(size, 10);
              if (!isNaN(parsed)) {
                numericSize = parsed;
              }
            }
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

