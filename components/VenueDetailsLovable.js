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
import { validateVenueType, isBar as isBarHelper, getVenueKeySafe } from "../utils/venueHelpers";
import { getLatestVibe, getRecentVibes } from "../services/vibeService";
import { formatTimeAgo } from "../utils/timeHelpers";
import { getDisplayValue, MISSING_DATA_PLACEHOLDER } from "../utils/displayHelpers";
import { mapCoverPriceToUI, mapBarTierToUI, mapBarTierToSymbol, mapLegacyDrinksPriceToTier } from "../utils/priceMapping";

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

function getBarTypeEmoji(barType) {
  if (!barType) return "";
  switch (barType) {
    case "cocktail": return "🍸";
    case "sports": return "🏈";
    case "dive": return "🍺";
    case "wine": return "🍷";
    case "speakeasy": return "🕵️";
    default: return "";
  }
}

function getBarTypeLabel(barType) {
  if (!barType) return "";
  switch (barType) {
    case "cocktail": return "Cocktail";
    case "sports": return "Sports";
    case "dive": return "Dive";
    case "wine": return "Wine";
    case "speakeasy": return "Speakeasy";
    default: return "";
  }
}

function getRatioEmoji(ratio) {
  if (!ratio) return null;
  if (ratio.includes("guys")) return "👥";
  if (ratio.includes("girls")) return "👭";
  return "⚖️";
}

function getLineEmoji(line) {
  if (!line) return null;
  if (line.includes("No line")) return "✅";
  if (line.includes("30+")) return "⏳";
  return "⏱️";
}

function getCoverEmoji(cover) {
  if (!cover) return null;
  if (cover.includes("Free")) return "🆓";
  if (cover.includes("$20+")) return "💎";
  return "💰";
}

// Build summary chips from a vibe for display
function buildVibeChips({ vibe, venueType }) {
  if (!vibe) return [];
  const isBar = venueType === "bar";
  const chips = [];

  if (isBar) {
    // Bar: Bar Type, Crowd, Price, Music
    if (vibe.bar_type) {
      chips.push({
        key: "bar_type",
        label: getBarTypeLabel(vibe.bar_type),
        emoji: getBarTypeEmoji(vibe.bar_type),
        selected: true,
      });
    }
    if (vibe.crowd) {
      chips.push({
        key: "crowd",
        label: vibe.crowd,
        emoji: getCrowdEmoji(vibe.crowd),
        selected: true,
      });
    }
    // Price for bars
    if (vibe.drinks_price_tier || vibe.drinks_price) {
      let priceLabel = null;
      if (vibe.drinks_price_tier) {
        priceLabel = mapBarTierToUI(vibe.drinks_price_tier);
      } else if (vibe.drinks_price) {
        const tier = mapLegacyDrinksPriceToTier(vibe.drinks_price);
        priceLabel = tier ? mapBarTierToUI(tier) : null;
      }
      if (priceLabel) {
        chips.push({
          key: "price",
          label: priceLabel,
          emoji: "🍹",
          selected: true,
        });
      }
    }
    if (vibe.music) {
      chips.push({
        key: "music",
        label: vibe.music,
        emoji: getMusicEmoji(vibe.music),
        selected: true,
      });
    }
  } else {
    // Club: Crowd, Ratio, Line, Price, Music
    if (vibe.crowd) {
      chips.push({
        key: "crowd",
        label: vibe.crowd,
        emoji: getCrowdEmoji(vibe.crowd),
        selected: true,
      });
    }
    if (vibe.ratio) {
      chips.push({
        key: "ratio",
        label: vibe.ratio,
        emoji: getRatioEmoji(vibe.ratio),
        selected: true,
      });
    }
    if (vibe.line) {
      chips.push({
        key: "line",
        label: vibe.line,
        emoji: getLineEmoji(vibe.line),
        selected: true,
      });
    }
    if (vibe.cover) {
      const coverLabel = mapCoverPriceToUI(vibe.cover);
      if (coverLabel) {
        chips.push({
          key: "price",
          label: coverLabel,
          emoji: getCoverEmoji(coverLabel),
          selected: true,
        });
      }
    }
    if (vibe.music) {
      chips.push({
        key: "music",
        label: vibe.music,
        emoji: getMusicEmoji(vibe.music),
        selected: true,
      });
    }
  }

  return chips;
}

