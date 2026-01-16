// Initialize Sentry as early as possible
import './utils/sentry';

import React, { useRef, useEffect } from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AppProvider, useAppContext } from "./contexts/AppContext";
import RootNavigator from "./navigation/RootNavigator";
import AuthModal from "./components/AuthModal";

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