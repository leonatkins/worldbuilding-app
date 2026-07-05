/**
 * Schema-template merge planning (step 13, A4/A5). Pure: computes, for each
 * incoming field, what would happen if it merged into an existing category —
 * collision (overwrite via the Q9/Q10 matrix) or new (insert) — and returns the
 * lossy collisions so the UI can show one confirm. The server action performs
 * the actual writes (per-value pruning/parsing/clearing).
 */
import { classifyTransition, type ExistingField, type SnapshotFieldSpec, type TransitionPlan } from "./merge";
import type { SchemaSnapshot } from "./types";

export type MergeCollision = {
  /** Incoming snapshot field, normalized to the SnapshotFieldSpec shape. */
  incoming: SnapshotFieldSpec;
  /** The existing field it collides with (same name, case-insensitive). null = no collision → new field. */
  existing: ExistingField | null;
  /** The transition plan for this collision (or "new" for non-collisions). */
  plan: TransitionPlan;
  /** Number of existing values for this field (caller-supplied). */
  valueCount: number;
};

export type MergePreview = {
  collisions: MergeCollision[];
  /** Only the lossy ones — drive the A5 confirm. Empty = apply silently. */
  lossy: MergeCollision[];
  /** Fields that would be added (no same-name collision). */
  additions: MergeCollision[];
};

function toSpec(name: string, field: SchemaSnapshot["fields"][number]): SnapshotFieldSpec {
  return {
    name,
    type: field.type,
    target: field.target,
    selectOptions: field.selectOptions ?? null,
    scaleMin: field.scaleMin ?? null,
    scaleMax: field.scaleMax ?? null,
    unit: field.unit ?? null,
    inverseLabel: field.inverseLabel ?? null,
  };
}

/**
 * Plan a schema-template merge into an existing category. `existingFields` is the
 * category's live fields (with value counts supplied separately via
 * `valueCounts` keyed by field id). `categoriesById` resolves each existing
 * List/Link field's `targetCategoryId` to its target category's *name*, so the
 * pure classifier can detect a same-target no-op (the only portable comparison
 * is by name). The caller fetches the per-field value count from `field_values`
 * and the world's category names before calling.
 */
export function planSchemaMerge(
  snapshot: SchemaSnapshot,
  existingFields: ReadonlyArray<ExistingField & { id: string }>,
  valueCounts: ReadonlyMap<string, number>,
  categoriesById?: ReadonlyMap<string, { name: string }>,
): MergePreview {
  const byLowerName = new Map<string, ExistingField & { id: string }>();
  for (const f of existingFields) byLowerName.set(f.name.toLowerCase(), f);

  const collisions: MergeCollision[] = [];
  const lossy: MergeCollision[] = [];
  const additions: MergeCollision[] = [];

  snapshot.fields.forEach((f) => {
    const incoming = toSpec(f.name, f);
    const matched = byLowerName.get(f.name.toLowerCase()) ?? null;
    // Resolve the existing field's target name for the classifier (Q9 no-op
    // detection). null when there's no target or the target category is gone.
    const existing: ExistingField | null = matched
      ? {
          ...matched,
          targetCategoryName:
            matched.targetCategoryId && categoriesById
              ? (categoriesById.get(matched.targetCategoryId)?.name ?? null)
              : matched.targetCategoryName ?? null,
        }
      : null;
    const valueCount = matched ? (valueCounts.get(matched.id) ?? 0) : 0;
    const plan = existing
      ? classifyTransition(existing, incoming, valueCount)
      : { behavior: "migrate" as const, lossy: false, clearsAllValues: false };
    const entry: MergeCollision = { incoming, existing, plan, valueCount };
    collisions.push(entry);
    if (existing && plan.lossy) lossy.push(entry);
    if (!existing) additions.push(entry);
  });

  return { collisions, lossy, additions };
}
