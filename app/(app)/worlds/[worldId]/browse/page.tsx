/**
 * Full search page (step 12, PRD §6.8). State lives entirely in the URL
 * (`q`, repeatable `category`, repeatable `tag`) so results are shareable and
 * survive the back button; this server component reads those params, loads the
 * filter facets (categories + tags-with-counts, the latter doubling as the tag
 * browser), runs `searchWorld`, and renders the flat subject result list. The
 * live-updating input/checkboxes live in the client `SearchFilters` island.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { activeOnly } from "@/lib/db/soft-delete";
import { searchWorld } from "@/app/actions/search";
import { MIN_QUERY_LENGTH } from "@/lib/search";
import { BrowseFilters, type FilterFacet } from "./browse-filters";
import { BrowseResults } from "./browse-results";
import { TagManager, type WorldTag } from "../tag-manager";
import { NewSubjectForm, type CategoryOption } from "../new-subject-form";

type SearchPageProps = {
  params: Promise<{ worldId: string }>;
  searchParams: Promise<{ q?: string; category?: string | string[]; tag?: string | string[] }>;
};

function toArray(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const { worldId } = await params;
  const sp = await searchParams;
  const query = (sp.q ?? "").trim();
  const categoryIds = toArray(sp.category);
  const tagIds = toArray(sp.tag);

  const supabase = await createClient();

  const { data: world } = await supabase
    .from("worlds")
    .select("id, name")
    .eq("id", worldId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!world) notFound();

  // Filter facets: the world's categories, and its tags with per-tag counts
  // (same shape the world-home TagManager computes — this list is the browser).
  const [{ data: catRows }, { data: tagRows }, { data: subjectTags }] = await Promise.all([
    activeOnly(
      supabase
        .from("categories")
        .select("id, name, icon, position")
        .eq("world_id", worldId)
        .order("position"),
    ),
    supabase.from("tags").select("id, name").eq("world_id", worldId).order("name"),
    supabase
      .from("subject_tags")
      .select("tag_id, tags!inner(world_id)")
      .eq("tags.world_id", worldId),
  ]);

  const tagCounts = new Map<string, number>();
  for (const row of (subjectTags ?? []) as { tag_id: string }[]) {
    tagCounts.set(row.tag_id, (tagCounts.get(row.tag_id) ?? 0) + 1);
  }
  const categories: FilterFacet[] = (
    (catRows ?? []) as { id: string; name: string; icon: string | null }[]
  ).map((c) => ({ id: c.id, name: `${c.icon ? `${c.icon} ` : ""}${c.name}` }));
  // Raw category options for the inline new-subject picker (needs the bare icon,
  // not the display-prefixed facet name).
  const categoryOptions: CategoryOption[] = (
    (catRows ?? []) as { id: string; name: string; icon: string | null }[]
  ).map((c) => ({ id: c.id, name: c.name, icon: c.icon }));
  const tags: FilterFacet[] = ((tagRows ?? []) as { id: string; name: string }[]).map((t) => ({
    id: t.id,
    name: `#${t.name}`,
    count: tagCounts.get(t.id) ?? 0,
  }));
  // Tag management (rename/delete, world-level) lives here now — the tag filter is
  // the tag's home (step 15b, ADR 0014); behind a quiet disclosure so Browse stays
  // about finding subjects.
  const worldTags: WorldTag[] = ((tagRows ?? []) as { id: string; name: string }[]).map((t) => ({
    ...t,
    subjectCount: tagCounts.get(t.id) ?? 0,
  }));

  const { results, total } = await searchWorld(worldId, { query, categoryIds, tagIds });

  const activeSearch =
    query.length >= MIN_QUERY_LENGTH || categoryIds.length > 0 || tagIds.length > 0;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
      <div className="space-y-1">
        <Link
          href={`/worlds/${worldId}`}
          className="text-sm text-neutral-500 underline-offset-4 transition hover:text-neutral-800 hover:underline dark:hover:text-neutral-200"
        >
          ← {world.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Browse</h1>
      </div>

      <BrowseFilters
        worldId={worldId}
        query={query}
        categoryIds={categoryIds}
        tagIds={tagIds}
        categories={categories}
        tags={tags}
      />

      <NewSubjectForm
        worldId={worldId}
        categories={categoryOptions}
        defaultCategoryId={categoryIds.length === 1 ? categoryIds[0] : undefined}
      />

      <section className="space-y-3">
        <p className="text-sm text-neutral-500">
          {total === 0
            ? "No matches."
            : total > results.length
              ? `Showing ${results.length} of ${total} subjects. ${activeSearch ? "Narrow your search further." : "Type to search or add a filter to narrow further."}`
              : `${total} ${total === 1 ? "subject" : "subjects"}${activeSearch ? " matched" : ""}.`}
        </p>

        <BrowseResults worldId={worldId} results={results} />
      </section>

      {worldTags.length > 0 && (
        <details className="border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-neutral-500 transition hover:text-neutral-800 dark:hover:text-neutral-200">
            Manage tags
          </summary>
          <div className="pt-4">
            <TagManager worldId={worldId} tags={worldTags} />
          </div>
        </details>
      )}
    </main>
  );
}
