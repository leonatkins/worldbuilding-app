"use client";

/**
 * Apply-template preview + confirm (step 13, A6). Read-only preview of the
 * categories/fields to be created, then a single "Apply" that runs the
 * undo-on-failure chain (world) or routes to the schema-apply entry (schema).
 * No pre-creation editing — tweaks happen in-world via the existing editors +
 * schema-template merge (A4).
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createWorld } from "@/app/actions/worlds";
import { applySchemaTemplateNew } from "@/app/actions/templates";
import type { TemplateListItem, WorldSnapshot } from "@/lib/templates/types";
import type { World } from "./worlds-list";

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-100";

export function ApplyTemplateDialog({
  template,
  mode,
  worlds,
  selectedWorldId,
}: {
  template: TemplateListItem;
  mode: "world";
  worlds?: never;
  selectedWorldId?: never;
} | {
  template: TemplateListItem;
  mode: "schema";
  worlds: World[];
  selectedWorldId?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(template.name);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [appliedNotice, setAppliedNotice] = useState<string | null>(null);

  const snapshot = template.content;
  if (!snapshot) return null;

  function close() {
    router.push("/");
  }

  if (mode === "schema") {
    return (
      <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/30 px-4 py-16">
        <div className="w-full max-w-lg rounded-lg border border-neutral-200 bg-white p-5 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Apply {template.name}</h2>
            <button type="button" onClick={close} aria-label="Close" className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">
              ✕
            </button>
          </div>
          <SchemaPreview snapshot={snapshot as Extract<typeof snapshot, { kind: "schema" }>} />
          {selectedWorldId ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Create a new category from this template in the selected world.
                {appliedNotice ? "" : " List/Link targets missing in the world auto-create as empty stub categories."}
              </p>
              {appliedNotice && <p className="text-sm text-emerald-600 dark:text-emerald-400">{appliedNotice}</p>}
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      if (!template.content) return;
                      const result = await applySchemaTemplateNew(template.content, selectedWorldId);
                      if (result.error) setError(result.error);
                      else if (result.categoryId) {
                        const stubs = result.createdStubNames?.length
                          ? ` · also created: ${result.createdStubNames.join(", ")}`
                          : "";
                        setAppliedNotice(`Created category${stubs}.`);
                        // Revalidate + jump into the new category so the user lands
                        // on it (the world home was revalidated by the action).
                        router.refresh();
                        router.push(
                          `/worlds/${selectedWorldId}/categories/${result.categoryId}`,
                        );
                      }
                    })
                  }
                  className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
                >
                  {pending ? "Applying…" : "Create new category"}
                </button>
                <Link
                  href={`/?applySchema=${encodeURIComponent(template.id)}`}
                  className="rounded-md px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                >
                  Pick a different world
                </Link>
              </div>
            </div>
          ) : (
            <>
              <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
                Choose a world to apply this template into. A new category is
                created from the template; List/Link targets missing in the world
                auto-create as empty stub categories.
              </p>
              <ul className="mt-3 space-y-1">
                {worlds.map((w) => (
                  <li key={w.id}>
                    <Link
                      href={`/?applySchema=${encodeURIComponent(template.id)}&world=${w.id}`}
                      className="block rounded-md px-3 py-2 text-sm transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      {w.name}
                    </Link>
                  </li>
                ))}
              </ul>
              {appliedNotice && <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{appliedNotice}</p>}
              {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/30 px-4 py-16">
      <div className="w-full max-w-lg rounded-lg border border-neutral-200 bg-white p-5 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Apply {template.name}</h2>
          <button type="button" onClick={close} aria-label="Close" className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">
            ✕
          </button>
        </div>
        <WorldPreview snapshot={snapshot as WorldSnapshot} />
        <div className="mt-4 space-y-2">
          <label className="text-sm text-neutral-600 dark:text-neutral-400">New world name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            aria-label="New world name"
          />
        </div>
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="rounded-md px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const fd = new FormData();
                fd.set("name", name);
                fd.set("startingPoint", "template");
                fd.set("templateId", template.id);
                const result = await createWorld(fd);
                if (result?.error) setError(result.error);
              })
            }
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            {pending ? "Applying…" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}

function WorldPreview({ snapshot }: { snapshot: WorldSnapshot }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-neutral-600 dark:text-neutral-400">
        {snapshot.categories.length} categor{snapshot.categories.length === 1 ? "y" : "ies"} ·{" "}
        {snapshot.categories.reduce((n, c) => n + c.fields.length, 0)} fields total
      </p>
      <ul className="space-y-2">
        {snapshot.categories.map((c, i) => (
          <li key={i} className="rounded-md border border-neutral-200 bg-surface-raised p-3 dark:border-neutral-800">
            <div className="font-medium">
              {c.icon ?? ""} {c.name}
            </div>
            {c.fields.length > 0 && (
              <ul className="mt-1 list-inside list-disc text-neutral-600 dark:text-neutral-400">
                {c.fields.map((f, j) => (
                  <li key={j}>
                    {f.name} <span className="text-xs">· {f.type}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SchemaPreview({ snapshot }: { snapshot: { kind: "schema"; category: { name: string; icon: string | null }; fields: { name: string; type: string }[] } }) {
  return (
    <div className="space-y-2 text-sm">
      <p className="text-neutral-600 dark:text-neutral-400">
        {snapshot.category.icon ?? ""} {snapshot.category.name} · {snapshot.fields.length} field{snapshot.fields.length === 1 ? "" : "s"}
      </p>
      {snapshot.fields.length > 0 && (
        <ul className="list-inside list-disc text-neutral-600 dark:text-neutral-400">
          {snapshot.fields.map((f, i) => (
            <li key={i}>
              {f.name} <span className="text-xs">· {f.type}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
