"use client";

/**
 * Tag manager (subject-CRUD fix pass) — a world's tags, collapsed by default,
 * same collapsible pattern as the Recently Deleted sections. Rename is a single
 * world-level UPDATE that propagates everywhere (subject_tags is a pure join).
 * Delete is hard and cascading — removes the tag from every subject at once,
 * with no Recently Deleted (ADR 0008) — so it requires an inline confirm
 * naming the affected subject count, same shape as CategoryRow's confirm-delete.
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { renameTag, deleteTag } from "@/app/actions/tags";
import { MAX_NAME_LENGTH } from "@/lib/validation";

export type WorldTag = { id: string; name: string; subjectCount: number };

export function TagManager({ worldId, tags }: { worldId: string; tags: WorldTag[] }) {
  const [open, setOpen] = useState(false);
  if (tags.length === 0) return null;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        <span aria-hidden className={`text-xs transition-transform ${open ? "rotate-90" : ""}`}>
          ▸
        </span>
        Tags ({tags.length})
      </button>
      {open && (
        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {tags.map((t) => (
            <TagRow key={t.id} worldId={worldId} tag={t} />
          ))}
        </ul>
      )}
    </div>
  );
}

type RowMode = "view" | "rename" | "confirm-delete";

function TagRow({ worldId, tag }: { worldId: string; tag: WorldTag }) {
  const [mode, setMode] = useState<RowMode>("view");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function runDelete() {
    const fd = new FormData();
    fd.set("worldId", worldId);
    fd.set("tagId", tag.id);
    startTransition(async () => {
      const result = await deleteTag(fd);
      if (result?.error) setError(result.error);
      else setMode("view");
    });
  }

  if (mode === "rename") {
    return (
      <li className="px-4 py-3">
        <RenameTagForm worldId={worldId} tag={tag} onDone={() => setMode("view")} />
      </li>
    );
  }

  if (mode === "confirm-delete") {
    return (
      <li className="px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            Delete <span className="font-medium">#{tag.name}</span>? Removes it from{" "}
            {tag.subjectCount} {tag.subjectCount === 1 ? "subject" : "subjects"}
            {" — this can’t be undone."}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={runDelete}
              disabled={pending}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? "Deleting…" : "Delete"}
            </button>
            <button
              type="button"
              onClick={() => setMode("view")}
              className="rounded-md px-3 py-1.5 text-sm text-neutral-600 transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              Cancel
            </button>
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 px-4 py-3">
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
        #{tag.name}
      </span>
      <span className="shrink-0 text-xs text-neutral-400">
        {tag.subjectCount} {tag.subjectCount === 1 ? "subject" : "subjects"}
      </span>
      <div className="flex shrink-0 items-center gap-1 text-sm text-neutral-500">
        <Link
          href={`/worlds/${worldId}/search?tag=${tag.id}`}
          className="rounded-md px-2 py-1 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        >
          Browse
        </Link>
        <button
          type="button"
          onClick={() => setMode("rename")}
          className="rounded-md px-2 py-1 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        >
          Rename
        </button>
        <button
          type="button"
          onClick={() => setMode("confirm-delete")}
          className="rounded-md px-2 py-1 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
        >
          Delete
        </button>
      </div>
    </li>
  );
}

function RenameTagForm({
  worldId,
  tag,
  onDone,
}: {
  worldId: string;
  tag: WorldTag;
  onDone: () => void;
}) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => {
        fd.set("worldId", worldId);
        fd.set("tagId", tag.id);
        startTransition(async () => {
          const result = await renameTag(fd);
          if (result.error) setError(result.error);
          else onDone();
        });
      }}
      noValidate
      className="space-y-2"
    >
      <div className="flex items-stretch gap-2">
        <input
          type="text"
          name="name"
          defaultValue={tag.name}
          required
          autoFocus
          maxLength={MAX_NAME_LENGTH}
          aria-label="Tag name"
          className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-100"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md px-3 text-sm text-neutral-600 transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
