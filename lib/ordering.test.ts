import { describe, it, expect } from "vitest";
import { midpointPosition } from "./ordering";

describe("midpointPosition", () => {
  it("returns 1 for an empty list (both neighbors null)", () => {
    expect(midpointPosition(null, null)).toBe(1);
  });

  it("places before the first item (before null)", () => {
    expect(midpointPosition(null, 2)).toBe(1);
    expect(midpointPosition(null, 1)).toBe(0);
  });

  it("places after the last item (after null)", () => {
    expect(midpointPosition(5, null)).toBe(6);
  });

  it("averages two neighbors", () => {
    expect(midpointPosition(1, 2)).toBe(1.5);
    expect(midpointPosition(1, 1.5)).toBe(1.25);
  });
});
