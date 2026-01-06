import React, { useState, useEffect, useRef } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  PanResponder,
  Modal,
  Keyboard,
  TouchableWithoutFeedback,
  Easing,
} from "react-native";
import { createClient } from "@supabase/supabase-js";
import VenueCardLovable from "./components/VenueCardLovable";
import VenueDetailsLovable from "./components/VenueDetailsLovable";
import PostVibeScreen from "./components/PostVibeScreen";

const { height } = Dimensions.get("window");

// 🔐 SUPABASE – OS TEUS DADOS
const SUPABASE_URL = "https://uttcnvqhhmkfkccwjgnt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_FRoLIm9eLIJYnjSMJ68KCw_hwr4zuiF";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Fallback local (se Supabase falhar completamente)
const FALLBACK_VENUES = [
  { id: "Gospel", name: "Gospel", neighborhood: "SoHo", guys: 50, girls: 50 },
  {
    id: "Schimanski",
    name: "Schimanski",
    neighborhood: "Williamsburg",
    guys: 50,
    girls: 50,
  },
  {
    id: "Skyline",
    name: "Skyline Rooftop",
    neighborhood: "Midtown",
    guys: 50,
    girls: 50,
  },
  {
    id: "PublicArts",
    name: "Public Arts",
    neighborhood: "Lower East Side",
    guys: 50,
    girls: 50,
  },
];

// ---------- SUPABASE HELPERS ----------

// Buscar venues da tabela `venues`
async function fetchVenues() {
  const { data, error } = await supabase
    .from("venues")
    .select("id, name, neighborhood, default_guys, default_girls")
    .order("name", { ascending: true });

  if (error) {
    console.log("Erro a buscar venues:", error.message);
    return FALLBACK_VENUES;
  }

  if (!data || data.length === 0) {
    return FALLBACK_VENUES;
  }

  return data.map((row) => ({
    id: row.id, // ex: "Gospel"
    name: row.name,
    neighborhood: row.neighborhood,
    guys: row.default_guys ?? 50,
    girls: row.default_girls ?? 50,
  }));
}

// vibe mais recente (últimas 24h)
async function fetchLatestVibe(venueKey) {
  if (!venueKey) return null;

  const since = new Date(
    Date.now() - 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("vibes")
    .select("crowd, ratio, line, cover, created_at")
    .eq("venue_id", venueKey)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.log("Erro a buscar latest vibe:", error.message);
    return null;
  }

  return data;
}

// Fetch recent vibes (last 2 hours)
async function fetchRecentVibes(venueKey, hours = 2) {
  if (!venueKey) return [];

  const since = new Date(
    Date.now() - hours * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("vibes")
    .select("crowd, ratio, line, cover, created_at")
    .eq("venue_id", venueKey)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.log("Erro a buscar recent vibes:", error.message);
    return [];
  }

  return data || [];
}

// converte label -> percentagens
function mapRatioToPercent(ratioLabel) {
  switch (ratioLabel) {
    case "Mostly guys":
      return { guys: 70, girls: 30 };
    case "Balanced":
      return { guys: 50, girls: 50 };
    case "Mostly girls":
      return { guys: 30, girls: 70 };
    default:
      return { guys: 50, girls: 50 };
  }
}

// ---------- APP ROOT ----------

