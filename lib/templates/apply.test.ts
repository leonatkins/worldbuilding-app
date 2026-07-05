import { describe, it, expect } from "vitest";
import { applyWorldSnapshot, applySchemaToNewCategory } from "./apply";
import type { WorldSnapshot, SchemaSnapshot } from "./types";

describe("applyWorldSnapshot", () => {
  it("remaps localKey targets to fresh UUIDs and orders by position", () => {
    const snap: WorldSnapshot = {
      kind: "world",
      categories: [
        {
          localKey: "cat-1",
          name: "Characters",
          icon: "🧑",
          fields: [
            { name: "Class", type: "Select", selectOptions: ["A", "B"] },
            { name: "Mentor", type: "Link", target: { localKey: "cat-1" }, inverseLabel: "Student" },
            { name: "Home", type: "Link", target: { localKey: "cat-2" } },
          ],
        },
        {
          localKey: "cat-2",
          name: "Locations",
          icon: "📍",
          fields: [{ name: "Population", type: "Number", unit: "people" }],
        },
      ],
    };

    const out = applyWorldSnapshot(snap);
    expect(out.categories.map((c) => c.name)).toEqual(["Characters", "Locations"]);
    expect(out.categories[0].position).toBe(1);
    expect(out.categories[1].position).toBe(2);

    const charId = out.categories[0].id;
    const locId = out.categories[1].id;
    const mentor = out.fields.find((f) => f.name === "Mentor")!;
    const home = out.fields.find((f) => f.name === "Home")!;
    expect(mentor.targetCategoryId).toBe(charId);
    expect(mentor.inverseLabel).toBe("Student");
    expect(home.targetCategoryId).toBe(locId);
    expect(out.stubs).toEqual([]);
    expect(out.createdStubNames).toEqual([]);
  });

  it("auto-creates stub categories for unresolved targets", () => {
    const snap: WorldSnapshot = {
      kind: "world",
      categories: [
        {
          localKey: "cat-1",
          name: "Heroes",
          icon: null,
          fields: [{ name: "Spellbook", type: "List", target: { name: "Spell" } }],
        },
      ],
    };
    const out = applyWorldSnapshot(snap);
    expect(out.stubs.length).toBe(1);
    expect(out.stubs[0].name).toBe("Spell");
    expect(out.createdStubNames).toEqual(["Spell"]);
    const spellField = out.fields.find((f) => f.name === "Spellbook")!;
    expect(spellField.targetCategoryId).toBe(out.stubs[0].categoryId);
  });

  it("resolves by name when localKey is absent", () => {
    const snap: WorldSnapshot = {
      kind: "world",
      categories: [
        { name: "A", icon: null, fields: [{ name: "toB", type: "Link", target: { name: "B" } }] },
        { name: "B", icon: null, fields: [] },
      ],
    };
    const out = applyWorldSnapshot(snap);
    const bId = out.categories.find((c) => c.name === "B")!.id;
    const toB = out.fields.find((f) => f.name === "toB")!;
    expect(toB.targetCategoryId).toBe(bId);
    expect(out.stubs).toEqual([]);
  });

  it("attaches each category's fields to its own id when localKey is absent (no name .find fallback)", () => {
    const snap: WorldSnapshot = {
      kind: "world",
      categories: [
        { name: "Same", icon: null, fields: [{ name: "f1", type: "Text" }] },
        { name: "Same", icon: null, fields: [{ name: "f2", type: "Text" }] },
      ],
    };
    const out = applyWorldSnapshot(snap);
    // f1 belongs to the first Same, f2 to the second — not both to the first.
    expect(out.fields[0].categoryId).toBe(out.categories[0].id);
    expect(out.fields[1].categoryId).toBe(out.categories[1].id);
    expect(out.fields[0].categoryId).not.toBe(out.fields[1].categoryId);
  });

  it("creates a single shared stub when two fields reference the same missing target", () => {
    const snap: WorldSnapshot = {
      kind: "world",
      categories: [
        {
          name: "C",
          icon: null,
          fields: [
            { name: "Spells", type: "List", target: { name: "Spell" } },
            { name: "Favorite", type: "Link", target: { name: "Spell" } },
          ],
        },
      ],
    };
    const out = applyWorldSnapshot(snap);
    expect(out.stubs.length).toBe(1);
    expect(out.stubs[0].name).toBe("Spell");
    expect(out.createdStubNames).toEqual(["Spell"]);
    // Both fields point at the same stub id.
    const spells = out.fields.find((f) => f.name === "Spells")!;
    const favorite = out.fields.find((f) => f.name === "Favorite")!;
    expect(spells.targetCategoryId).toBe(out.stubs[0].categoryId);
    expect(favorite.targetCategoryId).toBe(out.stubs[0].categoryId);
  });
});

describe("applySchemaToNewCategory", () => {
  it("creates the one category and resolves targets by name against the world", () => {
    const snap: SchemaSnapshot = {
      kind: "schema",
      category: { name: "Character", icon: "🧙" },
      fields: [
        { name: "Class", type: "Select", selectOptions: ["A"] },
        { name: "Home", type: "Link", target: { name: "Locations" } },
      ],
    };
    const out = applySchemaToNewCategory(snap, [{ id: "loc-uuid", name: "Locations" }]);
    expect(out.categories.map((c) => c.name)).toEqual(["Character"]);
    const home = out.fields.find((f) => f.name === "Home")!;
    expect(home.targetCategoryId).toBe("loc-uuid");
    expect(out.stubs).toEqual([]);
  });

  it("auto-creates a stub when the named target is absent", () => {
    const snap: SchemaSnapshot = {
      kind: "schema",
      category: { name: "Character", icon: "🧙" },
      fields: [{ name: "Spells", type: "List", target: { name: "Spell" } }],
    };
    const out = applySchemaToNewCategory(snap, []);
    expect(out.stubs.length).toBe(1);
    expect(out.stubs[0].name).toBe("Spell");
    expect(out.createdStubNames).toEqual(["Spell"]);
  });

  it("matches target names case-insensitively", () => {
    const snap: SchemaSnapshot = {
      kind: "schema",
      category: { name: "X", icon: null },
      fields: [{ name: "F", type: "Link", target: { name: "locations" } }],
    };
    const out = applySchemaToNewCategory(snap, [{ id: "L", name: "Locations" }]);
    expect(out.fields[0].targetCategoryId).toBe("L");
    expect(out.stubs).toEqual([]);
  });

  it("creates one shared stub when two fields reference the same missing target", () => {
    const snap: SchemaSnapshot = {
      kind: "schema",
      category: { name: "X", icon: null },
      fields: [
        { name: "Spells", type: "List", target: { name: "Spell" } },
        { name: "Favorite", type: "Link", target: { name: "Spell" } },
      ],
    };
    const out = applySchemaToNewCategory(snap, []);
    expect(out.stubs.length).toBe(1);
    expect(out.stubs[0].name).toBe("Spell");
    expect(out.fields[0].targetCategoryId).toBe(out.stubs[0].categoryId);
    expect(out.fields[1].targetCategoryId).toBe(out.stubs[0].categoryId);
  });
});
