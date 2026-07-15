/**
 * A world's Overview — the journal front page you open to (step 15b, ADR 0014).
 * Recency-led (recently edited / viewed *in this world*), opening with a start-here
 * new-subject composer and closing with a secondary categories index — a category
 * click filters Browse, it is not a folder (ADR 0013). Category management inlines
 * behind the index's Edit toggle; tag management moved to Browse; there is no tab bar.
 * Resolves the world *without* the active filter so we can tell "missing/not owned"
 * (404) from "exists but soft-deleted" (Tombstone + one-click Restore, ADR 0006).
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { activeOnly, deletedOnly } from "@/lib/db/soft-delete";
import { Tombstone } from "@/app/(app)/_components/tombstone";
import { SaveAsTemplateButton } from "@/app/(app)/_components/save-as-template";
import { RecentSubjects, type RecentSubject } from "@/app/(app)/_components/recent-subjects";
import { type Category, type DeletedCategory } from "./category-manager";
import { WorldCategories } from "./world-categories";
import { NewSubjectForm } from "./new-subject-form";

type WorldPageProps = { params: Promise<{ worldId: string }> };

const RECENCY_LIMIT = 6;

// A subject embedded with just enough to render a recency row + a liveness check.
// The world is already known-live here, so only the subject's own deleted_at matters.
type EmbeddedSubject = {
  id: string;
  name: string;
  world_id: string;
  deleted_at?: string | null;
  categories: { name: string } | null;
};

function toRecent(s: EmbeddedSubject): RecentSubject {
  return { id: s.id, worldId: s.world_id, name: s.name, categoryName: s.categories?.name ?? null };
}

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

  const [
    { data: active },
    { data: deleted },
    { data: subjects },
    { data: viewed },
    { data: edited },
  ] = await Promise.all([
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
    // Live subject names per category — for the category counts and the
    // delete-confirm sample the (Edit-mode) CategoryManager shows.
    activeOnly(
      supabase
        .from("subjects")
        .select("name, category_id")
        .eq("world_id", worldId)
        .order("updated_at", { ascending: false }),
    ),
    // World-scoped recency: recently viewed (view history, ADR 0012) and recently
    // edited. Over-fetch views + filter liveness in JS (the world is already live).
    supabase
      .from("subject_views")
      .select("last_viewed_at, subjects!inner(id, name, world_id, deleted_at, categories(name))")
      .eq("subjects.world_id", worldId)
      .order("last_viewed_at", { ascending: false })
      .limit(30),
    activeOnly(
      supabase
        .from("subjects")
        .select("id, name, world_id, categories(name)")
        .eq("world_id", worldId)
        .order("updated_at", { ascending: false })
        .limit(RECENCY_LIMIT),
    ),
  ]);

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

  const recentlyViewed = ((viewed ?? []) as unknown as { subjects: EmbeddedSubject | null }[])
    .map((r) => r.subjects)
    .filter((s): s is EmbeddedSubject => !!s && !s.deleted_at)
    .map(toRecent)
    .slice(0, RECENCY_LIMIT);
  const recentlyEdited = ((edited ?? []) as unknown as EmbeddedSubject[]).map(toRecent);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-12">
      <div className="space-y-1">
        <Link
          href="/"
          className="text-sm text-neutral-500 underline-offset-4 transition hover:text-neutral-800 hover:underline dark:hover:text-neutral-200"
        >
          ← All worlds
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{world.name}</h1>
      </div>

      <NewSubjectForm worldId={worldId} categories={categories} />

      <RecentSubjects heading="Recently edited" subjects={recentlyEdited} />
      <RecentSubjects heading="Recently viewed" subjects={recentlyViewed} />

      <WorldCategories
        worldId={worldId}
        categories={categories}
        deletedCategories={deletedCategories}
      />

      <div className="pt-2">
        <SaveAsTemplateButton kind="world" sourceId={worldId} defaultName={world.name} />
      </div>
    </main>
  );
}
