"use client";

/**
 * Subject page client island (step 7). Inline name edit, category change (clears
 * field values — counted confirm), tag pills with autocomplete, the schema-field
 * value block (read-only with click-to-edit; [+ Add field] for empties; one editor
 * per field type), inbound backlinks grouped by field, and soft delete. Field-value
 * writes + relationships sync happen in app/actions/field-values.ts.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { renameSubject, changeSubjectCategory, deleteSubject } from "@/app/actions/subjects";
import {
  setScalarValue,
  setLinkValue,
  setListValue,
  clearFieldValue,
} from "@/app/actions/field-values";
import { promoteToListField } from "@/app/actions/backlinks";
import { applyTag, removeTag } from "@/app/actions/tags";
import { formatScalarValue } from "@/lib/field-values";
import { FIELD_TYPE_LABELS, type FieldType } from "@/lib/schema-fields";
import { MAX_NAME_LENGTH } from "@/lib/validation";
import { SubjectPicker } from "./subject-picker";
import { FactsList, type Fact, type DeletedFact, type MentionMap } from "./facts-list";
import { SubjectHoverCard } from "./mention";
import type { SchemaField } from "../../categories/[categoryId]/schema-editor";

export type FieldValueState =
  | { kind: "scalar"; value: unknown }
  | { kind: "link"; subject: { id: string; name: string } | null }
  | { kind: "list"; subjects: { id: string; name: string }[] };

type Ref = { id: string; name: string };
type Props = {
  worldId: string;
  subject: { id: string; name: string; categoryId: string };
  category: Ref;
  categories: Ref[];
  fields: SchemaField[];
  valuesByField: Record<string, FieldValueState>;
  tags: Ref[];
  allTags: Ref[];
  backlinks: Backlink[];
  dateSuggestions: string[];
  facts: Fact[];
  deletedFacts: DeletedFact[];
  mentions: MentionMap;
};

/**
 * One inbound reference, grouped by source subject (fact + field origins
 * merged). `factCount` / `fieldLabels` (step 10) feed the hover "Referenced
 * via" line; `categoryId` drives the select-mode single-category lock.
 */
type Backlink = {
  id: string;
  name: string;
  category: string | null;
  categoryId: string | null;
  factCount: number;
  fieldLabels: string[];
};

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-100";

export function SubjectPage(props: Props) {
  const { worldId, subject, category, categories, fields, valuesByField, tags, allTags, backlinks, dateSuggestions, facts, deletedFacts, mentions } =
    props;

  const filled = fields.filter((f) => valuesByField[f.id]);
  const empty = fields.filter((f) => !valuesByField[f.id]);

  return (
    // Two columns on wide screens; the "Referenced by" rail stacks below on narrow.
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_15rem]">
      <div className="flex min-w-0 flex-col gap-8">
        <header className="space-y-3">
          <NameEditor worldId={worldId} subject={subject} />
          <CategoryChanger
            worldId={worldId}
            subject={subject}
            category={category}
            categories={categories}
            valueCount={Object.keys(valuesByField).length}
          />
          <TagsEditor worldId={worldId} subjectId={subject.id} tags={tags} allTags={allTags} />
        </header>

        <FieldsBlock
          worldId={worldId}
          subject={subject}
          filled={filled}
          empty={empty}
          valuesByField={valuesByField}
          dateSuggestions={dateSuggestions}
        />

        <FactsList
          worldId={worldId}
          subjectId={subject.id}
          facts={facts}
          deletedFacts={deletedFacts}
          mentions={mentions}
        />

        <DeleteSubject worldId={worldId} subject={subject} />
      </div>

      {backlinks.length > 0 && (
        <BacklinksRail
          worldId={worldId}
          subjectId={subject.id}
          categoryId={subject.categoryId}
          backlinks={backlinks}
          fields={fields}
        />
      )}
    </div>
  );
}

/**
 * "Referenced by" side-rail (step 9) + select-mode promotion into a List field
 * (step 10). Selecting locks the rail to that entry's category — a List
 * field's members are all one category, so mismatched entries disable live
 * rather than letting an invalid selection reach "Promote".
 */
