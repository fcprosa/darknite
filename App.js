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
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { supabase } from "./utils/supabase";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import VenueCardLovable from "./components/VenueCardLovable";
import VenueDetailsLovable from "./components/VenueDetailsLovable";
import PostVibeScreen from "./components/PostVibeScreen";
import ExploreScreen from "./components/ExploreScreen";
import NeighborhoodScreen from "./components/NeighborhoodScreen";
import NeighborhoodVenuesScreen from "./components/NeighborhoodVenuesScreen";
import VenuePickerScreen from "./components/VenuePickerScreen";
import ProfileScreen from "./components/ProfileScreen";
import SettingsScreen from "./components/SettingsScreen";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const { height } = Dimensions.get("window");


// Fallback local (se Supabase falhar completamente)
const FALLBACK_VENUES = [
  { id: "Gospel", name: "Gospel", neighborhood: "SoHo", guys: 50, girls: 50, venue_type: "club" },
  {
    id: "Schimanski",
    name: "Schimanski",
    neighborhood: "Williamsburg",
    guys: 50,
    girls: 50,
    venue_type: "bar",
  },
  {
    id: "Skyline",
    name: "Skyline Rooftop",
    neighborhood: "Midtown",
    guys: 50,
    girls: 50,
    venue_type: "bar",
  },
  {
    id: "PublicArts",
    name: "Public Arts",
    neighborhood: "Lower East Side",
    guys: 50,
    girls: 50,
    venue_type: "bar",
  },
];

// ---------- SUPABASE HELPERS ----------

// Buscar venues da tabela `venues`
async function fetchVenues() {
  const { data, error } = await supabase
    .from("venues")
    .select("id, name, neighborhood, default_guys, default_girls, venue_type, lat, lng")
    .order("name", { ascending: true });

  if (error) {
    console.log("Erro a buscar venues:", error.message);
    return FALLBACK_VENUES;
  }

  if (!data || data.length === 0) {
    return FALLBACK_VENUES;
  }

  return data.map((row) => {
    // Normalize venue_type to lowercase, keep as-is from DB (no defaulting)
    const venueType = row.venue_type ? row.venue_type.trim().toLowerCase() : null;
    if (!venueType) {
      console.warn(`[fetchVenues] Warning: venue "${row.name}" has null/undefined venue_type`);
    }
    return {
    id: row.id, // ex: "Gospel"
    name: row.name,
    neighborhood: row.neighborhood,
    guys: row.default_guys ?? 50,
    girls: row.default_girls ?? 50,
      venue_type: venueType, // Normalized lowercase: "club" or "bar" or null
      lat: row.lat || null,
      lng: row.lng || null,
    };
  });
}

