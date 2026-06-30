"use client";

/**
 * Tombstone (ADR 0006). Rendered by a routable page's resolver when the entity —
 * or any of its ancestors — is in Recently Deleted, instead of a bare 404. Names
 * the topmost deleted level and offers a one-click Restore (which makes the whole
 * subtree reachable again); restoring re-runs the resolver via router.refresh().
 *
 * "Tombstone" is an internal name — users only ever see the friendly copy below.
 * The decorative slot is a placeholder for the skeleton mascot, which lands in
 * the near-launch visual-polish pass.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { restoreWorld } from "@/app/actions/worlds";
import { restoreCategory } from "@/app/actions/categories";
import { restoreSubject } from "@/app/actions/subjects";

/** Which level is in Recently Deleted — the topmost dead one drives the copy. */
export type TombstoneKind = "world" | "category" | "subject";

type Props = {
  kind: TombstoneKind;
  /** Name of the deleted entity, when known (e.g. the category's name). */
  name?: string;
  worldId: string;
  categoryId?: string;
  subjectId?: string;
};

const COPY: Record<TombstoneKind, { lead: (name?: string) => string; restore: string }> = {
  world: {
    lead: (name) =>
      name ? `“${name}” is in Recently Deleted.` : "This world is in Recently Deleted.",
    restore: "Restore world",
  },
  category: {
    lead: (name) =>
      name
        ? `This page’s category, “${name}”, is in Recently Deleted.`
        : "This page’s category is in Recently Deleted.",
    restore: "Restore category",
  },
  subject: {
    lead: (name) =>
      name ? `“${name}” is in Recently Deleted.` : "This subject is in Recently Deleted.",
    restore: "Restore subject",
  },
};

export function Tombstone({ kind, name, worldId, categoryId, subjectId }: Props) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const copy = COPY[kind];

  function restore() {
    const fd = new FormData();
    fd.set("worldId", worldId);
    if (categoryId) fd.set("categoryId", categoryId);
    if (subjectId) fd.set("subjectId", subjectId);

    startTransition(async () => {
      const action =
        kind === "world" ? restoreWorld : kind === "category" ? restoreCategory : restoreSubject;
      const result = await action(fd);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      {/* Mascot slot — replaced by the skeleton illustration in the visual-polish pass. */}
      <div
        aria-hidden
        className="flex h-28 w-28 items-center justify-center rounded-full bg-neutral-100 text-5xl dark:bg-neutral-800"
      >
        🦴
      </div>

      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">Nothing here right now</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {copy.lead(name)} Restore it to bring this page — and everything inside it — back.
          Items in Recently Deleted are removed for good after 30 days.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={restore}
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          {pending ? "Restoring…" : copy.restore}
        </button>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </main>
  );
}
