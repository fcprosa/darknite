import React, { useState, useEffect } from "react";
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
} from "react-native";
import { createClient } from "@supabase/supabase-js";

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

// vibe mais recente para UMA venue (usamos o id)
async function fetchLatestVibe(venueKey) {
  if (!venueKey) return null;

  const { data, error } = await supabase
    .from("vibes")
    .select("crowd, ratio, line, cover, created_at")
    .eq("venue_id", venueKey)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle(); // se não houver linhas, data = null

  if (error) {
    console.log("Erro a buscar latest vibe:", error.message);
    return null;
  }
  return data;
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
  const [screen, setScreen] = useState("landing"); // landing | list | detail | auth
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [venues, setVenues] = useState(FALLBACK_VENUES);
  const [loadingVenues, setLoadingVenues] = useState(true);

  const [selectedVenue, setSelectedVenue] = useState(null);
  const [showSheet, setShowSheet] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [crowdLevel, setCrowdLevel] = useState(null);
  const [ratio, setRatio] = useState(null);
  const [line, setLine] = useState(null);
  const [cover, setCover] = useState(null);

  // força HomeScreen + VenueDetailScreen a recarregarem vibes
  const [refreshKey, setRefreshKey] = useState(0);

  const crowdOptions = ["Dead", "Chill", "Fun", "Packed", "Chaos"];
  const ratioOptions = ["Mostly guys", "Balanced", "Mostly girls"];
  const lineOptions = ["No line", "0–10 min", "10–30 min", "30+ min"];
  const coverOptions = ["Free", "< $10", "$10–20", "$20+"];

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
    setShowSheet(false);
    setCrowdLevel(null);
    setRatio(null);
    setLine(null);
    setCover(null);
  };

  const goBack = () => {
    setScreen("list");
    setSelectedVenue(null);
    setShowSheet(false);
  };

  // guardar vibe em Supabase
  const handleSubmitVibe = async () => {
    if (!selectedVenue) {
      Alert.alert("Error", "Nenhum bar selecionado.");
      return;
    }

    if (!crowdLevel || !ratio || !line || !cover) {
      Alert.alert("Oops", "Escolhe crowd, ratio, line e cover antes de enviar.");
      return;
    }

    const venueKey = selectedVenue.id || selectedVenue.name;

    try {
      setSubmitting(true);

      const { data, error } = await supabase.from("vibes").insert([
        {
          venue_id: venueKey,
          crowd: crowdLevel,
          ratio,
          line,
          cover,
        },
      ]);

      if (error) {
        Alert.alert("Erro Supabase", error.message);
        console.log("Supabase insert error:", error);
        return;
      }

      console.log("Vibe gravado:", data);
      setShowSheet(false);
      Alert.alert("Obrigado!", "O teu vibe foi guardado.");
      // 🔥 força VENUES + DETAIL a atualizarem depois de guardar
      setRefreshKey((k) => k + 1);
    } catch (e) {
      Alert.alert("Erro inesperado", e.message);
      console.log("Unexpected error:", e);
    } finally {
      setSubmitting(false);
    }
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
            onBackToLanding={() => setScreen("landing")}
            refreshKey={refreshKey}
          />
        ))}

      {screen === "detail" && selectedVenue && (
        <VenueDetailScreen
          venue={selectedVenue}
          onBack={goBack}
          onOpenSheet={() => setShowSheet(true)}
          refreshKey={refreshKey}
        />
      )}

      {/* BOTTOM SHEET POST YOUR VIBE */}
      {showSheet && (
        <View style={styles.sheetOverlay}>
          <TouchableOpacity
            style={styles.sheetBackdrop}
            onPress={() => setShowSheet(false)}
            activeOpacity={1}
          />
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.sheetScroll}
              showsVerticalScrollIndicator={true}
            >
              <Text style={styles.sheetTitle}>Post your vibe 🔥</Text>
              <Text style={styles.sheetSubtitle}>
                We&apos;ll use this to update the crowd, ratio, line &amp; cover.
              </Text>

              {/* CROWD */}
              <View style={styles.sheetRow}>
                <Text style={styles.sheetLabel}>Crowd level</Text>
                <View style={styles.optionsRow}>
                  {crowdOptions.map((opt) => (
                    <OptionChip
                      key={opt}
                      label={opt}
                      selected={crowdLevel === opt}
                      onPress={() => setCrowdLevel(opt)}
                    />
                  ))}
                </View>
              </View>

              {/* RATIO */}
              <View style={styles.sheetRow}>
                <Text style={styles.sheetLabel}>Ratio</Text>
                <View style={styles.optionsRow}>
                  {ratioOptions.map((opt) => (
                    <OptionChip
                      key={opt}
                      label={opt}
                      selected={ratio === opt}
                      onPress={() => setRatio(opt)}
                    />
                  ))}
                </View>
              </View>

              {/* LINE */}
              <View style={styles.sheetRow}>
                <Text style={styles.sheetLabel}>Line</Text>
                <View style={styles.optionsRow}>
                  {lineOptions.map((opt) => (
                    <OptionChip
                      key={opt}
                      label={opt}
                      selected={line === opt}
                      onPress={() => setLine(opt)}
                    />
                  ))}
                </View>
              </View>

              {/* COVER */}
              <View style={styles.sheetRow}>
                <Text style={styles.sheetLabel}>Cover</Text>
                <View style={styles.optionsRow}>
                  {coverOptions.map((opt) => (
                    <OptionChip
                      key={opt}
                      label={opt}
                      selected={cover === opt}
                      onPress={() => setCover(opt)}
                    />
                  ))}
                </View>
              </View>

              {/* BOTÃO */}
              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: 24, marginBottom: 8 }]}
                onPress={handleSubmitVibe}
                disabled={submitting}
              >
                <Text style={styles.primaryButtonText}>
                  {submitting ? "Submitting..." : "Submit vibe"}
                </Text>
              </TouchableOpacity>

              <Text style={styles.sheetHint}>
                Create a free account to drop real vibes and help others decide
                where to go.
              </Text>
            </ScrollView>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ---------- LANDING ----------

