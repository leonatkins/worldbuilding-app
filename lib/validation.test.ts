import { describe, it, expect } from "vitest";
import { validateFactBody, MAX_FACT_LENGTH } from "./validation";

describe("validateFactBody", () => {
  it("trims surrounding whitespace", () => {
    expect(validateFactBody("  Born in the third age.  ")).toEqual({
      body: "Born in the third age.",
    });
  });

  it("rejects empty or whitespace-only input", () => {
    expect(validateFactBody("")).toEqual({ error: "A fact can't be empty." });
    expect(validateFactBody("   ")).toEqual({ error: "A fact can't be empty." });
  });

  it("accepts a body at the max length", () => {
    const body = "a".repeat(MAX_FACT_LENGTH);
    expect(validateFactBody(body)).toEqual({ body });
  });

  it("rejects a body over the max length (measured after trim)", () => {
    const result = validateFactBody(" " + "a".repeat(MAX_FACT_LENGTH + 1) + " ");
    expect("error" in result).toBe(true);
  });
});
