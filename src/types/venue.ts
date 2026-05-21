export interface PlaceLocation {
  latitude: number;
  longitude: number;
}

export interface NearbyPlace {
  place_id: string;
  name: string;
  vicinity: string;
  geometry: {
    location: PlaceLocation;
  };
  rating: number | null;
  user_ratings_total: number;
  types?: string[];
  photoReference?: string | null;
}

export interface PlaceDetails extends NearbyPlace {
  formatted_address: string;
  venue_type: "bar" | "club";
  opening_hours?: unknown;
  price_level?: number | null;
  photos?: Array<{ name: string; widthPx?: number; heightPx?: number }>;
}

export interface AutocompleteSuggestion {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}
