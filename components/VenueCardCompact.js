/**
 * VenueCardCompact.js
 *
 * Lightweight feed card. No per-card fetches. No modals. No animations.
 * All data passed in via props, pre-computed by HomeScreen.
 *
 * Props:
 * @param {Object} venue - venue object (name, neighborhood, address, venue_type)
 * @param {{ text: string, type: string, trend?: Object }} statusLine - from computeStatusLine()
 * @param {Array<{ label, value, isLive }>} chips - from computeChips()
 * @param {boolean} isLive - whether venue has an active vibe
 * @param {string|null} lastVibeTimestamp - ISO timestamp of latest vibe
 * @param {number} moveCount - active move count for this venue
 * @param {Function} onPress - navigate to venue detail
 */

import React from "react";
import { View, Text, StyleSheet, Pressable, LayoutAnimation, UIManager, Platform } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { getResolvedDefaults, getStaticSubtitle } from "../utils/feedHelpers";
import { DATA_SOURCE } from "../constants/dataSources";
import { isVibeLiveForBorder } from "../utils/vibeDecay";
import { Chip } from "../src/components/Chip";
import { spacing, radius, fontSize, fontWeight, color } from "../src/theme/tokens";
import { timeAgo } from "../src/utils/timeAgo";

function getTypeConfig(venueType) {
  const type = venueType?.toLowerCase();
  if (type === "club") {
    return { icon: <Ionicons name="globe-outline" size={13} color={color.textTertiary} />, label: "CLUB" };
  }
  return { icon: <Ionicons name="wine-outline" size={13} color={color.textTertiary} />, label: "BAR" };
}

function getVibeIcon(crowd) {
  if (!crowd) return null;
  const crowdLower = crowd.toLowerCase();
  if (crowdLower === "chaos" || crowdLower === "packed") {
    return <MaterialCommunityIcons name="fire" size={14} color={color.live} />;
  }
  if (crowdLower === "buzzing") {
    return <MaterialCommunityIcons name="lightning-bolt" size={14} color={color.live} />;
  }
  if (crowdLower === "fun") {
    return <Ionicons name="happy-outline" size={14} color={color.live} />;
  }
  if (crowdLower === "chill") {
    return <MaterialCommunityIcons name="snowflake" size={14} color={color.textSecondary} />;
  }
  if (crowdLower === "dead") {
    return <Ionicons name="moon-outline" size={14} color={color.textSecondary} />;
  }
  return <Ionicons name="location-outline" size={14} color={color.textSecondary} />;
}

function parseStatusLine(statusLineText, statusLineType) {
  if (!statusLineText) return { vibeName: null, timeText: null, fullText: statusLineText };
  
  if (statusLineType === "moves" || statusLineType === "historical") {
    return { vibeName: null, timeText: null, fullText: statusLineText };
  }
  
  const parts = statusLineText.split(" • ");
  if (parts.length < 2) return { vibeName: statusLineText.replace(/^[^\w\s]+/, "").trim(), timeText: null, fullText: statusLineText };
  
  const vibeName = parts[0].replace(/^[^\w\s]+/, "").trim();
  const rest = parts.slice(1).join(" • ");
  const timeMatch = rest.match(/^(right now|\d+[mhd] ago)/);
  const timeText = timeMatch ? timeMatch[1] : null;
  return { vibeName, timeText, fullText: statusLineText };
}

function getStatusLineColor(type) {
  switch (type) {
    case "live":
      return color.live;
    case "moves":
      return color.accent;
    case "historical":
    default:
      return color.textSecondary;
  }
}

// 🚀 UX IMPROVEMENT: Interceta a cor da tendência para evitar vermelhos de "erro"
function getTrendColor(trend) {
  if (!trend) return color.textSecondary;
  if (trend.arrow && trend.arrow.includes('↑')) return '#F59E0B'; // Âmbar/Laranja para "Aquecer"
  if (trend.arrow && trend.arrow.includes('↓')) return '#60A5FA'; // Azul para "Arrefecer"
  return trend.color; // fallback
}