export default function App() {
  const [screen, setScreen] = useState("landing"); // landing | list | detail | auth | postvibe
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [venues, setVenues] = useState(FALLBACK_VENUES);
  const [loadingVenues, setLoadingVenues] = useState(true);

  const [selectedVenue, setSelectedVenue] = useState(null);

  // força HomeScreen + VenueDetailScreen a recarregarem vibes
  const [refreshKey, setRefreshKey] = useState(0);

  // carregar venues da tabela `venues`
  useEffect(() => {
    async function loadVenues() {
      setLoadingVenues(true);
      const v = await fetchVenues();
      setVenues(v);
      setLoadingVenues(false);
    }
    loadVenues();
  }, []);

  const openVenue = (venue) => {
    setSelectedVenue(venue);
    setScreen("detail");
  };

  const openPostVibeScreen = (venue) => {
    // Preserve existing selectedVenue if no venue is passed (e.g., called from VenueDetails)
    // Only update if a valid venue is explicitly provided
    if (venue) {
      setSelectedVenue(venue);
    }
    // If no venue provided but selectedVenue exists, keep it
    // This ensures we don't clear selectedVenue when opening from detail screen
    setScreen("postvibe");
  };

  const goBack = () => {
    setScreen("list");
    setSelectedVenue(null);
  };

  // ---------- RENDER ----------

  return (
    <SafeAreaView style={styles.container}>
      {screen === "landing" && (
        <LandingScreen
          onDiscover={() => setScreen("list")}
          onSignIn={() => setScreen("auth")}
        />
      )}

      {screen === "auth" && (
        <SignInScreen
          onBack={() => setScreen("landing")}
          onSignInSuccess={() => {
            setIsLoggedIn(true);
            setScreen("list");
          }}
        />
      )}

      {screen === "list" &&
        (loadingVenues ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ color: "#E5E7EB" }}>Loading venues…</Text>
          </View>
        ) : (
          <HomeScreen
            venues={venues}
            isLoggedIn={isLoggedIn}
            onOpenVenue={openVenue}
            onOpenSheet={openPostVibeScreen}
            onBackToLanding={() => setScreen("landing")}
            refreshKey={refreshKey}
          />
        ))}

      {screen === "detail" && selectedVenue && (
        <VenueDetailsLovable
          venue={selectedVenue}
          onBack={goBack}
          onOpenSheet={openPostVibeScreen}
          refreshKey={refreshKey}
        />
      )}

      {screen === "postvibe" && selectedVenue && (
        <AnimatedPostVibeSheet
          venue={selectedVenue}
          onClose={() => {
            // Only change screen, preserve selectedVenue
            setScreen("detail");
          }}
          onSuccess={() => {
            setRefreshKey((prev) => prev + 1);
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ---------- ANIMATED POST VIBE SHEET ----------

function AnimatedPostVibeSheet({ venue, onClose, onSuccess }) {
  const translateY = useRef(new Animated.Value(height)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    // Slide up animation on mount
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const closeSheet = () => {
    if (isClosing) return;
    setIsClosing(true);
    
    // Animate down
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: height,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt, gestureState) => {
        // Only respond to vertical swipes
        return Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dy) > 10 && gestureState.dy > 0;
      },
      onPanResponderGrant: () => {
        translateY.setOffset(translateY._value);
      },
      onPanResponderMove: (evt, gestureState) => {
        // Only allow downward drag
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        translateY.flattenOffset();
        const threshold = height * 0.3; // Close if dragged down more than 30% of screen
        
        if (gestureState.dy > threshold || gestureState.vy > 0.5) {
          // Close sheet
          closeSheet();
        } else {
          // Snap back up
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
          }).start();
        }
      },
    })
  ).current;

  return (
    <View style={styles.sheetOverlay}>
      {/* Backdrop */}
      <Animated.View
        style={[
          styles.sheetBackdrop,
          {
            opacity: backdropOpacity,
          },
        ]}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={closeSheet}
        />
      </Animated.View>

      {/* Sheet Container */}
      <Animated.View
        style={[
          styles.sheetContainer,
          {
            transform: [{ translateY }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.sheetKeyboardView}
        >
          <PostVibeScreen
            venue={venue}
            onBack={closeSheet}
            onSuccess={onSuccess}
          />
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}

// ---------- LANDING ----------

function LandingScreen({ onDiscover, onSignIn }) {
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0.3, 1],
    outputRange: [0.4, 0.8],
  });

  return (
    <View style={styles.landingRoot}>
      {/* Gradient Background Layers */}
      <View style={styles.landingGradient1} />
      <View style={styles.landingGradient2} />
      
      <View style={styles.landingContent}>
        {/* Logo with animated glow */}
        <View style={styles.landingLogoContainer}>
          <Animated.View
            style={[
              styles.landingLogoGlow,
              {
                opacity: glowOpacity,
              },
            ]}
          />
          <Text style={styles.landingLogo}>DarkNite</Text>
        </View>

        <Text style={styles.landingTagline}>Know Before You Go</Text>
        <Text style={styles.landingSubtitle}>
          Real-time crowd, ratios & lines
        </Text>

        {/* Social Proof */}
        <Text style={styles.landingSocialProof}>
          Live vibes from NYC spots
        </Text>

        <View style={styles.landingButtonsContainer}>
          <TouchableOpacity style={styles.landingPrimary} onPress={onDiscover}>
            <Text style={styles.landingPrimaryText}>
              Discover Tonight&apos;s Vibe
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.landingSecondary} onPress={onSignIn}>
            <Text style={styles.landingSecondaryText}>Sign In</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.landingPeek}>
          Just looking around?{" "}
          <Text style={styles.landingPeekLink} onPress={onDiscover}>
            Peek the vibes
          </Text>
        </Text>
      </View>
    </View>
  );
}

