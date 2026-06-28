/**
 * Pure world-domain helpers shared by the server actions (`app/actions/worlds.ts`)
 * and unit tests. Kept free of `"use server"` and of any Supabase/Next imports so
 * it is trivially importable and testable.
 */

/** Max length for a world name (display label; not a key). */
export const MAX_WORLD_NAME_LENGTH = 100;

/**
 * The default categories seeded into every new world (design §4.4 — hardcoded in
 * app code, not a DB table). No schema fields: structure stays a deliberate pull.
 * Positions are floats with unit gaps, leaving midpoint-insertion room.
 */
export const DEFAULT_CATEGORIES: ReadonlyArray<{
  name: string;
  icon: string;
  position: number;
}> = [
  { name: "Characters", icon: "🧑", position: 1 },
  { name: "Locations", icon: "📍", position: 2 },
  { name: "Factions", icon: "🏛️", position: 3 },
  { name: "Items", icon: "🗡️", position: 4 },
  { name: "Systems", icon: "⚙️", position: 5 },
];

export type NameValidation = { name: string } | { error: string };

/**
 * Validate a world name from user input. Trims surrounding whitespace, then
 * rejects empty or over-long names. Duplicates are allowed (names are display
 * labels, not keys — step-5 spec §7), so there is no uniqueness check here.
 */
export function validateName(raw: string): NameValidation {
  const name = raw.trim();
  if (name.length === 0) return { error: "Name is required." };
  if (name.length > MAX_WORLD_NAME_LENGTH) {
    return { error: `Name must be ${MAX_WORLD_NAME_LENGTH} characters or fewer.` };
  }
  return { name };
}