function formatLastSeen(timestamp) {
  if (!timestamp) return null;
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  if (isNaN(then)) return null;
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMin / 60);

  if (diffMin <= 90) return null;
  if (diffHrs < 12) return `Last vibe ${diffHrs}h ago`;
  return null;
}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function VenueCardCompact({ venue, statusLine, chips = [], isLive = false, lastVibeTimestamp = null, moveCount = 0, distanceKm = null, onPress }) {
  const typeConfig = getTypeConfig(venue?.venue_type);
  const neighborhood = venue?.neighborhood || "";
  const distanceMi = distanceKm != null ? `${(distanceKm * 0.621371).toFixed(1)} mi` : null;
  const locationLabel = [distanceMi, neighborhood].filter(Boolean).join(" · ");

  const hasBorder = isVibeLiveForBorder(lastVibeTimestamp);
  const isInactive = !hasBorder && statusLine?.type !== 'moves';

  let chipOpacity = 1;
  if (lastVibeTimestamp) {
    const ageMin = (Date.now() - new Date(lastVibeTimestamp).getTime()) / 60000;
    if (ageMin > 90) chipOpacity = 0;
    else if (ageMin >= 45) chipOpacity = 0.45;
  } else {
    chipOpacity = 0;
  }

  React.useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [isInactive]);

  const resolved = getResolvedDefaults(venue, {});
  const showUsuallySubtitle =
    statusLine?.type !== 'live' &&
    resolved.crowd.source === DATA_SOURCE.HISTORICAL_DB &&
    resolved.crowd.visible;

  const isStatic = isInactive && statusLine?.type === 'historical';
  const staticContext = isStatic ? getStaticSubtitle(venue, resolved) : null;
  const inactiveSubtitle = isInactive
    ? (lastVibeTimestamp ? formatLastSeen(lastVibeTimestamp) : null)
    : null;
  const showNoVibesYet = isInactive && !lastVibeTimestamp;

  const showMoveTrending = moveCount >= 5;
  const statusLineParsed = statusLine?.text ? parseStatusLine(statusLine.text, statusLine?.type) : null;
  const vibeIcon = statusLineParsed?.vibeName ? getVibeIcon(statusLineParsed.vibeName) : null;

  // FUNÇÃO CENTRALIZADA PARA RENDERIZAR AS TAGS SEM REPETIR CÓDIGO 
  const renderChips = () => {
    let displayChips = [];

    if (moveCount > 0) {
      displayChips.push(
        <Chip
          key="move-chip"
          label={showMoveTrending ? `${moveCount} heading here — trending` : `${moveCount} heading here`}
          icon={showMoveTrending 
            ? <MaterialCommunityIcons name="fire" size={14} color={color.textTertiary} />
            : <Ionicons name="location-outline" size={14} color={color.textTertiary} />}
        />
      );
    }

    if (chipOpacity > 0 && chips && chips.length > 0) {
      chips.forEach((chip) => {
        const isMusicChip = chip.id === "music";
        let chipIcon = null;
        if (chip.id === "line") chipIcon = <Ionicons name="time-outline" size={14} color={color.textSecondary} />;
        else if (isMusicChip) chipIcon = <Ionicons name="musical-notes-outline" size={14} color={color.textSecondary} />;
        else if (chip.id === "cover" || chip.id === "drinks_price") chipIcon = <MaterialCommunityIcons name="cash" size={14} color={color.textSecondary} />;
        else if (chip.id === "age_range") chipIcon = <MaterialCommunityIcons name="account-group" size={14} color={color.textSecondary} />;

        displayChips.push(
          <Chip key={chip.id} label={chip.value} icon={chipIcon} tinted={isMusicChip} />
        );
      });
    }

    // 🚀 Limite estrito de 3 chips para evitar a sopa de tags no feed
    displayChips = displayChips.slice(0, 3);

    if (displayChips.length === 0) return null;

    return (
      <View style={[styles.chipRow, { opacity: chipOpacity > 0 ? chipOpacity : 1 }]}>
        {displayChips}
      </View>
    );
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        venue?.venue_type?.toLowerCase() === "club" && styles.cardClub,
        hasBorder && {
          borderColor: color.borderLive,
          borderWidth: 1.5,
        },
        statusLine?.type === "moves" && styles.cardMoves,
        isStatic && styles.cardStatic,
        isInactive && styles.cardInactive,
        showMoveTrending && { backgroundColor: "rgba(155, 89, 182, 0.08)" },
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.nameRow}>
        <View style={styles.nameLeft}>
          {statusLine?.type === "live" && (
            <View style={styles.liveDot} />
          )}
          <Text
            style={[styles.venueName, isInactive && styles.venueNameInactive]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {venue?.name || "Unknown"}
          </Text>
        </View>
        {locationLabel ? (
          <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">
            {locationLabel}
          </Text>
        ) : null}
      </View>

      <View style={styles.typeBadgeRow}>
        <View style={styles.typeBadge}>
          {typeConfig.icon}
          <Text style={styles.typeBadgeText}>{typeConfig.label}</Text>
        </View>
      </View>

      {isInactive ? (
        <>
          {statusLine?.text && (statusLine.type === "stale" || statusLine.type === "historical") ? (
            // Show last known crowd (stale) or historical context — better than silence
            <Text
              style={[styles.inactiveSubtitle, statusLine.type === "stale" && styles.staleSubtitle]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {statusLine.text}
            </Text>
          ) : (
            <>
              {showNoVibesYet && (
                <Text style={styles.noVibesSubtitle} numberOfLines={1}>
                  No vibes yet tonight
                </Text>
              )}
              {!showNoVibesYet && inactiveSubtitle && (
                <Text style={styles.inactiveSubtitle} numberOfLines={1}>
                  {inactiveSubtitle}
                </Text>
              )}
            </>
          )}
          {renderChips()}
        </>
      ) : (
        <>
          {showUsuallySubtitle && (
            <Text style={styles.usuallySubtitle} numberOfLines={1}>
              Usually {resolved.crowd.label}
            </Text>
          )}

          {isStatic && staticContext && (
            <Text style={styles.staticContext} numberOfLines={1}>
              {staticContext}
            </Text>
          )}

          {statusLine?.text && (
            <View style={styles.statusLineContainer}>
              {statusLineParsed?.vibeName ? (
                <>
                  {vibeIcon}
                  <Text
                    style={[
                      styles.statusLine,
                      { color: getStatusLineColor(statusLine?.type) },
                      isInactive && styles.statusLineInactive,
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {statusLineParsed.vibeName}
                  </Text>
                  {statusLineParsed.timeText && (
                    <>
                      <Text style={styles.statusLineSeparator}>·</Text>
                      <Text style={styles.statusLineTime}>
                        {statusLineParsed.timeText || timeAgo(lastVibeTimestamp) || 'right now'}
                      </Text>
                    </>
                  )}
                  {statusLine.trend && (
                    <Text style={{ color: getTrendColor(statusLine.trend), fontWeight: fontWeight.bold }}>
                      {" "}{statusLine.trend.arrow}
                    </Text>
                  )}
                </>
              ) : (
                <Text
                  style={[
                    styles.statusLine,
                    { color: getStatusLineColor(statusLine?.type) },
                    isInactive && styles.statusLineInactive,
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {statusLineParsed?.fullText || statusLine.text}
                  {statusLine.trend && (
                    <Text style={{ color: getTrendColor(statusLine.trend), fontWeight: fontWeight.bold }}>
                      {" "}{statusLine.trend.arrow}
                    </Text>
                  )}
                </Text>
              )}
            </View>
          )}

          {renderChips()}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface1,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: color.borderDefault,
    padding: spacing.lg,
    marginBottom: spacing.md,
    width: "100%",
    gap: 6,
  },
  cardInactive: {
    paddingVertical: spacing.sm,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  nameLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexShrink: 1,
    flex: 1,
    paddingRight: 8,
  },
  venueName: {
    color: color.textPrimary,
    fontSize: fontSize.titleLg,
    fontWeight: fontWeight.bold,
    fontFamily: "Inter_700Bold",
    flexShrink: 1,
  },
  venueNameInactive: {
    opacity: 0.75,
  },
  typeBadgeRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 6,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  typeBadgeText: {
    color: color.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.regular,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginLeft: 4,
  },
  usuallySubtitle: {
    color: color.textSecondary,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    fontStyle: "italic",
    marginTop: 2,
  },
  locationText: {
    color: color.textSecondary,
    fontSize: fontSize.label,
    fontWeight: fontWeight.medium,
    flexShrink: 0,
  },
  statusLineContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  statusLine: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
    color: color.textPrimary,
    marginLeft: 5,
  },
  statusLineSeparator: {
    fontSize: fontSize.body,
    color: color.textSecondary,
    marginLeft: 4,
  },
  statusLineTime: {
    fontSize: fontSize.caption,
    color: color.textTertiary,
    marginLeft: 4,
  },
  statusLineInactive: {
    opacity: 0.6,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  cardClub: {
    backgroundColor: color.surface2,
  },
  cardMoves: {
    borderColor: color.accent,
    borderWidth: 1.5,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: color.live,
    marginRight: 6,
    flexShrink: 0,
  },
  cardStatic: {
    opacity: 0.7,
    borderColor: color.borderDefault,
    backgroundColor: color.surface1,
  },
  staticContext: {
    color: color.textSecondary,
    fontSize: fontSize.caption,
    fontStyle: "italic",
    marginTop: 2,
  },
  inactiveSubtitle: {
    color: color.textTertiary,
    fontSize: fontSize.body,
    fontWeight: fontWeight.regular,
    marginTop: 2,
  },
  noVibesSubtitle: {
    color: color.textTertiary,
    fontSize: fontSize.body,
    fontWeight: fontWeight.regular,
    fontStyle: "italic",
    marginBottom: spacing.md,
  },
  staleSubtitle: {
    color: color.textSecondary,
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
    marginTop: 2,
  },
});