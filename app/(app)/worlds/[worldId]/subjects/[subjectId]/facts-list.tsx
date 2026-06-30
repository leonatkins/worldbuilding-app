"use client";

/**
 * Facts list (step 8) — the subject's primary content. Fast-capture composer
 * (Enter to save, draft autosaved to localStorage so brand-new text survives a
 * reload — open-questions Q6 / memory fact_draft_autosave), inline edit
 * (dismiss = cancel/revert; Save is explicit), drag reorder (midpoint position),
 * and soft delete with a Recently Deleted section. Mutations go through
 * app/actions/facts.ts. Body is plain text here; @{id} mention rendering arrives
 * in step 9.
 */
import { useRef, useState, useSyncExternalStore, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  createFact,
  updateFact,
  reorderFact,
  deleteFact,
  restoreFact,
  purgeFact,
  type FactResult,
} from "@/app/actions/facts";
import { MAX_FACT_LENGTH } from "@/lib/validation";
import { midpointPosition } from "@/lib/ordering";

export type Fact = { id: string; body: string; position: number };
export type DeletedFact = { id: string; body: string };

/** Fired when a fact draft is written, so the composer's external store re-reads. */
const DRAFT_EVENT = "fact-draft-change";

const textareaClass =
  "w-full resize-none rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-100";

export function FactsList({
  worldId,
  subjectId,
  facts,
  deletedFacts,
}: {
  worldId: string;
  subjectId: string;
  facts: Fact[];
  deletedFacts: DeletedFact[];
}) {
  // Local mirror for instant drag reordering; resync on new server data (the
  // schema-editor pattern).
  const [items, setItems] = useState(facts);
  const [syncedFrom, setSyncedFrom] = useState(facts);
  if (syncedFrom !== facts) {
    setSyncedFrom(facts);
    setItems(facts);
  }
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((f) => f.id === active.id);
    const newIndex = items.findIndex((f) => f.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    const before = reordered[newIndex - 1]?.position ?? null;
    const after = reordered[newIndex + 1]?.position ?? null;
    const position = midpointPosition(before, after);
    reordered[newIndex] = { ...reordered[newIndex], position };
    setItems(reordered);

    const fd = new FormData();
    fd.set("worldId", worldId);
    fd.set("subjectId", subjectId);
    fd.set("factId", String(active.id));
    fd.set("position", String(position));
    startTransition(() => {
      void reorderFact(fd);
    });
  }

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-medium text-neutral-500">Facts</h2>

      <FactComposer worldId={worldId} subjectId={subjectId} />

      {items.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
              {items.map((fact) => (
                <FactRow key={fact.id} worldId={worldId} subjectId={subjectId} fact={fact} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <RecentlyDeletedFacts worldId={worldId} subjectId={subjectId} facts={deletedFacts} />
    </section>
  );
}

/**
 * New-fact input. The only place we persist a draft (brand-new, unsaved text):
 * localStorage is the source of truth via useSyncExternalStore, so every keystroke
 * survives a reload/navigation and there is no SSR hydration mismatch (server
 * snapshot is "").
 */
function subscribeDraft(cb: () => void) {
  window.addEventListener(DRAFT_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(DRAFT_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function FactComposer({ worldId, subjectId }: { worldId: string; subjectId: string }) {
  const draftKey = `fact-draft:${subjectId}`;
  const body = useSyncExternalStore(
    subscribeDraft,
    () => localStorage.getItem(draftKey) ?? "",
    () => "",
  );
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);

  function setBody(next: string) {
    if (next) localStorage.setItem(draftKey, next);
    else localStorage.removeItem(draftKey);
    window.dispatchEvent(new Event(DRAFT_EVENT));
  }

  function submit() {
    if (!body.trim()) return;
    const fd = new FormData();
    fd.set("worldId", worldId);
    fd.set("subjectId", subjectId);
    fd.set("body", body);
    startTransition(async () => {
      const result = await createFact(fd);
      if (result.error) {
        setError(result.error);
      } else {
        setError("");
        setBody(""); // clears the draft from localStorage too
        ref.current?.focus(); // drop the cursor into a fresh input for fast capture
      }
    });
  }

  return (
    <div className="space-y-1">
      <textarea
        ref={ref}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={2}
        maxLength={MAX_FACT_LENGTH}
        placeholder="Write a fact… (Enter to save, Shift+Enter for a new line)"
        aria-label="New fact"
        className={textareaClass}
      />
      <div className="flex items-center gap-3 text-sm">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !body.trim()}
          className="rounded-md bg-neutral-900 px-3 py-1.5 font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          {pending ? "Saving…" : "Save fact"}
        </button>
        {error && <span className="text-red-600 dark:text-red-400">{error}</span>}
      </div>
    </div>
  );
}

function FactRow({
  worldId,
  subjectId,
  fact,
}: {
  worldId: string;
  subjectId: string;
  fact: Fact;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: fact.id,
  });
  const [editing, setEditing] = useState(false);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (editing) {
    return (
      <li ref={setNodeRef} style={style} className="px-4 py-3">
        <FactEditor
          worldId={worldId}
          subjectId={subjectId}
          fact={fact}
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li ref={setNodeRef} style={style} className="group flex items-start gap-2 px-4 py-3">
      <button
        type="button"
        aria-label="Drag to reorder"
        className="mt-0.5 cursor-grab touch-none text-neutral-300 transition hover:text-neutral-500 active:cursor-grabbing dark:text-neutral-600"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm text-neutral-900 dark:text-neutral-100">
        {fact.body}
      </p>
      <div className="flex shrink-0 items-center gap-1 text-sm text-neutral-400 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-md px-2 py-1 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        >
          Edit
        </button>
        <DeleteFactButton worldId={worldId} subjectId={subjectId} factId={fact.id} />
      </div>
    </li>
  );
}

/** Inline editor. Save commits; Cancel/Escape dismisses and reverts (no draft). */
function FactEditor({
  worldId,
  subjectId,
  fact,
  onDone,
}: {
  worldId: string;
  subjectId: string;
  fact: Fact;
  onDone: () => void;
}) {
  const [body, setBody] = useState(fact.body);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function save() {
    if (!body.trim()) return;
    const fd = new FormData();
    fd.set("worldId", worldId);
    fd.set("subjectId", subjectId);
    fd.set("factId", fact.id);
    fd.set("body", body);
    startTransition(async () => {
      const result = await updateFact(fd);
      if (result.error) setError(result.error);
      else onDone();
    });
  }

  return (
    <div className="space-y-1">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            save();
          } else if (e.key === "Escape") {
            onDone();
          }
        }}
        rows={2}
        maxLength={MAX_FACT_LENGTH}
        autoFocus
        aria-label="Edit fact"
        className={textareaClass}
      />
      <div className="flex items-center gap-3 text-sm">
        <button
          type="button"
          onClick={save}
          disabled={pending || !body.trim()}
          className="rounded-md bg-neutral-900 px-3 py-1.5 font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onDone} className="text-neutral-400">
          Cancel
        </button>
        {error && <span className="text-red-600 dark:text-red-400">{error}</span>}
      </div>
    </div>
  );
}

/** Soft delete is reversible (Recently Deleted), so one click — no confirm. */
function DeleteFactButton({
  worldId,
  subjectId,
  factId,
}: {
  worldId: string;
  subjectId: string;
  factId: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const fd = new FormData();
        fd.set("worldId", worldId);
        fd.set("subjectId", subjectId);
        fd.set("factId", factId);
        startTransition(() => {
          void deleteFact(fd);
        });
      }}
      className="rounded-md px-2 py-1 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950 dark:hover:text-red-400"
    >
      Delete
    </button>
  );
}

