/**
 * Belli-style dark map styling for Google Maps (react-native-maps customMapStyle).
 */
export const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#0A0A0F" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#4A4A5E" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0A0A0F" }] },
  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ color: "#1C1C26" }],
  },
  {
    featureType: "poi",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi.business",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#1C1C26" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#2A2A38" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#2A2A38" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#13131A" }],
  },
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#050508" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#2A2A38" }],
  },
];
