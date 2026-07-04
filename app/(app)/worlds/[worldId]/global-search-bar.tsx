"use client";

/**
 * Persistent world search bar (step 12). A debounced typeahead that previews the
 * top matches inline (same debounce/server-round-trip idiom as the @mention
 * search, since the search space is a whole world), with a "See all results"
 * item and Enter both routing to the full /search page for filters. Below the
 * 2-char minimum it stays quiet — a single letter matches almost everything.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchWorldPreview } from "@/app/actions/search";
import { MIN_QUERY_LENGTH, type SearchResult } from "@/lib/search";

const DEBOUNCE_MS = 300;

export function GlobalSearchBar({ worldId }: { worldId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  // Debounced preview fetch. `seq` guards against out-of-order responses; the
  // below-minimum clear also runs in the timeout (not the effect body) so no
  // setState fires synchronously during render.
  useEffect(() => {
    const q = query.trim();
    const id = ++seq.current;
    const t = setTimeout(async () => {
      if (q.length < MIN_QUERY_LENGTH) {
        if (id === seq.current) {
          setResults([]);
          setTotal(0);
        }
        return;
      }
      const outcome = await searchWorldPreview(worldId, q);
      if (id !== seq.current) return; // a newer keystroke already fired
      setResults(outcome.results);
      setTotal(outcome.total);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, worldId]);

  // Close the dropdown on an outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function goToSearch() {
    const q = query.trim();
    setOpen(false);
    router.push(`/worlds/${worldId}/search${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      goToSearch();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showDropdown = open && query.trim().length >= MIN_QUERY_LENGTH;

  return (
    <div ref={containerRef} className="relative">
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search subjects, facts, fields…"
        aria-label="Search this world"
        className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-100"
      />

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          {results.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-neutral-500">No matches.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-neutral-100 overflow-y-auto dark:divide-neutral-800">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setOpen(false);
                      router.push(`/worlds/${worldId}/subjects/${r.id}`);
                    }}
                    className="block w-full px-3 py-2 text-left transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
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
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={goToSearch}
            className="block w-full border-t border-neutral-200 px-3 py-2 text-left text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            See all {total} {total === 1 ? "result" : "results"} →
          </button>
        </div>
      )}
    </div>
  );
}
