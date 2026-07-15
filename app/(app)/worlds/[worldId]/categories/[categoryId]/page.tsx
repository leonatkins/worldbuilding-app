/**
 * Category detail page (step 15b, ADR 0013) — an authoring/focus surface, not a
 * navigation step: a category's members (left) and its schema editor (right)
 * together, which flat Browse never shows. Reached from the Overview index (Edit
 * mode) and Browse's category chip, not a folder click. The old read-only schema
 * *summary* is dropped and the dedicated /schema route folds in here (it now just
 * redirects). Same resolve/tombstone handling as before — foreign/missing → 404,
 * soft-deleted category or world → Tombstone + Restore (ADR 0006).
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { activeOnly, deletedOnly } from "@/lib/db/soft-delete";
import { Tombstone } from "@/app/(app)/_components/tombstone";
import { SaveAsTemplateButton } from "@/app/(app)/_components/save-as-template";
import { SchemaEditor, type SchemaField } from "./schema-editor";
import { SubjectsList, type Subject, type DeletedSubject } from "./subjects-list";

type Props = { params: Promise<{ worldId: string; categoryId: string }> };

export default async function CategoryPage({ params }: Props) {
  const { worldId, categoryId } = await params;
  const supabase = await createClient();

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

  const [
    { data: fieldData },
    { data: categoryData },
    { data: subjectData },
    { data: deletedSubjectData },
  ] = await Promise.all([
    supabase
      .from("schema_fields")
      .select(
        "id, name, type, position, target_category_id, select_options, scale_min, scale_max, unit, inverse_label",
      )
      .eq("category_id", categoryId)
      .order("position"),
    activeOnly(
      supabase.from("categories").select("id, name").eq("world_id", worldId).order("position"),
    ),
    activeOnly(
      supabase
        .from("subjects")
        .select("id, name, created_at, updated_at")
        .eq("category_id", categoryId),
    ),
    deletedOnly(supabase.from("subjects").select("id, name").eq("category_id", categoryId)),
  ]);

  const fields = (fieldData ?? []) as SchemaField[];
  const categories = (categoryData ?? []) as { id: string; name: string }[];
  const subjects = (subjectData ?? []) as Subject[];
  const deletedSubjects = (deletedSubjectData ?? []) as DeletedSubject[];

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
      <div className="space-y-1">
        <Link
          href={`/worlds/${worldId}`}
          className="text-sm text-neutral-500 underline-offset-4 transition hover:text-neutral-800 hover:underline dark:hover:text-neutral-200"
        >
          ← {world?.name ?? "World"}
        </Link>
        <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
          <span aria-hidden>{category.icon ?? ""}</span>
          {category.name}
        </h1>
      </div>

      {/* Members (left) + schema editor (right); stacks members-first on mobile. */}
      <div className="grid gap-8 lg:grid-cols-2">
        <SubjectsList
          worldId={worldId}
          categoryId={categoryId}
          subjects={subjects}
          deletedSubjects={deletedSubjects}
        />

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">Schema</h2>
            <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
              The structured, queryable facts every subject in this category shares.
              Optional — add them only when you’d filter or compare by the value.
            </p>
          </div>
          <SchemaEditor
            worldId={worldId}
            categoryId={categoryId}
            fields={fields}
            categories={categories}
          />
          <div className="pt-2">
            <SaveAsTemplateButton kind="schema" sourceId={categoryId} defaultName={category.name} />
          </div>
        </section>
      </div>
    </main>
  );
}
