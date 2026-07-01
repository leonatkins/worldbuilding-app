"use client";

/**
 * Live render of a single `@{id}` mention inside a fact (step 9 §5). The name is
 * resolved at render time (rename-safe) from a page-level batch; this component
 * only branches on the resolved state and owns the small inline popovers.
 *
 *   - Live          → bold link to the subject, hover card (category + fields).
 *   - Soft-deleted  → grayed, click opens an inline Restore popover.
 *   - Purged (absent from the map) → "unknown/deleted", click opens a Replace
 *     popover (world search → rewrites this @{id} in the fact body).
 *
 * Popovers are non-covering and dismiss on outside-click (memory avoid-modals).
 */
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { restoreSubject, searchSubjectsInWorld } from "@/app/actions/subjects";
import { replaceMention, getSubjectCard, type SubjectCard } from "@/app/actions/facts";
import type { ResolvedMention } from "@/lib/mentions";

/** Per-subject hover-card cache, shared across every mention on the page. */
const cardCache = new Map<string, SubjectCard | null>();

export function Mention({
  worldId,
  ownerSubjectId,
  factId,
  id,
  resolved,
}: {
  worldId: string;
  /** The subject whose fact contains this mention (Replace target for updateFact). */
  ownerSubjectId: string;
  factId: string;
  id: string;
  resolved: ResolvedMention | undefined;
}) {
  if (!resolved) {
    return (
      <ReplaceablePurged
        worldId={worldId}
        ownerSubjectId={ownerSubjectId}
        factId={factId}
        oldId={id}
      />
    );
  }
  if (resolved.deletedAt) {
    return (
      <RestorableDeleted
        worldId={worldId}
        targetId={id}
        targetCategoryId={resolved.categoryId}
        name={resolved.name}
      />
    );
  }
  return (
    <SubjectHoverCard subjectId={id}>
      <Link
        href={`/worlds/${worldId}/subjects/${id}`}
        className="font-semibold text-neutral-900 underline-offset-2 transition hover:underline dark:text-neutral-100"
      >
        {resolved.name}
      </Link>
    </SubjectHoverCard>
  );
}

/**
 * Wraps content with a lazy, cached hover card (category + filled fields). An
 * optional `reason` (step 10) adds a "Referenced via" line — why this subject
 * shows up as a backlink (field label(s) and/or a fact-mention count).
 */
export function SubjectHoverCard({
  subjectId,
  reason,
  children,
}: {
  subjectId: string;
  reason?: string;
  children: React.ReactNode;
}) {
  const [card, setCard] = useState<SubjectCard | null | undefined>(cardCache.get(subjectId));
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function show() {
    timer.current = setTimeout(() => setOpen(true), 250);
    if (cardCache.has(subjectId)) return;
    void getSubjectCard(subjectId).then((c) => {
      cardCache.set(subjectId, c);
      setCard(c);
    });
  }
  function hide() {
    clearTimeout(timer.current);
    setOpen(false);
  }
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <span className="relative inline-block" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {open && card && (
        <span className="absolute left-0 top-full z-30 mt-1 block w-56 rounded-lg border border-neutral-200 bg-white p-3 text-left text-xs shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          {card.category && (
            <span className="block font-medium text-neutral-500">{card.category}</span>
          )}
          {card.fields.length > 0 ? (
            <span className="mt-1.5 block space-y-1">
              {card.fields.map((f) => (
                <span key={f.name} className="flex gap-2">
                  <span className="shrink-0 text-neutral-400">{f.name}</span>
                  <span className="min-w-0 truncate text-neutral-700 dark:text-neutral-200">
                    {f.value}
                  </span>
                </span>
              ))}
            </span>
          ) : (
            <span className="mt-1 block text-neutral-400">No fields filled in.</span>
          )}
          {reason && (
            <span className="mt-1.5 block border-t border-neutral-100 pt-1.5 text-neutral-400 dark:border-neutral-800">
              Referenced via {reason}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

function RestorableDeleted({
  worldId,
  targetId,
  targetCategoryId,
  name,
}: {
  worldId: string;
  targetId: string;
  targetCategoryId: string | null;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const ref = useOutsideClick(() => setOpen(false));

  function restore() {
    const fd = new FormData();
    fd.set("worldId", worldId);
    fd.set("subjectId", targetId);
    if (targetCategoryId) fd.set("categoryId", targetCategoryId);
    startTransition(async () => {
      await restoreSubject(fd);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="font-semibold text-neutral-400 line-through underline-offset-2 transition hover:text-neutral-600 dark:hover:text-neutral-300"
        title="Deleted — click to restore"
      >
        {name}
      </button>
      {open && (
        <Popover>
          <span className="block text-neutral-600 dark:text-neutral-300">
            <span className="font-medium">{name}</span> is in Recently Deleted.
          </span>
          <button
            type="button"
            onClick={restore}
            disabled={pending}
            className="mt-2 rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {pending ? "Restoring…" : "Restore"}
          </button>
        </Popover>
      )}
    </span>
  );
}

function ReplaceablePurged({
  worldId,
  ownerSubjectId,
  factId,
  oldId,
}: {
  worldId: string;
  ownerSubjectId: string;
  factId: string;
  oldId: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; categoryName: string | null }[]>([]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const ref = useOutsideClick(() => setOpen(false));

  function search(q: string) {
    setQuery(q);
    startTransition(async () => setResults(await searchSubjectsInWorld(worldId, q)));
  }
  function pick(newId: string) {
    const fd = new FormData();
    fd.set("worldId", worldId);
    fd.set("subjectId", ownerSubjectId);
    fd.set("factId", factId);
    fd.set("oldId", oldId);
    fd.set("newId", newId);
    startTransition(async () => {
      await replaceMention(fd);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!results.length) search("");
        }}
        className="rounded bg-neutral-100 px-1 text-neutral-400 italic transition hover:text-neutral-600 dark:bg-neutral-800 dark:hover:text-neutral-300"
        title="This subject was deleted — click to replace"
      >
        unknown/deleted
      </button>
      {open && (
        <Popover>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => search(e.target.value)}
            placeholder="Replace with…"
            className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-100"
          />
          <span className="mt-1 block max-h-40 overflow-y-auto">
            {results.length === 0 ? (
              <span className="block px-1 py-1 text-neutral-400">No matches.</span>
            ) : (
              results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  disabled={pending}
                  onClick={() => pick(r.id)}
                  className="flex w-full items-baseline gap-2 rounded px-1.5 py-1 text-left transition hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-800"
                >
                  <span className="truncate text-neutral-800 dark:text-neutral-100">{r.name}</span>
                  {r.categoryName && (
                    <span className="ml-auto shrink-0 text-neutral-400">{r.categoryName}</span>
                  )}
                </button>
              ))
            )}
          </span>
        </Popover>
      )}
    </span>
  );
}

/** A small non-covering popover anchored under the trigger. */
function Popover({ children }: { children: React.ReactNode }) {
  return (
    <span className="absolute left-0 top-full z-30 mt-1 block w-56 rounded-lg border border-neutral-200 bg-white p-2 text-xs shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
      {children}
    </span>
  );
}

/** Calls `onOutside` when a pointerdown lands outside the returned ref'd element. */
function useOutsideClick(onOutside: () => void) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    function onDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [onOutside]);
  return ref;
}
