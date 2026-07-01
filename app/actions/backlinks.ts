"use server";

/**
 * Backlink promotion (step 10) — the second bridge from loose facts into
 * schema structure (design §4.3). Selects several backlinks on a subject's
 * "Referenced by" rail and adds them into a List field on that subject: an
 * existing one (additive — union with current members) or a brand-new one
 * (reuses schema-fields' `createField`, so name validation/position/insert
 * stay in one place). The single-category constraint on List fields
 * (`target_category_id`) is enforced client-side by disabling mismatched
 * checkboxes before a promotion is ever submitted — this action still trusts
 * only the ids it's given, not any category assumption from the client.
 */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createField } from "@/app/actions/schema-fields";
import { writeListValue } from "@/app/actions/field-values";

export type PromoteResult = { error?: string };

export async function promoteToListField(formData: FormData): Promise<PromoteResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const targetCategoryId = String(formData.get("targetCategoryId") ?? "");
  const fieldId = String(formData.get("fieldId") ?? "") || null;
  const newFieldName = String(formData.get("newFieldName") ?? "") || null;

  let subjectIds: string[];
  try {
    const parsed = JSON.parse(String(formData.get("subjectIds") ?? "[]"));
    subjectIds = Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
  } catch {
    subjectIds = [];
  }
  if (subjectIds.length === 0) return { error: "Select at least one backlink." };
  if (!targetCategoryId) return { error: "Missing target category." };

  const supabase = await createClient();

  let resolvedFieldId = fieldId;
  if (!resolvedFieldId) {
    if (!newFieldName?.trim()) return { error: "Name the new field." };
    const fieldFd = new FormData();
    fieldFd.set("worldId", worldId);
    fieldFd.set("categoryId", categoryId);
    fieldFd.set("name", newFieldName);
    fieldFd.set("type", "List");
    fieldFd.set("targetCategoryId", targetCategoryId);
    const created = await createField(fieldFd);
    if (created.error || !created.id) return { error: created.error ?? "Could not create field." };
    resolvedFieldId = created.id;
  }

  // Additive: union whatever this field already holds with the promoted ids.
  const { data: fv } = await supabase
    .from("field_values")
    .select("id")
    .eq("subject_id", subjectId)
    .eq("field_id", resolvedFieldId)
    .maybeSingle();
  let existingMemberIds: string[] = [];
  if (fv) {
    const { data: members } = await supabase
      .from("list_value_subjects")
      .select("subject_id")
      .eq("field_value_id", fv.id);
    existingMemberIds = ((members ?? []) as { subject_id: string }[]).map((m) => m.subject_id);
  }
  const memberIds = Array.from(new Set([...existingMemberIds, ...subjectIds]));

  const result = await writeListValue(supabase, subjectId, resolvedFieldId, memberIds);
  if (result.error) return result;

  revalidatePath(`/worlds/${worldId}/subjects/${subjectId}`);
  return {};
}
