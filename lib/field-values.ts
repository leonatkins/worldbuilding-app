/**
 * Field-value coercion + display for scalar field types (step 7). Scalar values are
 * stored in `field_values.scalar_value` (jsonb); Link/List values are subject
 * references handled separately (linked_subject_id / list_value_subjects). Pure /
 * framework-free for testing.
 */
import {
  isSubjectReference,
  type FieldType,
} from "@/lib/schema-fields";

export type ScalarConfig = {
  selectOptions?: string[] | null;
  scaleMin?: number | null;
  scaleMax?: number | null;
};

export type CoerceResult = { value: unknown } | { error: string };

/**
 * Coerce raw user input into the JSON value stored for a scalar field. `raw` is a
 * string for single-valued types and a string[] for Multi-select. Link/List are
 * not scalar and must be handled by the subject-reference path.
 */
export function coerceScalarValue(
  type: FieldType,
  raw: string | string[],
  config: ScalarConfig = {},
): CoerceResult {
  if (isSubjectReference(type)) {
    return { error: "Link/List values are subject references, not scalars." };
  }

  switch (type) {
    case "Text":
    case "Color":
    case "Date": {
      const s = typeof raw === "string" ? raw.trim() : "";
      if (s.length === 0) return { error: "Enter a value." };
      return { value: s };
    }
    case "Number": {
      const n = Number(raw);
      if (raw === "" || Number.isNaN(n)) return { error: "Enter a number." };
      return { value: n };
    }
    case "Boolean": {
      return { value: raw === "true" || raw === "on" };
    }
    case "Scale": {
      const n = Number(raw);
      if (raw === "" || Number.isNaN(n)) return { error: "Enter a number." };
      const { scaleMin, scaleMax } = config;
      if (scaleMin != null && n < scaleMin) return { error: `Minimum is ${scaleMin}.` };
      if (scaleMax != null && n > scaleMax) return { error: `Maximum is ${scaleMax}.` };
      return { value: n };
    }
    case "Select": {
      const s = String(raw);
      if (config.selectOptions && !config.selectOptions.includes(s)) {
        return { error: "Pick one of the options." };
      }
      return { value: s };
    }
    case "MultiSelect": {
      const arr = Array.isArray(raw) ? raw : [];
      if (config.selectOptions) {
        const allowed = new Set(config.selectOptions);
        if (!arr.every((v) => allowed.has(v))) {
          return { error: "Pick from the options." };
        }
      }
      return { value: arr };
    }
    default:
      return { error: "Unsupported field type." };
  }
}

/**
 * Coerce a scalar value typed as free text (step 11 field command's
 * `!fieldname value` line) rather than picked from a form control. Only
 * Boolean/Select/MultiSelect need normalizing before `coerceScalarValue` can
 * accept them — free-typed text won't match its stricter expectations
 * ("true"/"on" for Boolean, an exact option string for Select). Everything
 * else passes through unchanged.
 */
export function parseFieldCommandValue(
  type: FieldType,
  raw: string,
  config: ScalarConfig = {},
): CoerceResult {
  if (type === "Boolean") {
    const s = raw.trim().toLowerCase();
    if (["yes", "y", "true"].includes(s)) return coerceScalarValue(type, "true", config);
    if (["no", "n", "false"].includes(s)) return coerceScalarValue(type, "false", config);
    return { error: "Enter yes or no." };
  }

  if (type === "Select") {
    const s = raw.trim();
    const match = config.selectOptions?.find((o) => o.toLowerCase() === s.toLowerCase());
    return coerceScalarValue(type, match ?? s, config);
  }

  if (type === "MultiSelect") {
    const parts = raw
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    const resolved = parts.map(
      (p) => config.selectOptions?.find((o) => o.toLowerCase() === p.toLowerCase()) ?? p,
    );
    return coerceScalarValue(type, resolved, config);
  }

  return coerceScalarValue(type, raw, config);
}

/** Human-readable rendering of a stored scalar value (read-only display). */
export function formatScalarValue(type: FieldType, value: unknown): string {
  if (value === null || value === undefined) return "";
  switch (type) {
    case "Boolean":
      return value ? "Yes" : "No";
    case "MultiSelect":
      return Array.isArray(value) ? value.join(", ") : String(value);
    default:
      return String(value);
  }
}
