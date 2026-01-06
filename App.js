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
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import VenueCardLovable from "./components/VenueCardLovable";
import VenueDetailsLovable from "./components/VenueDetailsLovable";
import PostVibeScreen from "./components/PostVibeScreen";
import ExploreScreen from "./components/ExploreScreen";
import ProfileScreen from "./components/ProfileScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

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
    .select("crowd, ratio, line, cover, music, created_at")
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
    .select("crowd, ratio, line, cover, music, created_at")
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

// Format time ago (compact version for cards)
function formatTimeAgoCompact(dateString) {
  if (!dateString) return "";
  const now = new Date();
  const then = new Date(dateString);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
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

// ---------- APP CONTEXT FOR SHARED STATE ----------

const AppContext = React.createContext(null);

function AppProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [venues, setVenues] = useState(FALLBACK_VENUES);
  const [loadingVenues, setLoadingVenues] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    async function loadVenues() {
      setLoadingVenues(true);
      const v = await fetchVenues();
      setVenues(v);
      setLoadingVenues(false);
    }
    loadVenues();
  }, []);

  return (
    <AppContext.Provider
      value={{
        isLoggedIn,
        setIsLoggedIn,
        venues,
        loadingVenues,
        refreshKey,
        setRefreshKey: () => setRefreshKey((prev) => prev + 1),
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

function useAppContext() {
  const context = React.useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within AppProvider");
  }
  return context;
}

// ---------- HOME STACK NAVIGATOR ----------

function HomeStackNavigator() {
  const { venues, isLoggedIn, refreshKey, setRefreshKey } = useAppContext();
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [showPostVibe, setShowPostVibe] = useState(false);

  return (
    <>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#050013" },
        }}
      >
        <Stack.Screen name="HomeList">
          {({ navigation }) => {
            const tabNavigation = navigation.getParent();
            return (
              <HomeScreenWrapper
                navigation={navigation}
                tabNavigation={tabNavigation}
                venues={venues}
                isLoggedIn={isLoggedIn}
                refreshKey={refreshKey}
                onOpenVenue={(venue) => {
                  setSelectedVenue(venue);
                  navigation.navigate("VenueDetails");
                }}
                onOpenSheet={(venue) => {
                  if (venue) setSelectedVenue(venue);
                  setShowPostVibe(true);
                }}
              />
            );
          }}
        </Stack.Screen>
        <Stack.Screen name="VenueDetails">
          {({ navigation }) =>
            selectedVenue ? (
              <VenueDetailsLovable
                venue={selectedVenue}
                onBack={() => navigation.goBack()}
                onOpenSheet={(venue) => {
                  if (venue) setSelectedVenue(venue);
                  setShowPostVibe(true);
                }}
                refreshKey={refreshKey}
              />
            ) : null
          }
        </Stack.Screen>
      </Stack.Navigator>
      {showPostVibe && selectedVenue && (
        <AnimatedPostVibeSheet
          venue={selectedVenue}
          onClose={() => setShowPostVibe(false)}
          onSuccess={() => {
            setRefreshKey();
            setShowPostVibe(false);
          }}
        />
      )}
    </>
  );
}

// ---------- EXPLORE STACK NAVIGATOR ----------

function ExploreStackNavigator() {
  const { refreshKey, setRefreshKey } = useAppContext();
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [showPostVibe, setShowPostVibe] = useState(false);

  return (
    <>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#050013" },
        }}
      >
        <Stack.Screen name="ExploreList">
          {({ navigation }) => {
            const tabNavigation = navigation.getParent();
            return (
              <ExploreScreen
                navigation={navigation}
                tabNavigation={tabNavigation}
                onOpenVenue={(venue) => {
                  setSelectedVenue(venue);
                  navigation.navigate("VenueDetails");
                }}
              />
            );
          }}
        </Stack.Screen>
        <Stack.Screen name="VenueDetails">
          {({ navigation }) =>
            selectedVenue ? (
              <VenueDetailsLovable
                venue={selectedVenue}
                onBack={() => navigation.goBack()}
                onOpenSheet={(venue) => {
                  if (venue) setSelectedVenue(venue);
                  setShowPostVibe(true);
                }}
                refreshKey={refreshKey}
              />
            ) : null
          }
        </Stack.Screen>
      </Stack.Navigator>
      {showPostVibe && selectedVenue && (
        <AnimatedPostVibeSheet
          venue={selectedVenue}
          onClose={() => setShowPostVibe(false)}
          onSuccess={() => {
            setRefreshKey();
            setShowPostVibe(false);
          }}
        />
      )}
    </>
  );
}