// vibe mais recente (últimas 24h)
async function fetchLatestVibe(venueKey) {
  if (!venueKey) return null;

  const since = new Date(
    Date.now() - 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("vibes")
    .select("crowd, ratio, line, cover, drinks_price, music, bar_type, created_at")
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
    .select("crowd, ratio, line, cover, drinks_price, music, bar_type, created_at")
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

// Calculate hotness score for ranking venues in feed
function getHotnessScore(latestVibe) {
  if (!latestVibe || !latestVibe.created_at) {
    return -1000; // Place venues without vibes at bottom
  }

  let score = 0;

  // Recency: newer vibes rank higher (max ~1000 points for very recent)
  const now = new Date();
  const vibeTime = new Date(latestVibe.created_at);
  const diffMs = now - vibeTime;
  const diffHours = diffMs / (1000 * 60 * 60);
  
  // Exponential decay: very recent (< 1 hour) = ~1000, 1 hour = ~500, 2 hours = ~250, etc.
  if (diffHours < 1) {
    score += 1000;
  } else if (diffHours < 2) {
    score += 500;
  } else if (diffHours < 4) {
    score += 250;
  } else if (diffHours < 12) {
    score += 100;
  } else {
    score += Math.max(0, 50 - diffHours * 2); // Decay after 12 hours
  }

  // Crowd: Packed > Fun > Chill > Dead > Unknown
  const crowdScore = {
    "Packed": 500,
    "Chaos": 450,
    "Fun": 300,
    "Chill": 100,
    "Dead": 0,
  };
  score += crowdScore[latestVibe.crowd] || -50;

  // Bonus: No line (+100)
  if (latestVibe.line === "No line") {
    score += 100;
  }

  // Bonus: Free or cheap cover (+50)
  if (latestVibe.cover === "Free" || latestVibe.cover === "< $10") {
    score += 50;
  }

  return score;
}

// ---------- APP CONTEXT FOR SHARED STATE ----------

const AppContext = React.createContext(null);

function AppProvider({ children }) {
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
  const { venues, refreshKey, setRefreshKey } = useAppContext();
  const { requireAuth, isAuthenticated } = useAuth();
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
                refreshKey={refreshKey}
                selectedVenue={selectedVenue}
                setSelectedVenue={setSelectedVenue}
                onOpenVenue={(venue) => {
                  setSelectedVenue(venue);
                  navigation.navigate("VenueDetails");
                }}
                onOpenSheet={(venue) => {
                  requireAuth(() => {
                    if (venue) setSelectedVenue(venue);
                    setShowPostVibe(true);
                  });
                }}
              />
            );
          }}
        </Stack.Screen>
        <Stack.Screen name="VenuePicker">
          {({ navigation, route }) => (
            <VenuePickerScreen navigation={navigation} route={route} />
          )}
        </Stack.Screen>
        <Stack.Screen name="PostVibe">
          {({ navigation, route }) => {
            const params = route.params || {};
            if (!params.venueId && !params.venueName) {
              // Missing venue data - redirect back to picker
              console.error("[Home] PostVibe opened without venue data, redirecting to picker");
              return (
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#050013" }}>
                  <Text style={{ color: "#F9FAFB", fontSize: 16, marginBottom: 16 }}>Please select a venue</Text>
                  <TouchableOpacity
                    style={{
                      backgroundColor: "#A855F7",
                      paddingHorizontal: 24,
                      paddingVertical: 12,
                      borderRadius: 8,
                    }}
                    onPress={() => navigation.replace("VenuePicker")}
                  >
                    <Text style={{ color: "#F9FAFB", fontWeight: "600" }}>Choose Venue</Text>
                  </TouchableOpacity>
                </View>
              );
            }
            
            // Create venue object for PostVibeScreen
            const venue = {
              id: params.venueId,
              name: params.venueName,
              venue_type: params.venueType,
              neighborhood: params.neighborhood,
            };
            
            // Safe back handler - check if we can go back, else navigate to Home
            const handleBack = () => {
              if (navigation?.canGoBack?.()) {
                navigation.goBack();
              } else {
                // Fallback to Home tab
                const tabNav = navigation.getParent();
                if (tabNav) {
                  tabNav.navigate("HomeTab");
                } else {
                  navigation.navigate("HomeList");
                }
              }
            };
            
            return (
              <PostVibeScreen
                venue={venue}
                navigation={navigation}
                route={route}
                onBack={handleBack}
                onSuccess={() => {
                  // Refresh the Home feed by incrementing refreshKey
                  setRefreshKey();
                  // Note: PostVibeScreen will handle closing/navigation itself
                }}
              />
            );
          }}
        </Stack.Screen>
        <Stack.Screen name="VenueDetails">
          {({ navigation, route }) => {
            // Support both state-based (HomeList) and params-based navigation
            const venueFromState = selectedVenue;
            const venueFromParams = route?.params?.venue;
            const venueIdFromParams = route?.params?.venueId;
            
            console.log("[Home] VenueDetails route.params:", route?.params);
            console.log("[Home] selectedVenue:", !!selectedVenue, selectedVenue?.name);
            
            // Prefer state (HomeList flow), fallback to params
            const venue = venueFromState || venueFromParams;
            
            // If we have venueId but no venue object, fetch it
            const [fetchedVenue, setFetchedVenue] = useState(null);
            const [fetchingVenue, setFetchingVenue] = useState(false);
            
            useEffect(() => {
              if (!venue && venueIdFromParams && !fetchingVenue) {
                setFetchingVenue(true);
                supabase
                  .from("venues")
                  .select("id, name, neighborhood, default_guys, default_girls, venue_type")
                  .eq("id", venueIdFromParams)
                  .maybeSingle()
                  .then(({ data, error }) => {
                    if (!error && data) {
                      setFetchedVenue({
                        id: data.id,
                        name: data.name,
                        neighborhood: data.neighborhood || "Unknown",
                        guys: data.default_guys ?? 50,
                        girls: data.default_girls ?? 50,
                        venue_type: data.venue_type ? data.venue_type.trim().toLowerCase() : null,
                      });
                    }
                    setFetchingVenue(false);
                  });
              }
            }, [venue, venueIdFromParams, fetchingVenue]);
            
            const finalVenue = venue || fetchedVenue;
            
            if (!finalVenue) {
              // Show error state if no venue data
              return (
                <View style={{ flex: 1, backgroundColor: "#050013", justifyContent: "center", alignItems: "center", padding: 24 }}>
                  <Text style={{ color: "#E5E7EB", fontSize: 18, fontWeight: "600", marginBottom: 8, textAlign: "center" }}>
                    Venue not found
                  </Text>
                  <Text style={{ color: "#9CA3AF", fontSize: 14, marginBottom: 24, textAlign: "center" }}>
                    Unable to load venue details. Please try again.
                  </Text>
                  <TouchableOpacity
                    style={{
                      backgroundColor: "#A855F7",
                      paddingHorizontal: 24,
                      paddingVertical: 12,
                      borderRadius: 8,
                    }}
                    onPress={() => navigation.goBack()}
                  >
                    <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>Go Back</Text>
                  </TouchableOpacity>
                </View>
              );
            }
            
            return (
              <VenueDetailsLovable
                venue={finalVenue}
                onBack={() => navigation.goBack()}
                onOpenSheet={(venue) => {
                  if (venue) setSelectedVenue(venue);
                  setShowPostVibe(true);
                }}
                refreshKey={refreshKey}
              />
            );
          }}
        </Stack.Screen>
      </Stack.Navigator>
      {showPostVibe && selectedVenue && (
        <AnimatedPostVibeSheet
          venue={selectedVenue}
          navigation={null}
          route={{ params: { origin: 'home' } }}
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
  const { requireAuth } = useAuth();
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
        <Stack.Screen name="NeighborhoodVenues">
          {({ navigation, route }) => (
            <NeighborhoodVenuesScreen navigation={navigation} route={route} />
          )}
        </Stack.Screen>
        <Stack.Screen name="VenueDetails">
          {({ navigation, route }) => {
            // Support both state-based (Home) and params-based (Explore) navigation
            const venueFromState = selectedVenue;
            const venueFromParams = route?.params?.venue;
            const venueIdFromParams = route?.params?.venueId;
            
            console.log("[Explore] VenueDetails route.params:", route?.params);
            console.log("[Explore] selectedVenue:", !!selectedVenue, selectedVenue?.name);
            
            // Prefer state (Home flow), fallback to params (Explore flow)
            const venue = venueFromState || venueFromParams;
            
            // If we have venueId but no venue object, fetch it
            const [fetchedVenue, setFetchedVenue] = useState(null);
            const [fetchingVenue, setFetchingVenue] = useState(false);
            
            useEffect(() => {
              if (!venue && venueIdFromParams && !fetchingVenue) {
                setFetchingVenue(true);
                supabase
                  .from("venues")
                  .select("id, name, neighborhood, default_guys, default_girls, venue_type")
                  .eq("id", venueIdFromParams)
                  .maybeSingle()
                  .then(({ data, error }) => {
                    if (!error && data) {
                      setFetchedVenue({
                        id: data.id,
                        name: data.name,
                        neighborhood: data.neighborhood || "Unknown",
                        guys: data.default_guys ?? 50,
                        girls: data.default_girls ?? 50,
                        venue_type: data.venue_type ? data.venue_type.trim().toLowerCase() : null,
                      });
                    }
                    setFetchingVenue(false);
                  });
              }
            }, [venue, venueIdFromParams, fetchingVenue]);
            
            const finalVenue = venue || fetchedVenue;
            
            if (!finalVenue) {
              // Show error state if no venue data
              return (
                <View style={{ flex: 1, backgroundColor: "#050013", justifyContent: "center", alignItems: "center", padding: 24 }}>
                  <Text style={{ color: "#E5E7EB", fontSize: 18, fontWeight: "600", marginBottom: 8, textAlign: "center" }}>
                    Venue not found
                  </Text>
                  <Text style={{ color: "#9CA3AF", fontSize: 14, marginBottom: 24, textAlign: "center" }}>
                    Unable to load venue details. Please try again.
                  </Text>
                  <TouchableOpacity
                    style={{
                      backgroundColor: "#A855F7",
                      paddingHorizontal: 24,
                      paddingVertical: 12,
                      borderRadius: 8,
                    }}
                    onPress={() => navigation.goBack()}
                  >
                    <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>Go Back</Text>
                  </TouchableOpacity>
                </View>
              );
            }
            
            return (
              <VenueDetailsLovable
                venue={finalVenue}
                onBack={() => navigation.goBack()}
                onOpenSheet={(venue) => {
                  if (venue) setSelectedVenue(venue);
                  setShowPostVibe(true);
                }}
                refreshKey={refreshKey}
              />
            );
          }}
        </Stack.Screen>
      </Stack.Navigator>
      {showPostVibe && selectedVenue && (
        <AnimatedPostVibeSheet
          venue={selectedVenue}
          navigation={null}
          route={{ params: { origin: 'explore' } }}
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
        tabBarIconSize: 24,
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
            // Explicitly handle "large" string and ensure numeric value
            let numericSize = 24; // default
            if (typeof size === 'number' && !isNaN(size)) {
              numericSize = size;
            } else if (typeof size === 'string') {
              // Explicitly handle "large" or any other string
              numericSize = size === 'large' ? 24 : parseInt(size, 10) || 24;
            }
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
            // Explicitly handle "large" string and ensure numeric value
            let numericSize = 24; // default
            if (typeof size === 'number' && !isNaN(size)) {
              numericSize = size;
            } else if (typeof size === 'string') {
              // Explicitly handle "large" or any other string
              numericSize = size === 'large' ? 24 : parseInt(size, 10) || 24;
            }
            return <Ionicons name="compass-outline" size={numericSize} color={color} />;
          },
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, size }) => {
            // Explicitly handle "large" string and ensure numeric value
            let numericSize = 24; // default
            if (typeof size === 'number' && !isNaN(size)) {
              numericSize = size;
            } else if (typeof size === 'string') {
              // Explicitly handle "large" or any other string
              numericSize = size === 'large' ? 24 : parseInt(size, 10) || 24;
            }
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

function RootStackNavigator({ initialRouteName = "Landing" }) {
  const { session } = useAuth();

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#050013" },
      }}
    >
      <Stack.Screen name="Landing">
        {({ navigation }) => (
          <LandingScreen
            onDiscover={() => {
              // If user is authenticated, navigate to MainTabs
              if (session) {
                navigation.replace("MainTabs");
              } else {
                // Guest mode - navigate to MainTabs but show auth prompts
                navigation.replace("MainTabs");
              }
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="MainTabs"
        component={MainTabsNavigator}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="Settings">
        {({ navigation }) => <SettingsScreen navigation={navigation} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

// ---------- APP ROOT ----------

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <AuthProvider>
        <AppProvider>
          <RootNavigator />
          <AuthModalWrapper />
        </AppProvider>
      </AuthProvider>
    </SafeAreaView>
  );
}

// Root navigator that conditionally renders based on auth state
function RootNavigator() {
  const { session, loading, user } = useAuth();

  // Debug logging
  console.log("[Root] loading:", loading, "session:", !!session, "user:", user?.email);

  // Show loading screen while checking auth state
  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#A855F7" />
      </View>
    );
  }

  // Use key prop to force remount when auth state changes
  // This ensures navigation resets properly between Landing and MainTabs
  const initialRoute = session && user ? "MainTabs" : "Landing";
  const navKey = session && user ? "authenticated" : "guest";

  return <RootStackNavigator key={navKey} initialRouteName={initialRoute} />;
}

// Wrapper to access auth context and show modal globally
function AuthModalWrapper() {
  const { showAuthModal, setShowAuthModal } = useAuth();
  return <AuthModal visible={showAuthModal} onClose={() => setShowAuthModal(false)} />;
}

// ---------- ANIMATED POST VIBE SHEET ----------

function AnimatedPostVibeSheet({ venue, navigation, route, onClose, onSuccess }) {
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
            navigation={navigation}
            route={route}
            onBack={closeSheet}
            onSuccess={onSuccess}
          />
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}

// ---------- LANDING ----------

function LandingScreen({ onDiscover }) {
  const { setShowAuthModal } = useAuth();
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

          <TouchableOpacity style={styles.landingSecondary} onPress={() => setShowAuthModal(true)}>
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

// ---------- SIGN-IN WITH APPLE ----------

// Password validation helper
const validatePassword = (password) => {
  if (!password) return { valid: false, error: "Password is required" };
  if (password.length < 8) return { valid: false, error: "Password must be at least 8 characters" };
  if (!/[A-Z]/.test(password)) return { valid: false, error: "Password must contain at least one uppercase letter" };
  if (!/[0-9]/.test(password)) return { valid: false, error: "Password must contain at least one number" };
  return { valid: true, error: null };
};

// Auth Modal Component
function AuthModal({ visible, onClose }) {
  const { signUp, signIn } = useAuth();
  const [activeTab, setActiveTab] = useState("signin"); // "signin" or "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [emailSent, setEmailSent] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState(null);

  // Reset form when modal opens/closes or tab changes
  useEffect(() => {
    if (visible) {
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setError(null);
      setEmailSent(false);
      setPasswordError(null);
      setConfirmPasswordError(null);
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
      const { data, error: signUpError } = await signUp(email, password);
      
      if (signUpError) {
        setError(signUpError.message || "Sign up failed");
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

  const isSignInValid = email.includes("@") && password.length > 0;
  const isSignUpValid = 
    email.includes("@") && 
    validatePassword(password).valid && 
    confirmPassword === password &&
    confirmPassword.length > 0;

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

                    {/* Guest Option */}
            <TouchableOpacity
                      style={styles.authGuestButton}
                      onPress={onClose}
                      disabled={loading}
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

function HomeScreenWrapper({ navigation, tabNavigation, venues, onOpenVenue, onOpenSheet, refreshKey, selectedVenue, setSelectedVenue }) {
  return (
    <HomeScreen
      navigation={navigation}
      tabNavigation={tabNavigation}
      venues={venues}
      onOpenVenue={onOpenVenue}
      onOpenSheet={onOpenSheet}
      refreshKey={refreshKey}
      selectedVenue={selectedVenue}
      setSelectedVenue={setSelectedVenue}
    />
  );
}

// ---------- LISTA DE VENUES ----------

function HomeScreen({ navigation, tabNavigation, venues, onOpenVenue, onOpenSheet, refreshKey, selectedVenue, setSelectedVenue }) {
  const { setShowAuthModal, isAuthenticated } = useAuth();
  const isLoggedIn = isAuthenticated;
  const [ratios, setRatios] = useState({}); // { [venueId]: { guys, girls } }
  const [latestVibes, setLatestVibes] = useState({}); // { [venueId]: vibe }
  const [feedMode, setFeedMode] = useState("forYou"); // "forYou" | "hotNow"
  const [hotNowVenues, setHotNowVenues] = useState([]); // Venues with recent vibes
  const [hotNowLoading, setHotNowLoading] = useState(false);

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

  // Load Hot Now venues (venues with vibes in last 12 hours)
  useEffect(() => {
    if (feedMode !== "hotNow") return;

    let cancelled = false;

    async function loadHotNow() {
      setHotNowLoading(true);
      try {
        // Query vibes from last 12 hours
        const hoursAgo = 12; // Configurable
        const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

        const { data: vibesData, error: vibesError } = await supabase
          .from("vibes")
          .select("venue_id, crowd, ratio, line, cover, drinks_price, music, bar_type, created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: false });

        if (vibesError) {
          console.error("[Home] Error fetching hot now vibes:", vibesError.message);
          if (!cancelled) {
            setHotNowVenues([]);
            setHotNowLoading(false);
          }
          return;
        }

        if (!vibesData || vibesData.length === 0) {
          if (!cancelled) {
            setHotNowVenues([]);
            setHotNowLoading(false);
          }
          return;
        }

        // Dedupe by venue_id - keep first occurrence (latest)
        const vibeMap = new Map();
        for (const vibe of vibesData) {
          if (!vibeMap.has(vibe.venue_id)) {
            vibeMap.set(vibe.venue_id, vibe);
          }
        }

        const venueIds = Array.from(vibeMap.keys());

        // Fetch venue rows for those venue_ids
        const { data: venuesData, error: venuesError } = await supabase
          .from("venues")
          .select("id, name, neighborhood, default_guys, default_girls, venue_type")
          .in("id", venueIds);

        if (venuesError) {
          console.error("[Home] Error fetching hot now venues:", venuesError.message);
          if (!cancelled) {
            setHotNowVenues([]);
            setHotNowLoading(false);
          }
          return;
        }

        // Join in-memory: create list with venue + latestVibe + guys/girls
        const hotNowList = (venuesData || []).map((venue) => {
          const vibe = vibeMap.get(venue.id);
          const ratio = vibe?.ratio ? mapRatioToPercent(vibe.ratio) : null;
          return {
            venue,
            latestVibe: vibe || null,
            guys: ratio?.guys ?? venue.default_guys ?? 50,
            girls: ratio?.girls ?? venue.default_girls ?? 50,
            created_at: vibe?.created_at || null,
          };
        });

        // Sort by created_at desc (most recent first), tie-break by crowd score
        hotNowList.sort((a, b) => {
          if (!a.created_at && !b.created_at) return 0;
          if (!a.created_at) return 1;
          if (!b.created_at) return -1;
          const timeDiff = new Date(b.created_at) - new Date(a.created_at);
          if (timeDiff !== 0) return timeDiff;
          // Tie-break by crowd score
          const crowdScores = { Dead: 1, Chill: 2, Fun: 3, Packed: 4, Chaos: 5 };
          const scoreA = crowdScores[a.latestVibe?.crowd] || 0;
          const scoreB = crowdScores[b.latestVibe?.crowd] || 0;
          return scoreB - scoreA;
        });

        if (!cancelled) {
          setHotNowVenues(hotNowList);
          setHotNowLoading(false);
        }
      } catch (error) {
        console.error("[Home] Error in loadHotNow:", error);
        if (!cancelled) {
          setHotNowVenues([]);
          setHotNowLoading(false);
        }
      }
    }

    loadHotNow();

    return () => {
      cancelled = true;
    };
  }, [feedMode, refreshKey]);

  // Sort venues by hotness score for "For You" feed
  const getSortedVenues = () => {
    if (feedMode === "hotNow") {
      // Return hot now venues (already sorted)
      return hotNowVenues.map((item) => item.venue);
    }
    
    const baseVenues = isLoggedIn ? venues : venues.slice(0, 2);
    
    if (feedMode === "forYou") {
      // Sort by hotness score
      return [...baseVenues].sort((a, b) => {
        const keyA = a.id || a.name;
        const keyB = b.id || b.name;
        const vibeA = latestVibes[keyA];
        const vibeB = latestVibes[keyB];
        const scoreA = getHotnessScore(vibeA);
        const scoreB = getHotnessScore(vibeB);
        return scoreB - scoreA; // Descending order
      });
    }
    
    return baseVenues;
  };

  const sortedVenues = getSortedVenues();
  
  // Get latest vibe and ratio for a venue (works for both feed modes)
  const getVenueData = (venue) => {
    if (feedMode === "hotNow") {
      const hotNowItem = hotNowVenues.find((item) => item.venue.id === venue.id);
      if (hotNowItem) {
        return {
          latestVibe: hotNowItem.latestVibe,
          guys: hotNowItem.guys,
          girls: hotNowItem.girls,
        };
      }
    }
    // Fallback to regular lookup
    const key = venue.id || venue.name;
    const liveRatio = ratios[key];
    return {
      latestVibe: latestVibes[key] || null,
      guys: liveRatio?.guys ?? venue.guys,
      girls: liveRatio?.girls ?? venue.girls,
    };
  };

  // Handle FAB press for posting vibes
  const handleFABPress = () => {
    if (!isLoggedIn) {
      // Not authenticated - prompt to sign in
      Alert.alert(
        "Sign in required",
        "Please sign in to post vibes",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Sign in",
            onPress: () => setShowAuthModal(true),
          },
        ]
      );
      return;
    }
    console.log("[Home] FAB pressed, navigating to VenuePicker");
    // Navigate to venue picker screen
    navigation.navigate("VenuePicker");
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
        <Text style={styles.logo}>DarkNite</Text>
          <Text style={styles.headerSubtitle}>Feed · Live vibes</Text>
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

      {/* For You / Hot Now Toggle */}
      <View style={styles.feedToggleContainer}>
        <TouchableOpacity
          style={[styles.feedToggleButton, feedMode === "forYou" && styles.feedToggleButtonActive]}
          onPress={() => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (e) {}
            setFeedMode("forYou");
          }}
        >
          <Text style={[styles.feedToggleText, feedMode === "forYou" && styles.feedToggleTextActive]}>
            For You
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.feedToggleButton, feedMode === "hotNow" && styles.feedToggleButtonActive]}
          onPress={() => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (e) {}
            setFeedMode("hotNow");
          }}
        >
          <Text style={[styles.feedToggleText, feedMode === "hotNow" && styles.feedToggleTextActive]}>
            Hot Now
          </Text>
        </TouchableOpacity>
      </View>

      {feedMode === "hotNow" && hotNowLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading hot venues…</Text>
        </View>
      ) : (
      <FlatList
          data={sortedVenues}
        keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListEmptyComponent={
            feedMode === "hotNow" ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No venues with recent vibes</Text>
              </View>
            ) : null
          }
        renderItem={({ item }) => {
            const venueData = getVenueData(item);
          return (
            <VenueCardLovable
              venue={item}
                guys={venueData.guys}
                girls={venueData.girls}
              onPress={() => onOpenVenue(item)}
                latestVibe={venueData.latestVibe}
            />
          );
        }}
      />
      )}

      {/* Floating Action Button (FAB) */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleFABPress}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+ Post Vibe</Text>
      </TouchableOpacity>

    </View>
  );
}

// ---------- DETALHE DA VENUE ----------

function VenueDetailScreen({ venue, onBack, onOpenSheet, refreshKey }) {
  const { requireAuth } = useAuth();
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
        onPress={() => {
          requireAuth(() => {
            if (onOpenSheet) onOpenSheet(venue);
          });
        }}
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
  feedToggleContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: "rgba(168,85,247,0.1)",
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.2)",
  },
  feedToggleButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  feedToggleButtonActive: {
    backgroundColor: "#A855F7",
  },
  feedToggleText: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "600",
  },
  feedToggleTextActive: {
    color: "#F9FAFB",
    fontWeight: "700",
  },
  nearYouHint: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(168,85,247,0.1)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.2)",
  },
  nearYouHintText: {
    color: "#A855F7",
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
  loadingText: {
    color: "#E5E7EB",
    fontSize: 14,
  },
  emptyContainer: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    color: "#9CA3AF",
    fontSize: 14,
  },
  fab: {
    position: "absolute",
    bottom: 80,
    right: 16,
    backgroundColor: "#A855F7",
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 20,
    shadowColor: "#A855F7",
    shadowOpacity: 0.8,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  fabText: {
    color: "#F9FAFB",
    fontSize: 15,
    fontWeight: "700",
    marginLeft: 4,
  },
  venuePickerModal: {
    backgroundColor: "#0B0625",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(168,85,247,0.2)",
  },
  venuePickerItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(168,85,247,0.1)",
  },
  venuePickerItemName: {
    color: "#F9FAFB",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  venuePickerItemNeighborhood: {
    color: "#9CA3AF",
    fontSize: 13,
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
  appleSignInButton: {
    backgroundColor: "#000000",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    marginTop: 24,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  appleSignInButtonDisabled: {
    opacity: 0.6,
  },
  appleSignInButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  signInErrorContainer: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  signInErrorText: {
    color: "#EF4444",
    fontSize: 14,
    textAlign: "center",
  },
  signInErrorHelpText: {
    color: "#9CA3AF",
    fontSize: 11,
    textAlign: "center",
    marginTop: 8,
  },
  magicLinkContainer: {
    marginTop: 16,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(168,85,247,0.2)",
  },
  dividerText: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600",
    marginHorizontal: 16,
  },
  emailInput: {
    backgroundColor: "#050013",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#F9FAFB",
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.3)",
    marginBottom: 12,
  },
  magicLinkButton: {
    backgroundColor: "#A855F7",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#A855F7",
  },
  magicLinkButtonDisabled: {
    opacity: 0.5,
  },
  magicLinkButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  guestButton: {
    backgroundColor: "transparent",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.3)",
    marginTop: 12,
  },
  guestButtonText: {
    color: "#A855F7",
    fontSize: 16,
    fontWeight: "600",
  },
  guestHint: {
    color: "#6B7280",
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 18,
  },
  magicLinkSentContainer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  magicLinkSentTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F9FAFB",
    marginBottom: 8,
  },
  magicLinkSentText: {
    fontSize: 16,
    color: "#E5E7EB",
    textAlign: "center",
    marginBottom: 8,
  },
  magicLinkSentSubtext: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  magicLinkContainer: {
    marginTop: 16,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(168,85,247,0.2)",
  },
  dividerText: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600",
    marginHorizontal: 16,
  },
  emailInput: {
    backgroundColor: "#050013",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#F9FAFB",
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.3)",
    marginBottom: 12,
  },
  magicLinkButton: {
    backgroundColor: "#A855F7",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#A855F7",
  },
  magicLinkButtonDisabled: {
    opacity: 0.5,
  },
  magicLinkButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  guestButton: {
    backgroundColor: "transparent",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.3)",
    marginTop: 12,
  },
  guestButtonText: {
    color: "#A855F7",
    fontSize: 16,
    fontWeight: "600",
  },
  guestHint: {
    color: "#6B7280",
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 18,
  },
  magicLinkSentContainer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  magicLinkSentTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F9FAFB",
    marginBottom: 8,
  },
  magicLinkSentText: {
    fontSize: 16,
    color: "#E5E7EB",
    textAlign: "center",
    marginBottom: 8,
  },
  magicLinkSentSubtext: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  // Auth Modal Styles
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
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.3)",
    marginTop: 12,
  },
  authGuestButtonText: {
    color: "#A855F7",
    fontSize: 16,
    fontWeight: "600",
  },
  authGuestHint: {
    color: "#6B7280",
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 18,
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
