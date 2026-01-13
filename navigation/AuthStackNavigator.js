import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LandingScreen from "../components/LandingScreen";

const Stack = createNativeStackNavigator();

export default function AuthStackNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Landing"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#050013" },
      }}
    >
      <Stack.Screen name="Landing">
        {({ navigation }) => <LandingScreen />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

