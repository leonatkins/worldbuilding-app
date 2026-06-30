"use server";

/**
 * Server-only fact CRUD (step 8/9). Door 1; RLS-scoped; account_id auto-stamped.
 * Facts use soft delete (ADR 0005/0006). A fact is plain text in `body` with
 * `@{id}` mention markers (ADR 0001); on create/update we mirror those mentions
 * into fact-origin `relationships` rows (step 9, `syncFactRelationships`). Every
 * mutation stamps the parent `subjects.updated_at` (open-questions Q3) so the
 * "Last edited" sort stays honest.
 */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateFactBody } from "@/lib/validation";
import { syncFactRelationships } from "@/lib/mentions";
import { activeOnly } from "@/lib/db/soft-delete";
import { formatScalarValue } from "@/lib/field-values";
import type { FieldType } from "@/lib/schema-fields";

export type FactResult = { error?: string };

type Supa = Awaited<ReturnType<typeof createClient>>;

/** Touch the parent subject so fact edits surface in "recently edited". */
async function touchSubject(supabase: Supa, subjectId: string) {
  await supabase
    .from("subjects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", subjectId);
}

/** Next fact position = after the last live fact on the subject (midpoint append). */
async function nextFactPosition(supabase: Supa, subjectId: string): Promise<number> {
  const { data } = await supabase
    .from("facts")
    .select("position")
    .eq("subject_id", subjectId)
    .is("deleted_at", null)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.position ?? 0) + 1;
}

export async function createFact(formData: FormData): Promise<FactResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const validated = validateFactBody(String(formData.get("body") ?? ""));
  if ("error" in validated) return { error: validated.error };

  const supabase = await createClient();
  const position = await nextFactPosition(supabase, subjectId);
  const { data, error } = await supabase
    .from("facts")
    .insert({ subject_id: subjectId, body: validated.body, position })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Could not save fact." };
  await syncFactRelationships(supabase, data.id, subjectId, validated.body);
  await touchSubject(supabase, subjectId);
  revalidatePath(`/worlds/${worldId}/subjects/${subjectId}`);
  return {};
}

export async function updateFact(formData: FormData): Promise<FactResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const factId = String(formData.get("factId") ?? "");
  const validated = validateFactBody(String(formData.get("body") ?? ""));
  if ("error" in validated) return { error: validated.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("facts")
    .update({ body: validated.body, updated_at: new Date().toISOString() })
    .eq("id", factId);

  if (error) return { error: error.message };
  await syncFactRelationships(supabase, factId, subjectId, validated.body);
  await touchSubject(supabase, subjectId);
  revalidatePath(`/worlds/${worldId}/subjects/${subjectId}`);
  return {};
}

/** Persist a drag-reorder; the client computes the midpoint position. */
export async function reorderFact(formData: FormData): Promise<FactResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const factId = String(formData.get("factId") ?? "");
  const position = Number(formData.get("position"));
  if (Number.isNaN(position)) return { error: "Invalid position." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("facts")
    .update({ position, updated_at: new Date().toISOString() })
    .eq("id", factId);

  if (error) return { error: error.message };
  await touchSubject(supabase, subjectId);
  revalidatePath(`/worlds/${worldId}/subjects/${subjectId}`);
  return {};
}

export async function deleteFact(formData: FormData): Promise<FactResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const factId = String(formData.get("factId") ?? "");

  const supabase = await createClient();
  const { error } = await supabase
    .from("facts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", factId);

  if (error) return { error: error.message };
  await touchSubject(supabase, subjectId);
  revalidatePath(`/worlds/${worldId}/subjects/${subjectId}`);
  return {};
}

export async function restoreFact(formData: FormData): Promise<FactResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const factId = String(formData.get("factId") ?? "");

  const supabase = await createClient();
  const { error } = await supabase
    .from("facts")
    .update({ deleted_at: null })
    .eq("id", factId);

  if (error) return { error: error.message };
  await touchSubject(supabase, subjectId);
  revalidatePath(`/worlds/${worldId}/subjects/${subjectId}`);
  return {};
}

export async function purgeFact(formData: FormData): Promise<FactResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const factId = String(formData.get("factId") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.from("facts").delete().eq("id", factId);

  if (error) return { error: error.message };
  revalidatePath(`/worlds/${worldId}/subjects/${subjectId}`);
  return {};
}