// ---------- MAIN TABS NAVIGATOR ----------

function MainTabsNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0B0625",
          borderTopColor: "rgba(168,85,247,0.3)",
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
        },
        tabBarActiveTintColor: "#A855F7",
        tabBarInactiveTintColor: "#6B7280",
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color, size }) => {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/cba8ee34-06e8-4e52-ac33-69cdc33161c4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.js:374',message:'tabBarIcon HomeTab size value',data:{size,sizeType:typeof size,isString:typeof size === 'string',isNumber:typeof size === 'number'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            const numericSize = typeof size === 'number' ? size : 24;
            return <Ionicons name="home-outline" size={numericSize} color={color} />;
          },
        }}
      />
      <Tab.Screen
        name="ExploreTab"
        component={ExploreStackNavigator}
        options={{
          tabBarLabel: "Explore",
          tabBarIcon: ({ color, size }) => {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/cba8ee34-06e8-4e52-ac33-69cdc33161c4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.js:384',message:'tabBarIcon ExploreTab size value',data:{size,sizeType:typeof size,isString:typeof size === 'string',isNumber:typeof size === 'number'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            const numericSize = typeof size === 'number' ? size : 24;
            return <Ionicons name="compass-outline" size={numericSize} color={color} />;
          },
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, size }) => {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/cba8ee34-06e8-4e52-ac33-69cdc33161c4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.js:393',message:'tabBarIcon ProfileTab size value',data:{size,sizeType:typeof size,isString:typeof size === 'string',isNumber:typeof size === 'number'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            const numericSize = typeof size === 'number' ? size : 24;
            return <Ionicons name="person-outline" size={numericSize} color={color} />;
          },
        }}
      >
        {({ navigation }) => <ProfileScreen navigation={navigation} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

// ---------- ROOT STACK NAVIGATOR ----------

function RootStackNavigator() {
  const { setIsLoggedIn } = useAppContext();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#050013" },
      }}
    >
      <Stack.Screen name="Landing">
        {({ navigation }) => (
          <LandingScreen
            onDiscover={() => navigation.replace("MainTabs")}
            onSignIn={() => navigation.navigate("SignIn")}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="SignIn">
        {({ navigation }) => (
          <SignInScreen
            onBack={() => navigation.goBack()}
            onSignInSuccess={() => {
              setIsLoggedIn(true);
              navigation.replace("MainTabs");
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="MainTabs"
        component={MainTabsNavigator}
        options={{ gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
}

// ---------- APP ROOT ----------

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <AppProvider>
        <RootStackNavigator />
      </AppProvider>
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
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 3000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1.1,
            duration: 3000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ]),
        Animated.parallel([
          Animated.timing(glowAnim, {
            toValue: 0.3,
            duration: 3000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 3000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ]),
      ])
    ).start();
  }, []);

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0.3, 1],
    outputRange: [0.3, 0.6],
  });

  return (
    <View style={styles.landingRoot}>
      {/* Gradient Background Layers */}
      <View style={styles.landingGradient1} />
      <View style={styles.landingGradient2} />
      
      {/* Animated Blob Behind Logo */}
      <Animated.View
        style={[
          styles.landingBlob,
          {
            opacity: glowOpacity,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      />
      
      <ScrollView
        contentContainerStyle={styles.landingContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo with animated glow */}
        <View style={styles.landingLogoContainer}>
          <Text style={styles.landingLogo}>DarkNite</Text>
        </View>

        <Text style={styles.landingTagline}>Know Before You Go</Text>
        <Text style={styles.landingSubtitle}>
          Live vibes, ratios & lines — NYC
        </Text>

        {/* Benefit Chips */}
        <View style={styles.landingChipsContainer}>
          <View style={styles.landingChip}>
            <Text style={styles.landingChipText}>Live crowd</Text>
          </View>
          <View style={styles.landingChip}>
            <Text style={styles.landingChipText}>Lines</Text>
          </View>
          <View style={styles.landingChip}>
            <Text style={styles.landingChipText}>Music</Text>
          </View>
        </View>

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
      </ScrollView>
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

// ---------- FILTER CHIP COMPONENT ----------

function FilterChip({ label, isActive, onPress, onClear }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.filterChip, isActive && styles.filterChipActive]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.8}
      >
        <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
          {label}
        </Text>
        {isActive && onClear && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onClear();
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.filterChipClearButton}
          >
            <Text style={styles.filterChipClear}>×</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ---------- HOME SCREEN WRAPPER ----------

function HomeScreenWrapper({ navigation, tabNavigation, venues, isLoggedIn, onOpenVenue, onOpenSheet, refreshKey }) {
  return (
    <HomeScreen
      navigation={navigation}
      tabNavigation={tabNavigation}
      venues={venues}
      isLoggedIn={isLoggedIn}
      onOpenVenue={onOpenVenue}
      onOpenSheet={onOpenSheet}
      refreshKey={refreshKey}
    />
  );
}

// ---------- LISTA DE VENUES ----------

function HomeScreen({ navigation, tabNavigation, venues, isLoggedIn, onOpenVenue, onOpenSheet, refreshKey }) {
  const [ratios, setRatios] = useState({}); // { [venueId]: { guys, girls } }
  const [latestVibes, setLatestVibes] = useState({}); // { [venueId]: vibe }
  const [activeFilters, setActiveFilters] = useState({
    nearMe: false,
    noLine: false,
    freeCheap: false,
    packed: false,
    music: [],
  });
  const [showFiltersModal, setShowFiltersModal] = useState(false);

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

  // Filter logic
  const filterVenues = (venuesList) => {
    if (!activeFilters.nearMe && !activeFilters.noLine && !activeFilters.freeCheap && !activeFilters.packed && activeFilters.music.length === 0) {
      return venuesList;
    }

    return venuesList.filter((venue) => {
      const key = venue.id || venue.name;
      const vibe = latestVibes[key];

      if (!vibe) {
        // If no vibe data, only show if no filters are active (already handled above)
        return false;
      }

      // No line filter
      if (activeFilters.noLine && vibe.line !== "No line") {
        return false;
      }

      // Free/cheap filter
      if (activeFilters.freeCheap && vibe.cover !== "Free" && vibe.cover !== "< $10") {
        return false;
      }

      // Packed filter
      if (activeFilters.packed && vibe.crowd !== "Packed") {
        return false;
      }

      // Music filter (OR logic - venue matches if music is in selected array)
      if (activeFilters.music.length > 0) {
        if (!vibe.music || !activeFilters.music.includes(vibe.music)) {
          return false;
        }
      }

      // Near me filter - placeholder (no filtering logic yet)
      // if (activeFilters.nearMe) {
      //   // TODO: Implement location-based filtering when location data is available
      // }

      return true;
    });
  };

  const toggleFilter = (filterType, value = null) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      // Haptics not available
    }
    setActiveFilters((prev) => {
      if (filterType === "music") {
        const musicArray = prev.music.includes(value)
          ? prev.music.filter((m) => m !== value)
          : [...prev.music, value];
        return { ...prev, music: musicArray };
      } else {
        return { ...prev, [filterType]: !prev[filterType] };
      }
    });
  };

  const clearFilter = (filterType, value = null) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      // Haptics not available
    }
    setActiveFilters((prev) => {
      if (filterType === "music") {
        return { ...prev, music: prev.music.filter((m) => m !== value) };
      } else {
        return { ...prev, [filterType]: false };
      }
    });
  };

  const baseVenues = isLoggedIn ? venues : venues.slice(0, 2);
  const filteredVenues = filterVenues(baseVenues);

  const musicOptions = ["Hip-Hop / R&B", "Afrobeats", "House / Techno", "Reggaeton", "Top Hits", "Mixed"];

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.logo}>DarkNite</Text>
          <Text style={styles.headerSubtitle}>Tonight in NYC · Live</Text>
        </View>
        <TouchableOpacity
          onPress={() => tabNavigation?.navigate("ProfileTab")}
          style={styles.mapIconButton}
        >
          <Ionicons name="person-circle-outline" size={28} color="#A855F7" />
        </TouchableOpacity>
      </View>

      {!isLoggedIn && (
        <View style={styles.previewModeBadge}>
          <Text style={styles.previewModeText}>Preview mode</Text>
        </View>
      )}

      {/* Filter Chip Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterChipContainer}
        contentContainerStyle={styles.filterChipContent}
      >
        <FilterChip
          label="Near me"
          isActive={activeFilters.nearMe}
          onPress={() => toggleFilter("nearMe")}
          onClear={() => clearFilter("nearMe")}
        />
        <FilterChip
          label="No line"
          isActive={activeFilters.noLine}
          onPress={() => toggleFilter("noLine")}
          onClear={() => clearFilter("noLine")}
        />
        <FilterChip
          label="Free/cheap"
          isActive={activeFilters.freeCheap}
          onPress={() => toggleFilter("freeCheap")}
          onClear={() => clearFilter("freeCheap")}
        />
        <FilterChip
          label="Packed"
          isActive={activeFilters.packed}
          onPress={() => toggleFilter("packed")}
          onClear={() => clearFilter("packed")}
        />
        {musicOptions.map((musicType) => (
          <FilterChip
            key={musicType}
            label={musicType}
            isActive={activeFilters.music.includes(musicType)}
            onPress={() => toggleFilter("music", musicType)}
            onClear={() => clearFilter("music", musicType)}
          />
        ))}
        <TouchableOpacity
          style={styles.filterChip}
          onPress={() => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (e) {}
            setShowFiltersModal(true);
          }}
        >
          <Text style={styles.filterChipText}>🎚️ Filters</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Filters Modal (Placeholder) */}
      <Modal
        visible={showFiltersModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowFiltersModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowFiltersModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Filters</Text>
                <Text style={styles.modalText}>More filter options coming soon...</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowFiltersModal(false)}
                >
                  <Text style={styles.modalCloseButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <FlatList
        data={filteredVenues}
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
  landingBlob: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#A855F7",
    top: "20%",
    alignSelf: "center",
    zIndex: 0,
  },
  landingLogoContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    position: "relative",
    zIndex: 1,
  },
  landingLogo: {
    fontSize: 56,
    fontWeight: "900",
    color: "#F973FF",
    letterSpacing: -1.5,
    textShadowColor: "rgba(249,115,255,0.5)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  landingTagline: {
    fontSize: 28,
    color: "#F9FAFB",
    fontWeight: "800",
    marginBottom: 12,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  landingSubtitle: {
    color: "#E5E7EB",
    textAlign: "center",
    fontSize: 16,
    marginBottom: 32,
    fontWeight: "500",
  },
  landingChipsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 40,
    flexWrap: "wrap",
  },
  landingChip: {
    backgroundColor: "rgba(168,85,247,0.15)",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  landingChipText: {
    color: "#A855F7",
    fontSize: 13,
    fontWeight: "600",
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
  headerLeft: {
    flex: 1,
  },
  logo: {
    fontSize: 24,
    fontWeight: "800",
    color: "#F5F3FF",
  },
  headerSubtitle: {
    color: "#9CA3AF",
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  mapIconButton: {
    padding: 4,
  },
  previewModeBadge: {
    alignSelf: "flex-start",
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: "rgba(168,85,247,0.15)",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  previewModeText: {
    color: "#A855F7",
    fontSize: 11,
    fontWeight: "600",
  },
  filterChipContainer: {
    marginTop: 8,
    marginBottom: 8,
    maxHeight: 36,
  },
  filterChipContent: {
    paddingHorizontal: 16,
    gap: 6,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(168,85,247,0.1)",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
    height: 32,
  },
  filterChipActive: {
    backgroundColor: "#A855F7",
    borderColor: "#A855F7",
    shadowColor: "#A855F7",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  filterChipText: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "500",
  },
  filterChipTextActive: {
    color: "#F9FAFB",
    fontWeight: "600",
  },
  filterChipClearButton: {
    marginLeft: 6,
    paddingLeft: 4,
  },
  filterChipClear: {
    color: "#F9FAFB",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#0B0625",
    borderRadius: 20,
    padding: 24,
    width: "80%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
  },
  modalTitle: {
    color: "#F9FAFB",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 16,
  },
  modalText: {
    color: "#9CA3AF",
    fontSize: 14,
    marginBottom: 24,
  },
  modalCloseButton: {
    backgroundColor: "#A855F7",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  modalCloseButtonText: {
    color: "#F9FAFB",
    fontSize: 16,
    fontWeight: "600",
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
