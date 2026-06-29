import { describe, it, expect } from "vitest";
import { coerceScalarValue, formatScalarValue } from "./field-values";

describe("coerceScalarValue", () => {
  it("trims text and rejects empty", () => {
    expect(coerceScalarValue("Text", "  hi ")).toEqual({ value: "hi" });
    expect(coerceScalarValue("Text", "   ")).toEqual({ error: "Enter a value." });
  });

  it("parses numbers", () => {
    expect(coerceScalarValue("Number", "42")).toEqual({ value: 42 });
    expect(coerceScalarValue("Number", "abc")).toEqual({ error: "Enter a number." });
  });

  it("coerces booleans", () => {
    expect(coerceScalarValue("Boolean", "true")).toEqual({ value: true });
    expect(coerceScalarValue("Boolean", "false")).toEqual({ value: false });
  });

  it("enforces scale bounds", () => {
    expect(coerceScalarValue("Scale", "5", { scaleMin: 1, scaleMax: 10 })).toEqual({
      value: 5,
    });
    expect(coerceScalarValue("Scale", "11", { scaleMin: 1, scaleMax: 10 })).toEqual({
      error: "Maximum is 10.",
    });
  });

  it("validates select membership", () => {
    expect(coerceScalarValue("Select", "B", { selectOptions: ["A", "B"] })).toEqual({
      value: "B",
    });
    expect(coerceScalarValue("Select", "Z", { selectOptions: ["A", "B"] })).toEqual({
      error: "Pick one of the options.",
    });
  });

  it("validates multi-select subset", () => {
    expect(
      coerceScalarValue("MultiSelect", ["A", "C"], { selectOptions: ["A", "B", "C"] }),
    ).toEqual({ value: ["A", "C"] });
    expect(
      coerceScalarValue("MultiSelect", ["X"], { selectOptions: ["A"] }),
    ).toEqual({ error: "Pick from the options." });
  });

  it("refuses subject-reference types", () => {
    expect("error" in coerceScalarValue("Link", "x")).toBe(true);
    expect("error" in coerceScalarValue("List", "x")).toBe(true);
  });
});

describe("formatScalarValue", () => {
  it("formats by type", () => {
    expect(formatScalarValue("Boolean", true)).toBe("Yes");
    expect(formatScalarValue("MultiSelect", ["A", "B"])).toBe("A, B");
    expect(formatScalarValue("Number", 42)).toBe("42");
    expect(formatScalarValue("Text", null)).toBe("");
  });
});
