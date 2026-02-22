// ========== LAYOUT CONSTANTS ==========
// Shared layout values for consistent safe-area and touch-target handling

// Header spacing — added ON TOP of insets.top
export const HEADER_PADDING_TOP = 12;

// Standard header bar height (excluding safe area)
export const HEADER_BAR_HEIGHT = 52;

// Minimum touch target per Apple HIG (44×44 pt)
export const MIN_TOUCH_TARGET = 44;

// Standard hitSlop for icon buttons
export const ICON_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

// Tab bar height (must match MainTabsNavigator)
export const TAB_BAR_HEIGHT = 60;