function BacklinksRail({
  worldId,
  subjectId,
  categoryId,
  backlinks,
  fields,
}: {
  worldId: string;
  subjectId: string;
  categoryId: string;
  backlinks: Backlink[];
  fields: SchemaField[];
}) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showPromote, setShowPromote] = useState(false);

  const lockedCategoryId =
    selected.size > 0 ? backlinks.find((b) => selected.has(b.id))?.categoryId ?? null : null;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exit() {
    setSelecting(false);
    setSelected(new Set());
    setShowPromote(false);
  }

  const matchingListFields = lockedCategoryId
    ? fields.filter((f) => f.type === "List" && f.target_category_id === lockedCategoryId)
    : [];

  return (
    <aside className="space-y-2 lg:border-l lg:border-neutral-200 lg:pl-6 dark:lg:border-neutral-800">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-500">Referenced by</h2>
        <button
          type="button"
          onClick={() => (selecting ? exit() : setSelecting(true))}
          className="text-xs text-neutral-400 underline-offset-4 transition hover:text-neutral-900 hover:underline dark:hover:text-neutral-100"
        >
          {selecting ? "Done" : "Select"}
        </button>
      </div>

      <ul className="space-y-1.5">
        {backlinks.map((b) => {
          const isSelected = selected.has(b.id);
          const disabled = selecting && lockedCategoryId != null && b.categoryId !== lockedCategoryId && !isSelected;
          const reason = [
            ...b.fieldLabels,
            b.factCount > 0 ? `mentioned in ${b.factCount} fact${b.factCount === 1 ? "" : "s"}` : null,
          ]
            .filter((x): x is string => !!x)
            .join(" · ");

          return (
            <li key={b.id} className="flex items-center gap-2">
              {selecting && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={disabled}
                  onChange={() => toggle(b.id)}
                  aria-label={`Select ${b.name}`}
                  title={disabled ? "List fields hold one category — deselect to change" : undefined}
                  className="h-3.5 w-3.5 shrink-0 accent-neutral-900 disabled:opacity-30 dark:accent-neutral-100"
                />
              )}
              <span className={disabled ? "opacity-40" : ""}>
                <SubjectHoverCard subjectId={b.id} reason={reason || undefined}>
                  {selecting ? (
                    <span className="text-sm text-neutral-700 dark:text-neutral-200">{b.name}</span>
                  ) : (
                    <Link
                      href={`/worlds/${worldId}/subjects/${b.id}`}
                      className="text-sm text-neutral-700 underline-offset-4 transition hover:text-neutral-950 hover:underline dark:text-neutral-200 dark:hover:text-neutral-50"
                    >
                      {b.name}
                    </Link>
                  )}
                </SubjectHoverCard>
                {b.category && (
                  <span className="ml-1.5 text-xs text-neutral-400">{b.category}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      {selected.size > 0 && (
        <div className="space-y-2 rounded-md bg-neutral-50 p-2 dark:bg-neutral-900">
          {!showPromote ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPromote(true)}
                className="rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900"
              >
                Promote {selected.size} to List…
              </button>
              <button type="button" onClick={exit} className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">
                Cancel
              </button>
            </div>
          ) : (
            <PromotePanel
              worldId={worldId}
              subjectId={subjectId}
              categoryId={categoryId}
              targetCategoryId={lockedCategoryId!}
              subjectIds={Array.from(selected)}
              existingFields={matchingListFields}
              onDone={exit}
              onCancel={() => setShowPromote(false)}
            />
          )}
        </div>
      )}
    </aside>
  );
}

function PromotePanel({
  worldId,
  subjectId,
  categoryId,
  targetCategoryId,
  subjectIds,
  existingFields,
  onDone,
  onCancel,
}: {
  worldId: string;
  subjectId: string;
  categoryId: string;
  targetCategoryId: string;
  subjectIds: string[];
  existingFields: SchemaField[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<"existing" | "new">(existingFields.length > 0 ? "existing" : "new");
  const [fieldId, setFieldId] = useState(existingFields[0]?.id ?? "");
  const [newFieldName, setNewFieldName] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    if (mode === "existing" && !fieldId) {
      setError("Choose a field.");
      return;
    }
    if (mode === "new" && !newFieldName.trim()) {
      setError("Name the new field.");
      return;
    }
    const fd = new FormData();
    fd.set("worldId", worldId);
    fd.set("subjectId", subjectId);
    fd.set("categoryId", categoryId);
    fd.set("targetCategoryId", targetCategoryId);
    fd.set("subjectIds", JSON.stringify(subjectIds));
    if (mode === "existing") fd.set("fieldId", fieldId);
    else fd.set("newFieldName", newFieldName);

    startTransition(async () => {
      const result = await promoteToListField(fd);
      if (result.error) setError(result.error);
      else {
        router.refresh();
        onDone();
      }
    });
  }

  return (
    <div className="space-y-2 rounded-md border border-neutral-200 p-2 dark:border-neutral-800">
      {existingFields.length > 0 && (
        <label className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
          <input type="radio" checked={mode === "existing"} onChange={() => setMode("existing")} />
          Add to
          <select
            value={fieldId}
            onChange={(e) => {
              setFieldId(e.target.value);
              setMode("existing");
            }}
            className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-1.5 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
          >
            {existingFields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
        {existingFields.length > 0 ? (
          <input type="radio" checked={mode === "new"} onChange={() => setMode("new")} />
        ) : (
          "Create"
        )}
        {existingFields.length > 0 && "or create new"}
        <input
          type="text"
          value={newFieldName}
          onChange={(e) => {
            setNewFieldName(e.target.value);
            setMode("new");
          }}
          placeholder="Field name, e.g. Students"
          className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-1.5 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {pending ? "Promoting…" : "Promote"}
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">
          Cancel
        </button>
      </div>
    </div>
  );
}

function NameEditor({
  worldId,
  subject,
}: {
  worldId: string;
  subject: { id: string; name: string };
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-left text-3xl font-semibold tracking-tight transition hover:opacity-70"
        title="Click to rename"
      >
        {subject.name}
      </button>
    );
  }

  return (
    <form
      action={(fd) => {
        fd.set("worldId", worldId);
        fd.set("subjectId", subject.id);
        startTransition(async () => {
          const r = await renameSubject(fd);
          if (r.error) setError(r.error);
          else setEditing(false);
        });
      }}
      noValidate
      className="space-y-1"
    >
      <input
        name="name"
        defaultValue={subject.name}
        autoFocus
        required
        maxLength={MAX_NAME_LENGTH}
        aria-label="Subject name"
        className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-2xl font-semibold outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-100"
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-sm text-neutral-400">
          Cancel
        </button>
        {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
      </div>
    </form>
  );
}

function CategoryChanger({
  worldId,
  subject,
  category,
  categories,
  valueCount,
}: {
  worldId: string;
  subject: { id: string; categoryId: string };
  category: Ref;
  categories: Ref[];
  valueCount: number;
}) {
  const [changing, setChanging] = useState(false);
  const [target, setTarget] = useState("");
  const [pending, startTransition] = useTransition();

  function commit() {
    if (!target || target === subject.categoryId) {
      setChanging(false);
      return;
    }
    const fd = new FormData();
    fd.set("worldId", worldId);
    fd.set("subjectId", subject.id);
    fd.set("categoryId", target);
    startTransition(async () => {
      await changeSubjectCategory(fd);
      setChanging(false);
    });
  }

  if (!changing) {
    return (
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <span>{category.name}</span>
        <button
          type="button"
          onClick={() => setChanging(true)}
          className="underline-offset-4 transition hover:text-neutral-800 hover:underline dark:hover:text-neutral-200"
        >
          change
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md bg-amber-50 p-3 text-sm dark:bg-amber-950/40">
      <select
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        aria-label="New category"
        className={inputClass}
      >
        <option value="" disabled>
          Move to which category?
        </option>
        {categories
          .filter((c) => c.id !== subject.categoryId)
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
      </select>
      {valueCount > 0 && (
        <p className="text-amber-900 dark:text-amber-200">
          This clears {valueCount} field value{valueCount === 1 ? "" : "s"} set for{" "}
          {category.name}. Facts and tags are kept.
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={commit}
          disabled={pending || !target}
          className="rounded-md bg-neutral-900 px-3 py-1.5 font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {pending ? "Moving…" : "Move"}
        </button>
        <button type="button" onClick={() => setChanging(false)} className="text-neutral-500">
          Cancel
        </button>
      </div>
    </div>
  );
}

function TagsEditor({
  worldId,
  subjectId,
  tags,
  allTags,
}: {
  worldId: string;
  subjectId: string;
  tags: Ref[];
  allTags: Ref[];
}) {
  const [pending, startTransition] = useTransition();

  function add(name: string) {
    if (!name.trim()) return;
    const fd = new FormData();
    fd.set("worldId", worldId);
    fd.set("subjectId", subjectId);
    fd.set("name", name);
    startTransition(() => {
      void applyTag(fd);
    });
  }

  function remove(tagId: string) {
    const fd = new FormData();
    fd.set("worldId", worldId);
    fd.set("subjectId", subjectId);
    fd.set("tagId", tagId);
    startTransition(() => {
      void removeTag(fd);
    });
  }

  const suggestions = allTags.filter((t) => !tags.some((own) => own.id === t.id));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <span
          key={t.id}
          className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
        >
          #{t.name}
          <button
            type="button"
            onClick={() => remove(t.id)}
            aria-label={`Remove ${t.name}`}
            className="text-neutral-400 transition hover:text-red-600 dark:hover:text-red-400"
          >
            ×
          </button>
        </span>
      ))}
      <form
        action={(fd) => {
          const name = String(fd.get("tag") ?? "");
          add(name);
          (document.getElementById("tag-input") as HTMLInputElement | null)?.form?.reset();
        }}
      >
        <input
          id="tag-input"
          name="tag"
          list="tag-suggestions"
          placeholder="+ tag"
          disabled={pending}
          className="w-24 rounded-full border border-neutral-200 bg-transparent px-2 py-0.5 text-xs outline-none transition focus:w-36 focus:border-neutral-400 dark:border-neutral-700"
        />
        <datalist id="tag-suggestions">
          {suggestions.map((t) => (
            <option key={t.id} value={t.name} />
          ))}
        </datalist>
      </form>
    </div>
  );
}

function FieldsBlock({
  worldId,
  subject,
  filled,
  empty,
  valuesByField,
  dateSuggestions,
}: {
  worldId: string;
  subject: { id: string; name: string };
  filled: SchemaField[];
  empty: SchemaField[];
  valuesByField: Record<string, FieldValueState>;
  dateSuggestions: string[];
}) {
  const [addingId, setAddingId] = useState<string | null>(null);
  const addable = empty.filter((f) => f.id !== addingId);
  const addingField = empty.find((f) => f.id === addingId) ?? null;

  return (
    <section className="space-y-3">
      {(filled.length > 0 || addingField) && (
        <div className="flex flex-wrap items-center gap-2">
          {filled.map((field) => (
            <FieldRow
              key={field.id}
              worldId={worldId}
              subject={subject}
              field={field}
              state={valuesByField[field.id]}
              dateSuggestions={dateSuggestions}
            />
          ))}
          {addingField && (
            <div className="basis-full">
              <FieldEditor
                worldId={worldId}
                subject={subject}
                field={addingField}
                state={undefined}
                dateSuggestions={dateSuggestions}
                onDone={() => setAddingId(null)}
              />
            </div>
          )}
        </div>
      )}

      {addable.length > 0 && (
        <AddFieldMenu fields={addable} onPick={(id) => setAddingId(id)} />
      )}
    </section>
  );
}

function AddFieldMenu({
  fields,
  onPick,
}: {
  fields: SchemaField[];
  onPick: (id: string) => void;
}) {
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-sm text-neutral-500 underline-offset-4 transition hover:text-neutral-900 hover:underline dark:hover:text-neutral-100">
        + Add field
      </summary>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {fields.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onPick(f.id)}
            className="rounded-full border border-neutral-200 px-2.5 py-1 text-xs text-neutral-600 transition hover:-translate-y-px hover:border-neutral-400 hover:text-neutral-900 dark:border-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            {f.name}
            <span className="ml-1 text-neutral-400">{FIELD_TYPE_LABELS[f.type]}</span>
          </button>
        ))}
      </div>
    </details>
  );
}

function describeValue(field: SchemaField, state: FieldValueState): string {
  if (state.kind === "scalar") return formatScalarValue(field.type, state.value);
  if (state.kind === "link") return state.subject?.name ?? "—";
  return state.subjects.map((s) => s.name).join(", ");
}

function FieldRow({
  worldId,
  subject,
  field,
  state,
  dateSuggestions,
}: {
  worldId: string;
  subject: { id: string; name: string };
  field: SchemaField;
  state: FieldValueState;
  dateSuggestions: string[];
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="basis-full">
        <FieldEditor
          worldId={worldId}
          subject={subject}
          field={field}
          state={state}
          dateSuggestions={dateSuggestions}
          onDone={() => setEditing(false)}
        />
      </div>
    );
  }

  // Compact click-to-edit pill: "Age: 12 Years".
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Click to edit"
      className="inline-flex items-baseline gap-1 rounded-md border border-neutral-200 px-2.5 py-1 text-sm transition hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
    >
      <span className="text-neutral-500">{field.name}:</span>
      <span className="font-medium text-neutral-900 dark:text-neutral-100">
        {describeValue(field, state) || "—"}
      </span>
      {field.unit ? <span className="text-neutral-400">{field.unit}</span> : null}
    </button>
  );
}

