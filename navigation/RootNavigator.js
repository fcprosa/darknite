import React, { useState, useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { useAppContext } from "../contexts/AppContext";
import AppStackNavigator from "./AppStackNavigator";
import AuthStackNavigator from "./AuthStackNavigator";
import OnboardingScreen, { isOnboardingComplete } from "../components/OnboardingScreen";

export default function RootNavigator() {
  const { session, loading } = useAuth();
  const { guestMode } = useAppContext();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check if user has completed onboarding
  useEffect(() => {
    async function checkOnboarding() {
      try {
        const complete = await isOnboardingComplete();
        setShowOnboarding(!complete);
      } catch (e) {
        console.warn("[RootNavigator] Error checking onboarding:", e);
        setShowOnboarding(false);
      } finally {
        setCheckingOnboarding(false);
      }
    }
    checkOnboarding();
  }, []);

  console.log("[RootNavigator] guestMode:", guestMode, "session:", !!session, "showOnboarding:", showOnboarding);

  // Show loading while checking auth or onboarding
  if (loading || checkingOnboarding) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#A855F7" />
      </View>
    );
  }

  // Show onboarding for first-time users
  if (showOnboarding) {
    return (
      <OnboardingScreen
        onComplete={() => setShowOnboarding(false)}
      />
    );
  }

  if (session) {
    return <AppStackNavigator key="app" />;
  } else if (guestMode) {
    return <AppStackNavigator key="guest" />;
  } else {
    return <AuthStackNavigator key="auth" />;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050013",
  },
});

