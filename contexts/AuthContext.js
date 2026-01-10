import React, { createContext, useContext, useState, useEffect } from "react";
import Constants from "expo-constants";
import { supabase } from "../utils/supabase";

// Detect if running in Expo Go
const isExpoGo = Constants.appOwnership === "expo";

const AuthContext = createContext(null);

/**
 * Supabase Dashboard Configuration:
 * - Go to Authentication > Providers > Email
 * - Ensure Email provider is enabled
 * - For testing: Turn OFF "Confirm email" to allow instant sign-in
 * - For production: Turn ON "Confirm email" and handle confirmation flow
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authCallback, setAuthCallback] = useState(null);

  // Stable auth state listener - subscribe once, never re-subscribe
  useEffect(() => {
    let mounted = true;

    // Get initial session (handles app restart/auth restoration)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        console.log("[Auth] Initial session:", !!session, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });

    // Listen for auth changes (handles sign in/out events)
    // This subscription stays stable - don't re-create it
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[Auth] State change:", event, !!session, session?.user?.email);
      
      if (!mounted) return;

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      } else if (event === "SIGNED_OUT") {
        setSession(null);
        setUser(null);
        setLoading(false);
      } else {
        // Update session/user for other events too
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // Empty deps - subscribe once only

  // Separate effect to handle modal closing when session appears
  useEffect(() => {
    if (session && showAuthModal) {
      setShowAuthModal(false);
      // Execute callback if provided (e.g., continue to Post Vibe flow)
      if (authCallback) {
        authCallback();
        setAuthCallback(null);
      }
    }
  }, [session, showAuthModal, authCallback]);

  const signUp = async (email, password) => {
    try {
      if (!email || !email.includes("@")) {
        throw new Error("Please enter a valid email address");
      }

      // Sign up with Supabase
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password,
      });

      if (error) throw error;

      // If email confirmation is required, user needs to check email
      if (data.user && !data.session) {
        return {
          data: {
            message: "Please check your email to confirm your account",
            needsConfirmation: true,
          },
          error: null,
        };
      }

      return { data, error: null };
    } catch (error) {
      console.error("[Auth] Sign up error:", error);
      return { data: null, error };
    }
  };

  const signIn = async (email, password) => {
    try {
      if (!email || !email.includes("@")) {
        throw new Error("Please enter a valid email address");
      }

      // Sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password,
      });

      if (error) throw error;

      // Debug: Log session immediately after sign in
      console.log("[Auth] signIn result session:", !!data?.session, "user:", data?.user?.email);
      
      // Verify session was created
      const { data: sessionData } = await supabase.auth.getSession();
      console.log("[Auth] getSession after signIn:", !!sessionData?.session, sessionData?.session?.user?.email);

      return { data, error: null };
    } catch (error) {
      console.error("[Auth] Sign in error:", error);
      return { data: null, error };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error("[Auth] Sign out error:", error);
      return { error };
    }
  };

  const deleteAccount = async () => {
    try {
      // Note: This requires admin privileges or a server-side function
      // In production, you'd call a Supabase Edge Function to delete the user
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error("[Auth] Delete account error:", error);
      return { error };
    }
  };

  /**
   * Require authentication for an action
   * If not authenticated, shows auth modal
   * If authenticated, executes the callback immediately
   */
  const requireAuth = (callback) => {
    if (session && user) {
      // Already authenticated, execute callback
      callback();
    } else {
      // Not authenticated, show modal and save callback
      setAuthCallback(() => callback);
      setShowAuthModal(true);
    }
  };

  const isGuest = !session && !user;

  const value = {
    session,
    user,
    loading,
    isExpoGo,
    isGuest,
    isAuthenticated: !!session,
    signUp,
    signIn,
    signOut,
    deleteAccount,
    requireAuth,
    showAuthModal,
    setShowAuthModal,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

