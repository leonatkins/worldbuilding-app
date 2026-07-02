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

/** Create a subject (name only). Stays on the category page for fast repeat-add. */
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

  revalidatePath(`/worlds/${worldId}/categories/${categoryId}`);
  return {};
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

/**
 * World-scoped typeahead for `@mention` autocomplete (step 9). Unlike
 * `searchSubjects` (category-scoped, for Link/List pickers) this searches every
 * live subject in the world. Empty query → the 10 most recently edited (fast
 * "who was I just working on" capture); otherwise alphabetical with an exact
 * name match floated to the top to disambiguate identical names.
 */
export async function searchSubjectsInWorld(
  worldId: string,
  query: string,
  limit = 10,
): Promise<{ id: string; name: string; categoryName: string | null }[]> {
  const supabase = await createClient();
  const trimmed = query.trim();

  let q = supabase
    .from("subjects")
    .select("id, name, category:categories(name)")
    .eq("world_id", worldId)
    .is("deleted_at", null)
    .limit(limit);

  q = trimmed ? q.ilike("name", `%${trimmed}%`).order("name") : q.order("updated_at", { ascending: false });

  const { data } = await q;
  const rows = ((data ?? []) as unknown as {
    id: string;
    name: string;
    category: { name: string } | null;
  }[]).map((r) => ({ id: r.id, name: r.name, categoryName: r.category?.name ?? null }));

  // Float an exact (case-insensitive) name match to the front.
  if (trimmed) {
    const lower = trimmed.toLowerCase();
    rows.sort((a, b) => Number(b.name.toLowerCase() === lower) - Number(a.name.toLowerCase() === lower));
  }
  return rows;
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
