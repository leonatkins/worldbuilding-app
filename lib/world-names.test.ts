import { describe, it, expect } from "vitest";
import { randomWorldName } from "./world-names";

describe("randomWorldName", () => {
  it("returns a non-empty two-word name", () => {
    for (let i = 0; i < 50; i++) {
      const name = randomWorldName();
      const words = name.split(" ");
      expect(words).toHaveLength(2);
      expect(words[0].length).toBeGreaterThan(0);
      expect(words[1].length).toBeGreaterThan(0);
    }
  });
});
