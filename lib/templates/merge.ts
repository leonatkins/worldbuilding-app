/**
 * Field-merge compatibility matrix (step 13, A5 / Q9 / Q10). Pure, framework-
 * free. Given an existing field (with its current type/config + a value count)
 * and the incoming snapshot field spec, decides the transition behavior and
 * whether it is lossy.
 *
 * Storage grounding (design §4.2):
 * - scalars (Text/Number/Boolean/Select/MultiSelect/Date/Scale/Color) →
 *   `field_values.scalar_value` (jsonb)
 * - Link → `field_values.linked_subject_id`
 * - List → `list_value_subjects` join rows
 *
 * The planner returns a *behavior*; the server action performs the actual
 * per-value pruning/parsing/clearing (it has DB access). Behavior buckets:
 * - `migrate`        — just update type/config; all values survive.
 * - `prune-orphaned` — Select/MultiSelect option-set narrowing: clear only the
 *                      values whose option no longer survives. `survivingOptions`
 *                      lists the new option set.
 * - `per-value-parse`— cross-scalar-type: try to coerce each value into the new
 *                      type; clear failures (the caller does this with
 *                      `coerceScalarValue`).
 * - `clear-all`      — bytes incompatible (cross-storage-family, target-category
 *                      change, MultiSelect → Select narrowing, Scale narrowing):
 *                      drop every value for this field.
 */
import { isSubjectReference, type FieldType } from "@/lib/schema-fields";

/** The existing field's relevant config (a subset of the schema_fields row). */
export type ExistingField = {
  name: string;
  type: FieldType;
  targetCategoryId: string | null;
  /**
   * The existing field's target category *name*, resolved by the caller from
   * `targetCategoryId`. Lets the pure classifier compare a Link/List target
   * change by name (the only portable form) without DB access. null when the
   * field has no target or the target category was soft-deleted.
   */
  targetCategoryName: string | null;
  selectOptions: string[] | null;
  scaleMin: number | null;
  scaleMax: number | null;
  unit: string | null;
  inverseLabel: string | null;
};

/** The incoming snapshot field spec (a subset of SnapshotField). */
export type SnapshotFieldSpec = {
  name: string;
  type: FieldType;
  target?: { name?: string; localKey?: string } | null;
  selectOptions: string[] | null;
  scaleMin: number | null;
  scaleMax: number | null;
  unit: string | null;
  inverseLabel: string | null;
};

export type TransitionBehavior =
  | "migrate"
  | "prune-orphaned"
  | "per-value-parse"
  | "clear-all";

export type TransitionPlan = {
  behavior: TransitionBehavior;
  /** True if any existing value may be lost — drives the A5 lossy-confirm. */
  lossy: boolean;
  /** True for clear-all (every value for the field is dropped). */
  clearsAllValues: boolean;
  /** For prune-orphaned: the new surviving option set (others get cleared). */
  survivingOptions?: string[];
};

const SCALAR_TYPES: ReadonlySet<FieldType> = new Set([
  "Text",
  "Number",
  "Boolean",
  "Select",
  "MultiSelect",
  "Date",
  "Scale",
  "Color",
]);

function isScalar(t: FieldType): boolean {
  return SCALAR_TYPES.has(t);
}

/**
 * Decide the transition for one existing → incoming field pair. `valueCount`
 * is the number of subjects currently holding a value for this field (the
 * caller fetches it); lossiness is only meaningful when > 0.
 */
export function classifyTransition(
  existing: ExistingField,
  incoming: SnapshotFieldSpec,
  valueCount: number,
): TransitionPlan {
  const hasValues = valueCount > 0;
  const sameType = existing.type === incoming.type;

  // Q9: List/Link target-category change. A *different* target is treated as a
  // re-point → clear all values (existing members point at the old category's
  // subjects). The pure classifier compares the existing resolved target name
  // to the incoming target name (the only portable form); the caller resolves
  // the existing field's targetCategoryId → name before calling.
  if (isSubjectReference(existing.type) || isSubjectReference(incoming.type)) {
    // Cross within the subject-reference family: List/Link ↔ Link/List.
    if (isSubjectReference(existing.type) && isSubjectReference(incoming.type)) {
      const incomingTarget = incoming.target?.name ?? incoming.target?.localKey ?? null;
      const targetChanged =
        incomingTarget != null &&
        incomingTarget.toLowerCase() !== (existing.targetCategoryName ?? "").toLowerCase();
      // Link -> List is a widening (single value still valid as one-element list);
      // List -> Link narrows cardinality (could drop the extras) → clear all.
      if (sameType) {
        if (targetChanged) {
          return {
            behavior: "clear-all",
            lossy: hasValues,
            clearsAllValues: true,
          };
        }
        return { behavior: "migrate", lossy: false, clearsAllValues: false };
      }
      if (existing.type === "Link" && incoming.type === "List") {
        return { behavior: "migrate", lossy: false, clearsAllValues: false };
      }
      // List -> Link: clear all (can't pick one of many).
      return { behavior: "clear-all", lossy: hasValues, clearsAllValues: true };
    }
    // Cross-storage-family: Scalar ↔ subject-reference → bytes incompatible.
    return { behavior: "clear-all", lossy: hasValues, clearsAllValues: true };
  }

  // Scalar ↔ scalar.
  if (!sameType) {
    // Select -> MultiSelect widening: a single stored value is still a valid
    // one-element array. Migrate silently.
    if (existing.type === "Select" && incoming.type === "MultiSelect") {
      return { behavior: "migrate", lossy: false, clearsAllValues: false };
    }
    // MultiSelect -> Select narrowing: a subject holding >1 value can't map to
    // a single option. Conservative: clear all (caller can refine per-value).
    if (existing.type === "MultiSelect" && incoming.type === "Select") {
      return { behavior: "clear-all", lossy: hasValues, clearsAllValues: true };
    }
    // Otherwise cross-scalar-type: per-value parse, keep parseable, clear fail.
    return {
      behavior: "per-value-parse",
      lossy: hasValues,
      clearsAllValues: false,
    };
  }

  // Same type from here on — config-only changes.
  if (needsOptions(incoming.type)) {
    const oldSet = existing.selectOptions ?? [];
    const newSet = incoming.selectOptions ?? [];
    const survived = newSet.filter((o) => oldSet.includes(o));
    const dropped = oldSet.filter((o) => !newSet.includes(o));
    if (dropped.length === 0) {
      // Only additions (or no change): all values survive.
      return { behavior: "migrate", lossy: false, clearsAllValues: false };
    }
    return {
      behavior: "prune-orphaned",
      lossy: hasValues,
      clearsAllValues: false,
      survivingOptions: survived,
    };
  }

  if (incoming.type === "Scale") {
    const minNarrowed =
      incoming.scaleMin != null &&
      existing.scaleMin != null &&
      incoming.scaleMin > existing.scaleMin;
    const maxNarrowed =
      incoming.scaleMax != null &&
      existing.scaleMax != null &&
      incoming.scaleMax < existing.scaleMax;
    if (minNarrowed || maxNarrowed) {
      return { behavior: "clear-all", lossy: hasValues, clearsAllValues: true };
    }
    return { behavior: "migrate", lossy: false, clearsAllValues: false };
  }

  // Text/Number/Boolean/Date/Color: any config-only change (unit, etc.) is safe.
  return { behavior: "migrate", lossy: false, clearsAllValues: false };
}

function needsOptions(t: FieldType): boolean {
  return t === "Select" || t === "MultiSelect";
}
