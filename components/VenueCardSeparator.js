// ========== SHARED COMPONENTS FOR VENUE CARDS ==========
// Reusable components to ensure consistent spacing across all screens

import React from "react";
import { View } from "react-native";
import { CARD_GAP } from "../constants/spacing";

/**
 * Shared separator component for FlatList ItemSeparatorComponent
 * Ensures consistent spacing between venue cards across all screens
 */
export function VenueCardSeparator() {
  return <View style={{ height: CARD_GAP }} />;
}

/**
 * Shared wrapper for venue card items
 * Ensures no external margins/padding that could cause inconsistent spacing
 */
export function VenueCardWrapper({ children }) {
  return <View style={{ width: "100%" }}>{children}</View>;
}

