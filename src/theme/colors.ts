export const COLORS = {
  background: "#0A0A0F",
  surface: "#13131A",
  surfaceRaised: "#1C1C26",
  border: "#2A2A38",
  primary: "#7B5EA7",
  primaryGlow: "#9B7EC8",
  accent: "#E8A838",
  accentGlow: "#FFD166",
  success: "#4CAF7D",
  danger: "#E05C5C",
  textPrimary: "#F2F2F7",
  textSecondary: "#8E8EA0",
  textMuted: "#4A4A5E",
  mapOverlay: "rgba(10,10,15,0.85)",
} as const;

export type ColorKey = keyof typeof COLORS;
