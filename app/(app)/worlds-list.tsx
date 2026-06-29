"use client";

/**
 * Client island for the worlds list (step 5): sortable list (choice persisted in
 * localStorage), inline create form with a random-name dice button, and per-row
 * inline rename / delete (no modals). Receives the RLS-scoped worlds from the
 * server page; all mutations go through the server actions in app/actions/worlds.
 */
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import {
  createWorld,
  renameWorld,
  deleteWorld,
  restoreWorld,
  purgeWorld,
  type WorldResult,
} from "@/app/actions/worlds";
import { randomWorldName } from "@/lib/world-names";
import { MAX_WORLD_NAME_LENGTH } from "@/lib/worlds";

export type World = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type DeletedWorld = {
  id: string;
  name: string;
  deleted_at: string;
};

type SortKey =
  | "updated-desc"
  | "created-desc"
  | "created-asc"
  | "name-asc"
  | "name-desc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "updated-desc", label: "Last updated" },
  { value: "created-desc", label: "Newest first" },
  { value: "created-asc", label: "Oldest first" },
  { value: "name-asc", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
];

const SORT_STORAGE_KEY = "worlds-sort";
const DEFAULT_SORT: SortKey = "updated-desc";

function isSortKey(v: string | null): v is SortKey {
  return SORT_OPTIONS.some((o) => o.value === v);
}

// The sort preference is external state (localStorage), read via
// useSyncExternalStore so there's no setState-in-effect and no SSR hydration
// mismatch (the server snapshot is the default).
const SORT_EVENT = "worlds-sort-change";

function subscribeSort(callback: () => void): () => void {
  window.addEventListener(SORT_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(SORT_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function readSort(): SortKey {
  const saved = localStorage.getItem(SORT_STORAGE_KEY);
  return isSortKey(saved) ? saved : DEFAULT_SORT;
}

function writeSort(next: SortKey) {
  localStorage.setItem(SORT_STORAGE_KEY, next);
  window.dispatchEvent(new Event(SORT_EVENT));
}

function sortWorlds(worlds: World[], sort: SortKey): World[] {
  const ms = (s: string) => new Date(s).getTime();
  const copy = [...worlds];
  switch (sort) {
    case "updated-desc":
      return copy.sort((a, b) => ms(b.updated_at) - ms(a.updated_at));
    case "created-desc":
      return copy.sort((a, b) => ms(b.created_at) - ms(a.created_at));
    case "created-asc":
      return copy.sort((a, b) => ms(a.created_at) - ms(b.created_at));
    case "name-asc":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "name-desc":
      return copy.sort((a, b) => b.name.localeCompare(a.name));
  }
}

export function WorldsList({
  worlds,
  deletedWorlds,
}: {
  worlds: World[];
  deletedWorlds: DeletedWorld[];
}) {
  const sort = useSyncExternalStore(subscribeSort, readSort, () => DEFAULT_SORT);
  const sorted = useMemo(() => sortWorlds(worlds, sort), [worlds, sort]);

  return (
    <div className="space-y-6">
      <CreateWorldForm />

      {worlds.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-500">
              {worlds.length} {worlds.length === 1 ? "world" : "worlds"}
            </span>
            <label className="flex items-center gap-2 text-sm text-neutral-500">
              Sort
              <select
                value={sort}
                onChange={(e) => writeSort(e.target.value as SortKey)}
                className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-100"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {sorted.map((world) => (
              <WorldRow key={world.id} world={world} />
            ))}
          </ul>
        </div>
      )}

      <RecentlyDeleted worlds={deletedWorlds} />
    </div>
  );
}

function RecentlyDeleted({ worlds }: { worlds: DeletedWorld[] }) {
  const [open, setOpen] = useState(false);

  if (worlds.length === 0) return null;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-800 dark:hover:text-neutral-200"
        aria-expanded={open}
      >
        <span
          aria-hidden
          className={`text-xs transition-transform ${open ? "rotate-90" : ""}`}
        >
          ▸
        </span>
        Recently deleted ({worlds.length})
      </button>

      {open && (
        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {worlds.map((world) => (
            <DeletedWorldRow key={world.id} world={world} />
          ))}
        </ul>
      )}
    </div>
  );
}

