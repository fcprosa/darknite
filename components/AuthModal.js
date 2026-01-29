import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import { useAuth } from "../contexts/AuthContext";
import { validateUsername, checkUsernameAvailability, suggestUsernameVariants } from "../utils/usernameHelpers";

// Password validation helper
const validatePassword = (password) => {
  if (!password) return { valid: false, error: "Password is required" };
  if (password.length < 8) return { valid: false, error: "Password must be at least 8 characters" };
  if (!/[A-Z]/.test(password)) return { valid: false, error: "Password must contain at least one uppercase letter" };
  if (!/[0-9]/.test(password)) return { valid: false, error: "Password must contain at least one number" };
  return { valid: true, error: null };
};

export default function AuthModal({ visible, onClose, onGuestContinue }) {
  const { signUp, signIn, signInWithApple } = useAuth();
  const [activeTab, setActiveTab] = useState("signin"); // "signin" or "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [error, setError] = useState(null);
  const [emailSent, setEmailSent] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState(null);
  const [usernameError, setUsernameError] = useState(null);
  const [usernameSuggestions, setUsernameSuggestions] = useState([]);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [appleSignInAvailable, setAppleSignInAvailable] = useState(false);

  // Check if Apple Sign-In is available
  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleSignInAvailable);
  }, []);

  // Reset form when modal opens/closes or tab changes
  useEffect(() => {
    if (visible) {
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setUsername("");
      setError(null);
      setEmailSent(false);
      setPasswordError(null);
      setConfirmPasswordError(null);
      setUsernameError(null);
      setUsernameSuggestions([]);
      setLoading(false);
    }
  }, [visible, activeTab]);

  // Validate password on change
  useEffect(() => {
    if (password) {
      const validation = validatePassword(password);
      setPasswordError(validation.error);
    } else {
      setPasswordError(null);
    }
  }, [password]);

  // Validate confirm password on change
  useEffect(() => {
    if (confirmPassword && password) {
      if (confirmPassword !== password) {
        setConfirmPasswordError("Passwords do not match");
      } else {
        setConfirmPasswordError(null);
      }
    } else if (confirmPassword) {
      setConfirmPasswordError(null);
    }
  }, [confirmPassword, password]);

  // Validate username format on change (but don't check availability until blur/submit)
  const handleUsernameChange = (text) => {
    const lowerText = text.toLowerCase();
    setUsername(lowerText);
    setUsernameError(null);
    setUsernameSuggestions([]);
    
    if (lowerText.length > 0) {
      const validation = validateUsername(lowerText);
      if (!validation.valid) {
        setUsernameError(validation.error);
      }
    }
  };

  // Check username availability (debounced, on blur or before submit)
  const checkUsername = async () => {
    if (!username || username.trim().length === 0) return;
    
    const validation = validateUsername(username);
    if (!validation.valid) {
      setUsernameError(validation.error);
      return;
    }

    setCheckingUsername(true);
    const { available, error: checkError } = await checkUsernameAvailability(username);
    setCheckingUsername(false);

    if (checkError) {
      setUsernameError("Error checking username availability");
      return;
    }

    if (!available) {
      setUsernameError("Username already taken");
      const suggestions = suggestUsernameVariants(username);
      setUsernameSuggestions(suggestions);
    } else {
      setUsernameError(null);
      setUsernameSuggestions([]);
    }
  };

  const handleSignIn = async () => {
    setError(null);
    setLoading(true);

    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address");
      setLoading(false);
      return;
    }

    if (!password) {
      setError("Please enter your password");
      setLoading(false);
      return;
    }

    try {
      const { data, error: signInError } = await signIn(email, password);
      
      if (signInError) {
        setError(signInError.message || "Sign in failed");
        setLoading(false);
        return;
      }
      
      // Success - onAuthStateChange will handle closing modal
      setLoading(false);
    } catch (err) {
      setError(err.message || "An error occurred");
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setError(null);
    setLoading(true);

    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address");
      setLoading(false);
      return;
    }

    // Validate username
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      setError(usernameValidation.error);
      setLoading(false);
      return;
    }

    // Check username availability before submitting
    const { available, error: checkError } = await checkUsernameAvailability(username);
    if (checkError || !available) {
      setError("Username already taken");
      const suggestions = suggestUsernameVariants(username);
      setUsernameSuggestions(suggestions);
      setLoading(false);
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.error);
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const { data, error: signUpError } = await signUp(email, password, username);
      
      if (signUpError) {
        // Check if error is username-related
        if (signUpError.message && signUpError.message.toLowerCase().includes("username")) {
          setError("Username already taken");
          const suggestions = suggestUsernameVariants(username);
          setUsernameSuggestions(suggestions);
        } else {
          setError(signUpError.message || "Sign up failed");
        }
        setLoading(false);
        return;
      }

      // If email confirmation is required
      if (data?.needsConfirmation) {
        setEmailSent(true);
        setLoading(false);
        return;
      }
      
      // Success - onAuthStateChange will handle closing modal
      setLoading(false);
    } catch (err) {
      setError(err.message || "An error occurred");
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setError(null);
    setAppleLoading(true);

    try {
      const { data, error: appleError } = await signInWithApple();

      if (appleError) {
        setError(appleError.message || "Apple Sign-In failed");
      }
      // Success is handled by AuthContext (closes modal automatically)
    } catch (err) {
      setError(err.message || "An error occurred");
    } finally {
      setAppleLoading(false);
    }
  };

  const isSignInValid = email.includes("@") && password.length > 0;
  const isSignUpValid =
    email.includes("@") &&
    validateUsername(username).valid &&
    validatePassword(password).valid &&
    confirmPassword === password &&
    confirmPassword.length > 0 &&
    !usernameError;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.authModalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.authModalContainer}
          >
            <TouchableWithoutFeedback>
              <View style={styles.authModalContent}>
                {/* Header */}
                <View style={styles.authModalHeader}>
                  <TouchableOpacity onPress={onClose} style={styles.authModalCloseButton}>
                    <Ionicons name="close" size={24} color="#F9FAFB" />
                  </TouchableOpacity>
                  <Text style={styles.authModalTitle}>DarkNite</Text>
                  <View style={styles.authModalCloseButton} />
                </View>

                {/* Tabs */}
                <View style={styles.authTabsContainer}>
                  <TouchableOpacity
                    style={[styles.authTab, activeTab === "signin" && styles.authTabActive]}
                    onPress={() => setActiveTab("signin")}
                  >
                    <Text style={[styles.authTabText, activeTab === "signin" && styles.authTabTextActive]}>
                      Sign In
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.authTab, activeTab === "signup" && styles.authTabActive]}
                    onPress={() => setActiveTab("signup")}
                  >
                    <Text style={[styles.authTabText, activeTab === "signup" && styles.authTabTextActive]}>
                      Sign Up
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Email Sent Confirmation */}
                {emailSent ? (
                  <View style={styles.authEmailSentContainer}>
                    <Ionicons name="mail-outline" size={48} color="#A855F7" style={{ marginBottom: 16 }} />
                    <Text style={styles.authEmailSentTitle}>Check your email!</Text>
                    <Text style={styles.authEmailSentText}>
                      We sent a confirmation link to {email}
                    </Text>
                    <Text style={styles.authEmailSentSubtext}>
                      Click the link in your email to activate your account.
                    </Text>
                    <TouchableOpacity
                      style={styles.authBackToSignInButton}
                      onPress={() => {
                        setEmailSent(false);
                        setActiveTab("signin");
                      }}
                    >
                      <Text style={styles.authBackToSignInText}>Back to Sign In</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <ScrollView style={styles.authFormContainer} showsVerticalScrollIndicator={false}>
                    {/* Error Message */}
                    {error && (
                      <View style={styles.authErrorContainer}>
                        <Text style={styles.authErrorText}>{error}</Text>
                      </View>
                    )}

                    {/* Email Input */}
                    <View style={styles.authInputContainer}>
                      <Text style={styles.authInputLabel}>Email</Text>
                      <TextInput
                        style={styles.authInput}
                        placeholder="Enter your email"
                        placeholderTextColor="#6B7280"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!loading}
                      />
                    </View>

                    {/* Username Input (Sign Up only) */}
                    {activeTab === "signup" && (
                      <View style={styles.authInputContainer}>
                        <Text style={styles.authInputLabel}>Username</Text>
                        <TextInput
                          style={[styles.authInput, usernameError && styles.authInputError]}
                          placeholder="Choose a username"
                          placeholderTextColor="#6B7280"
                          value={username}
                          onChangeText={handleUsernameChange}
                          onBlur={checkUsername}
                          autoCapitalize="none"
                          autoCorrect={false}
                          editable={!loading && !checkingUsername}
                        />
                        {checkingUsername && (
                          <Text style={styles.authInputHint}>Checking availability...</Text>
                        )}
                        {usernameError && (
                          <Text style={styles.authInputErrorText}>{usernameError}</Text>
                        )}
                        {usernameSuggestions.length > 0 && (
                          <View style={styles.usernameSuggestionsContainer}>
                            <Text style={styles.usernameSuggestionsLabel}>Try:</Text>
                            <View style={styles.usernameSuggestionsList}>
                              {usernameSuggestions.slice(0, 3).map((suggestion, index) => (
                                <TouchableOpacity
                                  key={index}
                                  style={styles.usernameSuggestionChip}
                                  onPress={() => {
                                    setUsername(suggestion);
                                    setUsernameError(null);
                                    setUsernameSuggestions([]);
                                  }}
                                >
                                  <Text style={styles.usernameSuggestionText}>{suggestion}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Password Input */}
                    <View style={styles.authInputContainer}>
                      <Text style={styles.authInputLabel}>Password</Text>
                      <TextInput
                        style={[styles.authInput, passwordError && styles.authInputError]}
                        placeholder="Enter your password"
                        placeholderTextColor="#6B7280"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        editable={!loading}
                      />
                      {passwordError && (
                        <Text style={styles.authInputErrorText}>{passwordError}</Text>
                      )}
                    </View>

                    {/* Confirm Password (Sign Up only) */}
                    {activeTab === "signup" && (
                      <View style={styles.authInputContainer}>
                        <Text style={styles.authInputLabel}>Confirm Password</Text>
                        <TextInput
                          style={[styles.authInput, confirmPasswordError && styles.authInputError]}
                          placeholder="Confirm your password"
                          placeholderTextColor="#6B7280"
                          value={confirmPassword}
                          onChangeText={setConfirmPassword}
                          secureTextEntry
                          editable={!loading}
                        />
                        {confirmPasswordError && (
                          <Text style={styles.authInputErrorText}>{confirmPasswordError}</Text>
                        )}
                      </View>
                    )}

                    {/* Submit Button */}
                    <TouchableOpacity
                      style={[
                        styles.authSubmitButton,
                        ((activeTab === "signin" && !isSignInValid) ||
                         (activeTab === "signup" && !isSignUpValid) ||
                         loading) && styles.authSubmitButtonDisabled
                      ]}
                      onPress={activeTab === "signin" ? handleSignIn : handleSignUp}
                      disabled={
                        (activeTab === "signin" && !isSignInValid) ||
                        (activeTab === "signup" && !isSignUpValid) ||
                        loading
                      }
                      activeOpacity={0.8}
                    >
                      <Text style={styles.authSubmitButtonText}>
                        {loading
                          ? (activeTab === "signin" ? "Signing in..." : "Creating account...")
                          : (activeTab === "signin" ? "Sign In" : "Sign Up")
                        }
                      </Text>
                    </TouchableOpacity>

                    {/* Divider */}
                    {Platform.OS === "ios" && appleSignInAvailable && (
                      <View style={styles.dividerContainer}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>or</Text>
                        <View style={styles.dividerLine} />
                      </View>
                    )}

                    {/* Apple Sign-In Button (iOS only) */}
                    {Platform.OS === "ios" && appleSignInAvailable && (
                      <AppleAuthentication.AppleAuthenticationButton
                        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                        cornerRadius={12}
                        style={styles.appleButton}
                        onPress={handleAppleSignIn}
                        disabled={loading || appleLoading}
                      />
                    )}

                    {/* Guest Option */}
                    <TouchableOpacity
                      style={styles.authGuestButton}
                      onPress={onGuestContinue || onClose}
                      disabled={loading || appleLoading}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.authGuestButtonText}>Continue as Guest</Text>
                    </TouchableOpacity>
                    <Text style={styles.authGuestHint}>
                      Browse venues without signing in. Sign in to post vibes.
                    </Text>
                  </ScrollView>
                )}
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  authModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(5, 0, 19, 0.95)",
    justifyContent: "flex-end",
  },
  authModalContainer: {
    maxHeight: "90%",
  },
  authModalContent: {
    backgroundColor: "#0B0625",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
    borderBottomWidth: 0,
    paddingTop: 8,
    paddingBottom: 32,
  },
  authModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  authModalCloseButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  authModalTitle: {
    color: "#F9FAFB",
    fontSize: 20,
    fontWeight: "700",
  },
  authTabsContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(168,85,247,0.2)",
  },
  authTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    marginBottom: -1,
  },
  authTabActive: {
    borderBottomColor: "#A855F7",
  },
  authTabText: {
    color: "#6B7280",
    fontSize: 16,
    fontWeight: "600",
  },
  authTabTextActive: {
    color: "#A855F7",
  },
  authFormContainer: {
    paddingHorizontal: 20,
  },
  authEmailSentContainer: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  authEmailSentTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F9FAFB",
    marginBottom: 8,
  },
  authEmailSentText: {
    fontSize: 16,
    color: "#E5E7EB",
    textAlign: "center",
    marginBottom: 8,
  },
  authEmailSentSubtext: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  authBackToSignInButton: {
    backgroundColor: "#A855F7",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  authBackToSignInText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  authErrorContainer: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  authErrorText: {
    color: "#EF4444",
    fontSize: 14,
    textAlign: "center",
  },
  authInputContainer: {
    marginBottom: 20,
  },
  authInputLabel: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  authInput: {
    backgroundColor: "#050013",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#F9FAFB",
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.3)",
  },
  authInputError: {
    borderColor: "#EF4444",
  },
  authInputErrorText: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  authInputHint: {
    color: "#9CA3AF",
    fontSize: 12,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  usernameSuggestionsContainer: {
    marginTop: 8,
  },
  usernameSuggestionsLabel: {
    color: "#9CA3AF",
    fontSize: 12,
    marginBottom: 6,
  },
  usernameSuggestionsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  usernameSuggestionChip: {
    backgroundColor: "rgba(168,85,247,0.1)",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  usernameSuggestionText: {
    color: "#A855F7",
    fontSize: 12,
    fontWeight: "500",
  },
  authSubmitButton: {
    backgroundColor: "#A855F7",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#A855F7",
    shadowOpacity: 0.6,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  authSubmitButtonDisabled: {
    opacity: 0.5,
  },
  authSubmitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  authGuestButton: {
    backgroundColor: "transparent",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.3)",
  },
  authGuestButtonText: {
    color: "#A855F7",
    fontSize: 16,
    fontWeight: "600",
  },
  authGuestHint: {
    color: "#9CA3AF",
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(168,85,247,0.3)",
  },
  dividerText: {
    color: "#6B7280",
    fontSize: 14,
    paddingHorizontal: 16,
  },
  appleButton: {
    width: "100%",
    height: 50,
    marginBottom: 4,
  },
});

