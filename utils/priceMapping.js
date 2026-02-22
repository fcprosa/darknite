// ========== CLUB COVER PRICE (legacy, still used for clubs) ==========
// UI labels shown to users for club cover charges
export const CLUB_COVER_UI_LABELS = ["Free", "< $10", "$10-20", "$20-30", "$30+"];

// Map UI label to DB value for club cover charges (for saving vibes)
export function mapCoverPriceToDB(uiLabel) {
  if (!uiLabel) return null;
  const normalized = uiLabel.replace(/–/g, "-").trim();
  const mapping = {
    "Free": null,
    "< $10": "$",
    "$10-20": "$$",
    "$20-30": "$$$",
    "$30+": "$$$$",
  };
  return mapping[normalized] ?? null;
}

// Map DB value to UI label for club cover charges (for displaying vibes)
export function mapCoverPriceToUI(dbValue) {
  if (!dbValue) return "Free";
  const mapping = {
    "$": "< $10",
    "$$": "$10-20",
    "$$$": "$20-30",
    "$$$$": "$30+",
  };
  return mapping[dbValue] ?? "Free";
}

// ========== BAR DRINKS PRICE TIER (new system for bars only) ==========
// Bar tier options (must match DB check constraint vibes_drinks_price_tier_check)
export const BAR_DRINKS_TIER_OPTIONS = ["cheap", "moderate", "pricey", "expensive"];

// Bar tier UI labels (full display)
export const BAR_TIER_UI_LABELS = {
  cheap: "$",
  moderate: "$$",
  pricey: "$$$",
  expensive: "$$$$"
};

// Bar tier symbols (short display for cards)
export const BAR_TIER_SYMBOLS = {
  cheap: "$",
  moderate: "$$",
  pricey: "$$$",
  expensive: "$$$$",
};

// Map bar tier to symbol only (for compact cards)
export function mapBarTierToSymbol(tier) {
  if (!tier) return null;
  return BAR_TIER_SYMBOLS[tier] || null;
}

// Map bar tier to full display label (e.g., "Cheap $", "Moderate $$")
export function mapBarTierToFullLabel(tier) {
  if (!tier) return null;
  const labels = {
    cheap: "Cheap $",
    moderate: "Moderate $$",
    pricey: "Pricey $$$",
    expensive: "Expensive $$$$",
  };
  return labels[tier] || null;
}

// Map bar tier to UI label (alias for symbol)
export function mapBarTierToUI(tier) {
  if (!tier) return null;
  return BAR_TIER_UI_LABELS[tier] || null;
}

// ========== BACKWARD COMPATIBILITY ==========
// Map old drinks_price range values to new bar tier system
export function mapLegacyDrinksPriceToTier(oldDbValue) {
  if (!oldDbValue) return null;
  const mapping = {
    "$": "cheap",
    "$$": "moderate",
    "$$$": "pricey",
    "$$$$": "expensive",
  };
  return mapping[oldDbValue] || null;
}

// Legacy function for clubs (cover charge) - kept for backward compatibility
// @deprecated - Use mapCoverPriceToUI for clubs instead
export function mapDrinksPriceToUI(dbValue) {
  return mapCoverPriceToUI(dbValue);
}

// Legacy function for clubs (cover charge) - kept for backward compatibility
// @deprecated - Use mapCoverPriceToDB for clubs instead
export function mapDrinksPriceToDB(uiLabel) {
  return mapCoverPriceToDB(uiLabel);
}

// Unified price tag display — returns "$" / "$$" / "$$$" / "$$$$"
// Works for bar drink tiers (pass tier string) or cover (pass DB value)
export function formatPriceTag(tierOrValue) {
  return mapBarTierToSymbol(tierOrValue) || tierOrValue || null;
}

// ========== AGE RANGE FORMATTING ==========
// Condense raw age_range values into short chip-friendly labels
export function formatAgeRange(ageRange) {
  if (!ageRange) return null;
  const mapping = {
    "18–25": "18-25",
    "18-25": "18-25",
    "25–30": "25-30",
    "25-30": "25-30",
    "30–35": "30-35",
    "30-35": "30-35",
    "35+": "35+",
    "Mixed": "Mixed ages",
  };
  return mapping[ageRange] || ageRange;
}

