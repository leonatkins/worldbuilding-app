import { describe, it, expect } from "vitest";
import {
  validateName,
  DEFAULT_CATEGORIES,
  MAX_WORLD_NAME_LENGTH,
} from "./worlds";

describe("validateName", () => {
  it("trims surrounding whitespace", () => {
    expect(validateName("  Eldoria  ")).toEqual({ name: "Eldoria" });
  });

  it("rejects an empty name", () => {
    expect(validateName("")).toEqual({ error: expect.any(String) });
  });

  it("rejects a whitespace-only name", () => {
    expect(validateName("   ")).toEqual({ error: expect.any(String) });
  });

  it("accepts a name at the max length", () => {
    const name = "a".repeat(MAX_WORLD_NAME_LENGTH);
    expect(validateName(name)).toEqual({ name });
  });

  it("rejects a name over the max length", () => {
    const name = "a".repeat(MAX_WORLD_NAME_LENGTH + 1);
    expect(validateName(name)).toEqual({ error: expect.any(String) });
  });
});

describe("DEFAULT_CATEGORIES", () => {
  it("seeds the five expected categories", () => {
    expect(DEFAULT_CATEGORIES.map((c) => c.name)).toEqual([
      "Characters",
      "Locations",
      "Factions",
      "Items",
      "Systems",
    ]);
  });

  it("gives each category an icon", () => {
    for (const category of DEFAULT_CATEGORIES) {
      expect(category.icon.length).toBeGreaterThan(0);
    }
  });

  it("has strictly ascending positions", () => {
    for (let i = 1; i < DEFAULT_CATEGORIES.length; i++) {
      expect(DEFAULT_CATEGORIES[i].position).toBeGreaterThan(
        DEFAULT_CATEGORIES[i - 1].position,
      );
    }
  });
});