function LandingScreen({ onDiscover, onSignIn }) {
  return (
    <View style={styles.landingRoot}>
      <View style={styles.landingOverlay} />
      <View style={styles.landingContent}>
        <Text style={styles.landingLogo}>DarkNite</Text>
        <Text style={styles.landingTagline}>Know Before You Go</Text>
        <Text style={styles.landingSubtitle}>
          Real-time vibes, gender ratios, and lines at NYC&apos;s hottest spots.
        </Text>

        <View style={{ marginTop: 32, width: "100%" }}>
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
          <Text style={{ color: "#F973FF" }} onPress={onDiscover}>
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

  return (
    <SafeAreaView style={styles.signInRoot}>
      <View style={styles.signInHeaderTop}>
        <Text style={styles.logo}>DarkNite</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.signInCenter}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.signInCard}>
          <Text style={styles.signInTitle}>Sign in to DarkNite</Text>
          <Text style={styles.signInSubtitle}>
            Create a free account to see every venue, unlock the map and drop
            real vibes.
          </Text>

          <Text style={styles.signInLabel}>Email</Text>
          <TextInput
            style={styles.signInInput}
            placeholder="you@example.com"
            placeholderTextColor="#6B7280"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.signInLabel}>Password</Text>
          <TextInput
            style={styles.signInInput}
            placeholder="••••••••"
            placeholderTextColor="#6B7280"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={[styles.primaryButton, { marginTop: 24 }]}
            onPress={onSignInSuccess}
          >
            <Text style={styles.primaryButtonText}>Sign in (demo)</Text>
          </TouchableOpacity>

          <Text style={styles.signInHint}>
            Demo only – sign in ainda não cria conta real.
          </Text>

          <TouchableOpacity
            onPress={onBack}
            style={{ marginTop: 16, alignSelf: "center" }}
          >
            <Text style={styles.signInBack}>Back to home</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------- LISTA DE VENUES ----------

