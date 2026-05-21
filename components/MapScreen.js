import React, { useCallback, useEffect, useRef, useState } from "react";
// v2 crash-fix: abortControllerRef cancels stale Places API responses on rapid pan/zoom
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import MapView from "react-native-maps";
import { useNavigation } from "@react-navigation/native";
import { useLocation } from "../src/hooks/useLocation";
import { useAppContext } from "../contexts/AppContext";
import {
  nearbyNightlife,
  getPlaceDetails,
  getPlacesApiError,
} from "../services/googlePlacesService";
import { DARK_MAP_STYLE } from "../constants/mapStyles";
import { COLORS } from "../constants";
import MapSearchBar from "./MapSearchBar";
import VenueMapMarker, { triggerVibeCounts } from "./VenueMapMarker";
import VenueDetailSheet from "./VenueDetailSheet";
import StreakBanner from "./StreakBanner";

const DEFAULT_REGION = {
  latitude: 40.7128,
  longitude: -74.006,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function MapScreen() {
  const navigation = useNavigation();
  const mapRef = useRef(null);
  const debounceRef = useRef(null);
  const apiDisabledRef = useRef(false);
  const abortControllerRef = useRef(null);

  const { coords, loading: locationLoading } = useLocation();
  const {
    nearbyPlaces,
    setNearbyPlaces,
    vibesByPlaceId,
  } = useAppContext();

  const [region, setRegion] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [placesApiError, setPlacesApiError] = useState(null);

  // Initial region + first fetch. Subsequent fetches come only from handleRegionChangeComplete (debounced).
  useEffect(() => {
    if (coords) {
      const r = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
      setRegion(r);
      fetchNearby(r.latitude, r.longitude);
    } else if (!locationLoading) {
      setRegion(DEFAULT_REGION);
      fetchNearby(DEFAULT_REGION.latitude, DEFAULT_REGION.longitude);
    }
  }, [coords, locationLoading]); // fetchNearby is a stable ref — intentionally omitted from deps

  const fetchNearby = useCallback(async (lat, lng) => {
    if (apiDisabledRef.current) return;

    // Cancel any in-flight request before starting a new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoadingPlaces(true);
    try {
      const places = await nearbyNightlife(lat, lng, 1500);

      // Discard response if a newer request has already started
      if (controller.signal.aborted) return;

      const apiError = getPlacesApiError();
      if (apiError) {
        setPlacesApiError(apiError);
        if (apiError.code === "PLACES_API_DISABLED") {
          apiDisabledRef.current = true;
        }
      } else {
        setPlacesApiError(null);
      }

      setNearbyPlaces(places);
    } catch (err) {
      if (controller.signal.aborted) return; // expected — not an error
      console.error("[MapScreen] nearbyNightlife error:", err);
    } finally {
      if (!controller.signal.aborted) setLoadingPlaces(false);
    }
  }, [setNearbyPlaces]);

  const handleRegionChangeComplete = useCallback(
    (newRegion) => {
      setRegion(newRegion);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchNearby(newRegion.latitude, newRegion.longitude);
      }, 800);
    },
    [fetchNearby]
  );

  // Trigger vibe-count batch fetch once when nearbyPlaces updates — not per-marker
  useEffect(() => {
    if (nearbyPlaces.length > 0) triggerVibeCounts(nearbyPlaces);
  }, [nearbyPlaces]);

  // Cleanup debounce and abort any in-flight request on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const openPlace = useCallback(async (place) => {
    const details = await getPlaceDetails(place.place_id);
    const resolved = details || place;
    setSelectedPlace(resolved);

    const { latitude, longitude } = resolved.geometry?.location || {};
    if (latitude && longitude && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude,
          longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        400
      );
    }
  }, []);

  const handleSearchSelect = useCallback(
    (suggestion) => {
      openPlace({
        place_id: suggestion.place_id,
        name: suggestion.structured_formatting?.main_text || suggestion.description,
        vicinity: suggestion.structured_formatting?.secondary_text || "",
        geometry: { location: coords || DEFAULT_REGION },
      });
    },
    [openPlace, coords]
  );

  const handlePostVibe = useCallback(
    (place) => {
      setSelectedPlace(null);
      navigation.navigate("PostVibe", {
        venue: {
          id: place.place_id,
          place_id: place.place_id,
          name: place.name,
          venue_type: place.venue_type || "bar",
        },
      });
    },
    [navigation]
  );

  if (locationLoading || !region) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const locationBias = coords || {
    latitude: region.latitude,
    longitude: region.longitude,
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        customMapStyle={DARK_MAP_STYLE}
        showsUserLocation
        showsMyLocationButton
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        {nearbyPlaces.map((place) => (
          <VenueMapMarker
            key={place.place_id}
            place={place}
            vibeCount={vibesByPlaceId[place.place_id] ? 1 : 0}
            onPress={openPlace}
          />
        ))}
      </MapView>

      <StreakBanner />

      <MapSearchBar
        locationBias={locationBias}
        onSelectPlace={handleSearchSelect}
      />

      {placesApiError ? (
        <View style={styles.apiBanner}>
          <Text style={styles.apiBannerText}>{placesApiError.message}</Text>
        </View>
      ) : null}

      {loadingPlaces && !placesApiError ? (
        <View style={styles.placesLoader}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      ) : null}

      <VenueDetailSheet
        place={selectedPlace}
        onClose={() => setSelectedPlace(null)}
        onPostVibe={handlePostVibe}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  placesLoader: {
    position: "absolute",
    bottom: 100,
    alignSelf: "center",
    backgroundColor: COLORS.surface,
    padding: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  apiBanner: {
    position: "absolute",
    bottom: 88,
    left: 16,
    right: 16,
    backgroundColor: COLORS.surfaceRaised,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.danger,
    padding: 12,
  },
  apiBannerText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
