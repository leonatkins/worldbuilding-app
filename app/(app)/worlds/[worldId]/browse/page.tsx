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
  const tags: FilterFacet[] = ((tagRows ?? []) as { id: string; name: string }[]).map((t) => ({
    id: t.id,
    name: `#${t.name}`,
    count: tagCounts.get(t.id) ?? 0,
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

      <section className="space-y-3">
        <p className="text-sm text-neutral-500">
          {total === 0
            ? "No matches."
            : total > results.length
              ? `Showing ${results.length} of ${total} subjects. ${activeSearch ? "Narrow your search further." : "Type to search or add a filter to narrow further."}`
              : `${total} ${total === 1 ? "subject" : "subjects"}${activeSearch ? " matched" : ""}.`}
        </p>

        {results.length > 0 && (
          <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {results.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/worlds/${worldId}/subjects/${r.id}`}
                  className="block px-4 py-3 transition hover:bg-neutral-50 dark:hover:bg-neutral-900"
                >
                  <span className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {r.name}
                    </span>
                    {r.categoryName && (
                      <span className="shrink-0 text-xs text-neutral-400">{r.categoryName}</span>
                    )}
                  </span>
                  {r.snippet && (
                    <span className="mt-0.5 block truncate text-xs text-neutral-500">
                      {r.snippet}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
