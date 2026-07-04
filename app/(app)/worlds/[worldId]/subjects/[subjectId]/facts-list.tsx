"use client";

/**
 * Facts list (step 8) — the subject's primary content. Fast-capture composer
 * (Enter to save, draft autosaved to localStorage so brand-new text survives a
 * reload — open-questions Q6 / memory fact_draft_autosave), inline edit
 * (dismiss = cancel/revert; Save is explicit), drag reorder (midpoint position),
 * and soft delete with a Recently Deleted section. Mutations go through
 * app/actions/facts.ts. The body carries `@{id}` mention markers (ADR 0001): the
 * composer/editor are constrained contentEditable mention inputs (step 9, ADR
 * 0007) and the read view renders markers as live `<Mention>` links.
 */
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  resolveMentionRefs,
  type FactResult,
} from "@/app/actions/facts";
import { setScalarValue, setLinkValue, setListValue } from "@/app/actions/field-values";
import { createField } from "@/app/actions/schema-fields";
import { midpointPosition } from "@/lib/ordering";
import { parseFact, mentionedIds, type FactToken } from "@/lib/facts";
import { parseFieldCommandValue } from "@/lib/field-values";
import type { ResolvedMention } from "@/lib/mentions";
import { MentionInput, type FieldCommand } from "./mention-input";
import type { SchemaField } from "../../categories/[categoryId]/schema-editor";
import { Mention } from "./mention";

export type Fact = { id: string; body: string; position: number };
export type DeletedFact = { id: string; body: string };
/** Live-resolved names for every `@{id}` across the subject's facts (page batch). */
export type MentionMap = Record<string, ResolvedMention>;

/** Fired when a fact draft is written, so the composer's external store re-reads. */
const DRAFT_EVENT = "fact-draft-change";

