/**
 * Category page (step 6: schema editor section). Resolves the category within its
 * world (RLS + deleted_at filter → 404 on foreign/missing/deleted). Loads this
 * category's schema fields and the world's categories (for List/Link target
 * pickers). Step 7 adds the subject list below the schema editor.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { activeOnly } from "@/lib/db/soft-delete";
import { SchemaEditor, type SchemaField } from "./schema-editor";

type Props = { params: Promise<{ worldId: string; categoryId: string }> };

export default async function CategoryPage({ params }: Props) {
  const { worldId, categoryId } = await params;
  const supabase = await createClient();

  const { data: category } = await supabase
    .from("categories")
    .select("id, name, icon, world_id")
    .eq("id", categoryId)
    .eq("world_id", worldId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!category) notFound();

  const [{ data: fieldData }, { data: categoryData }] = await Promise.all([
    supabase
      .from("schema_fields")
      .select(
        "id, name, type, position, target_category_id, select_options, scale_min, scale_max, unit",
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
          href={`/worlds/${worldId}`}
          className="text-sm text-neutral-500 underline-offset-4 transition hover:text-neutral-800 hover:underline dark:hover:text-neutral-200"
        >
          ← {category.icon ?? ""} categories
        </Link>
        <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
          <span aria-hidden>{category.icon ?? ""}</span>
          {category.name}
        </h1>
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
