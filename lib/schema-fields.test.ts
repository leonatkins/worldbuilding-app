import { describe, it, expect } from "vitest";
import { validateField, isFieldType, resolveInverseLabel } from "./schema-fields";

describe("isFieldType", () => {
  it("accepts enum values and rejects others", () => {
    expect(isFieldType("Text")).toBe(true);
    expect(isFieldType("MultiSelect")).toBe(true);
    expect(isFieldType("Banana")).toBe(false);
  });
});

describe("validateField", () => {
  it("validates a simple Text field", () => {
    const r = validateField({ name: "  Title ", type: "Text" });
    expect(r).toEqual({
      name: "Title",
      type: "Text",
      config: {
        targetCategoryId: null,
        selectOptions: null,
        scaleMin: null,
        scaleMax: null,
        unit: null,
        inverseLabel: null,
      },
    });
  });

  it("rejects an empty name", () => {
    expect(validateField({ name: "   ", type: "Text" })).toEqual({
      error: "Name is required.",
    });
  });

  it("requires a target category for Link/List", () => {
    expect(validateField({ name: "Mentor", type: "Link" })).toEqual({
      error: "Choose which category this field links to.",
    });
    const ok = validateField({ name: "Mentor", type: "Link", targetCategoryId: "c1" });
    expect("config" in ok && ok.config.targetCategoryId).toBe("c1");
  });

  it("requires at least one option for Select, trims and dedups", () => {
    expect(validateField({ name: "Status", type: "Select", selectOptions: ["", "  "] })).toEqual(
      { error: "Add at least one option." },
    );
    const ok = validateField({
      name: "Status",
      type: "Select",
      selectOptions: [" Active ", "Disbanded"],
    });
    expect("config" in ok && ok.config.selectOptions).toEqual(["Active", "Disbanded"]);
    expect(
      validateField({ name: "S", type: "Select", selectOptions: ["A", "A"] }),
    ).toEqual({ error: "Options must be unique." });
    expect(
      validateField({ name: "S", type: "Select", selectOptions: ["Hero", "hero"] }),
    ).toEqual({ error: "Options must be unique." });
  });

  it("requires min < max for Scale", () => {
    expect(
      validateField({ name: "Danger", type: "Scale", scaleMin: 5, scaleMax: 5 }),
    ).toEqual({ error: "Scale minimum must be less than the maximum." });
    const ok = validateField({ name: "Danger", type: "Scale", scaleMin: 1, scaleMax: 10 });
    expect("config" in ok && ok.config.scaleMin).toBe(1);
    expect("config" in ok && ok.config.scaleMax).toBe(10);
  });

  it("keeps an optional unit for Number", () => {
    const ok = validateField({ name: "Population", type: "Number", unit: " people " });
    expect("config" in ok && ok.config.unit).toBe("people");
  });

  it("keeps an optional, trimmed inverse label for Link/List only", () => {
    const withLabel = validateField({
      name: "Mentor",
      type: "Link",
      targetCategoryId: "c1",
      inverseLabel: " Student ",
    });
    expect("config" in withLabel && withLabel.config.inverseLabel).toBe("Student");

    const unset = validateField({ name: "Mentor", type: "Link", targetCategoryId: "c1" });
    expect("config" in unset && unset.config.inverseLabel).toBeNull();

    const notApplicable = validateField({
      name: "Age",
      type: "Number",
      inverseLabel: "ignored",
    });
    expect("config" in notApplicable && notApplicable.config.inverseLabel).toBeNull();
  });
});

describe("resolveInverseLabel", () => {
  it("falls back to the forward field name when unset", () => {
    expect(resolveInverseLabel({ name: "Mentor", inverseLabel: null })).toBe("Mentor");
    expect(resolveInverseLabel({ name: "Mentor", inverseLabel: "  " })).toBe("Mentor");
    expect(resolveInverseLabel({ name: "Mentor", inverseLabel: "Student" })).toBe("Student");
  });
});
