import React from "react";
import { View, StyleSheet } from "react-native";
import { Chip } from "../src/components/Chip";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { color } from "../src/theme/tokens";
import { spacing } from "../src/theme/tokens";

/**
 * ChipGroup - Handles chip wrapping and overflow with priority ordering
 * 
 * @param {Array} chips - Array of chip objects { emoji, label, variant, isLive, priority?, type? }
 * @param {number} maxVisible - Maximum chips to show before overflow (default 3)
 * @param {boolean} showOverflow - Whether to show "+X" overflow indicator (default true)
 */
export default function ChipGroup({ chips = [], maxVisible = 3, showOverflow = true }) {
  if (!chips || chips.length === 0) return null;

  // Sort chips by priority: trend state (priority 1) > music (priority 2) > others (priority 3)
  const sortedChips = [...chips].sort((a, b) => {
    const priorityA = a.priority || getChipPriority(a);
    const priorityB = b.priority || getChipPriority(b);
    return priorityA - priorityB;
  });

  const visibleChips = sortedChips.slice(0, maxVisible);
  const overflowCount = sortedChips.length - maxVisible;

  // Helper to get icon for chip based on emoji or type
  const getChipIcon = (chip) => {
    if (chip.icon) return chip.icon; // Already a React element
    
    const emoji = chip.emoji || '';
    const label = (chip.label || '').toLowerCase();
    
    // Trend chips
    if (label.includes('heating')) {
      return <MaterialCommunityIcons name="fire" size={14} color={color.textSecondary} />;
    }
    if (label.includes('cooling')) {
      return <MaterialCommunityIcons name="snowflake" size={14} color={color.textSecondary} />;
    }
    
    // Music chips
    if (chip.type === 'genre' || chip.priority === 2 || emoji.includes('🎵') || emoji.includes('🎤') || emoji.includes('🎛')) {
      return <Ionicons name="musical-notes-outline" size={14} color={color.textSecondary} />;
    }
    
    // Line chips
    if (emoji.includes('⏱') || chip.id === 'line') {
      return <Ionicons name="time-outline" size={14} color={color.textSecondary} />;
    }
    
    // Cover/Price chips
    if (emoji.includes('💰') || emoji.includes('💵') || chip.id === 'cover') {
      return <MaterialCommunityIcons name="cash" size={14} color={color.textSecondary} />;
    }
    
    // Drinks chips
    if (emoji.includes('🍺') || emoji.includes('🍹') || chip.id === 'drinks_price') {
      return <MaterialCommunityIcons name="cash" size={14} color={color.textSecondary} />;
    }

    // Age range chips
    if (emoji.includes('👥') || chip.id === 'age_range') {
      return <MaterialCommunityIcons name="account-group" size={14} color={color.textSecondary} />;
    }

    return null;
  };

  return (
    <View style={styles.container}>
      {visibleChips.map((chip, index) => {
        const isMusicChip = chip.type === 'genre' || chip.priority === 2 || 
                           (chip.label || '').toLowerCase().includes('house') ||
                           (chip.label || '').toLowerCase().includes('techno') ||
                           (chip.label || '').toLowerCase().includes('hip-hop');
        
        return (
          <Chip
            key={index}
            label={chip.label}
            icon={getChipIcon(chip)}
            tinted={isMusicChip}
          />
        );
      })}
      {showOverflow && overflowCount > 0 && (
        <Chip
          label={`+${overflowCount}`}
        />
      )}
    </View>
  );
}

/**
 * Get priority for chip sorting
 * Priority 1: Trend state (Heating up/Cooling down)
 * Priority 2: Music
 * Priority 3: Everything else (Drinks/Line/Cover/Ratio)
 */
function getChipPriority(chip) {
  const label = (chip.label || "").toLowerCase();
  
  // Trend state chips
  if (label.includes("heating") || label.includes("cooling")) {
    return 1;
  }
  
  // Music chips (check emoji or label)
  if (chip.emoji === "🎵" || chip.emoji === "🎤" || chip.emoji === "🥁" || 
      chip.emoji === "🎛️" || chip.emoji === "🪇" || chip.emoji === "🎶" ||
      label.includes("music") || label.includes("hip-hop") || label.includes("house") ||
      label.includes("techno") || label.includes("afrobeats") || label.includes("reggaeton")) {
    return 2;
  }
  
  // Everything else
  return 3;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
});
