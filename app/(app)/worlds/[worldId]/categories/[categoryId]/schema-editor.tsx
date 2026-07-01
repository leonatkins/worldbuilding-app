"use client";

/**
 * Schema editor (step 6) — manage a category's typed field definitions. Drag-
 * reorderable list, inline add/edit with per-type config, delete. No field
 * *values* here (step 7). Mutations go through app/actions/schema-fields.ts;
 * reorder writes a midpoint position.
 */
import { useState, useTransition } from "react";
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
  createField,
  updateField,
  reorderField,
  deleteField,
} from "@/app/actions/schema-fields";
import {
  FIELD_TYPES,
  FIELD_TYPE_LABELS,
  FIELD_TYPE_HINTS,
  needsOptions,
  needsScale,
  needsTargetCategory,
  allowsUnit,
  summarizeField,
  type FieldType,
} from "@/lib/schema-fields";
import { MAX_NAME_LENGTH } from "@/lib/validation";
import { midpointPosition } from "@/lib/ordering";

export type SchemaField = {
  id: string;
  name: string;
  type: FieldType;
  position: number;
  target_category_id: string | null;
  select_options: string[] | null;
  scale_min: number | null;
  scale_max: number | null;
  unit: string | null;
  inverse_label: string | null;
};

type Cat = { id: string; name: string };
type Props = {
  worldId: string;
  categoryId: string;
  fields: SchemaField[];
  categories: Cat[];
};

