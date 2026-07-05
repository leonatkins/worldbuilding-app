/**
 * Snapshot serialization (step 13, A3/A7). Pure, framework-free transforms from
 * live DB row shapes (with UUIDs) into the frozen, detached, UUID-free snapshot
 * stored in `templates.content` (and mirrored by the built-in constants).
 *
 * Structure only — never subjects/facts/values. List/Link targets are stored
 * portably: by `localKey` for world templates (resolved by mapping key → new
 * UUID at apply time) and by the target category's *name* for schema templates
 * (resolved by name lookup in the destination world, auto-creating a stub).
 */
import type {
  SchemaSnapshot,
  WorldSnapshot,
  SnapshotCategory,
  SnapshotField,
} from "./types";

/** The DB-row shape a serializer reads for a field (a subset of schema_fields). */
export type FieldRow = {
  name: string;
  type: import("@/lib/schema-fields").FieldType;
  position: number;
  target_category_id: string | null;
  select_options: string[] | null;
  scale_min: number | null;
  scale_max: number | null;
  unit: string | null;
  inverse_label: string | null;
};

/** The DB-row shape a serializer reads for a category (a subset of categories). */
export type CategoryRow = {
  id: string;
  name: string;
  icon: string | null;
  position: number;
};

/** A category plus its ordered fields — the input to both serializers. */
export type CategoryWithFields = CategoryRow & { fields: FieldRow[] };

/**
 * Map a field row → the portable snapshot field. `targetName` is the resolved
 * name of the field's target category (looked up by the caller); null/undefined
 * when the field has no target or its target was soft-deleted.
 */
function toSnapshotField(
  field: FieldRow,
  targetName: string | null,
): SnapshotField {
  const base: SnapshotField = {
    name: field.name,
    type: field.type,
    selectOptions: field.select_options,
    scaleMin: field.scale_min,
    scaleMax: field.scale_max,
    unit: field.unit,
    inverseLabel: field.inverse_label,
  };
  if (field.target_category_id && targetName) {
    base.target = { name: targetName };
  }
  return base;
}

/**
 * Serialize one category + its fields into a `kind:"schema"` snapshot (A7). The
 * category's name/icon head the snapshot; List/Link targets are stored by name
 * (resolved via `categoriesById`). Soft-deleted target categories contribute no
 * target (the field is kept, the link becomes dangling — re-pointed on apply).
 */
export function serializeCategory(
  category: { name: string; icon: string | null },
  fields: FieldRow[],
  categoriesById: ReadonlyMap<string, { name: string }>,
): SchemaSnapshot {
  const ordered = [...fields].sort((a, b) => a.position - b.position);
  return {
    kind: "schema",
    category: { name: category.name, icon: category.icon },
    fields: ordered.map((f) => {
      const target = f.target_category_id
        ? (categoriesById.get(f.target_category_id)?.name ?? null)
        : null;
      return toSnapshotField(f, target);
    }),
  };
}

/**
 * Serialize a world's live (non-soft-deleted) categories + their fields into a
 * `kind:"world"` snapshot (A7). Each category gets a stable `localKey`
 * (`"cat-1"`, `"cat-2"`, …) so List/Link fields in the same snapshot can
 * reference a sibling by key (resolved to a fresh UUID at apply time).
 */
export function serializeWorld(categories: CategoryWithFields[]): WorldSnapshot {
  const ordered = [...categories].sort((a, b) => a.position - b.position);
  const idToKey = new Map<string, string>();
  ordered.forEach((c, i) => idToKey.set(c.id, `cat-${i + 1}`));

  const snapshotCategories: SnapshotCategory[] = ordered.map((c) => {
    const fields = [...c.fields].sort((a, b) => a.position - b.position);
    return {
      localKey: idToKey.get(c.id),
      name: c.name,
      icon: c.icon,
      fields: fields.map((f) => {
        const targetKey = f.target_category_id
          ? idToKey.get(f.target_category_id)
          : null;
        const base: SnapshotField = {
          name: f.name,
          type: f.type,
          selectOptions: f.select_options,
          scaleMin: f.scale_min,
          scaleMax: f.scale_max,
          unit: f.unit,
          inverseLabel: f.inverse_label,
        };
        if (targetKey) base.target = { localKey: targetKey };
        return base;
      }),
    };
  });

  return { kind: "world", categories: snapshotCategories };
}
