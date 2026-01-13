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
// Bar tier options
export const BAR_DRINKS_TIER_OPTIONS = ["cheap", "normal", "expensive", "crazy"];

// Bar tier UI labels (full display)
export const BAR_TIER_UI_LABELS = {
  cheap: "$ Cheap",
  normal: "$$ Normal",
  expensive: "$$$ Expensive",
  crazy: "$$$$ Crazy",
};

// Bar tier symbols (short display for cards)
export const BAR_TIER_SYMBOLS = {
  cheap: "$",
  normal: "$$",
  expensive: "$$$",
  crazy: "$$$$",
};

// Map bar tier to full UI label
export function mapBarTierToUI(tier) {
  if (!tier) return null;
  return BAR_TIER_UI_LABELS[tier] || null;
}

// Map bar tier to symbol (for cards)
export function mapBarTierToSymbol(tier) {
  if (!tier) return null;
  return BAR_TIER_SYMBOLS[tier] || null;
}

// ========== BACKWARD COMPATIBILITY ==========
// Map old drinks_price range values to new bar tier system
export function mapLegacyDrinksPriceToTier(oldDbValue) {
  if (!oldDbValue) return null;
  const mapping = {
    "$": "cheap",      // "< $10" -> cheap
    "$$": "normal",    // "$10-20" -> normal
    "$$$": "expensive", // "$20-30" -> expensive
    "$$$$": "crazy",   // "$30+" -> crazy
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

