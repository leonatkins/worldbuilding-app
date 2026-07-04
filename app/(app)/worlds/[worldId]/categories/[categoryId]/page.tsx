/**
 * Category page (step 6: schema section; step 10: read-only). Resolves the
 * category within its world (RLS + deleted_at filter → 404 on foreign/missing/
 * deleted). Loads this category's schema fields and the world's categories (for
 * the read-only target-category labels). Editing the schema lives at the
 * dedicated /schema route — this page never mutates it. Step 7 adds the subject
 * list below.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { activeOnly, deletedOnly } from "@/lib/db/soft-delete";
import { Tombstone } from "@/app/(app)/_components/tombstone";
import { SchemaSummary } from "./schema-summary";
import type { SchemaField } from "./schema-editor";
import {
  SubjectsList,
  type Subject,
  type DeletedSubject,
} from "./subjects-list";

type Props = { params: Promise<{ worldId: string; categoryId: string }> };

export default async function CategoryPage({ params }: Props) {
  const { worldId, categoryId } = await params;
  const supabase = await createClient();

  // Resolve the category *with* its ancestor world's deleted_at, without the
  // active filter, so we can distinguish "missing/not owned" (404) from "exists
  // but unreachable because it — or its world — is in Recently Deleted"
  // (Tombstone, ADR 0006).
  const { data: category } = await supabase
    .from("categories")
    .select("id, name, icon, world_id, deleted_at, world:worlds(name, deleted_at)")
    .eq("id", categoryId)
    .eq("world_id", worldId)
    .maybeSingle();

  if (!category) notFound();

  const world = category.world as unknown as { name: string; deleted_at: string | null } | null;
  if (world?.deleted_at) {
    return <Tombstone kind="world" name={world.name} worldId={worldId} />;
  }
  if (category.deleted_at) {
    return (
      <Tombstone kind="category" name={category.name} worldId={worldId} categoryId={categoryId} />
    );
  }

  const [{ data: fieldData }, { data: categoryData }] = await Promise.all([
    supabase
      .from("schema_fields")
      .select(
        "id, name, type, position, target_category_id, select_options, scale_min, scale_max, unit, inverse_label",
      )
      .eq("category_id", categoryId)
      .order("position"),
    activeOnly(
      supabase
        .from("categories")
        .select("id, name")
        .eq("world_id", worldId)
        .order("position"),
    ),
  ]);

  const fields = (fieldData ?? []) as SchemaField[];
  const categories = (categoryData ?? []) as { id: string; name: string }[];

  const [{ data: subjectData }, { data: deletedSubjectData }] = await Promise.all([
    activeOnly(
      supabase
        .from("subjects")
        .select("id, name, created_at, updated_at")
        .eq("category_id", categoryId),
    ),
    deletedOnly(
      supabase.from("subjects").select("id, name").eq("category_id", categoryId),
    ),
  ]);
  const subjects = (subjectData ?? []) as Subject[];
  const deletedSubjects = (deletedSubjectData ?? []) as DeletedSubject[];

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      <div className="space-y-1">
        <Link
          href={`/worlds/${worldId}`}
          className="text-sm text-neutral-500 underline-offset-4 transition hover:text-neutral-800 hover:underline dark:hover:text-neutral-200"
        >
          ← categories
        </Link>
        <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
          <span aria-hidden>{category.icon ?? ""}</span>
          {category.name}
        </h1>
        <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          Schema fields are the structured, queryable facts every subject in
          this category shares. Optional — add them only when you’d filter or
          compare by the value.
        </p>
      </div>

      <SchemaSummary
        worldId={worldId}
        categoryId={categoryId}
        fields={fields}
        categories={categories}
      />

      <SubjectsList
        worldId={worldId}
        categoryId={categoryId}
        subjects={subjects}
        deletedSubjects={deletedSubjects}
      />
    </main>
  );
}
