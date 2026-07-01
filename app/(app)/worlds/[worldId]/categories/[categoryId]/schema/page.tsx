/**
 * Dedicated schema editor route (step 10). Split out of the category page,
 * which now only shows a read-only summary — every schema mutation (add,
 * edit, delete, reorder, inverse_label) happens here instead. Same category
 * resolution / tombstone handling as the category page, since a foreign or
 * deleted category must 404/tombstone here too.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { activeOnly } from "@/lib/db/soft-delete";
import { Tombstone } from "@/app/(app)/_components/tombstone";
import { SchemaEditor, type SchemaField } from "../schema-editor";

type Props = { params: Promise<{ worldId: string; categoryId: string }> };

export default async function CategorySchemaPage({ params }: Props) {
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

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      <div className="space-y-1">
        <Link
          href={`/worlds/${worldId}/categories/${categoryId}`}
          className="text-sm text-neutral-500 underline-offset-4 transition hover:text-neutral-800 hover:underline dark:hover:text-neutral-200"
        >
          ← {category.icon ? `${category.icon} ` : ""}{category.name}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Edit schema</h1>
        <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          Schema fields are the structured, queryable facts every{" "}
          {category.name.toLowerCase()} shares. Optional — add them only when you’d
          filter or compare by the value.
        </p>
      </div>

      <SchemaEditor
        worldId={worldId}
        categoryId={categoryId}
        fields={fields}
        categories={categories}
      />
    </main>
  );
}