function RecentlyDeletedFacts({
  worldId,
  subjectId,
  facts,
}: {
  worldId: string;
  subjectId: string;
  facts: DeletedFact[];
}) {
  const [open, setOpen] = useState(false);
  if (facts.length === 0) return null;

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
        Recently deleted ({facts.length})
      </button>
      {open && (
        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {facts.map((f) => (
            <DeletedFactRow key={f.id} worldId={worldId} subjectId={subjectId} fact={f} />
          ))}
        </ul>
      )}
    </div>
  );
}

function DeletedFactRow({
  worldId,
  subjectId,
  fact,
}: {
  worldId: string;
  subjectId: string;
  fact: DeletedFact;
}) {
  const [pending, startTransition] = useTransition();

  function act(fn: (fd: FormData) => Promise<FactResult>) {
    const fd = new FormData();
    fd.set("worldId", worldId);
    fd.set("subjectId", subjectId);
    fd.set("factId", fact.id);
    startTransition(() => {
      void fn(fd);
    });
  }

  return (
    <li className="flex items-start justify-between gap-3 px-4 py-3">
      <span className="min-w-0 flex-1 truncate text-sm text-neutral-500 line-through">
        {fact.body}
      </span>
      <div className="flex shrink-0 items-center gap-1 text-sm">
        <button
          type="button"
          disabled={pending}
          onClick={() => act(restoreFact)}
          className="rounded-md px-2 py-1 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        >
          Restore
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => act(purgeFact)}
          className="rounded-md px-2 py-1 text-neutral-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950 dark:hover:text-red-400"
        >
          Delete now
        </button>
      </div>
    </li>
  );
}
