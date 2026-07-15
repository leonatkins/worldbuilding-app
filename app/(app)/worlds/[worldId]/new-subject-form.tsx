"use client";

/**
 * Inline new-subject composer (step 15b). Reused on the world Overview front page
 * and on Browse — neither is category-scoped, so unlike the category page's
 * name-only add this one carries a category picker. `defaultCategoryId` prefills it
 * (Browse passes the active category filter); otherwise the picker starts empty and
 * a category must be chosen. Stays open for fast repeat-add; refreshes the route so
 * the new subject shows in recency/results without a redirect.
 */
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSubject } from "@/app/actions/subjects";
import { MAX_NAME_LENGTH } from "@/lib/validation";

export type CategoryOption = { id: string; name: string; icon: string | null };

export function NewSubjectForm({
  worldId,
  categories,
  defaultCategoryId,
}: {
  worldId: string;
  categories: CategoryOption[];
  defaultCategoryId?: string;
}) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? "");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form
      action={(fd) => {
        if (!categoryId) {
          setError("Choose a category.");
          return;
        }
        fd.set("worldId", worldId);
        fd.set("categoryId", categoryId);
        startTransition(async () => {
          const result = await createSubject(fd);
          if (result?.error) {
            setError(result.error);
          } else {
            setError("");
            if (inputRef.current) inputRef.current.value = "";
            router.refresh();
          }
        });
      }}
      noValidate
      className="space-y-2"
    >
      <div className="flex items-stretch gap-2">
        <input
          ref={inputRef}
          type="text"
          name="name"
          required
          maxLength={MAX_NAME_LENGTH}
          placeholder="Add a subject"
          aria-label="Subject name"
          className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-100"
        />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          aria-label="Category"
          className="rounded-md border border-neutral-300 bg-white px-2 py-2 text-sm outline-none transition focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-100"
        >
          <option value="">Category…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon ? `${c.icon} ` : ""}
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
