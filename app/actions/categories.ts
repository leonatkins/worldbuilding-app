"use server";

/**
 * Server-only category CRUD (step 6). All access via the Supabase client (door 1):
 * `account_id` auto-stamped, RLS enforces ownership, reads filter `deleted_at IS
 * NULL`. Categories use soft delete (ADR 0005). See docs/step-6-category-schema-
 * editor-spec.md.
 */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateName } from "@/lib/validation";
import { DEFAULT_CATEGORY_ICON } from "@/lib/categories";

/** A field (in another category) that blocks deleting a category via RESTRICT. */
export type BlockingField = {
  fieldId: string;
  fieldName: string;
  categoryId: string;
  categoryName: string;
};

export type CategoryResult = { error?: string; blockers?: BlockingField[] };

/** Next position = after the last live category in the world (unit gaps). */
async function nextCategoryPosition(
  supabase: Awaited<ReturnType<typeof createClient>>,
  worldId: string,
): Promise<number> {
  const { data } = await supabase
    .from("categories")
    .select("position")
    .eq("world_id", worldId)
    .is("deleted_at", null)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.position ?? 0) + 1;
}

export async function createCategory(formData: FormData): Promise<CategoryResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const icon = String(formData.get("icon") ?? "").trim() || DEFAULT_CATEGORY_ICON;
  const validated = validateName(String(formData.get("name") ?? ""));
  if ("error" in validated) return { error: validated.error };

  const supabase = await createClient();
  const position = await nextCategoryPosition(supabase, worldId);

  const { error } = await supabase
    .from("categories")
    .insert({ world_id: worldId, name: validated.name, icon, position });

  if (error) return { error: error.message };
  revalidatePath(`/worlds/${worldId}`);
  return {};
}

export async function renameCategory(formData: FormData): Promise<CategoryResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const validated = validateName(String(formData.get("name") ?? ""));
  if ("error" in validated) return { error: validated.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ name: validated.name, updated_at: new Date().toISOString() })
    .eq("id", categoryId);

  if (error) return { error: error.message };
  revalidatePath(`/worlds/${worldId}`);
  return {};
}

export async function setCategoryIcon(formData: FormData): Promise<CategoryResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const icon = String(formData.get("icon") ?? "").trim() || DEFAULT_CATEGORY_ICON;

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ icon, updated_at: new Date().toISOString() })
    .eq("id", categoryId);

  if (error) return { error: error.message };
  revalidatePath(`/worlds/${worldId}`);
  return {};
}

/** Persist a drag-reorder. The client computes the midpoint position. */
export async function reorderCategory(formData: FormData): Promise<CategoryResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const position = Number(formData.get("position"));
  if (Number.isNaN(position)) return { error: "Invalid position." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ position, updated_at: new Date().toISOString() })
    .eq("id", categoryId);

  if (error) return { error: error.message };
  revalidatePath(`/worlds/${worldId}`);
  return {};
}

/**
 * Soft-delete a category (ADR 0005). First detects List/Link fields in OTHER
 * categories that target this one (the RESTRICT dependency, design §4.2): if any
 * exist, returns them as `blockers` so the UI can offer delete/re-point inline,
 * and does NOT delete. Fields within this category are cascade-removed on purge,
 * so they don't block.
 */
export async function deleteCategory(formData: FormData): Promise<CategoryResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");

  const supabase = await createClient();

  const { data: referencing } = await supabase
    .from("schema_fields")
    .select("id, name, category_id, categories!category_id(name)")
    .eq("target_category_id", categoryId)
    .neq("category_id", categoryId)
    .is("deleted_at", null);

  if (referencing && referencing.length > 0) {
    const blockers: BlockingField[] = referencing.map((r) => {
      const cat = r.categories as unknown as { name: string } | null;
      return {
        fieldId: r.id as string,
        fieldName: r.name as string,
        categoryId: r.category_id as string,
        categoryName: cat?.name ?? "another category",
      };
    });
    return { blockers };
  }

  const { error } = await supabase
    .from("categories")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", categoryId);

  if (error) return { error: error.message };
  revalidatePath(`/worlds/${worldId}`);
  return {};
}

export async function restoreCategory(formData: FormData): Promise<CategoryResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ deleted_at: null })
    .eq("id", categoryId);

  if (error) return { error: error.message };
  revalidatePath(`/worlds/${worldId}`);
  return {};
}

/** Permanently delete a category now (CASCADE removes its fields/subjects). */
export async function purgeCategory(formData: FormData): Promise<CategoryResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", categoryId);

  if (error) return { error: error.message };
  revalidatePath(`/worlds/${worldId}`);
  return {};
}
