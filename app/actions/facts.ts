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
