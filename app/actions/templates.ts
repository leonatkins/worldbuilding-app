"use server";

/**
 * Server-only template CRUD + apply (step 13). All access via the Supabase
 * client (door 1): `account_id` auto-stamped, RLS enforces ownership. Built-in
 * templates live in `lib/templates/builtins.ts` (never in this table); the
 * library list merges built-ins + private rows. Apply uses the undo-on-failure
 * pattern from `createWorld` (no transactions over door 1).
 */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateName } from "@/lib/validation";
import { BUILTIN_TEMPLATES } from "@/lib/templates/builtins";
import {
  parseSnapshot,
  asSchema,
  asWorld,
} from "@/lib/templates/parse";
import {
  applyWorldSnapshot,
  applySchemaToNewCategory,
  categoryInsertToRow,
  fieldInsertToRow,
  type ApplyResult,
} from "@/lib/templates/apply";
import { planSchemaMerge } from "@/lib/templates/plan-merge";
import { serializeCategory, serializeWorld, type FieldRow, type CategoryWithFields } from "@/lib/templates/snapshot";
import {
  type TemplateListItem,
  type Snapshot,
  type TemplateKind,
} from "@/lib/templates/types";

export type TemplateResult = { error?: string };

/** A private template row from the DB. */
export type PrivateTemplate = {
  id: string;
  name: string;
  kind: TemplateKind;
  content: Snapshot;
  createdAt: string;
};

/**
 * The library list: built-ins first, then the user's private templates
 * (newest-first). Built-ins are read-only; private ones are editable/deletable.
 * Selects + parses the full `content` for each row — use this only on the
 * `/templates` library page. The home page wants `listTemplateMetadata`
 * (no `content`) + a lazy `getTemplate` for the one apply preview.
 */
export async function listTemplates(): Promise<TemplateListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("templates")
    .select("id, name, kind, content, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const privateRows: TemplateListItem[] = [];
  for (const r of (data ?? []) as {
    id: string;
    name: string;
    kind: TemplateKind;
    content: unknown;
    created_at: string;
  }[]) {
    const parsed = parseSnapshot(r.content);
    if ("error" in parsed) continue;
    privateRows.push({
      id: r.id,
      name: r.name,
      kind: r.kind,
      builtin: false,
      content: parsed.value,
      createdAt: r.created_at,
    });
  }

  return [...BUILTIN_TEMPLATES, ...privateRows];
}

/**
 * Metadata-only list (no `content` jsonb) for the home page: the worlds-list
 * create-form "From template" dropdown + the "Browse templates (N)" count only
 * need id/name/kind. Built-ins always included (their metadata is in code).
 */
export async function listTemplateMetadata(): Promise<TemplateListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("templates")
    .select("id, name, kind, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const privateRows: TemplateListItem[] = (data ?? []).map(
    (r: { id: string; name: string; kind: TemplateKind; created_at: string }) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      builtin: false,
      createdAt: r.created_at,
    }),
  );

  // Built-ins carry their content (small, in-code); strip it for the metadata
  // list so the home page doesn't hold every built-in snapshot either.
  const builtinsMeta: TemplateListItem[] = BUILTIN_TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    kind: t.kind,
    builtin: true,
  }));
  return [...builtinsMeta, ...privateRows];
}

/**
 * Fetch + parse a single template's snapshot (built-in by `builtin:<key>` or
 * private by DB uuid). Used by the apply preview dialog, which needs the
 * content for exactly one template — not the whole library.
 */
