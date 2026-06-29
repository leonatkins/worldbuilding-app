/**
 * Pure world-domain helpers shared by the server actions (`app/actions/worlds.ts`)
 * and unit tests. Kept free of `"use server"` and of any Supabase/Next imports so
 * it is trivially importable and testable.
 *
 * Name validation moved to the shared `lib/validation` (reused by categories,
 * fields, subjects, tags); re-exported here for back-compat.
 */
export {
  validateName,
  MAX_NAME_LENGTH as MAX_WORLD_NAME_LENGTH,
  type NameValidation,
} from "@/lib/validation";

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
