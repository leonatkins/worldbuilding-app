"use client";

/**
 * Category manager (step 6) — the world home. Drag-reorderable list of categories
 * with inline create (curated emoji + suggested quick-picks), inline rename, icon
 * change, soft delete with an actionable RESTRICT panel (delete/re-point blocking
 * fields), and a Recently Deleted section. All mutations go through the server
 * actions in app/actions/categories.ts; reorder writes a midpoint position.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
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
  createCategory,
  renameCategory,
  setCategoryIcon,
  reorderCategory,
  deleteCategory,
  restoreCategory,
  purgeCategory,
  type BlockingField,
  type CategoryResult,
} from "@/app/actions/categories";
import { deleteField, repointField } from "@/app/actions/schema-fields";
import {
  SUGGESTED_CATEGORIES,
  CURATED_EMOJI,
  DEFAULT_CATEGORY_ICON,
} from "@/lib/categories";
import { MAX_NAME_LENGTH } from "@/lib/validation";
import { midpointPosition } from "@/lib/ordering";

export type Category = {
  id: string;
  name: string;
  icon: string | null;
  position: number;
  /** Live subject count in this category (for the delete confirmation). */
  subjectCount: number;
  /** Up to 3 sample subject names shown in the delete confirmation. */
  subjectSample: string[];
};
export type DeletedCategory = { id: string; name: string };

type Props = {
  worldId: string;
  categories: Category[];
  deletedCategories: DeletedCategory[];
};

