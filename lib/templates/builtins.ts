/**
 * Built-in official templates (step 13, A2). Hardcoded TS constants sharing the
 * exact snapshot shape with `templates.content` (design §4.4 — defaults live in
 * app code, not a DB table). Git-versioned; no system-account / seed /
 * `is_official` machinery. The library list is `[...BUILTINS, ...userTemplates]`
 * and `applyTemplate(snapshot)` is source-agnostic.
 */
import type { TemplateListItem } from "./types";

/**
 * The built-in library. Each entry's `id` is `"builtin:<key>"` so it can never
 * collide with a DB uuid and the UI can disambiguate built-in vs private. Keep
 * the curated set small and high-signal — these are starting points, not a
 * genre taxonomy.
 */
export const BUILTIN_TEMPLATES: ReadonlyArray<TemplateListItem> = [
  {
    id: "builtin:dnd-character",
    name: "D&D Character",
    kind: "schema",
    builtin: true,
    content: {
      kind: "schema",
      category: { name: "Character", icon: "🧙" },
      fields: [
        { name: "Class", type: "Select", selectOptions: ["Fighter", "Wizard", "Rogue", "Cleric"] },
        { name: "Level", type: "Number", unit: null },
        { name: "Alignment", type: "Select", selectOptions: ["Lawful Good", "Neutral Good", "Chaotic Good", "Lawful Neutral", "True Neutral", "Chaotic Neutral", "Lawful Evil", "Neutral Evil", "Chaotic Evil"] },
        { name: "Race", type: "Select", selectOptions: ["Human", "Elf", "Dwarf", "Halfling", "Tiefling"] },
        { name: "Spells", type: "List", target: { name: "Spell" } },
        { name: "Mentor", type: "Link", target: { name: "Character" }, inverseLabel: "Student" },
        { name: "Hit Points", type: "Number", unit: "HP" },
        { name: "Alive", type: "Boolean" },
      ],
    },
  },
  {
    id: "builtin:dnd-spell",
    name: "D&D Spell",
    kind: "schema",
    builtin: true,
    content: {
      kind: "schema",
      category: { name: "Spell", icon: "✨" },
      fields: [
        { name: "Level", type: "Select", selectOptions: ["Cantrip", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"] },
        { name: "School", type: "Select", selectOptions: ["Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation"] },
        { name: "Casting Time", type: "Text" },
        { name: "Range", type: "Text" },
        { name: "Duration", type: "Text" },
        { name: "Components", type: "MultiSelect", selectOptions: ["V", "S", "M"] },
      ],
    },
  },
  {
    id: "builtin:fantasy-world",
    name: "Fantasy World",
    kind: "world",
    builtin: true,
    content: {
      kind: "world",
      categories: [
        {
          localKey: "cat-1",
          name: "Characters",
          icon: "🧑",
          fields: [
            { name: "Class", type: "Select", selectOptions: ["Fighter", "Wizard", "Rogue", "Cleric"] },
            { name: "Level", type: "Number", unit: null },
            { name: "Mentor", type: "Link", target: { localKey: "cat-1" }, inverseLabel: "Student" },
            { name: "Home", type: "Link", target: { localKey: "cat-2" } },
          ],
        },
        {
          localKey: "cat-2",
          name: "Locations",
          icon: "📍",
          fields: [
            { name: "Population", type: "Number", unit: "people" },
            { name: "Ruler", type: "Link", target: { localKey: "cat-1" } },
          ],
        },
        {
          localKey: "cat-3",
          name: "Spells",
          icon: "✨",
          fields: [
            { name: "Level", type: "Select", selectOptions: ["Cantrip", "1st", "2nd", "3rd"] },
            { name: "School", type: "Select", selectOptions: ["Evocation", "Illusion", "Necromancy"] },
          ],
        },
      ],
    },
  },
];
