// Initialize Sentry as early as possible
import './utils/sentry';
import { getSentry } from './utils/sentry';

import React, { useRef, useEffect } from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AppProvider, useAppContext } from "./contexts/AppContext";
import RootNavigator from "./navigation/RootNavigator";
import AuthModal from "./components/AuthModal";
import { navigationRef } from "./navigation/navigationService";

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

// Wrap App component with Sentry if available
const AppComponent = function App() {
  return (
    <SafeAreaView style={styles.container}>
      <AuthProvider>
        <AppProvider>
          <RootNavigator />
          <AuthModalWrapper />
          <SignOutGuestReset />
          <PendingNavHandler />
        </AppProvider>
      </AuthProvider>
    </SafeAreaView>
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