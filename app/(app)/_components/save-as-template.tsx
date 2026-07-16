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
  "min-w-0 flex-1 border border-rule bg-surface-raised px-3 py-2 text-sm outline-none transition-colors duration-150 ease-[var(--ease-out)] placeholder:italic placeholder:text-ink-faint focus:border-accent";

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
        className="text-sm text-ink-muted underline-offset-4 transition-colors duration-150 ease-[var(--ease-out)] hover:text-ink hover:underline"
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
          className="bg-ink px-4 text-sm font-medium text-surface transition-[color,background-color,transform] duration-150 ease-[var(--ease-out)] hover:bg-ink-muted active:scale-[0.97] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-3 text-sm text-ink-muted transition-[color,background-color,transform] duration-150 ease-[var(--ease-out)] hover:bg-surface-raised hover:text-ink active:scale-[0.97]"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