function FieldEditor({
  worldId,
  subject,
  field,
  state,
  dateSuggestions,
  onDone,
}: {
  worldId: string;
  subject: { id: string; name: string };
  field: SchemaField;
  state: FieldValueState | undefined;
  dateSuggestions: string[];
  onDone: () => void;
}) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function base() {
    const fd = new FormData();
    fd.set("worldId", worldId);
    fd.set("subjectId", subject.id);
    fd.set("fieldId", field.id);
    return fd;
  }
  function run(promise: Promise<{ error?: string }>) {
    startTransition(async () => {
      const r = await promise;
      if (r.error) setError(r.error);
      else {
        router.refresh();
        onDone();
      }
    });
  }
  function clear() {
    run(clearFieldValue(base()));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="w-32 shrink-0 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {field.name}
        </span>
        <div className="flex-1">
          <FieldInput
            field={field}
            state={state}
            dateSuggestions={dateSuggestions}
            subjectId={subject.id}
            pending={pending}
            onSubmitScalar={(value, values) => {
              const fd = base();
              if (values) fd.set("values", JSON.stringify(values));
              else fd.set("value", value ?? "");
              run(setScalarValue(fd));
            }}
            onSubmitLink={(linkedId) => {
              const fd = base();
              fd.set("linkedSubjectId", linkedId);
              run(setLinkValue(fd));
            }}
            onSubmitList={(ids) => {
              const fd = base();
              fd.set("subjectIds", JSON.stringify(ids));
              run(setListValue(fd));
            }}
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex items-center gap-3 pl-[8.5rem] text-sm">
        {state && (
          <button type="button" onClick={clear} disabled={pending} className="text-neutral-400 hover:text-red-600 dark:hover:text-red-400">
            Clear
          </button>
        )}
        <button type="button" onClick={onDone} className="text-neutral-400">
          Done
        </button>
      </div>
    </div>
  );
}

