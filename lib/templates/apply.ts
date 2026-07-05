/**
 * Snapshot application (step 13, A3/A4/A6) — pure transform from a snapshot to
 * the category + field insert payloads (with UUIDs), plus a stub-category plan.
 * Framework-free and fully unit-testable; the server actions add the DB writes
 * and the undo-on-failure chain.
 *
 * Two apply modes:
 * - **world apply** (A6): create all categories first, map `localKey → newUUID`,
 *   then create fields with `target_category_id` resolved to the mapped UUID.
 *   List/Link targets with no matching `localKey` fall back to a *stub* plan:
 *   an empty category is auto-created (A3) so the field is immediately
 *   functional.
 * - **schema apply (new category)** (A4): create the one category, resolve
 *   List/Link targets by *name* in the destination world; missing → stub plan.
 * - **schema apply (merge)** (A4/A5): no categories are created; fields are
 *   unpacked into an existing category, with merge collisions handled by the
 *   Q9/Q10 matrix (`classifyTransition` in merge.ts). The merge decision is
 *   computed separately by `planSchemaMerge` so the UI can show a lossy confirm.
 */
import type { FieldType } from "@/lib/schema-fields";
import type {
  SchemaSnapshot,
  Snapshot,
  SnapshotField,
  WorldSnapshot,
} from "./types";

export type CategoryInsert = {
  id: string;
  name: string;
  icon: string | null;
  position: number;
};

export type FieldInsert = {
  id: string;
  name: string;
  type: FieldType;
  position: number;
  targetCategoryId: string | null;
  selectOptions: string[] | null;
  scaleMin: number | null;
  scaleMax: number | null;
  unit: string | null;
  inverseLabel: string | null;
  categoryId: string;
};

export type StubCategoryPlan = {
  /** The field id (in FieldInsert) whose target needs this stub. */
  fieldId: string;
  /** The stub category's id (also appears as the field's targetCategoryId). */
  categoryId: string;
  name: string;
  position: number;
};

export type ApplyResult = {
  categories: CategoryInsert[];
  fields: FieldInsert[];
  stubs: StubCategoryPlan[];
  /** Inline notice for the "Applied X · also created category: Y" message. */
  createdStubNames: string[];
};

/**
 * Map a `CategoryInsert` to the snake_case `categories` insert row. Shared by
 * both apply paths so the column list can't drift between them (a new
 * `CategoryInsert` attribute added in one path but not the other would
 * silently drop the column otherwise).
 */
export function categoryInsertToRow(
  c: CategoryInsert,
  worldId: string,
): Record<string, unknown> {
  return { id: c.id, world_id: worldId, name: c.name, icon: c.icon, position: c.position };
}

/** Map a `FieldInsert` to the snake_case `schema_fields` insert row. */
export function fieldInsertToRow(f: FieldInsert): Record<string, unknown> {
  return {
    id: f.id,
    category_id: f.categoryId,
    name: f.name,
    type: f.type,
    position: f.position,
    target_category_id: f.targetCategoryId,
    select_options: f.selectOptions,
    scale_min: f.scaleMin,
    scale_max: f.scaleMax,
    unit: f.unit,
    inverse_label: f.inverseLabel,
  };
}

/**
 * Generate a fresh UUID. `crypto.randomUUID` is available in Node 19+ and in
 * modern browsers; fall back to a manual RFC4122 v4 if absent (tests). The
 * `categories` / `schema_fields` id columns are uuid-typed, so snapshot
 * inserts must carry real UUIDs — not placeholder strings.
 */
function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Minimal RFC4122 v4 fallback.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function toFieldInsert(
  field: SnapshotField,
  position: number,
  categoryId: string,
  targetCategoryId: string | null,
): FieldInsert {
  return {
    id: uuid(),
    name: field.name,
    type: field.type,
    position,
    targetCategoryId,
    selectOptions: field.selectOptions ?? null,
    scaleMin: field.scaleMin ?? null,
    scaleMax: field.scaleMax ?? null,
    unit: field.unit ?? null,
    inverseLabel: field.inverseLabel ?? null,
    categoryId,
  };
}

/**
 * Apply a world snapshot: build category + field inserts with fresh UUIDs and a
 * stub plan for any List/Link target whose `localKey` doesn't resolve in-snapshot.
 * The caller (`createWorld` path) inserts categories → stubs → fields, and runs
 * the undo-on-failure chain if any step fails.
 */
