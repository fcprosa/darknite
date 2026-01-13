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
  const [pendingNav, setPendingNav] = useState(null); // { name, params }

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
        
        // Ensure profile exists after sign in
        if (session?.user?.id) {
          await ensureProfileExists(session.user.id);
        }
      } else if (event === "SIGNED_OUT") {
        // Clear all auth-related state on sign-out
        setSession(null);
        setUser(null);
        setLoading(false);
        setShowAuthModal(false);
        setAuthCallback(null);
        setPendingNav(null);
        console.log("[Auth] Sign-out complete - all state cleared");
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

  // Helper function to ensure profile exists
  const ensureProfileExists = async (userId) => {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") { // PGRST116 = no rows returned
        console.error("[Auth] Error checking profile:", error);
        return;
      }

      // If profile doesn't exist, we'll create it when user sets username via ProfileSetupScreen
      // Don't create empty profile here - username is required
    } catch (e) {
      console.error("[Auth] Error ensuring profile exists:", e);
    }
  };

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

  const signUp = async (email, password, username) => {
    try {
      if (!email || !email.includes("@")) {
        throw new Error("Please enter a valid email address");
      }

      if (!username || username.trim().length === 0) {
        throw new Error("Username is required");
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

      // Create user profile with username
      if (data.user && data.session) {
        const normalizedUsername = username.trim().toLowerCase();
        const { error: profileError } = await supabase
          .from("user_profiles")
          .insert({
            id: data.user.id,
            username: normalizedUsername,
          });

        if (profileError) {
          console.error("[Auth] Profile creation error:", profileError);
          // If profile creation fails (e.g., username taken), sign out the user
          await supabase.auth.signOut();
          throw new Error(profileError.message || "Failed to create profile");
        }
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
   * 
   * Can accept either:
   * - callback function: requireAuth(() => { ... })
   * - navigation target: requireAuth({ name: "VenueDetails", params: { venueId } })
   */
  const requireAuth = (callbackOrNav) => {
    if (session && user) {
      // Already authenticated
      if (typeof callbackOrNav === 'function') {
        callbackOrNav();
      }
      // If it's a nav target, we don't navigate here - let the caller handle it
      return;
    }
    
    // Not authenticated, show modal and store target
    if (typeof callbackOrNav === 'function') {
      setAuthCallback(() => callbackOrNav);
    } else if (callbackOrNav && typeof callbackOrNav === 'object' && callbackOrNav.name) {
      // Store navigation target
      setPendingNav(callbackOrNav);
    }
    setShowAuthModal(true);
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
    pendingNav,
    setPendingNav,
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

