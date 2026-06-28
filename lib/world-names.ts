/**
 * Random world-name generator for the "I lack inspiration" dice button on the
 * worlds list. Pure and client-safe — two curated thematic wordlists combined
 * into an evocative "Adjective Noun" pair (e.g. "Whispering Hollow"). No
 * dependency, no network; purely a convenience the user can overtype.
 */

const ADJECTIVES = [
  "Whispering",
  "Crimson",
  "Shattered",
  "Gilded",
  "Hollow",
  "Verdant",
  "Sunken",
  "Ashen",
  "Frosted",
  "Wandering",
  "Forgotten",
  "Obsidian",
  "Radiant",
  "Thornwood",
  "Silent",
  "Ember",
  "Pale",
  "Drowned",
  "Hidden",
  "Iron",
] as const;

const NOUNS = [
  "Hollow",
  "Vale",
  "Reach",
  "Expanse",
  "Marches",
  "Spires",
  "Reaches",
  "Wilds",
  "Hearth",
  "Dominion",
  "Hollows",
  "Frontier",
  "Sanctum",
  "Tides",
  "Glade",
  "Realm",
  "Hold",
  "Wastes",
  "Crossing",
  "Depths",
] as const;

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/** Returns an evocative two-word world name, e.g. "Crimson Vale". */
export function randomWorldName(): string {
  return `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
}
