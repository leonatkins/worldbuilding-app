/**
 * Pure category-domain constants shared by the category manager UI and server
 * actions. Free of framework imports for easy testing. (Name validation lives in
 * lib/validation; default-world categories in lib/worlds.)
 */

/**
 * Opt-in quick-pick categories offered alongside the create form (step-5 spec §9).
 * Same hardcoded-suggestions pattern as the default world seed; fully overtypable.
 */
export const SUGGESTED_CATEGORIES: ReadonlyArray<{ name: string; icon: string }> = [
  { name: "Species", icon: "🐉" },
  { name: "Biomes", icon: "🌲" },
  { name: "Events", icon: "📅" },
  { name: "Organizations", icon: "⚔️" },
  { name: "Deities", icon: "✨" },
  { name: "Languages", icon: "🗣️" },
  { name: "Creatures", icon: "🐺" },
  { name: "Artifacts", icon: "🔮" },
];

/**
 * Curated emoji set for category icons — a small in-app popover instead of a full
 * emoji-picker dependency (step-6 spec §4). Swappable later.
 */
export const CURATED_EMOJI: ReadonlyArray<string> = [
  "🧑", "📍", "🏛️", "🗡️", "⚙️", "🐉", "🌍", "✨",
  "📜", "🔮", "⚔️", "🛡️", "👑", "🏰", "🌲", "🌊",
  "🔥", "❄️", "☀️", "🌙", "⭐", "💀", "🐺", "🦅",
  "🌿", "💎", "🗺️", "📖", "🎭", "🎵", "⚖️", "🧪",
];

/** Default icon when the user doesn't choose one. */
export const DEFAULT_CATEGORY_ICON = "📁";
