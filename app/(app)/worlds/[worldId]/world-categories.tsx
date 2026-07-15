"use client";

/**
 * The Overview front page's categories index (step 15b). At rest it's a quiet
 * read-only index — icon · name · subject count — where a click filters Browse to
 * that category (categories are a filter, not a folder — ADR 0013). An "Edit" toggle
 * reveals the full CategoryManager in place (reused verbatim), so the calm reading
 * surface stays calm until you choose to manage the set. Replaces the dissolved
 * "Manage" tab's category island (ADR 0014).
 */
import { useState } from "react";
import Link from "next/link";
import { CategoryManager, type Category, type DeletedCategory } from "./category-manager";

export function WorldCategories({
  worldId,
  categories,
  deletedCategories,
}: {
  worldId: string;
  categories: Category[];
  deletedCategories: DeletedCategory[];
}) {
  const [editing, setEditing] = useState(false);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">Categories</h2>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="rounded-md px-2 py-1 text-sm text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        >
          {editing ? "Done" : "Edit"}
        </button>
      </div>

      {editing ? (
        <CategoryManager
          worldId={worldId}
          categories={categories}
          deletedCategories={deletedCategories}
        />
      ) : categories.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 px-6 py-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
          No categories yet. Click Edit to add one.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {categories.map((c) => (
            <li key={c.id}>
              <Link
                href={`/worlds/${worldId}/browse?category=${c.id}`}
                className="flex items-center justify-between gap-3 px-4 py-2.5 transition hover:bg-neutral-50 dark:hover:bg-neutral-900"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {c.icon && <span aria-hidden>{c.icon}</span>}
                  <span className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {c.name}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-neutral-400">{c.subjectCount}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
