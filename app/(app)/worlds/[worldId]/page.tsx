/**
 * A world's home = the category manager (step 6). Resolves the world by id
 * *without* the active filter so we can distinguish "missing/not owned" (404)
 * from "exists but soft-deleted" (Tombstone with one-click Restore, ADR 0006).
 * Loads the world's live categories (for the manager) and soft-deleted ones (for
 * Recently Deleted), then hands them to the client island.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { activeOnly, deletedOnly } from "@/lib/db/soft-delete";
import { Tombstone } from "@/app/(app)/_components/tombstone";
import { SaveAsTemplateButton } from "@/app/(app)/_components/save-as-template";
import {
  CategoryManager,
  type Category,
  type DeletedCategory,
} from "./category-manager";
import { TagManager, type WorldTag } from "./tag-manager";

type WorldPageProps = { params: Promise<{ worldId: string }> };

export default async function WorldPage({ params }: WorldPageProps) {
  const { worldId } = await params;
  const supabase = await createClient();

  const { data: world } = await supabase
    .from("worlds")
    .select("id, name, deleted_at")
    .eq("id", worldId)
    .maybeSingle();

  if (!world) notFound();
  if (world.deleted_at) {
    return <Tombstone kind="world" name={world.name} worldId={worldId} />;
  }

  const [{ data: active }, { data: deleted }, { data: subjects }, { data: tags }, { data: subjectTags }] =
    await Promise.all([
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
      // Live subjects across the world — used to warn (with a sample) before
      // soft-deleting a category that still contains subjects.
      activeOnly(
        supabase
          .from("subjects")
          .select("name, category_id")
          .eq("world_id", worldId)
          .order("updated_at", { ascending: false }),
      ),
      supabase.from("tags").select("id, name").eq("world_id", worldId).order("name"),
      // Per-tag subject count, for the delete-confirm warning (ADR 0008 — tag
      // delete is hard/cascading, unlike every other entity).
      supabase.from("subject_tags").select("tag_id, tags!inner(world_id)").eq("tags.world_id", worldId),
    ]);

  // Per-category subject count + a few sample names for the delete confirmation.
  const byCategory = new Map<string, string[]>();
  for (const s of (subjects ?? []) as { name: string; category_id: string }[]) {
    const list = byCategory.get(s.category_id) ?? [];
    list.push(s.name);
    byCategory.set(s.category_id, list);
  }

  const categories = ((active ?? []) as Omit<Category, "subjectCount" | "subjectSample">[]).map(
    (c) => {
      const names = byCategory.get(c.id) ?? [];
      return { ...c, subjectCount: names.length, subjectSample: names.slice(0, 3) };
    },
  ) as Category[];
  const deletedCategories = (deleted ?? []) as DeletedCategory[];

  const tagCounts = new Map<string, number>();
  for (const row of (subjectTags ?? []) as { tag_id: string }[]) {
    tagCounts.set(row.tag_id, (tagCounts.get(row.tag_id) ?? 0) + 1);
  }
  const worldTags: WorldTag[] = ((tags ?? []) as { id: string; name: string }[]).map((t) => ({
    ...t,
    subjectCount: tagCounts.get(t.id) ?? 0,
  }));

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

      <TagManager worldId={worldId} tags={worldTags} />

      <div className="pt-2">
        <SaveAsTemplateButton kind="world" sourceId={worldId} defaultName={world.name} />
      </div>
    </main>
  );
}
