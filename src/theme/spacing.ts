// 4px grid spacing scale (v2 theme)
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// Re-export layout spacing used across v1 screens
export {
  CARD_GAP,
  SCREEN_PADDING_HORIZONTAL,
  SCREEN_PADDING_TOP,
  SCREEN_PADDING_BOTTOM,
} from "../../constants/spacing";