/**
 * Rewrite every `@{oldId}` marker in a fact to `@{newId}` — the "Replace" action
 * on a purged mention (step 9 §5). Re-runs the relationship sync afterwards. The
 * literal-string replace is precise: ids never contain `{`/`}`.
 */
export async function replaceMention(formData: FormData): Promise<FactResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const factId = String(formData.get("factId") ?? "");
  const oldId = String(formData.get("oldId") ?? "");
  const newId = String(formData.get("newId") ?? "");
  if (!oldId || !newId) return { error: "Pick a subject to link." };

  const supabase = await createClient();
  const { data: fact } = await supabase
    .from("facts")
    .select("body")
    .eq("id", factId)
    .maybeSingle();
  if (!fact) return { error: "Fact not found." };

  const body = String(fact.body).split(`@{${oldId}}`).join(`@{${newId}}`);
  const { error } = await supabase
    .from("facts")
    .update({ body, updated_at: new Date().toISOString() })
    .eq("id", factId);

  if (error) return { error: error.message };
  await syncFactRelationships(supabase, factId, subjectId, body);
  await touchSubject(supabase, subjectId);
  revalidatePath(`/worlds/${worldId}/subjects/${subjectId}`);
  return {};
}

export type SubjectCard = {
  name: string;
  category: string | null;
  fields: { name: string; value: string }[];
};

/**
 * Lazy hover-tooltip payload for a mention or backlink (step 9 §5): the subject's
 * category and its filled schema fields (hide-empty, same rule as the subject
 * page). Live subjects only; returns null when missing/unowned/deleted.
 */
export async function getSubjectCard(subjectId: string): Promise<SubjectCard | null> {
  const supabase = await createClient();

  const { data: subject } = await activeOnly(
    supabase
      .from("subjects")
      .select("id, name, category_id, category:categories(name)")
      .eq("id", subjectId),
  ).maybeSingle();
  if (!subject) return null;

  const category = (subject.category as unknown as { name: string } | null)?.name ?? null;

  const [{ data: fieldData }, { data: fvData }] = await Promise.all([
    supabase
      .from("schema_fields")
      .select("id, name, type")
      .eq("category_id", subject.category_id)
      .order("position"),
    supabase
      .from("field_values")
      .select("id, field_id, scalar_value, linked_subject_id")
      .eq("subject_id", subjectId),
  ]);
  const schemaFields = (fieldData ?? []) as { id: string; name: string; type: FieldType }[];
  const fieldValues = (fvData ?? []) as {
    id: string;
    field_id: string;
    scalar_value: unknown;
    linked_subject_id: string | null;
  }[];

  // List memberships for any field_values present.
  const fvIds = fieldValues.map((fv) => fv.id);
  const { data: lvsData } = fvIds.length
    ? await supabase
        .from("list_value_subjects")
        .select("field_value_id, subject_id")
        .in("field_value_id", fvIds)
    : { data: [] };
  const listRows = (lvsData ?? []) as { field_value_id: string; subject_id: string }[];

  // Resolve referenced (Link/List) subject names in one batch.
  const refIds = new Set<string>();
  fieldValues.forEach((fv) => fv.linked_subject_id && refIds.add(fv.linked_subject_id));
  listRows.forEach((r) => refIds.add(r.subject_id));
  const { data: refSubjects } = refIds.size
    ? await activeOnly(supabase.from("subjects").select("id, name").in("id", Array.from(refIds)))
    : { data: [] };
  const refName = new Map(
    ((refSubjects ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]),
  );

  const fields: { name: string; value: string }[] = [];
  for (const field of schemaFields) {
    const fv = fieldValues.find((v) => v.field_id === field.id);
    if (!fv) continue;
    let value = "";
    if (field.type === "Link") {
      value = fv.linked_subject_id ? refName.get(fv.linked_subject_id) ?? "" : "";
    } else if (field.type === "List") {
      value = listRows
        .filter((r) => r.field_value_id === fv.id)
        .map((r) => refName.get(r.subject_id))
        .filter((n): n is string => !!n)
        .join(", ");
    } else {
      value = formatScalarValue(field.type, fv.scalar_value);
    }
    if (value) fields.push({ name: field.name, value });
  }

  return { name: subject.name, category, fields };
}