// ---------- SIGN-IN (DEMO) ----------

function SignInScreen({ onBack, onSignInSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const passwordInputRef = useRef(null);

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  return (
    <SafeAreaView style={styles.signInRoot}>
      <TouchableWithoutFeedback onPress={dismissKeyboard}>
        <View style={styles.signInHeaderTop}>
          <TouchableOpacity onPress={onBack} style={styles.signInBackButton}>
            <Text style={styles.signInBackArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.logo}>DarkNite</Text>
          <View style={styles.signInBackButton} />
        </View>
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView
        style={styles.signInCenter}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={dismissKeyboard}>
          <View style={styles.signInCard}>
            <Text style={styles.signInTitle}>Sign in to DarkNite</Text>
            <Text style={styles.signInSubtitle}>
              Create a free account to see every venue and drop real vibes
            </Text>

            <View style={styles.signInInputContainer}>
              <Text style={styles.signInLabel}>Email</Text>
              <TextInput
                style={styles.signInInput}
                placeholder="you@example.com"
                placeholderTextColor="#6B7280"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordInputRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>

            <View style={styles.signInInputContainer}>
              <Text style={styles.signInLabel}>Password</Text>
              <View style={styles.signInPasswordContainer}>
                <TextInput
                  ref={passwordInputRef}
                  style={styles.signInPasswordInput}
                  placeholder="••••••••"
                  placeholderTextColor="#6B7280"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  returnKeyType="done"
                  onSubmitEditing={dismissKeyboard}
                  blurOnSubmit={true}
                />
                <TouchableOpacity
                  style={styles.signInPasswordToggle}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.signInPasswordToggleText}>
                    {showPassword ? "Hide" : "Show"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.signInSubmitButton}
              onPress={onSignInSuccess}
              activeOpacity={0.8}
            >
              <Text style={styles.signInSubmitButtonText}>Sign in (demo)</Text>
            </TouchableOpacity>

            <Text style={styles.signInHint}>
              Demo only – signing in does not create a real account yet
            </Text>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------- LISTA DE VENUES ----------

function HomeScreen({ venues, isLoggedIn, onOpenVenue, onOpenSheet, onBackToLanding, refreshKey }) {
  const visibleVenues = isLoggedIn ? venues : venues.slice(0, 2);
  const [ratios, setRatios] = useState({}); // { [venueId]: { guys, girls } }
  const [latestVibes, setLatestVibes] = useState({}); // { [venueId]: vibe }

  useEffect(() => {
    let cancelled = false;

    async function loadRatios() {
      const nextRatios = {};
      const nextVibes = {};
      for (const v of venues) {
        const key = v.id || v.name;
        const vibe = await fetchLatestVibe(key);
        if (vibe) {
          nextVibes[key] = vibe;
          if (vibe.ratio) {
            nextRatios[key] = mapRatioToPercent(vibe.ratio);
          }
        }
      }
      if (!cancelled) {
        setRatios(nextRatios);
        setLatestVibes(nextVibes);
      }
    }

    loadRatios();

    return () => {
      cancelled = true;
    };
  }, [refreshKey, venues]);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.headerRow}>
        <Text style={styles.logo}>DarkNite</Text>
        <TouchableOpacity onPress={onBackToLanding}>
          <Text style={styles.headerBackHome}>Home</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.tonightBanner}>Tonight in NYC</Text>
      {!isLoggedIn && (
        <Text style={styles.demoNote}>
          Preview mode: showing a couple of spots. Sign in to see them all &amp;
          drop vibes.
        </Text>
      )}

      <FlatList
        data={visibleVenues}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        renderItem={({ item }) => {
          const key = item.id || item.name;
          const liveRatio = ratios[key];
          const guys = liveRatio?.guys ?? item.guys;
          const girls = liveRatio?.girls ?? item.girls;
          const latestVibe = latestVibes[key] || null;

          return (
            <VenueCardLovable
              venue={item}
              guys={guys}
              girls={girls}
              onPress={() => onOpenVenue(item)}
              onRate={() => onOpenSheet(item)}
              latestVibe={latestVibe}
            />
          );
        }}
      />
    </View>
  );
}

