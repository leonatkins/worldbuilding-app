/**
 * Read-only schema field list on the category page (step 10). All mutation
 * (add/edit/delete/reorder) lives behind the "Edit schema" link, which opens
 * the dedicated /schema route — this view has no editor.
 */
import Link from "next/link";
import type { SchemaField } from "./schema-editor";
import { FIELD_TYPE_LABELS, summarizeField } from "@/lib/schema-fields";

type Cat = { id: string; name: string };

export function SchemaSummary({
  worldId,
  categoryId,
  fields,
  categories,
}: {
  worldId: string;
  categoryId: string;
  fields: SchemaField[];
  categories: Cat[];
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-500">Schema fields</h2>
        <Link
          href={`/worlds/${worldId}/categories/${categoryId}/schema`}
          className="text-sm text-neutral-500 underline-offset-4 transition hover:text-neutral-900 hover:underline dark:hover:text-neutral-100"
        >
          Edit schema
        </Link>
      </div>

      {fields.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 px-6 py-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
          No fields yet. Most subjects do fine with just facts — add a field only
          when you’d filter or compare by its value.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {fields.map((field) => {
            const summary = summarizeField(field, categories);
            return (
              <li key={field.id} className="flex items-center gap-2 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {field.name}
                  </span>
                  <span className="ml-2 text-xs text-neutral-500">
                    {FIELD_TYPE_LABELS[field.type]}
                    {summary ? ` · ${summary}` : ""}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