export function SchemaEditor({ worldId, categoryId, fields, categories }: Props) {
  // Local mirror for instant drag reordering; resync during render when server
  // data changes (the React-sanctioned alternative to a setState-in-effect).
  const [items, setItems] = useState(fields);
  const [syncedFrom, setSyncedFrom] = useState(fields);
  if (syncedFrom !== fields) {
    setSyncedFrom(fields);
    setItems(fields);
  }
  const [adding, setAdding] = useState(false);
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
    fd.set("categoryId", categoryId);
    fd.set("fieldId", String(active.id));
    fd.set("position", String(position));
    startTransition(() => {
      void reorderField(fd);
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-500">Schema fields</h2>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 px-6 py-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
          No fields yet. Most subjects do fine with just facts — add a field only
          when you’d filter or compare by its value.
        </p>
      ) : (
        <DndContext id="schema-fields" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
              {items.map((field) => (
                <FieldRow
                  key={field.id}
                  worldId={worldId}
                  categoryId={categoryId}
                  field={field}
                  categories={categories}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {adding ? (
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <FieldForm
            worldId={worldId}
            categoryId={categoryId}
            categories={categories}
            onDone={() => setAdding(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="text-sm text-neutral-500 underline-offset-4 transition hover:text-neutral-900 hover:underline dark:hover:text-neutral-100"
        >
          + Add field
        </button>
      )}
    </section>
  );
}

function FieldRow({
  worldId,
  categoryId,
  field,
  categories,
}: {
  worldId: string;
  categoryId: string;
  field: SchemaField;
  categories: Cat[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.id });
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (editing) {
    return (
      <li ref={setNodeRef} style={style} className="px-4 py-3">
        <FieldForm
          worldId={worldId}
          categoryId={categoryId}
          categories={categories}
          field={field}
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }

  const summary = summarizeField(field, categories);

  return (
    <li ref={setNodeRef} style={style} className="flex items-center gap-2 px-4 py-3">
      <button
        type="button"
        aria-label="Drag to reorder"
        className="cursor-grab touch-none text-neutral-300 transition hover:text-neutral-500 active:cursor-grabbing dark:text-neutral-600"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {field.name}
        </span>
        <span className="ml-2 text-xs text-neutral-500">
          {FIELD_TYPE_LABELS[field.type]}
          {summary ? ` · ${summary}` : ""}
        </span>
      </div>
      {confirmDelete ? (
        <div className="flex shrink-0 items-center gap-1 text-sm">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const fd = new FormData();
              fd.set("worldId", worldId);
              fd.set("categoryId", categoryId);
              fd.set("fieldId", field.id);
              startTransition(() => {
                void deleteField(fd);
              });
            }}
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
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-1 text-sm text-neutral-500">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md px-2 py-1 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="rounded-md px-2 py-1 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
          >
            Delete
          </button>
        </div>
      )}
    </li>
  );
}

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-100";

function FieldForm({
  worldId,
  categoryId,
  categories,
  field,
  onDone,
}: {
  worldId: string;
  categoryId: string;
  categories: Cat[];
  field?: SchemaField;
  onDone: () => void;
}) {
  const [name, setName] = useState(field?.name ?? "");
  const [type, setType] = useState<FieldType>(field?.type ?? "Text");
  const [targetCategoryId, setTargetCategoryId] = useState(
    field?.target_category_id ?? "",
  );
  const [inverseLabel, setInverseLabel] = useState(field?.inverse_label ?? "");
  const [options, setOptions] = useState<string[]>(field?.select_options ?? [""]);
  const [scaleMin, setScaleMin] = useState(field?.scale_min?.toString() ?? "1");
  const [scaleMax, setScaleMax] = useState(field?.scale_max?.toString() ?? "10");
  const [unit, setUnit] = useState(field?.unit ?? "");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const fd = new FormData();
    fd.set("worldId", worldId);
    fd.set("categoryId", categoryId);
    if (field) fd.set("fieldId", field.id);
    fd.set("name", name);
    fd.set("type", type);
    if (needsTargetCategory(type)) {
      fd.set("targetCategoryId", targetCategoryId);
      fd.set("inverseLabel", inverseLabel);
    }
    if (needsOptions(type)) fd.set("selectOptions", JSON.stringify(options));
    if (needsScale(type)) {
      fd.set("scaleMin", scaleMin);
      fd.set("scaleMax", scaleMax);
    }
    if (allowsUnit(type)) fd.set("unit", unit);

    startTransition(async () => {
      const result = field ? await updateField(fd) : await createField(fd);
      if (result.error) setError(result.error);
      else onDone();
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Field name (e.g. Population, Mentor)"
          maxLength={MAX_NAME_LENGTH}
          aria-label="Field name"
          autoFocus
          className={inputClass}
        />
        <div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as FieldType)}
            aria-label="Field type"
            className={inputClass}
          >
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {FIELD_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-neutral-500">{FIELD_TYPE_HINTS[type]}</p>
        </div>

        {needsTargetCategory(type) && (
          <>
            <select
              value={targetCategoryId}
              onChange={(e) => setTargetCategoryId(e.target.value)}
              aria-label="Target category"
              className={inputClass}
            >
              <option value="" disabled>
                Links to which category?
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={inverseLabel}
              onChange={(e) => setInverseLabel(e.target.value)}
              placeholder="Inverse label (optional) — how the target relates back, e.g. Student"
              maxLength={MAX_NAME_LENGTH}
              aria-label="Inverse label"
              className={inputClass}
            />
          </>
        )}

        {needsOptions(type) && (
          <OptionsEditor options={options} onChange={setOptions} />
        )}

        {needsScale(type) && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-sm text-neutral-500">
              Min
              <input
                type="number"
                value={scaleMin}
                onChange={(e) => setScaleMin(e.target.value)}
                className="w-20 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex items-center gap-1 text-sm text-neutral-500">
              Max
              <input
                type="number"
                value={scaleMax}
                onChange={(e) => setScaleMax(e.target.value)}
                className="w-20 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
          </div>
        )}

        {allowsUnit(type) && (
          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="Unit (optional, e.g. people, years)"
            aria-label="Unit"
            className={inputClass}
          />
        )}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          {pending ? "Saving…" : field ? "Save field" : "Add field"}
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

function OptionsEditor({
  options,
  onChange,
}: {
  options: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={opt}
            onChange={(e) => {
              const next = [...options];
              next[i] = e.target.value;
              onChange(next);
            }}
            placeholder={`Option ${i + 1}`}
            aria-label={`Option ${i + 1}`}
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => onChange(options.filter((_, j) => j !== i))}
            aria-label="Remove option"
            className="rounded-md px-2 py-1 text-sm text-neutral-500 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...options, ""])}
        className="text-sm text-neutral-500 underline-offset-4 transition hover:text-neutral-900 hover:underline dark:hover:text-neutral-100"
      >
        + Add option
      </button>
    </div>
  );
}
