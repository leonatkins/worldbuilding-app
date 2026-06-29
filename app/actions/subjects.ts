"use server";

/**
 * Server-only subject CRUD (step 7). Door 1; RLS-scoped; account_id auto-stamped.
 * Subjects use soft delete (ADR 0005). See docs/step-7-subject-crud-spec.md.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateName } from "@/lib/validation";

export type SubjectResult = { error?: string };

/** Create a subject (name only) and redirect into its page. */
export async function createSubject(formData: FormData): Promise<SubjectResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const validated = validateName(String(formData.get("name") ?? ""));
  if ("error" in validated) return { error: validated.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subjects")
    .insert({ world_id: worldId, category_id: categoryId, name: validated.name })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Could not create subject." };

  redirect(`/worlds/${worldId}/subjects/${data.id}`);
}

export async function renameSubject(formData: FormData): Promise<SubjectResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const validated = validateName(String(formData.get("name") ?? ""));
  if ("error" in validated) return { error: validated.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("subjects")
    .update({ name: validated.name, updated_at: new Date().toISOString() })
    .eq("id", subjectId);

  if (error) return { error: error.message };
  revalidatePath(`/worlds/${worldId}/subjects/${subjectId}`);
  return {};
}

/**
 * Move a subject to another category. Schema fields are category-owned, so every
 * field value is orphaned: clear field_values (list_value_subjects cascade) and
 * this subject's field-origin relationships, then switch the category. Facts and
 * tags are untouched (not category-bound). Inbound links are left as-is (accepted
 * edge, step-7 spec §6).
 */
export async function changeSubjectCategory(formData: FormData): Promise<SubjectResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  if (!categoryId) return { error: "Choose a category." };

  const supabase = await createClient();

  await supabase.from("field_values").delete().eq("subject_id", subjectId);
  await supabase
    .from("relationships")
    .delete()
    .eq("from_subject_id", subjectId)
    .eq("origin", "field");

  const { error } = await supabase
    .from("subjects")
    .update({ category_id: categoryId, updated_at: new Date().toISOString() })
    .eq("id", subjectId);

  if (error) return { error: error.message };
  revalidatePath(`/worlds/${worldId}/subjects/${subjectId}`);
  return {};
}

export async function deleteSubject(formData: FormData): Promise<SubjectResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");

  const supabase = await createClient();
  const { error } = await supabase
    .from("subjects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", subjectId);

  if (error) return { error: error.message };
  if (categoryId) revalidatePath(`/worlds/${worldId}/categories/${categoryId}`);
  // Deleting from the subject page → send the user back to the category.
  if (categoryId) redirect(`/worlds/${worldId}/categories/${categoryId}`);
  return {};
}

export async function restoreSubject(formData: FormData): Promise<SubjectResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");

  const supabase = await createClient();
  const { error } = await supabase
    .from("subjects")
    .update({ deleted_at: null })
    .eq("id", subjectId);

  if (error) return { error: error.message };
  if (categoryId) revalidatePath(`/worlds/${worldId}/categories/${categoryId}`);
  return {};
}

export async function purgeSubject(formData: FormData): Promise<SubjectResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.from("subjects").delete().eq("id", subjectId);

  if (error) return { error: error.message };
  if (categoryId) revalidatePath(`/worlds/${worldId}/categories/${categoryId}`);
  return {};
}

/** Typeahead search for Link/List pickers: live subjects of a category by name. */
export async function searchSubjects(
  categoryId: string,
  query: string,
  excludeId?: string,
): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  let q = supabase
    .from("subjects")
    .select("id, name")
    .eq("category_id", categoryId)
    .is("deleted_at", null)
    .order("name")
    .limit(20);

  if (query.trim()) q = q.ilike("name", `%${query.trim()}%`);
  if (excludeId) q = q.neq("id", excludeId);

  const { data } = await q;
  return (data ?? []) as { id: string; name: string }[];
}
