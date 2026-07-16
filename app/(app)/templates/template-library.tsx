"use client";

/**
 * Client island for the template library (step 13). Lists built-in + private
 * templates; private ones support edit-in-place (structural field editor, A8),
 * rename, and delete; plus a "New template" entry that opens the editor on an
 * empty snapshot (A8b). Built-ins are read-only. The editor mutates only the
 * snapshot blob (detachment: applied worlds are independent copies).
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import {
  deleteTemplate,
  saveTemplate,
  updateTemplate,
} from "@/app/actions/templates";
import {
  FIELD_TYPES,
  FIELD_TYPE_LABELS,
  type FieldType,
} from "@/lib/schema-fields";
import { MAX_NAME_LENGTH } from "@/lib/validation";
import type {
  TemplateListItem,
  Snapshot,
  SnapshotField,
  WorldSnapshot,
} from "@/lib/templates/types";

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-100";

export function TemplateLibrary({
  templates,
}: {
  templates: TemplateListItem[];
}) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const editing = editingId ? templates.find((t) => t.id === editingId) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-500">
          {templates.length} {templates.length === 1 ? "template" : "templates"}
        </span>
        <button
          type="button"
          onClick={() => {
            setCreating(true);
            setEditingId(null);
          }}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          + New template
        </button>
      </div>

      {creating && <TemplateEditor mode="create" onDone={() => setCreating(false)} />}

      {editing && editing.content && (
        <TemplateEditor
          mode="edit"
          template={editing}
          onDone={() => setEditingId(null)}
        />
      )}

      {!creating && !editing && (
        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 bg-surface-raised dark:divide-neutral-800 dark:border-neutral-800">
          {templates.map((t) => (
            <li key={t.id} className="px-4 py-3">
              <TemplateRow
                template={t}
                onEdit={t.builtin ? undefined : () => setEditingId(t.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TemplateRow({
  template,
  onEdit,
}: {
  template: TemplateListItem;
  onEdit?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const summary = summarizeSnapshot(template.content);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {template.name}
          </span>
          <span className="ml-2 text-xs text-neutral-500">
            {template.kind === "world" ? "World" : "Schema"}
            {template.builtin ? " · built-in" : ""}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1 text-sm">
          {template.kind === "world" ? (
            <Link
              href={`/?apply=${encodeURIComponent(template.id)}`}
              className="rounded-md px-2 py-1 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            >
              Apply
            </Link>
          ) : (
            <Link
              href={`/?applySchema=${encodeURIComponent(template.id)}`}
              className="rounded-md px-2 py-1 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            >
              Apply
            </Link>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-md px-2 py-1 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            >
              Edit
            </button>
          )}
          {!template.builtin &&
            (confirmDelete ? (
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const fd = new FormData();
                      fd.set("id", template.id);
                      await deleteTemplate(fd);
                    })
                  }
                  className="rounded-md bg-red-600 px-2 py-1 font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {pending ? "Deleting…" : "Delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-md px-2 py-1 text-neutral-600 transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="rounded-md px-2 py-1 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
              >
                Delete
              </button>
            ))}
        </div>
      </div>
      <p className="text-xs text-neutral-500">{summary}</p>
    </div>
  );
}

function summarizeSnapshot(snapshot: Snapshot | undefined): string {
  if (!snapshot) return "";
  if (snapshot.kind === "schema") {
    return `${snapshot.category.name} · ${snapshot.fields.length} field${snapshot.fields.length === 1 ? "" : "s"}`;
  }
  const cats = snapshot.categories.length;
  const fields = snapshot.categories.reduce((n, c) => n + c.fields.length, 0);
  return `${cats} categor${cats === 1 ? "y" : "ies"} · ${fields} field${fields === 1 ? "" : "s"}`;
}

function emptySnapshot(kind: "schema" | "world"): Snapshot {
  return kind === "schema"
    ? { kind: "schema", category: { name: "Untitled", icon: null }, fields: [] }
    : { kind: "world", categories: [{ localKey: "cat-1", name: "Untitled", icon: null, fields: [] }] };
}

function TemplateEditor({
  mode,
  template,
  onDone,
}: {
  mode: "create" | "edit";
  template?: TemplateListItem;
  onDone: () => void;
}) {
  const initial: Snapshot =
    mode === "edit" && template?.content
      ? (JSON.parse(JSON.stringify(template.content)) as Snapshot)
      : emptySnapshot("schema");
  const [snapshot, setSnapshot] = useState<Snapshot>(initial);
  const [name, setName] = useState(template?.name ?? "Untitled template");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const fd = new FormData();
    fd.set("name", name);
    fd.set("kind", snapshot.kind);
    fd.set("content", JSON.stringify(snapshot));
    if (mode === "edit" && template) fd.set("id", template.id);
    startTransition(async () => {
      const result = mode === "edit" && template ? await updateTemplate(fd) : await saveTemplate(fd);
      if (result.error) setError(result.error);
      else onDone();
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-neutral-200 bg-surface-raised p-4 dark:border-neutral-800">
      <div className="space-y-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_NAME_LENGTH}
          placeholder="Template name"
          aria-label="Template name"
          className={inputClass}
        />
        {mode === "create" && (
          <select
            value={snapshot.kind}
            onChange={(e) => setSnapshot(emptySnapshot(e.target.value as "schema" | "world"))}
            className={inputClass}
            aria-label="Template kind"
          >
            <option value="schema">Schema (one category&apos;s fields)</option>
            <option value="world">World (full category structure)</option>
          </select>
        )}
      </div>

      <SnapshotFieldsEditor snapshot={snapshot} onChange={setSnapshot} />

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          {pending ? "Saving…" : mode === "edit" ? "Save template" : "Create template"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function SnapshotFieldsEditor({
  snapshot,
  onChange,
}: {
  snapshot: Snapshot;
  onChange: (s: Snapshot) => void;
}) {
  if (snapshot.kind === "schema") {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={snapshot.category.name}
            onChange={(e) =>
              onChange({ ...snapshot, category: { ...snapshot.category, name: e.target.value } })
            }
            placeholder="Category name"
            aria-label="Category name"
            className={inputClass}
          />
          <input
            type="text"
            value={snapshot.category.icon ?? ""}
            onChange={(e) =>
              onChange({ ...snapshot, category: { ...snapshot.category, icon: e.target.value } })
            }
            placeholder="Icon (emoji, optional)"
            aria-label="Category icon"
            className={inputClass}
          />
        </div>
        <FieldListEditor
          fields={snapshot.fields}
          onChange={(fields) => onChange({ ...snapshot, fields })}
        />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {snapshot.categories.map((cat, i) => (
        <div key={i} className="space-y-3 rounded-md border border-neutral-200 bg-surface-raised p-3 dark:border-neutral-800">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={cat.name}
              onChange={(e) => updateCategory(snapshot, i, { name: e.target.value }, onChange)}
              placeholder="Category name"
              aria-label="Category name"
              className={inputClass}
            />
            <input
              type="text"
              value={cat.icon ?? ""}
              onChange={(e) => updateCategory(snapshot, i, { icon: e.target.value }, onChange)}
              placeholder="Icon (emoji, optional)"
              aria-label="Category icon"
              className={inputClass}
            />
          </div>
          <FieldListEditor
            fields={cat.fields}
            onChange={(fields) => updateCategory(snapshot, i, { fields }, onChange)}
          />
          {snapshot.categories.length > 1 && (
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...snapshot,
                  categories: snapshot.categories.filter((_, j) => j !== i),
                })
              }
              className="text-xs text-red-600 transition hover:underline dark:text-red-400"
            >
              Remove category
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange({
            ...snapshot,
            categories: [
              ...snapshot.categories,
              {
                localKey: `cat-${snapshot.categories.length + 1}`,
                name: "Untitled",
                icon: null,
                fields: [],
              },
            ],
          })
        }
        className="text-sm text-neutral-500 underline-offset-4 transition hover:text-neutral-900 hover:underline dark:hover:text-neutral-100"
      >
        + Add category
      </button>
    </div>
  );
}

function updateCategory(
  snapshot: WorldSnapshot,
  index: number,
  patch: Partial<WorldSnapshot["categories"][number]>,
  onChange: (s: Snapshot) => void,
) {
  const cats = snapshot.categories.map((c, i) => (i === index ? { ...c, ...patch } : c));
  onChange({ ...snapshot, categories: cats });
}

function FieldListEditor({
  fields,
  onChange,
}: {
  fields: SnapshotField[];
  onChange: (fields: SnapshotField[]) => void;
}) {
  function update(i: number, patch: Partial<SnapshotField>) {
    onChange(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  }
  return (
    <div className="space-y-2">
      {fields.map((field, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={field.name}
            onChange={(e) => update(i, { name: e.target.value })}
            placeholder="Field name"
            aria-label="Field name"
            className={inputClass}
          />
          <select
            value={field.type}
            onChange={(e) => update(i, { type: e.target.value as FieldType })}
            aria-label="Field type"
            className="w-32 rounded-md border border-neutral-300 bg-white px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {FIELD_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          {(field.type === "Select" || field.type === "MultiSelect") && (
            <input
              type="text"
              value={(field.selectOptions ?? []).join(", ")}
              onChange={(e) =>
                update(i, {
                  selectOptions: e.target.value
                    .split(",")
                    .map((o) => o.trim())
                    .filter(Boolean),
                })
              }
              placeholder="options, comma, separated"
              aria-label="Options"
              className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            />
          )}
          {(field.type === "Link" || field.type === "List") && (
            <input
              type="text"
              value={field.target?.name ?? ""}
              onChange={(e) =>
                update(i, { target: e.target.value ? { name: e.target.value } : undefined })
              }
              placeholder="target category name"
              aria-label="Target category"
              className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            />
          )}
          <button
            type="button"
            onClick={() => onChange(fields.filter((_, j) => j !== i))}
            aria-label="Remove field"
            className="rounded-md px-2 py-1 text-sm text-neutral-500 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...fields, { name: "", type: "Text" }])}
        className="text-sm text-neutral-500 underline-offset-4 transition hover:text-neutral-900 hover:underline dark:hover:text-neutral-100"
      >
        + Add field
      </button>
    </div>
  );
}
