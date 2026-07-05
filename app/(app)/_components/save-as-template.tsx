"use client";

/**
 * Save-as-template trigger (step 13, A7). Inline button that prompts for a
 * template name (defaulting to the source name), then calls the matching
 * save-from-source server action. Two entry points share this: a category's
 * schema page (schema template) and the world home (world template).
 */
import { useState, useTransition } from "react";
import {
  saveCategoryAsTemplate,
  saveWorldAsTemplate,
} from "@/app/actions/templates";
import { MAX_NAME_LENGTH } from "@/lib/validation";

const inputClass =
  "min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-100";

export function SaveAsTemplateButton({
  kind,
  sourceId,
  defaultName,
}: {
  kind: "schema" | "world";
  sourceId: string;
  defaultName: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const fd = new FormData();
    fd.set("name", name);
    if (kind === "schema") {
      fd.set("categoryId", sourceId);
      startTransition(async () => {
        const r = await saveCategoryAsTemplate(fd);
        if (r.error) setError(r.error);
        else setOpen(false);
      });
    } else {
      fd.set("worldId", sourceId);
      startTransition(async () => {
        const r = await saveWorldAsTemplate(fd);
        if (r.error) setError(r.error);
        else setOpen(false);
      });
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-neutral-500 underline-offset-4 transition hover:text-neutral-900 hover:underline dark:hover:text-neutral-100"
      >
        Save as template
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-stretch gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_NAME_LENGTH}
          aria-label="Template name"
          autoFocus
          className={inputClass}
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-3 text-sm text-neutral-600 transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