function HomeScreen({ venues, isLoggedIn, onOpenVenue, onBackToLanding, refreshKey }) {
  const visibleVenues = isLoggedIn ? venues : venues.slice(0, 2);
  const [ratios, setRatios] = useState({}); // { [venueId]: { guys, girls } }

  useEffect(() => {
    let cancelled = false;

    async function loadRatios() {
      const next = {};
      for (const v of venues) {
        const key = v.id || v.name;
        const vibe = await fetchLatestVibe(key);
        if (vibe && vibe.ratio) {
          next[key] = mapRatioToPercent(vibe.ratio);
        }
      }
      if (!cancelled) setRatios(next);
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

          return (
            <TouchableOpacity
              style={styles.venueCard}
              onPress={() => onOpenVenue(item)}
            >
              <Text style={styles.venueName}>{item.name}</Text>
              <Text style={styles.venueMeta}>{item.neighborhood}</Text>

              <View style={styles.ratioRow}>
                <Text style={styles.ratioLabel}>Gender ratio (last vibe)</Text>
                <Text style={styles.ratioNumbers}>
                  {guys}% guys • {girls}% girls
                </Text>
              </View>
              <View style={styles.ratioBar}>
                {/* GUYS = AZUL, GIRLS = ROSA */}
                <View style={[styles.ratioSegmentGuys, { flex: guys || 1 }]} />
                <View style={[styles.ratioSegmentGirls, { flex: girls || 1 }]} />
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: 14 }]}
                onPress={() => onOpenVenue(item)}
              >
                <Text style={styles.primaryButtonText}>Rate this spot 🔥</Text>
              </TouchableOpacity>
            </TouchableOpacity>
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

function OptionChip({ label, selected, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.optionChip, selected && styles.optionChipActive]}
    >
      <Text style={[styles.optionText, selected && styles.optionTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

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
  },
  landingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  landingContent: {
    paddingHorizontal: 24,
    width: "100%",
    alignItems: "center",
  },
  landingLogo: {
    fontSize: 40,
    fontWeight: "800",
    color: "#F973FF",
    marginBottom: 4,
  },
  landingTagline: {
    fontSize: 20,
    color: "#E5E7EB",
    fontWeight: "600",
    marginBottom: 12,
  },
  landingSubtitle: {
    color: "#9CA3AF",
    textAlign: "center",
    maxWidth: 320,
  },
  landingPrimary: {
    backgroundColor: "#A855F7",
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
    marginBottom: 10,
    shadowColor: "#A855F7",
    shadowOpacity: 0.7,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  landingPrimaryText: {
    color: "#F9FAFB",
    fontWeight: "700",
    fontSize: 16,
  },
  landingSecondary: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#A855F7",
    paddingVertical: 12,
    alignItems: "center",
  },
  landingSecondaryText: {
    color: "#E5E7EB",
    fontWeight: "600",
  },
  landingPeek: {
    color: "#9CA3AF",
    marginTop: 16,
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

  // Bottom sheet
  sheetOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "flex-end",
  },
  sheetBackdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  sheetContainer: {
    height: height * 0.9,
    backgroundColor: "#05041F",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderColor: "rgba(124,58,237,0.4)",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 60,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(156,163,175,0.8)",
    marginBottom: 12,
  },
  sheetScroll: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  sheetTitle: {
    color: "#F9FAFB",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  sheetSubtitle: {
    color: "#9CA3AF",
    marginBottom: 8,
  },
  sheetHint: {
    color: "#9CA3AF",
    textAlign: "center",
    fontSize: 12,
    marginBottom: 8,
  },
  sheetRow: {
    marginBottom: 16,
  },
  sheetLabel: {
    color: "#E5E7EB",
    marginBottom: 8,
    fontWeight: "600",
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  optionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(156,163,175,0.7)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  optionChipActive: {
    backgroundColor: "#A855F7",
    borderColor: "#F9FAFB",
  },
  optionText: {
    color: "#E5E7EB",
    fontSize: 13,
  },
  optionTextActive: {
    color: "#F9FAFB",
    fontWeight: "700",
  },

  // Sign-in
  signInRoot: {
    flex: 1,
    backgroundColor: "#050013",
  },
  signInHeaderTop: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  signInCenter: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  signInCard: {
    backgroundColor: "#05041F",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.5)",
    shadowColor: "#A855F7",
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  signInTitle: {
    color: "#F9FAFB",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  signInSubtitle: {
    color: "#9CA3AF",
    textAlign: "left",
    marginTop: 4,
    marginBottom: 16,
  },
  signInLabel: {
    color: "#E5E7EB",
    fontSize: 13,
    marginBottom: 4,
    marginTop: 12,
  },
  signInInput: {
    backgroundColor: "#020114",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: "#F9FAFB",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
  },
  signInHint: {
    color: "#9CA3AF",
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
  },
  signInBack: {
    color: "#A5B4FC",
    fontSize: 14,
  },
});
