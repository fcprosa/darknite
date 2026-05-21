import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import PlaceCard from "./PlaceCard";
import { autocomplete } from "../services/googlePlacesService";
import { COLORS } from "../constants";

function createSessionToken() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export default function MapSearchBar({ locationBias, onSelectPlace }) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const sessionTokenRef = useRef(createSessionToken());
  const debounceRef = useRef(null);

  const runSearch = useCallback(
    async (text) => {
      if (!text || text.trim().length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const suggestions = await autocomplete(
          text,
          sessionTokenRef.current,
          locationBias
        );
        setResults(suggestions);
      } catch (err) {
        console.error("[MapSearchBar] autocomplete error:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [locationBias]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      runSearch(query);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  const handleSelect = (place) => {
    Keyboard.dismiss();
    setQuery("");
    setResults([]);
    sessionTokenRef.current = createSessionToken();
    onSelectPlace?.(place);
  };

  const showDropdown = query.trim().length >= 2 && (results.length > 0 || loading);

  return (
    <View style={[styles.container, { top: insets.top + 8 }]}>
      <View style={styles.inputWrap}>
        <Ionicons
          name="search"
          size={20}
          color={COLORS.textSecondary}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.input}
          placeholder="Search bars & clubs..."
          placeholderTextColor={COLORS.textMuted}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoCorrect={false}
        />
        {loading ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : query.length > 0 ? (
          <Ionicons
            name="close-circle"
            size={20}
            color={COLORS.textMuted}
            onPress={() => {
              setQuery("");
              setResults([]);
            }}
          />
        ) : null}
      </View>

      {showDropdown ? (
        <View style={styles.dropdown}>
          <FlatList
            data={results}
            keyExtractor={(item) => item.place_id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <PlaceCard place={item} onPress={handleSelect} />
            )}
            ListEmptyComponent={
              loading ? null : (
                <View style={styles.empty}>
                  <ActivityIndicator size="small" color={COLORS.textMuted} />
                </View>
              )
            }
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 10,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 16,
    paddingVertical: 0,
  },
  dropdown: {
    marginTop: 8,
    backgroundColor: COLORS.mapOverlay,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxHeight: 280,
    padding: 8,
    overflow: "hidden",
  },
  empty: {
    padding: 16,
    alignItems: "center",
  },
});
