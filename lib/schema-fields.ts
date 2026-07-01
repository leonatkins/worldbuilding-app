/**
 * Schema-field domain: the field-type catalogue and per-type config validation,
 * shared by the schema editor UI, the field-value editors (step 7), and the
 * server actions. Field-type values MUST match the `field_type` pgEnum in
 * lib/db/schema.ts. Free of framework imports for testing.
 */
import { validateName, type NameValidation } from "@/lib/validation";

/** Legal field types — identical strings to the `field_type` enum. */
export const FIELD_TYPES = [
  "Text",
  "Number",
  "Boolean",
  "Select",
  "MultiSelect",
  "Date",
  "Scale",
  "Color",
  "Link",
  "List",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

/** Human labels for the type picker (value "MultiSelect" shows as "Multi-select"). */
export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  Text: "Text",
  Number: "Number",
  Boolean: "Yes / No",
  Select: "Select",
  MultiSelect: "Multi-select",
  Date: "Date",
  Scale: "Scale",
  Color: "Color",
  Link: "Link — one subject",
  List: "List — many subjects",
};

/** A short hint shown under each type in the picker. */
export const FIELD_TYPE_HINTS: Record<FieldType, string> = {
  Text: "A short labeled string.",
  Number: "A number, with optional units.",
  Boolean: "A yes/no toggle.",
  Select: "One choice from a list you define.",
  MultiSelect: "Several choices from a list you define.",
  Date: "An in-world date — written however your world dates work.",
  Scale: "A number on a range you define.",
  Color: "A color swatch.",
  Link: "A reference to one subject of a category.",
  List: "References to several subjects of a category.",
};

export const needsTargetCategory = (t: FieldType) => t === "Link" || t === "List";
export const needsOptions = (t: FieldType) => t === "Select" || t === "MultiSelect";
export const needsScale = (t: FieldType) => t === "Scale";
export const allowsUnit = (t: FieldType) => t === "Number";

/** Whether a field type stores its value(s) as subject references (vs scalar jsonb). */
export const isSubjectReference = (t: FieldType) => t === "Link" || t === "List";

export function isFieldType(v: string): v is FieldType {
  return (FIELD_TYPES as ReadonlyArray<string>).includes(v);
}

/**
 * The label shown for a List/Link field's backlink, from the target's side
 * (step 10). `inverseLabel` is optional — the forward field name is always a
 * safe fallback, so a backlink is never shown with a blank label.
 */
export function resolveInverseLabel(field: { name: string; inverseLabel: string | null }): string {
  return field.inverseLabel?.trim() || field.name;
}

/**
 * A one-line summary of a field's per-type config, shown next to its name in
 * both the read-only category-page list and the schema editor. Framework-free
 * (unlike schema-editor.tsx, which is a client component) so a server
 * component can call it directly.
 */
export function summarizeField(
  field: {
    type: FieldType;
    target_category_id: string | null;
    select_options: string[] | null;
    scale_min: number | null;
    scale_max: number | null;
    unit: string | null;
    inverse_label: string | null;
  },
  categories: { id: string; name: string }[],
): string {
  if (needsTargetCategory(field.type)) {
    const target = categories.find((c) => c.id === field.target_category_id);
    const base = target ? `→ ${target.name}` : "→ (no target)";
    return field.inverse_label ? `${base} · inverse: ${field.inverse_label}` : base;
  }
  if (needsOptions(field.type)) return (field.select_options ?? []).join(", ");
  if (needsScale(field.type)) return `${field.scale_min}–${field.scale_max}`;
  if (allowsUnit(field.type) && field.unit) return field.unit;
  return "";
}

/** Raw, per-type config a field carries (matches the schema_fields columns). */
export type FieldConfig = {
  targetCategoryId: string | null;
  selectOptions: string[] | null;
  scaleMin: number | null;
  scaleMax: number | null;
  unit: string | null;
  inverseLabel: string | null;
};

export type FieldDraft = { name: string; type: FieldType } & Partial<FieldConfig>;

export type FieldValidation =
  | { name: string; type: FieldType; config: FieldConfig }
  | { error: string };

/**
 * Validate a field definition: name + type-appropriate config. Returns the
 * normalized config with only the relevant columns set (others null), so the
 * server action can insert/update directly.
 */
export function validateField(draft: FieldDraft): FieldValidation {
  const nameResult: NameValidation = validateName(draft.name);
  if ("error" in nameResult) return nameResult;

  if (!isFieldType(draft.type)) return { error: "Pick a field type." };

  const config: FieldConfig = {
    targetCategoryId: null,
    selectOptions: null,
    scaleMin: null,
    scaleMax: null,
    unit: null,
    inverseLabel: null,
  };

  if (needsTargetCategory(draft.type)) {
    if (!draft.targetCategoryId) {
      return { error: "Choose which category this field links to." };
    }
    config.targetCategoryId = draft.targetCategoryId;
    const inverseLabel = draft.inverseLabel?.trim();
    config.inverseLabel = inverseLabel ? inverseLabel : null;
  }

  if (needsOptions(draft.type)) {
    const options = (draft.selectOptions ?? [])
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
    if (options.length === 0) return { error: "Add at least one option." };
    if (new Set(options).size !== options.length) {
      return { error: "Options must be unique." };
    }
    config.selectOptions = options;
  }

  if (needsScale(draft.type)) {
    const { scaleMin, scaleMax } = draft;
    if (
      scaleMin === null ||
      scaleMin === undefined ||
      scaleMax === null ||
      scaleMax === undefined ||
      Number.isNaN(scaleMin) ||
      Number.isNaN(scaleMax)
    ) {
      return { error: "Scale needs a minimum and a maximum." };
    }
    if (scaleMin >= scaleMax) {
      return { error: "Scale minimum must be less than the maximum." };
    }
    config.scaleMin = scaleMin;
    config.scaleMax = scaleMax;
  }

  if (allowsUnit(draft.type) && draft.unit) {
    const unit = draft.unit.trim();
    config.unit = unit.length > 0 ? unit : null;
  }

  return { name: nameResult.name, type: draft.type, config };
}
