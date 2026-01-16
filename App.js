import React, { useRef, useEffect } from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import Constants from "expo-constants";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AppProvider, useAppContext } from "./contexts/AppContext";
import RootNavigator from "./navigation/RootNavigator";
import AuthModal from "./components/AuthModal";

// Initialize Sentry (must be done before any other imports that might throw)
let Sentry = null;
const SENTRY_DSN = Constants.expoConfig?.extra?.sentryDsn || 
                   Constants.manifest?.extra?.sentryDsn;

if (SENTRY_DSN) {
  try {
    Sentry = require('@sentry/react-native');
    Sentry.init({
      dsn: SENTRY_DSN,
      enableInExpoDevelopment: false, // Set to true to test in dev mode
      environment: process.env.NODE_ENV || 'development',
      // Configure which errors to capture
      beforeSend(event, hint) {
        // Filter out development-only errors if needed
        if (process.env.NODE_ENV === 'development') {
          return null; // Don't send in development
        }
        return event;
      },
      // Attach stack traces
      attachStacktrace: true,
      // Set sample rate (1.0 = 100% of errors, 0.1 = 10%)
      tracesSampleRate: 1.0,
    });
    console.log('[Sentry] Initialized successfully');
  } catch (error) {
    console.warn('[Sentry] Failed to initialize:', error.message);
    // App continues to work even if Sentry fails to initialize
  }
} else {
  console.log('[Sentry] DSN not configured, skipping initialization');
}

// Export Sentry for use in logger
export { Sentry };

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

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <AuthProvider>
        <AppProvider>
          <RootNavigator />
          <AuthModalWrapper />
          <SignOutGuestReset />
        </AppProvider>
      </AuthProvider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050013",
  },
});