// ---------- DETALHE DA VENUE ----------

function VenueDetailScreen({ venue, onBack, onOpenSheet, refreshKey }) {
  const [latestVibe, setLatestVibe] = useState(null);
  const [loadingVibe, setLoadingVibe] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!venue) return;
      setLoadingVibe(true);
      const key = venue.id || venue.name;
      const vibe = await fetchLatestVibe(key);
      if (isMounted) {
        setLatestVibe(vibe);
        setLoadingVibe(false);
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [venue, refreshKey]);

  if (!venue) return null;

  const hasVibe = !!latestVibe;
  const crowdText = hasVibe ? latestVibe.crowd : "No vibes yet – be the first";
  const lineText = hasVibe ? latestVibe.line : "No line";
  const coverText = hasVibe ? latestVibe.cover : "Free";

  const ratioPercent = hasVibe
    ? mapRatioToPercent(latestVibe.ratio)
    : { guys: venue.guys, girls: venue.girls };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>◀ Back</Text>
        </TouchableOpacity>
        <Text style={styles.detailTitle}>{venue.name}</Text>
      </View>

      <View style={styles.detailCard}>
        <Text style={styles.sectionTitle}>Tonight at {venue.name}</Text>

        {loadingVibe ? (
          <Text style={styles.detailText}>Loading latest vibe…</Text>
        ) : (
          <>
            <Text style={styles.detailText}>Crowd: {crowdText}</Text>
            <Text style={styles.detailText}>Line: {lineText}</Text>
            <Text style={styles.detailText}>Cover: {coverText}</Text>
          </>
        )}

        <View style={{ marginTop: 16 }}>
          <Text style={styles.ratioLabel}>Gender ratio (last vibe)</Text>
          <Text style={styles.ratioNumbers}>
            {ratioPercent.guys}% guys • {ratioPercent.girls}% girls
          </Text>
          <View style={styles.ratioBar}>
            {/* GUYS = AZUL, GIRLS = ROSA */}
            <View
              style={[styles.ratioSegmentGuys, { flex: ratioPercent.guys || 1 }]}
            />
            <View
              style={[
                styles.ratioSegmentGirls,
                { flex: ratioPercent.girls || 1 },
              ]}
            />
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, { marginHorizontal: 16, marginTop: 16 }]}
        onPress={onOpenSheet}
      >
        <Text style={styles.primaryButtonText}>Post your vibe 🔥</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------- OPTION CHIP ----------


