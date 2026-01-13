import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { useAppContext } from "../contexts/AppContext";
import AppStackNavigator from "./AppStackNavigator";
import AuthStackNavigator from "./AuthStackNavigator";

export default function RootNavigator() {
  const { session, loading } = useAuth();
  const { guestMode } = useAppContext();

  console.log("[Guest] guestMode:", guestMode, "session:", !!session);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#A855F7" />
      </View>
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

