"use client";

/**
 * Subject list for a category (step 7). Inline name-only create (redirects into the
 * new subject), sortable list (choice persisted in localStorage, worlds-list
 * pattern), and a Recently Deleted section. Mutations via app/actions/subjects.ts.
 */
import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import {
  createSubject,
  restoreSubject,
  purgeSubject,
  type SubjectResult,
} from "@/app/actions/subjects";
import { MAX_NAME_LENGTH } from "@/lib/validation";

export type Subject = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};
export type DeletedSubject = { id: string; name: string };

type SortKey = "updated-desc" | "name-asc" | "name-desc";
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "updated-desc", label: "Last edited" },
  { value: "name-asc", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
];
const STORAGE_KEY = "subjects-sort";
const DEFAULT_SORT: SortKey = "updated-desc";
const SORT_EVENT = "subjects-sort-change";

function isSortKey(v: string | null): v is SortKey {
  return SORT_OPTIONS.some((o) => o.value === v);
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

function sortSubjects(subjects: Subject[], sort: SortKey): Subject[] {
  const ms = (s: string) => new Date(s).getTime();
  const copy = [...subjects];
  switch (sort) {
    case "updated-desc":
      return copy.sort((a, b) => ms(b.updated_at) - ms(a.updated_at));
    case "name-asc":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "name-desc":
      return copy.sort((a, b) => b.name.localeCompare(a.name));
  }
}

export function SubjectsList({
  worldId,
  categoryId,
  subjects,
  deletedSubjects,
}: {
  worldId: string;
  categoryId: string;
  subjects: Subject[];
  deletedSubjects: DeletedSubject[];
}) {
  const sort = useSyncExternalStore(subscribe, readSort, () => DEFAULT_SORT);
  const sorted = useMemo(() => sortSubjects(subjects, sort), [subjects, sort]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-500">Subjects</h2>
        {subjects.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-neutral-500">
            Sort
            <select
              value={sort}
              onChange={(e) => writeSort(e.target.value as SortKey)}
              className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <CreateSubjectForm worldId={worldId} categoryId={categoryId} />

      {subjects.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 px-6 py-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
          No subjects yet. Name one above to get started.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {sorted.map((s) => (
            <li key={s.id} className="px-4 py-3">
              <Link
                href={`/worlds/${worldId}/subjects/${s.id}`}
                className="block text-sm font-medium text-neutral-900 underline-offset-4 transition hover:underline dark:text-neutral-100"
              >
                {s.name}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <RecentlyDeletedSubjects
        worldId={worldId}
        categoryId={categoryId}
        subjects={deletedSubjects}
      />
    </section>
  );
}

function CreateSubjectForm({
  worldId,
  categoryId,
}: {
  worldId: string;
  categoryId: string;
}) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => {
        fd.set("worldId", worldId);
        fd.set("categoryId", categoryId);
        startTransition(async () => {
          const result = await createSubject(fd);
          // On success createSubject redirects; only errors return here.
          if (result?.error) setError(result.error);
        });
      }}
      noValidate
      className="space-y-2"
    >
      <div className="flex items-stretch gap-2">
        <input
          type="text"
          name="name"
          required
          maxLength={MAX_NAME_LENGTH}
          placeholder="Add a subject"
          aria-label="Subject name"
          className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-100"
        />
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

function RecentlyDeletedSubjects({
  worldId,
  categoryId,
  subjects,
}: {
  worldId: string;
  categoryId: string;
  subjects: DeletedSubject[];
}) {
  const [open, setOpen] = useState(false);
  if (subjects.length === 0) return null;

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
        Recently deleted ({subjects.length})
      </button>
      {open && (
        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {subjects.map((s) => (
            <DeletedSubjectRow
              key={s.id}
              worldId={worldId}
              categoryId={categoryId}
              subject={s}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function DeletedSubjectRow({
  worldId,
  categoryId,
  subject,
}: {
  worldId: string;
  categoryId: string;
  subject: DeletedSubject;
}) {
  const [pending, startTransition] = useTransition();

  function act(fn: (fd: FormData) => Promise<SubjectResult>) {
    const fd = new FormData();
    fd.set("worldId", worldId);
    fd.set("categoryId", categoryId);
    fd.set("subjectId", subject.id);
    startTransition(() => {
      void fn(fd);
    });
  }

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="min-w-0 flex-1 truncate text-sm text-neutral-500 line-through">
        {subject.name}
      </span>
      <div className="flex shrink-0 items-center gap-1 text-sm">
        <button
          type="button"
          disabled={pending}
          onClick={() => act(restoreSubject)}
          className="rounded-md px-2 py-1 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        >
          Restore
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => act(purgeSubject)}
          className="rounded-md px-2 py-1 text-neutral-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950 dark:hover:text-red-400"
        >
          Delete now
        </button>
      </div>
    </li>
  );
}
