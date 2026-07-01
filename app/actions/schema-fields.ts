"use server";

/**
 * Server-only schema-field CRUD (step 6). Door 1; RLS-scoped; account_id
 * auto-stamped. Schema fields are NOT soft-deleted — they hold no values yet
 * (values arrive in step 7), so delete is a plain hard delete. Per-type config is
 * validated by lib/schema-fields.validateField. See docs/step-6 spec §5.
 */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateField, type FieldDraft, type FieldType } from "@/lib/schema-fields";

export type FieldResult = { error?: string };

/** Parse the per-type config fields out of the submitted form. */
function draftFromForm(formData: FormData): FieldDraft {
  const optionsRaw = String(formData.get("selectOptions") ?? "");
  let selectOptions: string[] | undefined;
  if (optionsRaw) {
    try {
      const parsed = JSON.parse(optionsRaw);
      if (Array.isArray(parsed)) selectOptions = parsed.map((o) => String(o));
    } catch {
      selectOptions = undefined;
    }
  }

  const scaleMinRaw = formData.get("scaleMin");
  const scaleMaxRaw = formData.get("scaleMax");
  const targetCategoryId = String(formData.get("targetCategoryId") ?? "") || null;
  const unit = String(formData.get("unit") ?? "") || null;
  const inverseLabel = String(formData.get("inverseLabel") ?? "") || null;

  return {
    name: String(formData.get("name") ?? ""),
    type: String(formData.get("type") ?? "") as FieldType,
    targetCategoryId,
    selectOptions,
    scaleMin: scaleMinRaw === null || scaleMinRaw === "" ? null : Number(scaleMinRaw),
    scaleMax: scaleMaxRaw === null || scaleMaxRaw === "" ? null : Number(scaleMaxRaw),
    unit,
    inverseLabel,
  };
}

/** Next field position = after the last field in the category. */
async function nextFieldPosition(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categoryId: string,
): Promise<number> {
  const { data } = await supabase
    .from("schema_fields")
    .select("position")
    .eq("category_id", categoryId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.position ?? 0) + 1;
}

export async function createField(formData: FormData): Promise<FieldResult & { id?: string }> {
  const worldId = String(formData.get("worldId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const validated = validateField(draftFromForm(formData));
  if ("error" in validated) return { error: validated.error };

  const supabase = await createClient();
  const position = await nextFieldPosition(supabase, categoryId);
  const { config } = validated;

  const { data, error } = await supabase
    .from("schema_fields")
    .insert({
      category_id: categoryId,
      name: validated.name,
      type: validated.type,
      position,
      target_category_id: config.targetCategoryId,
      select_options: config.selectOptions,
      scale_min: config.scaleMin,
      scale_max: config.scaleMax,
      unit: config.unit,
      inverse_label: config.inverseLabel,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Could not create field." };
  revalidatePath(`/worlds/${worldId}/categories/${categoryId}`);
  return { id: data.id };
}

export async function updateField(formData: FormData): Promise<FieldResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const fieldId = String(formData.get("fieldId") ?? "");
  const validated = validateField(draftFromForm(formData));
  if ("error" in validated) return { error: validated.error };

  const supabase = await createClient();
  const { config } = validated;

  const { error } = await supabase
    .from("schema_fields")
    .update({
      name: validated.name,
      type: validated.type,
      target_category_id: config.targetCategoryId,
      select_options: config.selectOptions,
      scale_min: config.scaleMin,
      scale_max: config.scaleMax,
      unit: config.unit,
      inverse_label: config.inverseLabel,
      updated_at: new Date().toISOString(),
    })
    .eq("id", fieldId);

  if (error) return { error: error.message };
  revalidatePath(`/worlds/${worldId}/categories/${categoryId}`);
  return {};
}

/** Persist a drag-reorder; client computes the midpoint position. */
export async function reorderField(formData: FormData): Promise<FieldResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const fieldId = String(formData.get("fieldId") ?? "");
  const position = Number(formData.get("position"));
  if (Number.isNaN(position)) return { error: "Invalid position." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("schema_fields")
    .update({ position, updated_at: new Date().toISOString() })
    .eq("id", fieldId);

  if (error) return { error: error.message };
  revalidatePath(`/worlds/${worldId}/categories/${categoryId}`);
  return {};
}

/** Hard-delete a field (no values exist yet). */
export async function deleteField(formData: FormData): Promise<FieldResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const fieldId = String(formData.get("fieldId") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.from("schema_fields").delete().eq("id", fieldId);

  if (error) return { error: error.message };
  if (categoryId) revalidatePath(`/worlds/${worldId}/categories/${categoryId}`);
  revalidatePath(`/worlds/${worldId}`);
  return {};
}

/**
 * Re-point a List/Link field to a different target category. Used by the
 * category-delete RESTRICT panel to clear a blocker without deleting the field.
 */
export async function repointField(formData: FormData): Promise<FieldResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const fieldId = String(formData.get("fieldId") ?? "");
  const targetCategoryId = String(formData.get("targetCategoryId") ?? "");
  if (!targetCategoryId) return { error: "Choose a category." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("schema_fields")
    .update({ target_category_id: targetCategoryId, updated_at: new Date().toISOString() })
    .eq("id", fieldId);

  if (error) return { error: error.message };
  revalidatePath(`/worlds/${worldId}`);
  return {};
}
