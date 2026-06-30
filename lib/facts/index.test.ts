import { describe, expect, it } from "vitest";
import { parseFact, serializeFact, mentionedIds, type FactToken } from "./index";

describe("parseFact", () => {
  it("returns a single text token when there are no markers", () => {
    expect(parseFact("just plain text")).toEqual([
      { type: "text", value: "just plain text" },
    ]);
  });

  it("returns an empty array for an empty string", () => {
    expect(parseFact("")).toEqual([]);
  });

  it("splits text around a single marker", () => {
    expect(parseFact("met @{a1} today")).toEqual([
      { type: "text", value: "met " },
      { type: "mention", id: "a1" },
      { type: "text", value: " today" },
    ]);
  });

  it("handles a marker at the start and end", () => {
    expect(parseFact("@{a1} and @{b2}")).toEqual([
      { type: "mention", id: "a1" },
      { type: "text", value: " and " },
      { type: "mention", id: "b2" },
    ]);
  });

  it("handles adjacent markers with no text between", () => {
    expect(parseFact("@{a1}@{b2}")).toEqual([
      { type: "mention", id: "a1" },
      { type: "mention", id: "b2" },
    ]);
  });
});

describe("serializeFact", () => {
  it("renders mentions back to @{id} and text verbatim", () => {
    const tokens: FactToken[] = [
      { type: "text", value: "met " },
      { type: "mention", id: "a1" },
    ];
    expect(serializeFact(tokens)).toBe("met @{a1}");
  });
});

describe("round-trip invariant", () => {
  const cases = [
    "",
    "no markers here",
    "one @{a1} marker",
    "@{a1} at the start",
    "marker at the @{a1}",
    "two @{a1} and @{b2} marks",
    "@{a1}@{b2} adjacent",
    "@{a1}",
    "weird ids @{uuid-with-dashes-123}",
  ];
  it.each(cases)("serializeFact(parseFact(b)) === b for %j", (b) => {
    expect(serializeFact(parseFact(b))).toBe(b);
  });
});

describe("mentionedIds", () => {
  it("returns distinct ids in first-seen order", () => {
    expect(mentionedIds("@{a1} then @{b2} then @{a1} again")).toEqual(["a1", "b2"]);
  });

  it("returns an empty array when there are no mentions", () => {
    expect(mentionedIds("nothing to see")).toEqual([]);
  });
});