// ---------- STYLES ----------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050013",
  },

  // Landing
  landingRoot: {
    flex: 1,
    backgroundColor: "#050013",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  landingGradient1: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(168,85,247,0.15)",
  },
  landingGradient2: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(249,115,255,0.08)",
  },
  landingContent: {
    paddingHorizontal: 24,
    width: "100%",
    alignItems: "center",
    zIndex: 1,
  },
  landingLogoContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    position: "relative",
  },
  landingLogoGlow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#F973FF",
    opacity: 0.4,
  },
  landingLogo: {
    fontSize: 48,
    fontWeight: "800",
    color: "#F973FF",
    letterSpacing: -1,
  },
  landingTagline: {
    fontSize: 24,
    color: "#F9FAFB",
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  landingSubtitle: {
    color: "#E5E7EB",
    textAlign: "center",
    fontSize: 16,
    marginBottom: 8,
    fontWeight: "500",
  },
  landingSocialProof: {
    color: "#A855F7",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 40,
    textAlign: "center",
  },
  landingButtonsContainer: {
    width: "100%",
    marginBottom: 24,
  },
  landingPrimary: {
    backgroundColor: "#A855F7",
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#A855F7",
    shadowOpacity: 0.8,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  landingPrimaryText: {
    color: "#F9FAFB",
    fontWeight: "700",
    fontSize: 17,
    letterSpacing: 0.3,
  },
  landingSecondary: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#A855F7",
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "rgba(168,85,247,0.1)",
  },
  landingSecondaryText: {
    color: "#E5E7EB",
    fontWeight: "700",
    fontSize: 16,
  },
  landingPeek: {
    color: "#9CA3AF",
    fontSize: 14,
    textAlign: "center",
  },
  landingPeekLink: {
    color: "#F973FF",
    fontWeight: "600",
  },

  // Header / list
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    alignItems: "center",
  },
  logo: {
    fontSize: 24,
    fontWeight: "800",
    color: "#F5F3FF",
  },
  headerBackHome: {
    color: "#A5B4FC",
  },
  tonightBanner: {
    marginTop: 8,
    marginHorizontal: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(148,163,184,0.12)",
    color: "#E5E7EB",
  },
  demoNote: {
    marginHorizontal: 16,
    marginTop: 4,
    color: "#9CA3AF",
    fontSize: 12,
  },

  // Venue cards
  venueCard: {
    backgroundColor: "#0B0625",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.4)",
  },
  venueName: {
    color: "#F9FAFB",
    fontSize: 18,
    fontWeight: "700",
  },
  venueMeta: {
    color: "#9CA3AF",
    marginTop: 4,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: "#A855F7",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#A855F7",
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  primaryButtonText: {
    color: "#F9FAFB",
    fontWeight: "700",
  },

  // Ratio bar  (GUYS = AZUL, GIRLS = ROSA)
  ratioRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  ratioLabel: {
    color: "#9CA3AF",
    fontSize: 12,
  },
  ratioNumbers: {
    color: "#E5E7EB",
    fontSize: 12,
  },
  ratioBar: {
    flexDirection: "row",
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#111827",
  },
  ratioSegmentGuys: {
    backgroundColor: "#38BDF8", // azul
  },
  ratioSegmentGirls: {
    backgroundColor: "#F973FF", // rosa
  },

  // Detail
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backText: {
    color: "#A5B4FC",
    marginRight: 8,
  },
  detailTitle: {
    color: "#F9FAFB",
    fontSize: 20,
    fontWeight: "700",
  },
  detailCard: {
    backgroundColor: "#0B0625",
    margin: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.4)",
  },
  sectionTitle: {
    color: "#E5E7EB",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  detailText: {
    color: "#9CA3AF",
    marginBottom: 4,
  },


  // Sign-in
  signInRoot: {
    flex: 1,
    backgroundColor: "#050013",
  },
  signInHeaderTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  signInBackButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  signInBackArrow: {
    color: "#E5E7EB",
    fontSize: 24,
    fontWeight: "600",
  },
  signInCenter: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  signInCard: {
    backgroundColor: "#0B0625",
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
    shadowColor: "#A855F7",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  signInTitle: {
    color: "#F9FAFB",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  signInSubtitle: {
    color: "#9CA3AF",
    textAlign: "center",
    fontSize: 15,
    marginBottom: 32,
    lineHeight: 22,
  },
  signInInputContainer: {
    marginBottom: 20,
  },
  signInLabel: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  signInInput: {
    backgroundColor: "#050013",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#F9FAFB",
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.3)",
  },
  signInPasswordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#050013",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.3)",
  },
  signInPasswordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#F9FAFB",
    fontSize: 16,
  },
  signInPasswordToggle: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  signInPasswordToggleText: {
    color: "#A855F7",
    fontSize: 14,
    fontWeight: "600",
  },
  signInSubmitButton: {
    backgroundColor: "#A855F7",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#A855F7",
    shadowOpacity: 0.6,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  signInSubmitButtonText: {
    color: "#F9FAFB",
    fontWeight: "700",
    fontSize: 16,
  },
  signInHint: {
    color: "#6B7280",
    fontSize: 12,
    textAlign: "center",
    marginTop: 20,
    lineHeight: 18,
  },
  signInBack: {
    color: "#A5B4FC",
    fontSize: 14,
  },
  // Animated Sheet
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  sheetContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: height * 0.92,
    backgroundColor: "#050013",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: "rgba(124,58,237,0.4)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  sheetKeyboardView: {
    flex: 1,
  },
});