// Reusable VibeChip component (same as PostVibeScreen)
const VibeChip = React.memo(function VibeChip({ chip, muted = false }) {
  const { label, emoji, selected } = chip;
  const displayEmoji = selected && emoji ? emoji : null;

  return (
    <View style={[styles.vibeChip, muted && !selected && styles.vibeChipMuted]}>
      {displayEmoji && <Text style={styles.vibeChipEmoji}>{displayEmoji}</Text>}
      <Text
        style={[
          styles.vibeChipText,
          muted && !selected && styles.vibeChipTextMuted,
        ]}
      >
        {label}
      </Text>
    </View>
  );
});


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
      const key = getVenueKeySafe(venue);
      if (!key) {
        console.error('[VenueDetails] Venue missing ID:', venue);
        if (isMounted) {
          setLoading(false);
        }
        return;
      }
      const [latest, recent] = await Promise.all([
        getLatestVibe(key, { 
          showError: true, 
          retries: 2,
          selectFields: "id, crowd, ratio, line, cover, drinks_price, drinks_price_tier, music, bar_type, created_at, stay_duration, tags"
        }),
        getRecentVibes(key, 2),
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
  const venueAddress = venue?.address || null;
  const venueCity = venue?.city || "New York";
  const venueNeighborhood = venue?.neighborhood || null;
  
  // Build address string for Maps deep-link: prefer address, fallback to neighborhood
  const fullAddress = venueAddress
    ? `${venueName}, ${venueAddress}, ${venueCity}`
    : `${venueName}, ${venueNeighborhood || "NYC"}, ${venueCity}`;
  
  // Build display address for Location section: address only, no venue name
  const displayAddress = venueAddress
    ? venueAddress
    : `${venueNeighborhood || ""}${venueCity ? ", " + venueCity : ""}`.trim() || "Location not available";

  const hasVibe = !!latestVibe;
  const vibeCount = recentVibes.length;

  const crowdEmoji = hasVibe ? getCrowdEmoji(latestVibe.crowd) : "❓";
  const crowdText = getDisplayValue(hasVibe ? latestVibe.crowd : null, MISSING_DATA_PLACEHOLDER);
  const lineText = getDisplayValue(hasVibe ? latestVibe.line : null, MISSING_DATA_PLACEHOLDER);
  const musicText = hasVibe ? latestVibe.music : null;
  const musicEmoji = musicText ? getMusicEmoji(musicText) : "🎵";
  const barType = hasVibe ? latestVibe.bar_type : null;
  const barTypeEmoji = barType ? getBarTypeEmoji(barType) : "";
  const barTypeLabel = barType ? getBarTypeLabel(barType) : "";

  const ratioPercent = hasVibe
    ? mapRatioToPercent(latestVibe.ratio)
    : { guys: 50, girls: 50 };

  const ratioText = getDisplayValue(hasVibe ? latestVibe.ratio : null, MISSING_DATA_PLACEHOLDER);

  // Validate venue type
  const venueTypeValidation = validateVenueType(venue?.venue_type);
  const venueType = venueTypeValidation.valid ? venueTypeValidation.type : null;
  const isBar = isBarHelper(venue?.venue_type);
  
  // For bars: use drinks_price_tier (new system), fallback to legacy drinks_price
  // For clubs: drinks_price is actually cover charge
  let drinksPriceText = null;
  let coverText = null;
  if (isBar && hasVibe) {
    if (latestVibe.drinks_price_tier) {
      // New tier system: display full label (e.g., "$$ Normal")
      drinksPriceText = mapBarTierToUI(latestVibe.drinks_price_tier);
    } else if (latestVibe.drinks_price) {
      // Backward compatibility: convert legacy drinks_price to tier label
      const tier = mapLegacyDrinksPriceToTier(latestVibe.drinks_price);
      drinksPriceText = tier ? mapBarTierToUI(tier) : null;
    }
    drinksPriceText = getDisplayValue(drinksPriceText, MISSING_DATA_PLACEHOLDER);
  } else if (!isBar && hasVibe) {
    // Club: cover charge
    if (latestVibe.cover) {
      coverText = mapCoverPriceToUI(latestVibe.cover);
    }
    coverText = getDisplayValue(coverText, MISSING_DATA_PLACEHOLDER);
  } else {
    // No vibe data
    coverText = getDisplayValue(null, MISSING_DATA_PLACEHOLDER);
  }
  
  // Log error if venue type is invalid (for monitoring)
  if (!venueTypeValidation.valid) {
    console.error(`[VenueDetails] Invalid venue_type for "${venue?.name}": ${venueTypeValidation.error}`);
    // In production, you'd send this to your monitoring service
    // e.g., Sentry.captureException(new Error(`Invalid venue_type: ${venueTypeValidation.error}`));
  }

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
          <View style={styles.venueNameRow}>
            <Text style={styles.venueName}>{venueName}</Text>
            <View style={styles.typeBadge}>
              {(() => {
                if (!venueTypeValidation.valid) {
                  // Show error badge for invalid venue type
                  return (
                    <>
                      <Text style={styles.typeBadgeEmoji}>⚠️</Text>
                      <Text style={[styles.typeBadgeText, styles.typeBadgeError]}>
                        ERROR
                      </Text>
                    </>
                  );
                }
                const isClub = venueType === "club";
                return (
                  <>
                    <Text style={styles.typeBadgeEmoji}>
                      {isClub ? "🪩" : "🍸"}
                    </Text>
                    <Text style={styles.typeBadgeText}>
                      {isClub ? "CLUB" : "BAR"}
                    </Text>
                  </>
                );
              })()}
            </View>
          </View>
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
              {/* Summary Chips */}
              <View style={styles.rightNowChipsContainer}>
                {buildVibeChips({ vibe: latestVibe, venueType }).map((chip) => (
                  <VibeChip key={chip.key} chip={chip} />
                ))}
              </View>
              {/* Metadata Line */}
              <Text style={styles.rightNowMetadata}>
                Updated {formatTimeAgo(latestVibe.created_at)} • {vibeCount} vibe{vibeCount === 1 ? "" : "s"} in last 2h
              </Text>
            </>
          )}
        </View>

        {/* Recent Updates */}
        {!loading && (
          <>
            <Text style={styles.sectionTitle}>Recent updates</Text>
            {recentVibes.length > 0 ? (
              recentVibes.slice(0, 10).map((vibe, index) => {
                const vibeChips = buildVibeChips({ vibe, venueType });
                const summaryText = vibeChips.map(c => `${c.emoji} ${c.label}`).join(" • ");
                return (
                  <TouchableOpacity
                    key={index}
                    style={styles.recentUpdateCard}
                    onPress={() => {
                      // Navigate to venue details (already on this screen, could scroll or highlight)
                      // For now, just keep it tappable for future enhancement
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.recentUpdateContent}>
                      <Text style={styles.recentUpdateText} numberOfLines={2}>
                        {summaryText || `${getCrowdEmoji(vibe.crowd)} ${vibe.crowd}`}
                      </Text>
                      <Text style={styles.recentUpdateTime}>
                        {formatTimeAgo(vibe.created_at)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.recentUpdateEmptyState}>
                <Text style={styles.mutedText}>No recent updates yet.</Text>
              </View>
            )}
          </>
        )}

        {/* Location Card */}
        <View style={styles.locationCard}>
          <Text style={styles.locationTitle}>Location</Text>
          <Text style={styles.locationAddress}>{displayAddress}</Text>
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
  venueNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  venueName: {
    color: "#F9FAFB",
    fontSize: 28,
    fontWeight: "700",
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(168,85,247,0.15)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
    gap: 4,
  },
  typeBadgeEmoji: {
    fontSize: 12,
  },
  typeBadgeText: {
    color: "#A855F7",
    fontSize: 11,
    fontWeight: "600",
  },
  typeBadgeError: {
    color: "#EF4444",
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
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.4)",
  },
  rightNowChipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  rightNowMetadata: {
    color: "#9CA3AF",
    fontSize: 12,
    marginTop: 4,
  },
  vibeChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(168,85,247,0.15)",
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
  },
  vibeChipMuted: {
    backgroundColor: "transparent",
    borderColor: "rgba(156,163,175,0.3)",
  },
  vibeChipEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  vibeChipText: {
    color: "#E5E7EB",
    fontSize: 11,
    fontWeight: "600",
  },
  vibeChipTextMuted: {
    color: "rgba(156,163,175,0.7)",
    fontWeight: "500",
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
  recentUpdateCard: {
    backgroundColor: "#0B0625",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.2)",
  },
  recentUpdateContent: {
    flex: 1,
  },
  recentUpdateText: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 4,
    lineHeight: 20,
  },
  recentUpdateTime: {
    color: "#9CA3AF",
    fontSize: 12,
  },
  recentUpdateEmptyState: {
    backgroundColor: "#0B0625",
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.2)",
    alignItems: "center",
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

