import React, { useRef } from "react";
import { TouchableOpacity, Text, Animated, StyleSheet } from "react-native";

export default function FilterChip({ label, isActive, onPress, onClear }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.filterChip, isActive && styles.filterChipActive]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.8}
      >
        <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
          {label}
        </Text>
        {isActive && onClear && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onClear();
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.filterChipClearButton}
          >
            <Text style={styles.filterChipClear}>×</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(168,85,247,0.1)",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
    height: 32,
  },
  filterChipActive: {
    backgroundColor: "#A855F7",
    borderColor: "#A855F7",
    shadowColor: "#A855F7",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  filterChipText: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "500",
  },
  filterChipTextActive: {
    color: "#F9FAFB",
    fontWeight: "600",
  },
  filterChipClearButton: {
    marginLeft: 6,
    paddingLeft: 4,
  },
  filterChipClear: {
    color: "#F9FAFB",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 16,
  },
});