function DeletedWorldRow({ world }: { world: DeletedWorld }) {
  const [, restoreAction, restoring] = useActionState<WorldResult | null, FormData>(
    async (_prev, formData) => restoreWorld(formData),
    null,
  );
  const [, purgeAction, purging] = useActionState<WorldResult | null, FormData>(
    async (_prev, formData) => purgeWorld(formData),
    null,
  );

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="min-w-0 flex-1 truncate text-sm text-neutral-500 line-through">
        {world.name}
      </span>
      <div className="flex shrink-0 items-center gap-1 text-sm">
        <form action={restoreAction}>
          <input type="hidden" name="worldId" value={world.id} />
          <button
            type="submit"
            disabled={restoring}
            className="rounded-md px-2 py-1 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            {restoring ? "Restoring…" : "Restore"}
          </button>
        </form>
        <form action={purgeAction}>
          <input type="hidden" name="worldId" value={world.id} />
          <button
            type="submit"
            disabled={purging}
            className="rounded-md px-2 py-1 text-neutral-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950 dark:hover:text-red-400"
          >
            {purging ? "Deleting…" : "Delete now"}
          </button>
        </form>
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-10 text-center dark:border-neutral-700">
      <p className="text-sm text-neutral-500">
        No worlds yet. Name one above to create your first.
      </p>
    </div>
  );
}

function CreateWorldForm() {
  const [state, formAction, pending] = useActionState<WorldResult | null, FormData>(
    async (_prev, formData) => createWorld(formData),
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form action={formAction} className="space-y-2">
      <div className="flex items-stretch gap-2">
        <input
          ref={inputRef}
          type="text"
          name="name"
          required
          maxLength={MAX_WORLD_NAME_LENGTH}
          placeholder="Name your world"
          aria-label="World name"
          className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-100"
        />
        <button
          type="button"
          onClick={() => {
            if (inputRef.current) {
              inputRef.current.value = randomWorldName();
              inputRef.current.focus();
            }
          }}
          title="Suggest a name"
          aria-label="Suggest a random name"
          className="rounded-md border border-neutral-300 px-3 text-base transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          🎲
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          {pending ? "Creating…" : "Create"}
        </button>
      </div>
      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}

type RowMode = "view" | "rename" | "confirm-delete";

function WorldRow({ world }: { world: World }) {
  const [mode, setMode] = useState<RowMode>("view");

  if (mode === "rename") {
    return (
      <li className="px-4 py-3">
        <RenameForm world={world} onDone={() => setMode("view")} />
      </li>
    );
  }

  if (mode === "confirm-delete") {
    return (
      <li className="px-4 py-3">
        <DeleteConfirm world={world} onCancel={() => setMode("view")} />
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <Link
        href={`/worlds/${world.id}`}
        className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900 underline-offset-4 hover:underline dark:text-neutral-100"
      >
        {world.name}
      </Link>
      <div className="flex shrink-0 items-center gap-1 text-sm text-neutral-500">
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

function RenameForm({ world, onDone }: { world: World; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<WorldResult | null, FormData>(
    async (_prev, formData) => renameWorld(formData),
    null,
  );

  // Close the editor once a rename succeeds (revalidation refreshes the name).
  useEffect(() => {
    if (state && state.error === "") onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="worldId" value={world.id} />
      <div className="flex items-stretch gap-2">
        <input
          type="text"
          name="name"
          defaultValue={world.name}
          required
          autoFocus
          maxLength={MAX_WORLD_NAME_LENGTH}
          aria-label="World name"
          className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-100"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
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
      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}

function DeleteConfirm({ world, onCancel }: { world: World; onCancel: () => void }) {
  const [state, formAction, pending] = useActionState<WorldResult | null, FormData>(
    async (_prev, formData) => deleteWorld(formData),
    null,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="worldId" value={world.id} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          Delete <span className="font-medium">{world.name}</span>? It moves to
          Recently Deleted — restore it any time within 30 days.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {pending ? "Deleting…" : "Delete"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-sm text-neutral-600 transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
        </div>
      </div>
      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
