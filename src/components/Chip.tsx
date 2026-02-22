import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { chipStyle, color, fontSize, fontWeight } from '../theme/tokens';

interface ChipProps {
  label: string;
  icon?: React.ReactNode; // Pass a vector icon component, NOT an emoji string
  tinted?: boolean;       // true = genre chips get purple-10% tint
}

export const Chip: React.FC<ChipProps> = ({ label, icon, tinted = false }) => (
  <View style={[styles.chip, tinted && styles.chipTinted]}>
    {icon && <View style={styles.iconWrap}>{icon}</View>}
    <Text style={styles.label} numberOfLines={1} ellipsizeMode="tail">
      {label}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  chip: {
    ...chipStyle,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipTinted: {
    backgroundColor: 'rgba(139,92,246,0.12)',
    borderColor: 'rgba(139,92,246,0.20)',
  },
  iconWrap: { marginRight: 5 },
  label: {
    fontSize: fontSize.label,
    fontWeight: fontWeight.medium,
    color: color.textPrimary,
    maxWidth: chipStyle.maxWidth,
  },
});
