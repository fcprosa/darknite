import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  Linking,
  Platform,
} from "react-native";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://uttcnvqhhmkfkccwjgnt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_FRoLIm9eLIJYnjSMJ68KCw_hwr4zuiF";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper functions (same as App.js)
async function fetchLatestVibe(venueKey) {
  if (!venueKey) return null;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("vibes")
    .select("id, crowd, ratio, line, cover, music, created_at, stay_duration, tags")
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

async function fetchRecentVibes(venueKey, hours = 2) {
  if (!venueKey) return [];

  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

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

function getCrowdEmoji(crowd) {
  switch (crowd) {
    case "Dead":
      return "💀";
    case "Chill":
      return "😌";
    case "Fun":
      return "🎉";
    case "Packed":
      return "🔥";
    case "Chaos":
      return "⚡";
    default:
      return "❓";
  }
}

function getMusicEmoji(music) {
  if (!music) return "🎵";
  if (music.includes("Hip-Hop")) return "🎤";
  if (music.includes("Afrobeats")) return "🥁";
  if (music.includes("House") || music.includes("Techno")) return "🎛️";
  if (music.includes("Reggaeton")) return "🪇";
  if (music.includes("Top Hits")) return "🔥";
  if (music.includes("Mixed")) return "🎶";
  return "🎵";
}

function formatTimeAgo(dateString) {
  if (!dateString) return "";
  const now = new Date();
  const then = new Date(dateString);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `about ${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `about ${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `about ${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function openMaps(address) {
  const encodedAddress = encodeURIComponent(address);
  const url =
    Platform.OS === "ios"
      ? `maps://maps.apple.com/?q=${encodedAddress}`
      : `geo:0,0?q=${encodedAddress}`;

  Linking.openURL(url).catch((err) => {
    // Fallback to web maps
    const webUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    Linking.openURL(webUrl).catch(console.error);
  });
}

export default function VenueDetailsLovable({
  venue,
  onBack,
  onOpenSheet,
  refreshKey,
}) {
  const [latestVibe, setLatestVibe] = useState(null);
  const [recentVibes, setRecentVibes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!venue) return;
      setLoading(true);
      // Defensive: ensure we have a valid key
      const key = venue?.id || venue?.name;
      if (!key) {
        if (isMounted) {
          setLoading(false);
        }
        return;
      }
      const [latest, recent] = await Promise.all([
        fetchLatestVibe(key),
        fetchRecentVibes(key, 2),
      ]);
      if (isMounted) {
        setLatestVibe(latest);
        setRecentVibes(recent);
        setLoading(false);
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [venue, refreshKey]);

  // Show loading state if venue is temporarily missing (not genuinely unknown)
  if (!venue) {
    return (
      <View style={styles.container}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: "#E5E7EB" }}>Loading venue...</Text>
        </View>
      </View>
    );
  }

  // Defensive checks: ensure venue properties are defined
  // Only show "Unknown Venue" if venue exists but name is genuinely missing
  const venueName = venue?.name || "Unknown Venue";
  const venueNeighborhood = venue?.neighborhood || "NYC";
  const fullAddress = `${venueName}, ${venueNeighborhood}, NYC`;

  const hasVibe = !!latestVibe;
  const vibeCount = recentVibes.length;

  const crowdEmoji = hasVibe ? getCrowdEmoji(latestVibe.crowd) : "❓";
  const crowdText = hasVibe ? latestVibe.crowd : "Unknown";
  const lineText = hasVibe ? latestVibe.line : "Unknown";
  const coverText = hasVibe ? latestVibe.cover : "Unknown";
  const musicText = hasVibe ? latestVibe.music : null;
  const musicEmoji = musicText ? getMusicEmoji(musicText) : "🎵";

  const ratioPercent = hasVibe
    ? mapRatioToPercent(latestVibe.ratio)
    : { guys: 50, girls: 50 };

  const ratioText = hasVibe
    ? latestVibe.ratio
    : "Unknown";


  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Hero Image */}
        <View style={styles.heroContainer}>
          <ImageBackground
            source={require("../assets/splash-icon.png")}
            style={styles.heroImage}
            imageStyle={styles.heroImageStyle}
          >
            <View style={styles.heroOverlay} />
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <View style={styles.backButtonCircle}>
                <Text style={styles.backButtonText}>←</Text>
              </View>
            </TouchableOpacity>
          </ImageBackground>
        </View>

        {/* Glassy Card with Venue Info */}
        <View style={styles.glossyCard}>
          <Text style={styles.venueName}>{venueName}</Text>
          <Text style={styles.venueAddress}>{fullAddress}</Text>
        </View>

        {/* Post Your Vibe Button */}
        <TouchableOpacity style={styles.primaryButton} onPress={() => onOpenSheet(venue)}>
          <Text style={styles.primaryButtonText}>Post your vibe 🔥</Text>
        </TouchableOpacity>

        {/* Right Now Section */}
        <Text style={styles.sectionTitle}>Right now</Text>
        <View style={styles.rightNowCard}>
          {loading ? (
            <Text style={styles.mutedText}>Loading...</Text>
          ) : !hasVibe || vibeCount === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.mutedText}>No recent vibes yet</Text>
              <Text style={styles.mutedTextSmall}>
                Be the first to post a vibe!
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.rightNowSummaryRow}>
                <Text style={styles.rightNowSummaryText}>
                  {crowdText} • {ratioText}{musicText ? ` • ${musicEmoji} ${musicText}` : ""}
                </Text>
              </View>
              <View style={styles.rightNowRow}>
                <View style={styles.rightNowItem}>
                  <Text style={styles.rightNowEmoji}>{crowdEmoji}</Text>
                  <View>
                    <Text style={styles.rightNowLabel}>Crowd</Text>
                    <Text style={styles.rightNowValue}>{crowdText}</Text>
                  </View>
                </View>
                <View style={styles.rightNowItem}>
                  <View>
                    <Text style={styles.rightNowLabel}>Ratio</Text>
                    <Text style={styles.rightNowValue}>{ratioText}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.rightNowRow}>
                <View style={styles.rightNowItem}>
                  <View>
                    <Text style={styles.rightNowLabel}>Line</Text>
                    <Text style={styles.rightNowValue}>{lineText}</Text>
                  </View>
                </View>
                <View style={styles.rightNowItem}>
                  <View>
                    <Text style={styles.rightNowLabel}>Cover</Text>
                    <Text style={styles.rightNowValue}>{coverText}</Text>
                  </View>
                </View>
              </View>
              {musicText && (
                <View style={styles.rightNowRow}>
                  <View style={styles.rightNowItem}>
                    <Text style={styles.rightNowEmoji}>{musicEmoji}</Text>
                    <View>
                      <Text style={styles.rightNowLabel}>Music</Text>
                      <Text style={styles.rightNowValue}>{musicText}</Text>
                    </View>
                  </View>
                </View>
              )}
              <View style={styles.rightNowFooter}>
                <Text style={styles.footerText}>
                  {vibeCount} vibe{vibeCount === 1 ? "" : "s"} in last 2h
                </Text>
                <Text style={styles.footerText}>
                  {formatTimeAgo(latestVibe.created_at)}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Recent Updates */}
        {!loading && recentVibes.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Recent updates</Text>
            {recentVibes.slice(0, 10).map((vibe, index) => {
              const vibeMusicEmoji = vibe.music ? getMusicEmoji(vibe.music) : "";
              const vibeMusicText = vibe.music ? ` • ${vibeMusicEmoji} ${vibe.music}` : "";
              return (
                <View key={index} style={styles.recentUpdateRow}>
                  <Text style={styles.recentUpdateEmoji}>
                    {getCrowdEmoji(vibe.crowd)}
                  </Text>
                  <View style={styles.recentUpdateContent}>
                    <Text style={styles.recentUpdateText}>
                      {vibe.crowd} • {vibe.ratio}{vibeMusicText}
                    </Text>
                    <Text style={styles.recentUpdateTime}>
                      {formatTimeAgo(vibe.created_at)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* Location Card */}
        <View style={styles.locationCard}>
          <Text style={styles.locationTitle}>Location</Text>
          <Text style={styles.locationAddress}>{fullAddress}</Text>
          <TouchableOpacity
            style={styles.mapsButton}
            onPress={() => openMaps(fullAddress)}
          >
            <Text style={styles.mapsButtonText}>Open in Maps</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050013",
  },
  scrollView: {
    flex: 1,
  },
  heroContainer: {
    height: 300,
    width: "100%",
  },
  heroImage: {
    flex: 1,
    width: "100%",
  },
  heroImageStyle: {
    resizeMode: "cover",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backButton: {
    position: "absolute",
    top: 50,
    left: 16,
    zIndex: 10,
  },
  backButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  backButtonText: {
    color: "#F9FAFB",
    fontSize: 20,
    fontWeight: "600",
  },
  glossyCard: {
    backgroundColor: "rgba(11,6,37,0.8)",
    marginHorizontal: 16,
    marginTop: -40,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.3)",
    shadowColor: "#A855F7",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
  },
  venueName: {
    color: "#F9FAFB",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  venueAddress: {
    color: "#9CA3AF",
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: "#A855F7",
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#A855F7",
    shadowOpacity: 0.6,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  primaryButtonText: {
    color: "#F9FAFB",
    fontSize: 18,
    fontWeight: "700",
  },
  sectionTitle: {
    color: "#E5E7EB",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 32,
    marginBottom: 12,
    marginHorizontal: 16,
  },
  rightNowCard: {
    backgroundColor: "#0B0625",
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.4)",
  },
  rightNowSummaryRow: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(124,58,237,0.2)",
  },
  rightNowSummaryText: {
    color: "#E5E7EB",
    fontSize: 16,
    fontWeight: "600",
  },
  rightNowRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  rightNowItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  rightNowEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  rightNowLabel: {
    color: "#9CA3AF",
    fontSize: 12,
    marginBottom: 4,
  },
  rightNowValue: {
    color: "#E5E7EB",
    fontSize: 16,
    fontWeight: "600",
  },
  rightNowFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(124,58,237,0.2)",
  },
  footerText: {
    color: "#9CA3AF",
    fontSize: 12,
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: "center",
  },
  mutedText: {
    color: "#6B7280",
    fontSize: 14,
    textAlign: "center",
  },
  mutedTextSmall: {
    color: "#6B7280",
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },
  recentUpdateRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0B0625",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.2)",
  },
  recentUpdateEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  recentUpdateContent: {
    flex: 1,
  },
  recentUpdateText: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 2,
  },
  recentUpdateTime: {
    color: "#9CA3AF",
    fontSize: 12,
  },
  locationCard: {
    backgroundColor: "#0B0625",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.4)",
  },
  locationTitle: {
    color: "#E5E7EB",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  locationAddress: {
    color: "#9CA3AF",
    fontSize: 14,
    marginBottom: 16,
  },
  mapsButton: {
    backgroundColor: "rgba(168,85,247,0.2)",
    borderWidth: 1,
    borderColor: "#A855F7",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  mapsButtonText: {
    color: "#A855F7",
    fontSize: 14,
    fontWeight: "600",
  },
});

