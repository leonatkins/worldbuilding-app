/**
 * A world's home = the category manager (step 6). Resolves the world by id; RLS +
 * the deleted_at filter mean a foreign, missing, or soft-deleted world returns no
 * row → 404. Loads the world's live categories (for the manager) and soft-deleted
 * ones (for Recently Deleted), then hands them to the client island.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { activeOnly, deletedOnly } from "@/lib/db/soft-delete";
import {
  CategoryManager,
  type Category,
  type DeletedCategory,
} from "./category-manager";

type WorldPageProps = { params: Promise<{ worldId: string }> };

export default async function WorldPage({ params }: WorldPageProps) {
  const { worldId } = await params;
  const supabase = await createClient();

  const { data: world } = await supabase
    .from("worlds")
    .select("id, name")
    .eq("id", worldId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!world) notFound();

  const [{ data: active }, { data: deleted }] = await Promise.all([
    activeOnly(
      supabase
        .from("categories")
        .select("id, name, icon, position")
        .eq("world_id", worldId)
        .order("position"),
    ),
    deletedOnly(
      supabase.from("categories").select("id, name").eq("world_id", worldId),
    ),
  ]);

  const categories = (active ?? []) as Category[];
  const deletedCategories = (deleted ?? []) as DeletedCategory[];

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      <div className="space-y-1">
        <Link
          href="/"
          className="text-sm text-neutral-500 underline-offset-4 transition hover:text-neutral-800 hover:underline dark:hover:text-neutral-200"
        >
          ← All worlds
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{world.name}</h1>
        <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          Categories group the subjects in your world. Drag to reorder.
        </p>
      </div>

      <CategoryManager
        worldId={worldId}
        categories={categories}
        deletedCategories={deletedCategories}
      />
    </main>
  );
}
