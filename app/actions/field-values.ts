"use server";

/**
 * Server-only field-value writes (step 7) — the first code to write `field_values`
 * and `relationships`. Hybrid storage (design §4.2): scalar types → scalar_value
 * (jsonb); Link → linked_subject_id; List → list_value_subjects join rows. For
 * Link/List, relationships (backlinks) are kept in sync by delete-then-insert of
 * this (subject, field)'s field-origin rows — simple and idempotent (step-7 spec
 * §5.1). Door 1; RLS-scoped; account_id auto-stamped. The field's type/config is
 * read from the DB (never trusted from the client).
 */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { coerceScalarValue } from "@/lib/field-values";
import type { FieldType } from "@/lib/schema-fields";

export type FieldValueResult = { error?: string };

type Supa = Awaited<ReturnType<typeof createClient>>;

/** Rebuild the field-origin relationship rows for one (subject, field). */
async function syncFieldRelationships(
  supabase: Supa,
  subjectId: string,
  fieldId: string,
  targetIds: string[],
) {
  await supabase
    .from("relationships")
    .delete()
    .eq("from_subject_id", subjectId)
    .eq("field_id", fieldId)
    .eq("origin", "field");

  if (targetIds.length > 0) {
    await supabase.from("relationships").insert(
      targetIds.map((toId) => ({
        from_subject_id: subjectId,
        to_subject_id: toId,
        origin: "field" as const,
        field_id: fieldId,
      })),
    );
  }
}

async function loadField(supabase: Supa, fieldId: string) {
  const { data } = await supabase
    .from("schema_fields")
    .select("id, type, select_options, scale_min, scale_max")
    .eq("id", fieldId)
    .maybeSingle();
  return data as
    | {
        id: string;
        type: FieldType;
        select_options: string[] | null;
        scale_min: number | null;
        scale_max: number | null;
      }
    | null;
}

export async function setScalarValue(formData: FormData): Promise<FieldValueResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const fieldId = String(formData.get("fieldId") ?? "");

  const supabase = await createClient();
  const field = await loadField(supabase, fieldId);
  if (!field) return { error: "Field not found." };

  let raw: string | string[];
  if (field.type === "MultiSelect") {
    try {
      const parsed = JSON.parse(String(formData.get("values") ?? "[]"));
      raw = Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
    } catch {
      raw = [];
    }
  } else {
    raw = String(formData.get("value") ?? "");
  }

  const coerced = coerceScalarValue(field.type, raw, {
    selectOptions: field.select_options,
    scaleMin: field.scale_min,
    scaleMax: field.scale_max,
  });
  if ("error" in coerced) return { error: coerced.error };

  const { error } = await supabase.from("field_values").upsert(
    {
      subject_id: subjectId,
      field_id: fieldId,
      scalar_value: coerced.value,
      linked_subject_id: null,
    },
    { onConflict: "subject_id,field_id" },
  );

  if (error) return { error: error.message };
  revalidatePath(`/worlds/${worldId}/subjects/${subjectId}`);
  return {};
}

export async function setLinkValue(formData: FormData): Promise<FieldValueResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const fieldId = String(formData.get("fieldId") ?? "");
  const linkedSubjectId = String(formData.get("linkedSubjectId") ?? "");

  const supabase = await createClient();

  if (!linkedSubjectId) {
    await supabase
      .from("field_values")
      .delete()
      .eq("subject_id", subjectId)
      .eq("field_id", fieldId);
    await syncFieldRelationships(supabase, subjectId, fieldId, []);
    revalidatePath(`/worlds/${worldId}/subjects/${subjectId}`);
    return {};
  }

  const { error } = await supabase.from("field_values").upsert(
    {
      subject_id: subjectId,
      field_id: fieldId,
      linked_subject_id: linkedSubjectId,
      scalar_value: null,
    },
    { onConflict: "subject_id,field_id" },
  );
  if (error) return { error: error.message };

  await syncFieldRelationships(supabase, subjectId, fieldId, [linkedSubjectId]);
  revalidatePath(`/worlds/${worldId}/subjects/${subjectId}`);
  return {};
}

export async function setListValue(formData: FormData): Promise<FieldValueResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const fieldId = String(formData.get("fieldId") ?? "");

  let subjectIds: string[];
  try {
    const parsed = JSON.parse(String(formData.get("subjectIds") ?? "[]"));
    subjectIds = Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
  } catch {
    subjectIds = [];
  }

  const supabase = await createClient();

  // Empty list = no value: drop the row entirely (cascades list_value_subjects).
  if (subjectIds.length === 0) {
    await supabase
      .from("field_values")
      .delete()
      .eq("subject_id", subjectId)
      .eq("field_id", fieldId);
    await syncFieldRelationships(supabase, subjectId, fieldId, []);
    revalidatePath(`/worlds/${worldId}/subjects/${subjectId}`);
    return {};
  }

  const { data: fv, error: fvError } = await supabase
    .from("field_values")
    .upsert(
      { subject_id: subjectId, field_id: fieldId, scalar_value: null, linked_subject_id: null },
      { onConflict: "subject_id,field_id" },
    )
    .select("id")
    .single();
  if (fvError || !fv) return { error: fvError?.message ?? "Could not save." };

  await supabase.from("list_value_subjects").delete().eq("field_value_id", fv.id);
  const { error: insError } = await supabase
    .from("list_value_subjects")
    .insert(subjectIds.map((sid) => ({ field_value_id: fv.id, subject_id: sid })));
  if (insError) return { error: insError.message };

  await syncFieldRelationships(supabase, subjectId, fieldId, subjectIds);
  revalidatePath(`/worlds/${worldId}/subjects/${subjectId}`);
  return {};
}

export async function clearFieldValue(formData: FormData): Promise<FieldValueResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const fieldId = String(formData.get("fieldId") ?? "");

  const supabase = await createClient();
  await supabase
    .from("field_values")
    .delete()
    .eq("subject_id", subjectId)
    .eq("field_id", fieldId);
  await syncFieldRelationships(supabase, subjectId, fieldId, []);

  revalidatePath(`/worlds/${worldId}/subjects/${subjectId}`);
  return {};
}
