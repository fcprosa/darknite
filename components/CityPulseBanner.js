/**
 * CityPulseBanner.js
 * 
 * Dynamic one-sentence header for the Home feed.
 * Changes based on time of night + available live signals.
 * 
 * Props:
 *  @param {Object[]} venues - Full venue list
 *  @param {Object} vibeMap - latestVibesByVenueId from AppContext
 *  @param {Object} moveCountMap - { venueId: count } of active moves (default: {})
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";

/**
 * Check if a vibe is active (posted within last 90 minutes)
 */
function isVibeActive(createdAt) {
  if (!createdAt) return false;
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageMin = Math.floor(ageMs / 60000);
  return ageMin <= 90;
}

/**
 * Get the neighborhood with the most active venues
 * Returns { name: string, count: number } or null
 */
function getMostActiveNeighborhood(venues, vibeMap) {
  const neighborhoodCounts = {};

  for (const venue of venues) {
    const vibe = vibeMap[venue.id];
    if (isVibeActive(vibe?.created_at)) {
      const hood = venue.neighborhood;
      if (hood) {
        neighborhoodCounts[hood] = (neighborhoodCounts[hood] || 0) + 1;
      }
    }
  }

  let bestHood = null;
  let bestCount = 0;
  for (const [name, count] of Object.entries(neighborhoodCounts)) {
    if (count > bestCount) {
      bestHood = name;
      bestCount = count;
    }
  }

  return bestCount > 0 ? { name: bestHood, count: bestCount } : null;
}

export default function CityPulseBanner({ venues = [], vibeMap = {}, moveCountMap = {} }) {
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const dotPulseAnim = useRef(new Animated.Value(1)).current;

  const { activeVenueCount, bannerText } = useMemo(() => {
    // Compute active venue count (venues with vibes posted within last 90 minutes)
    const activeVenues = venues.filter(venue => {
      const vibe = vibeMap[venue.id];
      return isVibeActive(vibe?.created_at);
    });
    const activeVenueCount = activeVenues.length;

    // Generate banner text based on active count
    let text = null;
    if (activeVenueCount === 0) {
      text = null; // Hide banner
    } else if (activeVenueCount === 1) {
      text = "1 venue live right now";
    } else if (activeVenueCount <= 5) {
      text = `${activeVenueCount} venues live right now`;
    } else {
      // activeVenueCount > 5
      const topNeighborhood = getMostActiveNeighborhood(venues, vibeMap);
      if (topNeighborhood) {
        text = `${activeVenueCount} venues live · ${topNeighborhood.name} is buzzing`;
      } else {
        text = `${activeVenueCount} venues live right now`;
      }
    }

    return { activeVenueCount, bannerText: text };
  }, [venues, vibeMap]);

  // Track previous count to detect transitions
  const prevCountRef = useRef(activeVenueCount);
  const [shouldRender, setShouldRender] = useState(activeVenueCount > 0);

  // Animate opacity when active count changes
  useEffect(() => {
    const prevCount = prevCountRef.current;
    prevCountRef.current = activeVenueCount;

    if (activeVenueCount === 0 && prevCount > 0) {
      // Fading out: animate to 0, then unmount
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setShouldRender(false);
      });
    } else if (activeVenueCount > 0 && prevCount === 0) {
      // Fading in: mount first, then animate to 1
      setShouldRender(true);
      opacityAnim.setValue(0);
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else if (activeVenueCount > 0) {
      // Already visible, ensure opacity is 1
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [activeVenueCount, opacityAnim]);

  // POLISH 16: Pulse animation for the dot
  useEffect(() => {
    if (activeVenueCount === 0) return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulseAnim, {
          toValue: 0.3,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(dotPulseAnim, {
          toValue: 1,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [activeVenueCount, dotPulseAnim]);

  // Don't render banner if no active venues or feed not loaded
  if (!shouldRender || activeVenueCount === 0 || !bannerText) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, { opacity: opacityAnim }]}>
      <View style={styles.banner}>
        <Animated.View style={[styles.liveDot, { opacity: dotPulseAnim }]} />
        <Text style={styles.sentence} numberOfLines={2}>
          {bannerText}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 0,
    paddingTop: 4,
    paddingBottom: 12,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(168, 85, 247, 0.08)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.2)",
    gap: 10,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#A855F7",
    shadowColor: "#A855F7",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
    flexShrink: 0,
  },
  sentence: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    flex: 1,
  },
});