export function applyWorldSnapshot(snapshot: WorldSnapshot): ApplyResult {
  const categories: CategoryInsert[] = [];
  const fields: FieldInsert[] = [];
  const stubs: StubCategoryPlan[] = [];
  const createdStubNames: string[] = [];

  // Build categories first (fresh UUIDs), keyed by localKey (defaulting to a
  // stable cat-N key when absent) and by name, so field targets resolve in O(1).
  const localKeyToId = new Map<string, string>();
  const nameToId = new Map<string, string>();
  snapshot.categories.forEach((c, i) => {
    const id = uuid();
    localKeyToId.set(c.localKey ?? `cat-${i + 1}`, id);
    if (c.name) nameToId.set(c.name.toLowerCase(), id);
    categories.push({ id, name: c.name, icon: c.icon, position: i + 1 });
  });

  // One stub per unresolved target (dedup by resolved key), shared by every
  // field referencing it. Without dedup, two fields pointing at the same
  // missing target would create two same-named stub categories.
  const stubByKey = new Map<string, { id: string; name: string; position: number }>();

  snapshot.categories.forEach((c, i) => {
    const categoryId = categories[i].id;
    c.fields.forEach((f, fieldIdx) => {
      const fieldId = uuid();
      let targetId: string | null = null;
      if (f.target) {
        if (f.target.localKey) {
          targetId = localKeyToId.get(f.target.localKey) ?? null;
        } else if (f.target.name) {
          targetId = nameToId.get(f.target.name.toLowerCase()) ?? null;
        }
      }
      const fieldInsert = toFieldInsert(f, fieldIdx + 1, categoryId, targetId);
      fieldInsert.id = fieldId;

      // Stub plan: target unresolved (no in-snapshot match).
      if (f.target && !targetId) {
        const stubName = f.target.name ?? f.target.localKey ?? `Untitled ${f.name} target`;
        const stubKey = stubName.toLowerCase();
        let stub = stubByKey.get(stubKey);
        if (!stub) {
          stub = {
            id: uuid(),
            name: stubName,
            position: categories.length + stubs.length + 1,
          };
          stubByKey.set(stubKey, stub);
          stubs.push({ fieldId, categoryId: stub.id, name: stub.name, position: stub.position });
          if (!createdStubNames.includes(stubName)) createdStubNames.push(stubName);
        }
        fieldInsert.targetCategoryId = stub.id;
      }
      fields.push(fieldInsert);
    });
  });

  return { categories, fields, stubs, createdStubNames };
}

/**
 * Apply a schema snapshot into a brand-new category (A4 new-from-template): one
 * category insert + its fields, resolving List/Link targets by *name* against
 * the destination world's existing categories. Missing targets → stub plan.
 */
export function applySchemaToNewCategory(
  snapshot: SchemaSnapshot,
  existingCategories: ReadonlyArray<{ id: string; name: string }>,
): ApplyResult {
  const categoryId = uuid();
  const categories: CategoryInsert[] = [
    { id: categoryId, name: snapshot.category.name, icon: snapshot.category.icon, position: 1 },
  ];
  const fields: FieldInsert[] = [];
  const stubs: StubCategoryPlan[] = [];
  const createdStubNames: string[] = [];

  const existingByName = new Map<string, string>();
  for (const c of existingCategories) existingByName.set(c.name.toLowerCase(), c.id);

  // One stub per unresolved target name (dedup), shared by all referencing fields.
  const stubByName = new Map<string, { id: string; position: number }>();

  snapshot.fields.forEach((f, i) => {
    const fieldId = uuid();
    let targetId: string | null = null;
    if (f.target?.name) {
      targetId = existingByName.get(f.target.name.toLowerCase()) ?? null;
    }
    const fieldInsert = toFieldInsert(f, i + 1, categoryId, targetId);
    fieldInsert.id = fieldId;
    if (f.target && !targetId && f.target.name) {
      const key = f.target.name.toLowerCase();
      let stub = stubByName.get(key);
      if (!stub) {
        stub = { id: uuid(), position: existingCategories.length + stubs.length + 1 };
        stubByName.set(key, stub);
        stubs.push({ fieldId, categoryId: stub.id, name: f.target.name, position: stub.position });
        if (!createdStubNames.includes(f.target.name)) createdStubNames.push(f.target.name);
      }
      fieldInsert.targetCategoryId = stub.id;
    }
    fields.push(fieldInsert);
  });

  return { categories, fields, stubs, createdStubNames };
}