export function CategoryManager({ worldId, categories, deletedCategories }: Props) {
  // Local mirror so drag reordering is instant; resync (during render, the React-
  // sanctioned way) when the server data changes after a mutation/revalidate.
  const [items, setItems] = useState(categories);
  const [syncedFrom, setSyncedFrom] = useState(categories);
  if (syncedFrom !== categories) {
    setSyncedFrom(categories);
    setItems(categories);
  }

  const [, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((c) => c.id === active.id);
    const newIndex = items.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    const before = reordered[newIndex - 1]?.position ?? null;
    const after = reordered[newIndex + 1]?.position ?? null;
    const position = midpointPosition(before, after);

    reordered[newIndex] = { ...reordered[newIndex], position };
    setItems(reordered);

    const fd = new FormData();
    fd.set("worldId", worldId);
    fd.set("categoryId", String(active.id));
    fd.set("position", String(position));
    startTransition(() => {
      void reorderCategory(fd);
    });
  }

  return (
    <div className="space-y-6">
      <CreateCategoryForm worldId={worldId} categories={items} />

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 px-6 py-10 text-center text-sm text-neutral-500 dark:border-neutral-700">
          No categories yet. Add one above, or pick a suggestion.
        </p>
      ) : (
        <DndContext
          id="category-list"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={items.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
              {items.map((category) => (
                <CategoryRow
                  key={category.id}
                  worldId={worldId}
                  category={category}
                  categories={items}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <RecentlyDeletedCategories worldId={worldId} categories={deletedCategories} />
    </div>
  );
}

function CreateCategoryForm({
  worldId,
  categories,
}: {
  worldId: string;
  categories: Category[];
}) {
  const [icon, setIcon] = useState(DEFAULT_CATEGORY_ICON);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // A suggestion hides once a live category matches its name+icon exactly; editing
  // either (rename or icon change) breaks the match and brings the suggestion back.
  const taken = new Set(
    categories.map((c) => `${c.name.trim().toLowerCase()}|${c.icon ?? DEFAULT_CATEGORY_ICON}`),
  );
  const availableSuggestions = SUGGESTED_CATEGORIES.filter(
    (s) => !taken.has(`${s.name.trim().toLowerCase()}|${s.icon}`),
  );

  function submit(name: string, withIcon: string) {
    const fd = new FormData();
    fd.set("worldId", worldId);
    fd.set("name", name);
    fd.set("icon", withIcon);
    startTransition(async () => {
      const result = await createCategory(fd);
      if (result.error) {
        setError(result.error);
      } else {
        setError("");
        if (inputRef.current) inputRef.current.value = "";
        setIcon(DEFAULT_CATEGORY_ICON);
      }
    });
  }

  return (
    <div className="space-y-3">
      <form
        action={(fd) => submit(String(fd.get("name") ?? ""), icon)}
        noValidate
        className="space-y-2"
      >
        <div className="flex items-stretch gap-2">
          <EmojiPicker value={icon} onPick={setIcon} />
          <input
            ref={inputRef}
            type="text"
            name="name"
            required
            maxLength={MAX_NAME_LENGTH}
            placeholder="Add a category"
            aria-label="Category name"
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

      <div className="flex flex-wrap gap-1.5">
        {availableSuggestions.map((s) => (
          <button
            key={s.name}
            type="button"
            disabled={pending}
            onClick={() => submit(s.name, s.icon)}
            className="rounded-full border border-neutral-200 px-2.5 py-1 text-xs text-neutral-600 transition hover:-translate-y-px hover:border-neutral-400 hover:text-neutral-900 disabled:opacity-50 dark:border-neutral-800 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:text-neutral-100"
          >
            {s.icon} {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function EmojiPicker({
  value,
  onPick,
}: {
  value: string;
  onPick: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Choose an icon"
        className="h-full rounded-md border border-neutral-300 px-3 text-base transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
      >
        {value}
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 grid w-64 grid-cols-8 gap-1 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
          {CURATED_EMOJI.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onPick(emoji);
                setOpen(false);
              }}
              className="rounded p-1 text-lg transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type RowMode = "view" | "rename" | "confirm-delete" | "blocked";

function CategoryRow({
  worldId,
  category,
  categories,
}: {
  worldId: string;
  category: Category;
  categories: Category[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: category.id });
  const [mode, setMode] = useState<RowMode>("view");
  const [blockers, setBlockers] = useState<BlockingField[]>([]);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  function runDelete() {
    const fd = new FormData();
    fd.set("worldId", worldId);
    fd.set("categoryId", category.id);
    startTransition(async () => {
      const result = await deleteCategory(fd);
      if (result.blockers && result.blockers.length > 0) {
        setBlockers(result.blockers);
        setMode("blocked");
      } else if (result.error) {
        setError(result.error);
      } else {
        setMode("view");
      }
    });
  }

  if (mode === "rename") {
    return (
      <li ref={setNodeRef} style={style} className="px-4 py-3">
        <RenameCategoryForm
          worldId={worldId}
          category={category}
          onDone={() => setMode("view")}
        />
      </li>
    );
  }

  if (mode === "confirm-delete") {
    return (
      <li ref={setNodeRef} style={style} className="px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            Delete <span className="font-medium">{category.name}</span>?
            {category.subjectCount > 0 ? (
              <>
                {" "}
                Its {category.subjectCount}{" "}
                {category.subjectCount === 1 ? "subject" : "subjects"}
                {category.subjectSample.length > 0 && (
                  <> ({category.subjectSample.join(", ")}
                  {category.subjectCount > category.subjectSample.length ? ", …" : ""})</>
                )}{" "}
                {category.subjectCount === 1 ? "goes" : "go"} with it.
              </>
            ) : null}{" "}
            It moves to Recently Deleted — restore within 30 days.
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

  if (mode === "blocked") {
    return (
      <li ref={setNodeRef} style={style} className="px-4 py-3">
        <BlockedDeletePanel
          worldId={worldId}
          category={category}
          blockers={blockers}
          categories={categories}
          onRetry={runDelete}
          onCancel={() => setMode("view")}
          retrying={pending}
        />
      </li>
    );
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-4 py-3"
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        className="cursor-grab touch-none text-neutral-300 transition hover:text-neutral-500 active:cursor-grabbing dark:text-neutral-600"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <span aria-hidden className="text-base">
        {category.icon ?? DEFAULT_CATEGORY_ICON}
      </span>
      <Link
        href={`/worlds/${worldId}/categories/${category.id}`}
        className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900 underline-offset-4 transition hover:underline dark:text-neutral-100"
      >
        {category.name}
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

function RenameCategoryForm({
  worldId,
  category,
  onDone,
}: {
  worldId: string;
  category: Category;
  onDone: () => void;
}) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => {
        fd.set("worldId", worldId);
        fd.set("categoryId", category.id);
        startTransition(async () => {
          const result = await renameCategory(fd);
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
          defaultValue={category.name}
          required
          autoFocus
          maxLength={MAX_NAME_LENGTH}
          aria-label="Category name"
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

function BlockedDeletePanel({
  worldId,
  category,
  blockers,
  categories,
  onRetry,
  onCancel,
  retrying,
}: {
  worldId: string;
  category: Category;
  blockers: BlockingField[];
  categories: Category[];
  onRetry: () => void;
  onCancel: () => void;
  retrying: boolean;
}) {
  const [, startTransition] = useTransition();
  const otherCategories = categories.filter((c) => c.id !== category.id);

  function removeField(fieldId: string) {
    const fd = new FormData();
    fd.set("worldId", worldId);
    fd.set("fieldId", fieldId);
    startTransition(() => {
      void deleteField(fd);
    });
  }

  function repoint(fieldId: string, targetCategoryId: string) {
    if (!targetCategoryId) return;
    const fd = new FormData();
    fd.set("worldId", worldId);
    fd.set("fieldId", fieldId);
    fd.set("targetCategoryId", targetCategoryId);
    startTransition(() => {
      void repointField(fd);
    });
  }

  return (
    <div className="space-y-3 rounded-md bg-amber-50 p-3 dark:bg-amber-950/40">
      <p className="text-sm text-amber-900 dark:text-amber-200">
        <span className="font-medium">{category.name}</span> can’t be deleted yet —
        these fields link to it. Delete or re-point each, then delete again.
      </p>
      <ul className="space-y-2">
        {blockers.map((b) => (
          <li
            key={b.fieldId}
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-amber-200 bg-white px-3 py-2 text-sm dark:border-amber-900 dark:bg-neutral-900"
          >
            <span className="text-neutral-700 dark:text-neutral-300">
              <span className="font-medium">{b.fieldName}</span> on {b.categoryName}
            </span>
            <div className="flex items-center gap-2">
              <select
                aria-label="Re-point to category"
                defaultValue=""
                onChange={(e) => repoint(b.fieldId, e.target.value)}
                className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
              >
                <option value="" disabled>
                  Re-point to…
                </option>
                {otherCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeField(b.fieldId)}
                className="rounded px-2 py-1 text-xs text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
              >
                Delete field
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
        >
          {retrying ? "Deleting…" : "Delete category"}
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
  );
}

function RecentlyDeletedCategories({
  worldId,
  categories,
}: {
  worldId: string;
  categories: DeletedCategory[];
}) {
  const [open, setOpen] = useState(false);
  if (categories.length === 0) return null;

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
        Recently deleted ({categories.length})
      </button>
      {open && (
        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {categories.map((c) => (
            <DeletedCategoryRow key={c.id} worldId={worldId} category={c} />
          ))}
        </ul>
      )}
    </div>
  );
}

function DeletedCategoryRow({
  worldId,
  category,
}: {
  worldId: string;
  category: DeletedCategory;
}) {
  const [pending, startTransition] = useTransition();

  function act(fn: (fd: FormData) => Promise<CategoryResult>) {
    const fd = new FormData();
    fd.set("worldId", worldId);
    fd.set("categoryId", category.id);
    startTransition(() => {
      void fn(fd);
    });
  }

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="min-w-0 flex-1 truncate text-sm text-neutral-500 line-through">
        {category.name}
      </span>
      <div className="flex shrink-0 items-center gap-1 text-sm">
        <button
          type="button"
          disabled={pending}
          onClick={() => act(restoreCategory)}
          className="rounded-md px-2 py-1 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        >
          Restore
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => act(purgeCategory)}
          className="rounded-md px-2 py-1 text-neutral-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950 dark:hover:text-red-400"
        >
          Delete now
        </button>
      </div>
    </li>
  );
}
