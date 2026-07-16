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
        <h2 className="label-structural font-medium">Categories</h2>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="px-2 py-1 text-sm text-ink-muted transition-[color,background-color,transform] duration-150 ease-[var(--ease-out)] hover:bg-surface-raised hover:text-ink active:scale-[0.97]"
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
        <p className="border border-dashed border-rule px-6 py-8 text-center text-sm text-system">
          No categories yet. Click Edit to add one.
        </p>
      ) : (
        <ul className="divide-y divide-rule overflow-hidden border border-rule bg-surface-raised">
          {categories.map((c) => (
            <li key={c.id}>
              <Link
                href={`/worlds/${worldId}/browse?category=${c.id}`}
                className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors duration-150 ease-[var(--ease-out)] hover:bg-accent-soft"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {c.icon && <span aria-hidden>{c.icon}</span>}
                  <span className="truncate text-sm font-medium text-ink">{c.name}</span>
                </span>
                <span className="shrink-0 text-xs text-ink-muted">{c.subjectCount}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
