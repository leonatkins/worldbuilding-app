import { describe, it, expect } from "vitest";
import {
  classifyTransition,
  type ExistingField,
  type SnapshotFieldSpec,
  type TransitionPlan,
} from "./merge";

// Helper: a scalar transition with the "existing field holds values" detail.
function plan(
  existing: ExistingField,
  incoming: SnapshotFieldSpec,
  valueCount = 0,
): TransitionPlan {
  return classifyTransition(existing, incoming, valueCount);
}

const F = (name: string, type: ExistingField["type"], extra: Partial<ExistingField> = {}): ExistingField => ({
  name,
  type,
  targetCategoryId: null,
  targetCategoryName: null,
  selectOptions: null,
  scaleMin: null,
  scaleMax: null,
  unit: null,
  inverseLabel: null,
  ...extra,
});

const S = (name: string, type: SnapshotFieldSpec["type"], extra: Partial<SnapshotFieldSpec> = {}): SnapshotFieldSpec => ({
  name,
  type,
  target: undefined,
  selectOptions: null,
  scaleMin: null,
  scaleMax: null,
  unit: null,
  inverseLabel: null,
  ...extra,
});

describe("classifyTransition — Q9/Q10 matrix", () => {
  it("same type, config-only change that keeps all values: migrate silently", () => {
    // Select *adds* an option nobody currently holds; not lossy.
    const p = plan(
      F("Class", "Select", { selectOptions: ["A", "B"] }),
      S("Class", "Select", { selectOptions: ["A", "B", "C"] }),
      5,
    );
    expect(p.behavior).toBe("migrate");
    expect(p.lossy).toBe(false);
    expect(p.clearsAllValues).toBe(false);
  });

  it("Number unit change: migrate silently", () => {
    const p = plan(
      F("Population", "Number", { unit: "people" }),
      S("Population", "Number", { unit: "souls" }),
      3,
    );
    expect(p.behavior).toBe("migrate");
    expect(p.lossy).toBe(false);
  });

  it("Scale min/max not excluding current values: migrate silently", () => {
    const p = plan(
      F("Power", "Scale", { scaleMin: 1, scaleMax: 10 }),
      S("Power", "Scale", { scaleMin: 0, scaleMax: 12 }),
      4,
    );
    expect(p.behavior).toBe("migrate");
    expect(p.lossy).toBe(false);
  });

  it("Select -> MultiSelect (widening): migrate silently", () => {
    const p = plan(
      F("Tags", "Select", { selectOptions: ["A", "B", "C"] }),
      S("Tags", "MultiSelect", { selectOptions: ["A", "B", "C"] }),
      7,
    );
    expect(p.behavior).toBe("migrate");
    expect(p.lossy).toBe(false);
  });

  it("MultiSelect -> MultiSelect where all current values survive: migrate silently", () => {
    const p = plan(
      F("Tags", "MultiSelect", { selectOptions: ["A", "B", "C"] }),
      S("Tags", "MultiSelect", { selectOptions: ["A", "B", "C", "D"] }),
      9,
    );
    expect(p.behavior).toBe("migrate");
    expect(p.lossy).toBe(false);
  });

  it("Select option-set drop with subjects holding the dropped option: prune orphaned values", () => {
    const p = plan(
      F("Class", "Select", { selectOptions: ["A", "B", "Wizard"] }),
      S("Class", "Select", { selectOptions: ["A", "B"] }),
      50,
    );
    expect(p.behavior).toBe("prune-orphaned");
    expect(p.lossy).toBe(true);
    expect(p.clearsAllValues).toBe(false);
    // The caller (server action) fetches per-value to count actual orphans;
    // the planner just flags that pruning is needed + which options survived.
    expect(p.survivingOptions).toEqual(["A", "B"]);
  });

  it("MultiSelect option-set drop with survivors: prune orphaned values", () => {
    const p = plan(
      F("Tags", "MultiSelect", { selectOptions: ["A", "B", "Z"] }),
      S("Tags", "MultiSelect", { selectOptions: ["A", "B"] }),
      12,
    );
    expect(p.behavior).toBe("prune-orphaned");
    expect(p.lossy).toBe(true);
    expect(p.survivingOptions).toEqual(["A", "B"]);
  });

  it("cross-scalar-type (Text -> Number): per-value parse, lossy", () => {
    const p = plan(F("Age", "Text"), S("Age", "Number"), 8);
    expect(p.behavior).toBe("per-value-parse");
    expect(p.lossy).toBe(true);
    expect(p.clearsAllValues).toBe(false);
  });

  it("cross-scalar-type (Number -> Boolean): per-value parse, lossy", () => {
    const p = plan(F("Flag", "Number"), S("Flag", "Boolean"), 3);
    expect(p.behavior).toBe("per-value-parse");
    expect(p.lossy).toBe(true);
  });

  it("cross-storage-family (Scalar -> Link/List): clear all values", () => {
    const p = plan(F("Mentor", "Text"), S("Mentor", "Link"), 4);
    expect(p.behavior).toBe("clear-all");
    expect(p.lossy).toBe(true);
    expect(p.clearsAllValues).toBe(true);
  });

  it("cross-storage-family (Link -> Scalar): clear all values", () => {
    const p = plan(F("Ruler", "Link"), S("Ruler", "Text"), 2);
    expect(p.behavior).toBe("clear-all");
    expect(p.lossy).toBe(true);
  });

  it("List -> Link (storage family same but cardinality narrows): clear all values", () => {
    const p = plan(F("Members", "List"), S("Members", "Link"), 6);
    expect(p.behavior).toBe("clear-all");
    expect(p.lossy).toBe(true);
  });

  it("Link -> List (widening): migrate (single value still valid as one-element list)", () => {
    const p = plan(F("Mentor", "Link"), S("Mentor", "List"), 5);
    expect(p.behavior).toBe("migrate");
    expect(p.lossy).toBe(false);
  });

  it("List/Link target-category change (Q9): clear all values", () => {
    const p = plan(
      F("Spells", "List", { targetCategoryId: "cat-old", targetCategoryName: "Old Spells" }),
      S("Spells", "List", { target: { name: "Different Category" } }),
      10,
    );
    expect(p.behavior).toBe("clear-all");
    expect(p.lossy).toBe(true);
    expect(p.clearsAllValues).toBe(true);
  });

  it("List/Link same name + same target (no-op re-apply): migrate, not lossy", () => {
    const p = plan(
      F("Mentor", "Link", { targetCategoryId: "c1", targetCategoryName: "Character" }),
      S("Mentor", "Link", { target: { name: "Character" } }),
      7,
    );
    expect(p.behavior).toBe("migrate");
    expect(p.lossy).toBe(false);
    expect(p.clearsAllValues).toBe(false);
  });

  it("List/Link target name differs only by case: migrate (same target)", () => {
    const p = plan(
      F("Mentor", "Link", { targetCategoryId: "c1", targetCategoryName: "character" }),
      S("Mentor", "Link", { target: { name: "Character" } }),
      3,
    );
    expect(p.behavior).toBe("migrate");
    expect(p.lossy).toBe(false);
  });

  it("MultiSelect -> Select narrowing where any subject holds >1 value: clear all", () => {
    // The planner is conservative: MultiSelect -> Select is always lossy because
    // we can't know per-subject counts here without values. Caller confirms.
    const p = plan(
      F("Tags", "MultiSelect", { selectOptions: ["A", "B", "C"] }),
      S("Tags", "Select", { selectOptions: ["A", "B", "C"] }),
      4,
    );
    expect(p.behavior).toBe("clear-all");
    expect(p.lossy).toBe(true);
  });

  it("empty-field collision: not lossy even when types/config differ", () => {
    const p = plan(F("Age", "Text"), S("Age", "Number"), 0);
    expect(p.lossy).toBe(false);
    // Still migrates the type/config; just nothing to clear.
    expect(p.behavior).toBe("per-value-parse");
  });

  it("Scale change that excludes current values is lossy (clears all)", () => {
    const p = plan(
      F("Power", "Scale", { scaleMin: 1, scaleMax: 10 }),
      S("Power", "Scale", { scaleMin: 5, scaleMax: 10 }),
      3,
    );
    // We can't know each value here; conservative clear-all.
    expect(p.behavior).toBe("clear-all");
    expect(p.lossy).toBe(true);
  });
});
