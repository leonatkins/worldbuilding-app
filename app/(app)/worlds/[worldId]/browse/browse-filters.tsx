"use client";

/**
 * Search controls (step 12). All state is the URL — this island just writes to
 * it via `router.replace` (not push, so rapid typing/toggling doesn't flood
 * browser history while the URL stays shareable). The query box is debounced and
 * locally controlled for instant feedback; category (OR) and tag (AND) checkbox
 * toggles apply immediately. The tag list, with its per-tag subject counts,
 * doubles as the PRD's tag browser.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type FilterFacet = { id: string; name: string; count?: number };

const DEBOUNCE_MS = 300;

export function BrowseFilters({
  worldId,
  query,
  categoryIds,
  tagIds,
  categories,
  tags,
}: {
  worldId: string;
  query: string;
  categoryIds: string[];
  tagIds: string[];
  categories: FilterFacet[];
  tags: FilterFacet[];
}) {
  const router = useRouter();
  const [text, setText] = useState(query);

  // Keep the box in sync if the URL's `q` changes from elsewhere (e.g. arriving
  // from the header bar), but don't stomp what the user is actively typing.
  const lastPushed = useRef(query);
  useEffect(() => {
    if (query !== lastPushed.current) {
      setText(query);
      lastPushed.current = query;
    }
  }, [query]);

  function pushUrl(next: { q: string; categoryIds: string[]; tagIds: string[] }) {
    const params = new URLSearchParams();
    if (next.q.trim()) params.set("q", next.q.trim());
    for (const c of next.categoryIds) params.append("category", c);
    for (const t of next.tagIds) params.append("tag", t);
    const qs = params.toString();
    lastPushed.current = next.q;
    router.replace(`/worlds/${worldId}/browse${qs ? `?${qs}` : ""}`);
  }

  // Debounced query push.
  useEffect(() => {
    if (text === query) return;
    const t = setTimeout(() => pushUrl({ q: text, categoryIds, tagIds }), DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  function toggle(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search subjects, facts, fields…"
        aria-label="Search query"
        className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-100"
      />

      {categories.length > 0 && (
        <FacetGroup
          label="Category"
          hint="any of"
          facets={categories}
          selected={categoryIds}
          onToggle={(id) =>
            pushUrl({ q: text, categoryIds: toggle(categoryIds, id), tagIds })
          }
        />
      )}

      {tags.length > 0 && (
        <FacetGroup
          label="Tags"
          hint="all of"
          facets={tags}
          selected={tagIds}
          onToggle={(id) => pushUrl({ q: text, categoryIds, tagIds: toggle(tagIds, id) })}
        />
      )}
    </div>
  );
}

function FacetGroup({
  label,
  hint,
  facets,
  selected,
  onToggle,
}: {
  label: string;
  hint: string;
  facets: FilterFacet[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
        {label} <span className="normal-case text-neutral-400">· {hint}</span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {facets.map((f) => {
          const on = selected.includes(f.id);
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(f.id)}
              className={`rounded-full border px-3 py-1 text-sm transition ${
                on
                  ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                  : "border-neutral-300 text-neutral-600 hover:border-neutral-500 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-500 dark:hover:text-neutral-100"
              }`}
            >
              {f.name}
              {f.count !== undefined && (
                <span className={`ml-1.5 text-xs ${on ? "opacity-70" : "text-neutral-400"}`}>
                  {f.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
