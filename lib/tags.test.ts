import { describe, it, expect } from "vitest";
import { normalizeTagName, validateTagName, sameTag } from "./tags";

describe("normalizeTagName", () => {
  it("strips leading #, collapses whitespace, trims", () => {
    expect(normalizeTagName("##  arc  1 ")).toBe("arc 1");
    expect(normalizeTagName("#deceased")).toBe("deceased");
  });
});

describe("validateTagName", () => {
  it("rejects empty / hash-only", () => {
    expect(validateTagName("#")).toEqual({ error: "Tag can’t be empty." });
  });
  it("returns the normalized name", () => {
    expect(validateTagName(" #Arc-1 ")).toEqual({ name: "Arc-1" });
  });
});

describe("sameTag", () => {
  it("matches case-insensitively, ignoring # and surrounding space", () => {
    expect(sameTag("#Deceased", "deceased ")).toBe(true);
    expect(sameTag("arc-1", "arc-2")).toBe(false);
  });
});