/** The per-type input. Scalars submit on a Save button; Link/List submit on pick. */
function FieldInput({
  field,
  state,
  dateSuggestions,
  subjectId,
  pending,
  onSubmitScalar,
  onSubmitLink,
  onSubmitList,
}: {
  field: SchemaField;
  state: FieldValueState | undefined;
  dateSuggestions: string[];
  subjectId: string;
  pending: boolean;
  onSubmitScalar: (value: string | null, values?: string[]) => void;
  onSubmitLink: (linkedId: string) => void;
  onSubmitList: (ids: string[]) => void;
}) {
  const scalar = state?.kind === "scalar" ? state.value : undefined;
  const [text, setText] = useState(
    scalar !== undefined && scalar !== null && !Array.isArray(scalar) ? String(scalar) : "",
  );
  const [bool, setBool] = useState(scalar === true);
  const [multi, setMulti] = useState<string[]>(
    state?.kind === "scalar" && Array.isArray(state.value) ? (state.value as string[]) : [],
  );

  const saveBtn = (
    <button
      type="button"
      disabled={pending}
      onClick={() => onSubmitScalar(text)}
      className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
    >
      Save
    </button>
  );

  switch (field.type) {
    case "Boolean":
      return (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={bool}
            onChange={(e) => {
              setBool(e.target.checked);
              onSubmitScalar(e.target.checked ? "true" : "false");
            }}
          />
          {bool ? "Yes" : "No"}
        </label>
      );
    case "Select":
      return (
        <select
          defaultValue={typeof scalar === "string" ? scalar : ""}
          disabled={pending}
          onChange={(e) => onSubmitScalar(e.target.value)}
          className={inputClass}
        >
          <option value="" disabled>
            Choose…
          </option>
          {(field.select_options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case "MultiSelect":
      return (
        <div className="flex flex-wrap gap-1.5">
          {(field.select_options ?? []).map((o) => {
            const on = multi.includes(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() => {
                  const next = on ? multi.filter((v) => v !== o) : [...multi, o];
                  setMulti(next);
                  onSubmitScalar(null, next);
                }}
                className={`rounded-full px-2.5 py-1 text-xs transition ${
                  on
                    ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                    : "border border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
                }`}
              >
                {o}
              </button>
            );
          })}
        </div>
      );
    case "Scale":
      return (
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={field.scale_min ?? 0}
            max={field.scale_max ?? 10}
            value={text || String(field.scale_min ?? 0)}
            onChange={(e) => setText(e.target.value)}
            className="flex-1"
          />
          <span className="w-8 text-sm tabular-nums">{text || field.scale_min}</span>
          {saveBtn}
        </div>
      );
    case "Color":
      return (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(text) ? text : "#888888"}
            onChange={(e) => setText(e.target.value)}
            className="h-9 w-12 rounded border border-neutral-300 dark:border-neutral-700"
          />
          {saveBtn}
        </div>
      );
    case "Date":
      return (
        <div className="flex items-center gap-2">
          <input
            type="text"
            list={`date-${field.id}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Any in-world date, e.g. 3E 2931"
            className={inputClass}
          />
          <datalist id={`date-${field.id}`}>
            {dateSuggestions.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
          {saveBtn}
        </div>
      );
    case "Number":
      return (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={inputClass}
          />
          {field.unit && <span className="text-sm text-neutral-400">{field.unit}</span>}
          {saveBtn}
        </div>
      );
    case "Link":
      return (
        <SubjectPicker
          targetCategoryId={field.target_category_id ?? ""}
          excludeId={subjectId}
          multiple={false}
          selected={state?.kind === "link" && state.subject ? [state.subject] : []}
          onChangeSingle={(s) => onSubmitLink(s?.id ?? "")}
        />
      );
    case "List":
      return (
        <SubjectPicker
          targetCategoryId={field.target_category_id ?? ""}
          excludeId={subjectId}
          multiple
          selected={state?.kind === "list" ? state.subjects : []}
          onChangeMulti={(arr) => onSubmitList(arr.map((s) => s.id))}
        />
      );
    default:
      return (
        <div className="flex items-center gap-2">
          <input type="text" value={text} onChange={(e) => setText(e.target.value)} className={inputClass} />
          {saveBtn}
        </div>
      );
  }
}

function DeleteSubject({
  worldId,
  subject,
}: {
  worldId: string;
  subject: { id: string; name: string; categoryId: string };
}) {
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirm) {
    return (
      <div className="border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="text-sm text-neutral-400 transition hover:text-red-600 dark:hover:text-red-400"
        >
          Delete subject
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-6 dark:border-neutral-800">
      <p className="text-sm text-neutral-700 dark:text-neutral-300">
        Delete <span className="font-medium">{subject.name}</span>? It moves to
        Recently Deleted — restore within 30 days.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const fd = new FormData();
          fd.set("worldId", worldId);
          fd.set("subjectId", subject.id);
          fd.set("categoryId", subject.categoryId);
          startTransition(() => {
            void deleteSubject(fd);
          });
        }}
        className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      <button type="button" onClick={() => setConfirm(false)} className="text-sm text-neutral-500">
        Cancel
      </button>
    </div>
  );
}