export function FactsList({
  worldId,
  subjectId,
  categoryId,
  fields,
  facts,
  deletedFacts,
  mentions,
}: {
  worldId: string;
  subjectId: string;
  /** The subject's category and its fields — step 11 field command's typeahead source. */
  categoryId: string;
  fields: SchemaField[];
  facts: Fact[];
  deletedFacts: DeletedFact[];
  mentions: MentionMap;
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

      <FactComposer
        worldId={worldId}
        subjectId={subjectId}
        categoryId={categoryId}
        fields={fields}
        mentions={mentions}
      />

      {items.length > 0 && (
        <DndContext id="facts-list" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
              {items.map((fact) => (
                <FactRow
                  key={fact.id}
                  worldId={worldId}
                  subjectId={subjectId}
                  fact={fact}
                  mentions={mentions}
                />
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

function FactComposer({
  worldId,
  subjectId,
  categoryId,
  fields,
  mentions,
}: {
  worldId: string;
  subjectId: string;
  categoryId: string;
  fields: SchemaField[];
  mentions: MentionMap;
}) {
  const router = useRouter();
  const draftKey = `fact-draft:${subjectId}`;
  // The serialized draft string (cross-tab/reload aware) is still the source of
  // truth (memory fact_draft_autosave); only the editor surface changed.
  const draft = useSyncExternalStore(
    subscribeDraft,
    () => localStorage.getItem(draftKey) ?? "",
    () => "",
  );

  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  // Mention input is uncontrolled: it populates once from initialTokens. Read the
  // draft synchronously at render (client only — the editor div SSRs empty either
  // way and is populated in an effect, so there's no hydration mismatch), then
  // remount with a bumped key after a successful save to clear it.
  const [initialTokens, setInitialTokens] = useState<FactToken[]>(() =>
    typeof window === "undefined" ? [] : parseFact(localStorage.getItem(draftKey) ?? ""),
  );
  const [draftNames, setDraftNames] = useState<MentionMap>({});
  const [editorKey, setEditorKey] = useState(0);
  const bodyRef = useRef(typeof window === "undefined" ? "" : localStorage.getItem(draftKey) ?? "");

  // Resolve chip names for any mentions in a restored draft (async → allowed).
  useEffect(() => {
    const ids = mentionedIds(bodyRef.current);
    if (ids.length) void resolveMentionRefs(ids).then(setDraftNames);
  }, []);

  function persist(serialized: string) {
    bodyRef.current = serialized;
    if (serialized) localStorage.setItem(draftKey, serialized);
    else localStorage.removeItem(draftKey);
    window.dispatchEvent(new Event(DRAFT_EVENT));
  }

  function submit() {
    const body = bodyRef.current;
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
        persist(""); // clears the draft from localStorage too
        setInitialTokens([]);
        setDraftNames({});
        setEditorKey((k) => k + 1); // remount empty + autofocus for fast capture
      }
    });
  }

  const fieldCommand: FieldCommand = {
    subjectId,
    fields,
    onSubmit: async (field, rawValue) => {
      if (field.type === "Link" || field.type === "List") {
        const ids = mentionedIds(rawValue);
        if (field.type === "Link" && ids.length > 1) {
          return { error: "Link only takes one — remove one of the mentions." };
        }
        const fd = new FormData();
        fd.set("worldId", worldId);
        fd.set("subjectId", subjectId);
        fd.set("fieldId", field.id);
        let result;
        if (field.type === "Link") {
          fd.set("linkedSubjectId", ids[0] ?? "");
          result = await setLinkValue(fd);
        } else {
          fd.set("subjectIds", JSON.stringify(ids));
          result = await setListValue(fd);
        }
        if (!result.error) router.refresh();
        return result;
      }

      const parsed = parseFieldCommandValue(field.type, rawValue, {
        selectOptions: field.select_options,
        scaleMin: field.scale_min,
        scaleMax: field.scale_max,
      });
      if ("error" in parsed) return { error: parsed.error };

      const fd = new FormData();
      fd.set("worldId", worldId);
      fd.set("subjectId", subjectId);
      fd.set("fieldId", field.id);
      if (field.type === "MultiSelect") fd.set("values", JSON.stringify(parsed.value));
      else fd.set("value", String(parsed.value));
      const result = await setScalarValue(fd);
      if (!result.error) router.refresh();
      return result;
    },
    onCreateField: async (name, guessedType, rawValue) => {
      const parsed = parseFieldCommandValue(guessedType, rawValue);
      if ("error" in parsed) return { error: parsed.error };

      const createFd = new FormData();
      createFd.set("worldId", worldId);
      createFd.set("categoryId", categoryId);
      createFd.set("name", name);
      createFd.set("type", guessedType);
      const created = await createField(createFd);
      if (created.error || !created.id) return { error: created.error ?? "Could not create field." };

      const valueFd = new FormData();
      valueFd.set("worldId", worldId);
      valueFd.set("subjectId", subjectId);
      valueFd.set("fieldId", created.id);
      valueFd.set("value", String(parsed.value));
      const result = await setScalarValue(valueFd);
      if (!result.error) router.refresh();
      return result;
    },
  };

  return (
    <div className="space-y-1">
      <MentionInput
        key={editorKey}
        worldId={worldId}
        initialTokens={initialTokens}
        resolved={{ ...mentions, ...draftNames }}
        placeholder="Write a fact… @ to mention, ! to fill a field. Enter to save."
        autoFocus={editorKey > 0}
        fieldCommand={fieldCommand}
        onChange={persist}
        onEnter={submit}
      />
      <div className="flex items-center gap-3 text-sm">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-md bg-neutral-900 px-3 py-1.5 font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          {pending ? "Saving…" : "Save fact"}
        </button>
        {/* Reflects unsaved-draft presence without controlling the editor. */}
        {draft && !pending && <span className="text-xs text-neutral-400">Draft saved</span>}
        {error && <span className="text-red-600 dark:text-red-400">{error}</span>}
      </div>
    </div>
  );
}

function FactRow({
  worldId,
  subjectId,
  fact,
  mentions,
}: {
  worldId: string;
  subjectId: string;
  fact: Fact;
  mentions: MentionMap;
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
          mentions={mentions}
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
        <FactBody worldId={worldId} subjectId={subjectId} fact={fact} mentions={mentions} />
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

/** Read-only fact body: text runs interleaved with live `<Mention>` links. */
function FactBody({
  worldId,
  subjectId,
  fact,
  mentions,
}: {
  worldId: string;
  subjectId: string;
  fact: Fact;
  mentions: MentionMap;
}) {
  const tokens = parseFact(fact.body);
  return (
    <>
      {tokens.map((t, i) =>
        t.type === "text" ? (
          <span key={i}>{t.value}</span>
        ) : (
          <Mention
            key={i}
            worldId={worldId}
            ownerSubjectId={subjectId}
            factId={fact.id}
            id={t.id}
            resolved={mentions[t.id]}
          />
        ),
      )}
    </>
  );
}

/** Inline editor. Save commits; Cancel/Escape dismisses and reverts (no draft). */
function FactEditor({
  worldId,
  subjectId,
  fact,
  mentions,
  onDone,
}: {
  worldId: string;
  subjectId: string;
  fact: Fact;
  mentions: MentionMap;
  onDone: () => void;
}) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  // Uncontrolled mention input; current serialized body lives in a ref.
  const bodyRef = useRef(fact.body);

  function save() {
    const body = bodyRef.current;
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
      <MentionInput
        worldId={worldId}
        initialTokens={parseFact(fact.body)}
        resolved={mentions}
        autoFocus
        placeholder="Edit fact… @ to mention."
        onChange={(s) => (bodyRef.current = s)}
        onEnter={save}
        onEscape={onDone}
      />
      <div className="flex items-center gap-3 text-sm">
        <button
          type="button"
          onClick={save}
          disabled={pending}
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