export async function getTemplate(
  templateId: string,
): Promise<TemplateResult & { template?: TemplateListItem }> {
  if (templateId.startsWith("builtin:")) {
    const builtin = BUILTIN_TEMPLATES.find((t) => t.id === templateId);
    if (!builtin?.content) return { error: "Unknown built-in template." };
    return { template: builtin };
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("templates")
    .select("id, name, kind, content, created_at")
    .eq("id", templateId)
    .maybeSingle();
  if (!data) return { error: "Template not found." };
  const parsed = parseSnapshot(data.content);
  if ("error" in parsed) return { error: parsed.error };
  return {
    template: {
      id: data.id,
      name: data.name,
      kind: data.kind,
      builtin: false,
      content: parsed.value,
      createdAt: data.created_at,
    },
  };
}

/** Save a private template (save-as-template, A7). */
export async function saveTemplate(formData: FormData): Promise<TemplateResult & { id?: string }> {
  const name = validateName(String(formData.get("name") ?? ""));
  if ("error" in name) return name;
  const kind = String(formData.get("kind") ?? "") as TemplateKind;
  if (kind !== "schema" && kind !== "world") return { error: "Unknown template kind." };
  const contentRaw = String(formData.get("content") ?? "");
  let content: unknown;
  try {
    content = JSON.parse(contentRaw);
  } catch {
    return { error: "Template content is invalid JSON." };
  }
  const parsed = parseSnapshot(content);
  if ("error" in parsed) return { error: parsed.error };
  if (parsed.value.kind !== kind) return { error: "Template kind mismatch." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("templates")
    .insert({ name: name.name, kind, content: parsed.value })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not save template." };
  revalidatePath("/templates");
  return { id: data.id };
}

/** Update a private template's name and/or content (in-place editor, A8). */
export async function updateTemplate(formData: FormData): Promise<TemplateResult> {
  const id = String(formData.get("id") ?? "");
  const name = validateName(String(formData.get("name") ?? ""));
  if ("error" in name) return name;
  const contentRaw = String(formData.get("content") ?? "");
  let patch: Record<string, unknown> = { name: name.name, updated_at: new Date().toISOString() };
  if (contentRaw) {
    let content: unknown;
    try {
      content = JSON.parse(contentRaw);
    } catch {
      return { error: "Template content is invalid JSON." };
    }
    const parsed = parseSnapshot(content);
    if ("error" in parsed) return { error: parsed.error };
    const kind = String(formData.get("kind") ?? "") as TemplateKind;
    if (kind && parsed.value.kind !== kind) return { error: "Template kind mismatch." };
    patch = { ...patch, content: parsed.value };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("templates").update(patch).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/templates");
  return {};
}

/** Hard-delete a private template (no soft delete — templates hold no user data). */
export async function deleteTemplate(formData: FormData): Promise<TemplateResult> {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.from("templates").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/templates");
  return {};
}

/**
 * Verify the caller owns `worldId` before any write that takes a world id from
 * the client. RLS is ownership-only (account_id = auth.uid()) and does NOT
 * check world_id ownership, so server actions must gate writes themselves: a
 * `select` returns null for a world the caller doesn't own. Without this check,
 * an attacker could plant categories/fields into another account's world.
 */
async function requireOwnedWorld(
  supabase: Awaited<ReturnType<typeof createClient>>,
  worldId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("worlds")
    .select("id")
    .eq("id", worldId)
    .is("deleted_at", null)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Apply a world template: create categories → stubs → fields, undo-on-failure.
 * Used by the `createWorld` path (A6) and a direct apply entry. Returns the new
 * world id on success.
 */
export async function applyWorldTemplate(
  snapshot: Snapshot,
  worldId: string,
): Promise<TemplateResult & { createdStubNames?: string[] }> {
  const world = asWorld(snapshot);
  const plan = applyWorldSnapshot(world);
  const supabase = await createClient();
  if (!(await requireOwnedWorld(supabase, worldId))) {
    return { error: "World not found." };
  }

  // 1. Categories.
  const { error: catError } = await supabase
    .from("categories")
    .insert(plan.categories.map((c) => categoryInsertToRow(c, worldId)));
  if (catError) return { error: catError.message };

  // 2. Stub categories (auto-created empty targets, A3).
  if (plan.stubs.length > 0) {
    const { error: stubError } = await supabase
      .from("categories")
      .insert(
        plan.stubs.map((s) =>
          categoryInsertToRow(
            { id: s.categoryId, name: s.name, icon: null, position: s.position },
            worldId,
          ),
        ),
      );
    if (stubError) {
      await undoApply(supabase, plan);
      return { error: stubError.message };
    }
  }

  // 3. Fields (must come after categories + stubs — target_category_id is RESTRICT).
  const { error: fieldError } = await supabase
    .from("schema_fields")
    .insert(plan.fields.map(fieldInsertToRow));
  if (fieldError) {
    await undoApply(supabase, plan);
    return { error: fieldError.message };
  }

  return { createdStubNames: plan.createdStubNames };
}

/** Undo a failed apply: delete fields → stubs → categories (reverse order). */
async function undoApply(
  supabase: Awaited<ReturnType<typeof createClient>>,
  plan: ApplyResult,
) {
  if (plan.fields.length) {
    await supabase
      .from("schema_fields")
      .delete()
      .in("id", plan.fields.map((f) => f.id));
  }
  const stubIds = plan.stubs.map((s) => s.categoryId);
  if (stubIds.length) await supabase.from("categories").delete().in("id", stubIds);
  await supabase
    .from("categories")
    .delete()
    .in("id", plan.categories.map((c) => c.id));
}

/**
 * Apply a schema template to a brand-new category (A4 new-from-template). Creates
 * the category + stubs + fields, resolving List/Link targets by *name* against
 * the destination world's existing categories (fetched here). Returns the new
 * category id + stub notice.
 */
export async function applySchemaTemplateNew(
  snapshot: Snapshot,
  worldId: string,
): Promise<TemplateResult & { categoryId?: string; createdStubNames?: string[] }> {
  const schema = asSchema(snapshot);
  const supabase = await createClient();
  if (!(await requireOwnedWorld(supabase, worldId))) {
    return { error: "World not found." };
  }
  const { data: existingRows } = await supabase
    .from("categories")
    .select("id, name")
    .eq("world_id", worldId)
    .is("deleted_at", null);
  const existing = ((existingRows ?? []) as { id: string; name: string }[]);
  const plan = applySchemaToNewCategory(schema, existing);

  const cat = plan.categories[0];
  const { error: catError } = await supabase
    .from("categories")
    .insert(categoryInsertToRow(cat, worldId));
  if (catError) return { error: catError.message };

  if (plan.stubs.length > 0) {
    const { error: stubError } = await supabase
      .from("categories")
      .insert(
        plan.stubs.map((s) =>
          categoryInsertToRow(
            { id: s.categoryId, name: s.name, icon: null, position: s.position },
            worldId,
          ),
        ),
      );
    if (stubError) {
      await undoApply(supabase, plan);
      return { error: stubError.message };
    }
  }

  const { error: fieldError } = await supabase
    .from("schema_fields")
    .insert(plan.fields.map(fieldInsertToRow));
  if (fieldError) {
    await undoApply(supabase, plan);
    return { error: fieldError.message };
  }

  revalidatePath(`/worlds/${worldId}`);
  revalidatePath("/");
  return { categoryId: cat.id, createdStubNames: plan.createdStubNames };
}

/**
 * Preview a schema-template merge (A5): returns the lossy collisions so the UI
 * can show one confirm before applying. The caller passes the destination
 * category's existing fields + per-field value counts. Resolves each existing
 * List/Link field's target category name so the Q9 classifier can detect a
 * same-target no-op (re-applying an identical field should not clear values).
 *
 * NOTE: the merge-execute UI is a follow-up; this preview + the pure planner
 * (`planSchemaMerge`/`classifyTransition`) ship the decided Q9/Q10 matrix now.
 */
export async function previewSchemaMerge(
  snapshot: Snapshot,
  categoryId: string,
): Promise<
  TemplateResult & {
    lossy?: { name: string; valueCount: number; behavior: string }[];
    additions?: number;
  }
> {
  const schema = asSchema(snapshot);
  const supabase = await createClient();
  const { data: fieldData } = await supabase
    .from("schema_fields")
    .select(
      "id, name, type, target_category_id, select_options, scale_min, scale_max, unit, inverse_label",
    )
    .eq("category_id", categoryId)
    .order("position");
  const existing = (fieldData ?? []) as {
    id: string;
    name: string;
    type: import("@/lib/schema-fields").FieldType;
    target_category_id: string | null;
    select_options: string[] | null;
    scale_min: number | null;
    scale_max: number | null;
    unit: string | null;
    inverse_label: string | null;
  }[];

  const { data: valueCounts } = await supabase
    .from("field_values")
    .select("field_id")
    .in(
      "field_id",
      existing.map((f) => f.id),
    );
  const counts = new Map<string, number>();
  for (const v of (valueCounts ?? []) as { field_id: string }[]) {
    counts.set(v.field_id, (counts.get(v.field_id) ?? 0) + 1);
  }

  // Resolve target category names for the Q9 same-target no-op check.
  const targetIds = existing
    .map((f) => f.target_category_id)
    .filter((id): id is string => Boolean(id));
  let categoriesById = new Map<string, { name: string }>();
  if (targetIds.length > 0) {
    const { data: targetCats } = await supabase
      .from("categories")
      .select("id, name")
      .in("id", targetIds);
    categoriesById = new Map(
      ((targetCats ?? []) as { id: string; name: string }[]).map((c) => [c.id, { name: c.name }]),
    );
  }

  const existingForPlan = existing.map((f) => ({
    id: f.id,
    name: f.name,
    type: f.type,
    targetCategoryId: f.target_category_id,
    targetCategoryName: null,
    selectOptions: f.select_options,
    scaleMin: f.scale_min,
    scaleMax: f.scale_max,
    unit: f.unit,
    inverseLabel: f.inverse_label,
  }));
  const preview = planSchemaMerge(schema, existingForPlan, counts, categoriesById);
  return {
    lossy: preview.lossy.map((c) => ({
      name: c.incoming.name,
      valueCount: c.valueCount,
      behavior: c.plan.behavior,
    })),
    additions: preview.additions.length,
  };
}

/**
 * Save a category as a schema template (A7). Serializes the category's name/icon
 * + fields into a `kind:"schema"` snapshot and stores it in the user-private
 * `templates` table. Soft-deleted target categories contribute no target.
 */
export async function saveCategoryAsTemplate(formData: FormData): Promise<TemplateResult> {
  const categoryId = String(formData.get("categoryId") ?? "");
  const name = validateName(String(formData.get("name") ?? ""));
  if ("error" in name) return name;
  const supabase = await createClient();

  const [{ data: category }, { data: fields }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, icon")
      .eq("id", categoryId)
      .maybeSingle(),
    supabase
      .from("schema_fields")
      .select(
        "name, type, position, target_category_id, select_options, scale_min, scale_max, unit, inverse_label",
      )
      .eq("category_id", categoryId)
      .order("position"),
  ]);
  if (!category) return { error: "Category not found." };

  // Resolve target category names for portability (A3).
  const targetIds = ((fields ?? []) as FieldRow[])
    .map((f) => f.target_category_id)
    .filter((id): id is string => Boolean(id));
  const { data: targetCats } = await supabase
    .from("categories")
    .select("id, name")
    .in("id", targetIds);
  const categoriesById = new Map<string, { name: string }>(
    ((targetCats ?? []) as { id: string; name: string }[]).map((c) => [c.id, { name: c.name }]),
  );

  const snapshot = serializeCategory(
    { name: category.name, icon: category.icon ?? null },
    (fields ?? []) as FieldRow[],
    categoriesById,
  );

  const { error } = await supabase
    .from("templates")
    .insert({ name: name.name, kind: "schema", content: snapshot })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/templates");
  return {};
}

/**
 * Save a world as a world template (A7). Serializes all *live* (non-soft-deleted)
 * categories + their fields into a `kind:"world"` snapshot; soft-deleted
 * categories are skipped silently. List/Link targets stored by `localKey`.
 */
export async function saveWorldAsTemplate(formData: FormData): Promise<TemplateResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const name = validateName(String(formData.get("name") ?? ""));
  if ("error" in name) return name;
  const supabase = await createClient();

  const { data: catRows } = await supabase
    .from("categories")
    .select("id, name, icon, position, deleted_at")
    .eq("world_id", worldId)
    .order("position");
  const liveCats = ((catRows ?? []) as { id: string; name: string; icon: string | null; position: number; deleted_at: string | null }[]).filter(
    (c) => !c.deleted_at,
  );
  if (liveCats.length === 0) return { error: "World has no live categories to save." };

  const { data: fieldRows } = await supabase
    .from("schema_fields")
    .select(
      "name, type, position, target_category_id, select_options, scale_min, scale_max, unit, inverse_label, category_id",
    )
    .in(
      "category_id",
      liveCats.map((c) => c.id),
    )
    .order("position");

  const fieldsByCat = new Map<string, FieldRow[]>();
  for (const f of (fieldRows ?? []) as (FieldRow & { category_id: string })[]) {
    const arr = fieldsByCat.get(f.category_id) ?? [];
    arr.push(f);
    fieldsByCat.set(f.category_id, arr);
  }

  const catsWithFields: CategoryWithFields[] = liveCats.map((c) => ({
    ...c,
    icon: c.icon,
    fields: fieldsByCat.get(c.id) ?? [],
  }));

  const snapshot = serializeWorld(catsWithFields);
  const { error } = await supabase
    .from("templates")
    .insert({ name: name.name, kind: "world", content: snapshot })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/templates");
  return {};
}
