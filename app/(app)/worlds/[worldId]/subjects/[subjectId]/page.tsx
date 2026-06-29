/**
 * Subject page (step 7) — the §6.7 layout minus facts (facts arrive in step 8).
 * Resolves the subject (RLS + deleted_at → 404), then loads its category's schema
 * fields, the subject's field values (scalar / Link / List), its tags, the world's
 * tags (for autocomplete), and inbound field backlinks. Everything is assembled
 * server-side and handed to the client island for inline editing.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { activeOnly } from "@/lib/db/soft-delete";
import { SubjectPage, type FieldValueState } from "./subject-page";
import type { SchemaField } from "../../categories/[categoryId]/schema-editor";

type Props = { params: Promise<{ worldId: string; subjectId: string }> };

export default async function SubjectRoute({ params }: Props) {
  const { worldId, subjectId } = await params;
  const supabase = await createClient();

  const { data: subject } = await supabase
    .from("subjects")
    .select("id, name, category_id, world_id")
    .eq("id", subjectId)
    .eq("world_id", worldId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!subject) notFound();

  const [{ data: category }, { data: categoryList }, { data: fieldData }] =
    await Promise.all([
      supabase
        .from("categories")
        .select("id, name")
        .eq("id", subject.category_id)
        .maybeSingle(),
      activeOnly(
        supabase.from("categories").select("id, name").eq("world_id", worldId).order("position"),
      ),
      supabase
        .from("schema_fields")
        .select(
          "id, name, type, position, target_category_id, select_options, scale_min, scale_max, unit",
        )
        .eq("category_id", subject.category_id)
        .order("position"),
    ]);

  const fields = (fieldData ?? []) as SchemaField[];

  // Field values for this subject + the List memberships.
  const { data: fvData } = await supabase
    .from("field_values")
    .select("id, field_id, scalar_value, linked_subject_id")
    .eq("subject_id", subjectId);
  const fieldValues = (fvData ?? []) as {
    id: string;
    field_id: string;
    scalar_value: unknown;
    linked_subject_id: string | null;
  }[];

  const fvIds = fieldValues.map((fv) => fv.id);
  const { data: lvsData } = fvIds.length
    ? await supabase
        .from("list_value_subjects")
        .select("field_value_id, subject_id")
        .in("field_value_id", fvIds)
    : { data: [] };
  const listRows = (lvsData ?? []) as { field_value_id: string; subject_id: string }[];

  // Tags on this subject + all world tags for autocomplete.
  const [{ data: subjectTagData }, { data: worldTagData }] = await Promise.all([
    supabase
      .from("subject_tags")
      .select("tag_id, tags!inner(id, name)")
      .eq("subject_id", subjectId),
    supabase.from("tags").select("id, name").eq("world_id", worldId).order("name"),
  ]);
  const tags = (subjectTagData ?? []).map((row) => {
    const t = row.tags as unknown as { id: string; name: string };
    return { id: t.id, name: t.name };
  });
  const allTags = (worldTagData ?? []) as { id: string; name: string }[];

  // Inbound field backlinks (origin = field).
  const { data: backlinkData } = await supabase
    .from("relationships")
    .select("from_subject_id, field_id")
    .eq("to_subject_id", subjectId)
    .eq("origin", "field");
  const backlinkRows = (backlinkData ?? []) as {
    from_subject_id: string;
    field_id: string | null;
  }[];

  // Resolve all referenced subject + field names in batch.
  const referencedSubjectIds = new Set<string>();
  fieldValues.forEach((fv) => fv.linked_subject_id && referencedSubjectIds.add(fv.linked_subject_id));
  listRows.forEach((r) => referencedSubjectIds.add(r.subject_id));
  backlinkRows.forEach((r) => referencedSubjectIds.add(r.from_subject_id));

  const backlinkFieldIds = Array.from(
    new Set(backlinkRows.map((r) => r.field_id).filter((id): id is string => !!id)),
  );

  const [{ data: refSubjects }, { data: backlinkFields }] = await Promise.all([
    referencedSubjectIds.size
      ? activeOnly(
          supabase.from("subjects").select("id, name").in("id", Array.from(referencedSubjectIds)),
        )
      : Promise.resolve({ data: [] }),
    backlinkFieldIds.length
      ? supabase.from("schema_fields").select("id, name").in("id", backlinkFieldIds)
      : Promise.resolve({ data: [] }),
  ]);
  const subjectName = new Map(
    ((refSubjects ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]),
  );
  const fieldName = new Map(
    ((backlinkFields ?? []) as { id: string; name: string }[]).map((f) => [f.id, f.name]),
  );

  // Build per-field value state.
  const membersByFv = new Map<string, { id: string; name: string }[]>();
  listRows.forEach((r) => {
    const arr = membersByFv.get(r.field_value_id) ?? [];
    const name = subjectName.get(r.subject_id);
    if (name) arr.push({ id: r.subject_id, name });
    membersByFv.set(r.field_value_id, arr);
  });

  const valuesByField: Record<string, FieldValueState> = {};
  for (const field of fields) {
    const fv = fieldValues.find((v) => v.field_id === field.id);
    if (!fv) continue;
    if (field.type === "Link") {
      if (fv.linked_subject_id) {
        valuesByField[field.id] = {
          kind: "link",
          subject: {
            id: fv.linked_subject_id,
            name: subjectName.get(fv.linked_subject_id) ?? "(deleted)",
          },
        };
      }
    } else if (field.type === "List") {
      const members = membersByFv.get(fv.id) ?? [];
      if (members.length) valuesByField[field.id] = { kind: "list", subjects: members };
    } else {
      valuesByField[field.id] = { kind: "scalar", value: fv.scalar_value };
    }
  }

  // Date learned-autofill vocabulary: distinct Date-field values already entered
  // across this world (no AI/cloud — just the user's own prior dates). Two cheap
  // queries: the world's Date fields, then their values.
  const worldCategoryIds = ((categoryList ?? []) as { id: string }[]).map((c) => c.id);
  let dateSuggestions: string[] = [];
  if (worldCategoryIds.length) {
    const { data: dateFields } = await supabase
      .from("schema_fields")
      .select("id")
      .eq("type", "Date")
      .in("category_id", worldCategoryIds);
    const dateFieldIds = ((dateFields ?? []) as { id: string }[]).map((f) => f.id);
    if (dateFieldIds.length) {
      const { data: dateVals } = await supabase
        .from("field_values")
        .select("scalar_value")
        .in("field_id", dateFieldIds)
        .limit(200);
      dateSuggestions = Array.from(
        new Set(
          ((dateVals ?? []) as { scalar_value: unknown }[])
            .map((r) => (typeof r.scalar_value === "string" ? r.scalar_value : null))
            .filter((s): s is string => !!s && s.trim().length > 0),
        ),
      ).slice(0, 50);
    }
  }

  // Group backlinks by field name.
  const backlinkGroups = new Map<string, { id: string; name: string }[]>();
  for (const row of backlinkRows) {
    const label = row.field_id ? fieldName.get(row.field_id) ?? "Linked" : "Linked";
    const arr = backlinkGroups.get(label) ?? [];
    const name = subjectName.get(row.from_subject_id);
    if (name && !arr.some((s) => s.id === row.from_subject_id)) {
      arr.push({ id: row.from_subject_id, name });
    }
    backlinkGroups.set(label, arr);
  }
  const backlinks = Array.from(backlinkGroups.entries()).map(([label, subjects]) => ({
    label,
    subjects,
  }));

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-12">
      <Link
        href={`/worlds/${worldId}/categories/${subject.category_id}`}
        className="text-sm text-neutral-500 underline-offset-4 transition hover:text-neutral-800 hover:underline dark:hover:text-neutral-200"
      >
        ← {category?.name ?? "Category"}
      </Link>

      <SubjectPage
        worldId={worldId}
        subject={{ id: subject.id, name: subject.name, categoryId: subject.category_id }}
        category={category ?? { id: subject.category_id, name: "Category" }}
        categories={(categoryList ?? []) as { id: string; name: string }[]}
        fields={fields}
        valuesByField={valuesByField}
        tags={tags}
        allTags={allTags}
        backlinks={backlinks}
        dateSuggestions={dateSuggestions}
      />
    </main>
  );
}
