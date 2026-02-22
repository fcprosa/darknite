// Initialize Sentry as early as possible
import './utils/sentry';
import { getSentry } from './utils/sentry';

import React, { useRef, useEffect } from "react";
import { View, StyleSheet, StatusBar } from "react-native";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AppProvider, useAppContext } from "./contexts/AppContext";
import { NetworkProvider } from "./contexts/NetworkContext";
import RootNavigator from "./navigation/RootNavigator";
import AuthModal from "./components/AuthModal";
import OfflineBanner from "./components/OfflineBanner";
import { navigationRef } from "./navigation/navigationService";
import { addNotificationResponseListener } from "./services/notificationService";

// Get Sentry instance for wrapping
const Sentry = getSentry();

// Component to manage guest mode based on auth state
function SignOutGuestReset() {
  const { session, loading } = useAuth();
  const { setGuestMode, guestMode } = useAppContext();
  const prevSessionRef = useRef(session);
  
  useEffect(() => {
    if (loading) return;
    
    if (session && guestMode) {
      console.log("[SignOutGuestReset] User authenticated - clearing guest mode");
      setGuestMode(false);
    }
    
    if (!session && prevSessionRef.current && guestMode) {
      console.log("[SignOutGuestReset] User signed out - resetting guest mode");
      setGuestMode(false);
    }
    
    prevSessionRef.current = session;
  }, [session, loading, guestMode, setGuestMode]);
  
  return null;
}

// Wrapper to access auth context and show modal globally
function AuthModalWrapper() {
  const { showAuthModal, setShowAuthModal } = useAuth();
  const { setGuestMode } = useAppContext();
  
  const handleClose = () => {
    setShowAuthModal(false);
  };
  
  const handleGuestContinue = () => {
    console.log("[AuthModal] Continue as Guest pressed - entering guest mode");
    setGuestMode(true);
    setShowAuthModal(false);
  };
  
  return <AuthModal visible={showAuthModal} onClose={handleClose} onGuestContinue={handleGuestContinue} />;
}

// Component to handle pending navigation after signup
function PendingNavHandler() {
  const { session, pendingNav, setPendingNav } = useAuth();

  useEffect(() => {
    if (session && pendingNav && navigationRef.isReady()) {
      console.log("[PendingNavHandler] Navigating to:", pendingNav.name);
      navigationRef.navigate(pendingNav.name, pendingNav.params || {});
      setPendingNav(null);
    }
  }, [session, pendingNav, setPendingNav]);

  return null;
}

// Component to handle notification tap responses (deep linking)
function NotificationHandler() {
  const { venues } = useAppContext();

  useEffect(() => {
    const unsubscribe = addNotificationResponseListener((data) => {
      console.log("[NotificationHandler] Notification tapped:", data);

      if (!navigationRef.isReady()) {
        console.log("[NotificationHandler] Navigation not ready");
        return;
      }

      const { type, venueId, venueName } = data;

      if (type === "weekly_reminder") {
        // Navigate to Home tab to see what's happening
        console.log("[NotificationHandler] Weekly reminder → Home");
        navigationRef.navigate("MainTabs", { screen: "HomeTab" });
      } else if (type === "vibe_reminder" && venueId) {
        // Find the venue and navigate to PostVibe screen
        console.log("[NotificationHandler] Vibe reminder → PostVibe for", venueName);
        const venue = venues.find((v) => v.id === venueId);
        if (venue) {
          navigationRef.navigate("PostVibe", { venue });
        } else {
          // If venue not found in context, navigate with minimal info
          navigationRef.navigate("PostVibe", {
            venue: { id: venueId, name: venueName || "Venue" },
          });
        }
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [venues]);

  return null;
}

// Wrap App component with Sentry if available
const AppComponent = function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  // Hold render until fonts are cached — usually < 100ms after first install
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: "#050013" }} />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#050013" />
      <View style={styles.container}>
        <NetworkProvider>
          <AuthProvider>
            <AppProvider>
              <RootNavigator />
              <AuthModalWrapper />
              <SignOutGuestReset />
              <PendingNavHandler />
              <NotificationHandler />
              <OfflineBanner />
            </AppProvider>
          </AuthProvider>
        </NetworkProvider>
      </View>
    </SafeAreaProvider>
  );
};

// Export wrapped or unwrapped App component
export default Sentry && Sentry.wrap ? Sentry.wrap(AppComponent) : AppComponent;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050013",
  },
});