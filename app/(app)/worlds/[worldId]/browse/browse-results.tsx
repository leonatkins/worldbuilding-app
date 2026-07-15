"use client";

/**
 * Browse's result list with a client-side sort toggle (step 15b). The server
 * returns rows already ordered most-recently-edited first (with an exact name
 * match floated when there's a query), so "Recently edited" keeps that order and
 * "A–Z" re-sorts by name in place — no refetch. The choice persists in
 * localStorage via the same useSyncExternalStore pattern as the category page's
 * subject sort.
 */
import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import type { SearchResult } from "@/lib/search";

type SortKey = "recent" | "name";
const STORAGE_KEY = "browse-sort";
const DEFAULT_SORT: SortKey = "recent";
const SORT_EVENT = "browse-sort-change";

function isSortKey(v: string | null): v is SortKey {
  return v === "recent" || v === "name";
}
function subscribe(cb: () => void) {
  window.addEventListener(SORT_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(SORT_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
function readSort(): SortKey {
  const v = localStorage.getItem(STORAGE_KEY);
  return isSortKey(v) ? v : DEFAULT_SORT;
}
function writeSort(next: SortKey) {
  localStorage.setItem(STORAGE_KEY, next);
  window.dispatchEvent(new Event(SORT_EVENT));
}

export function BrowseResults({ worldId, results }: { worldId: string; results: SearchResult[] }) {
  const sort = useSyncExternalStore(subscribe, readSort, () => DEFAULT_SORT);
  const sorted = useMemo(
    () => (sort === "name" ? [...results].sort((a, b) => a.name.localeCompare(b.name)) : results),
    [results, sort],
  );

  if (results.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <div className="inline-flex overflow-hidden rounded-md border border-neutral-300 text-xs dark:border-neutral-700">
          <SortButton active={sort === "recent"} onClick={() => writeSort("recent")}>
            Recently edited
          </SortButton>
          <SortButton active={sort === "name"} onClick={() => writeSort("name")}>
            A–Z
          </SortButton>
        </div>
      </div>
      <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {sorted.map((r) => (
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
                <span className="mt-0.5 block truncate text-xs text-neutral-500">{r.snippet}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SortButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`px-2.5 py-1 transition ${
        active
          ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
          : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
      }`}
    >
      {children}
    </button>
  );
}
