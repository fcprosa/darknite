import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import MapView from "react-native-maps";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useNavigation } from "@react-navigation/native";
import { useLocation } from "../src/hooks/useLocation";
import { useAppContext } from "../contexts/AppContext";
import { nearbyNightlife, getPlaceDetails } from "../services/googlePlacesService";
import { DARK_MAP_STYLE } from "../constants/mapStyles";
import { COLORS } from "../constants";
import MapSearchBar from "./MapSearchBar";
import VenueMapMarker from "./VenueMapMarker";
import VenueDetailSheet from "./VenueDetailSheet";

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
  const rawSampleLoggedRef = useRef(false);

  const { coords, loading: locationLoading } = useLocation();
  const {
    nearbyPlaces,
    setNearbyPlaces,
    vibesByPlaceId,
  } = useAppContext();

  const [region, setRegion] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [loadingPlaces, setLoadingPlaces] = useState(false);

  useEffect(() => {
    if (coords) {
      setRegion({
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    } else if (!locationLoading) {
      setRegion(DEFAULT_REGION);
    }
  }, [coords, locationLoading]);

  const fetchNearby = useCallback(async (lat, lng) => {
    setLoadingPlaces(true);
    try {
      const places = await nearbyNightlife(lat, lng, 1500);
      if (!rawSampleLoggedRef.current && places.length > 0) {
        console.log(
          "[MapScreen] Sacred check — first nearby place shape:",
          JSON.stringify(places[0], null, 2)
        );
        rawSampleLoggedRef.current = true;
      }
      setNearbyPlaces(places);
    } catch (err) {
      console.error("[MapScreen] nearbyNightlife error:", err);
    } finally {
      setLoadingPlaces(false);
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

  useEffect(() => {
    if (region) {
      fetchNearby(region.latitude, region.longitude);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [region?.latitude, region?.longitude]);

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
    <GestureHandlerRootView style={styles.container}>
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

      <MapSearchBar
        locationBias={locationBias}
        onSelectPlace={handleSearchSelect}
      />

      {loadingPlaces ? (
        <View style={styles.placesLoader}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      ) : null}

      <VenueDetailSheet
        place={selectedPlace}
        onClose={() => setSelectedPlace(null)}
        onPostVibe={handlePostVibe}
      />
    </GestureHandlerRootView>
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
});
