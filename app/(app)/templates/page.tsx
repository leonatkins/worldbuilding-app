/**
 * Template library (step 13). Lists built-in + the user's private templates,
 * with apply, save-as, edit-in-place, new-blank, and delete entries. Routed at
 * /templates. Built-ins are read-only (no delete/edit); private templates are
 * fully editable (A8/A8b).
 */
import Link from "next/link";
import { listTemplates } from "@/app/actions/templates";
import { TemplateLibrary } from "./template-library";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const templates = await listTemplates();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <div className="space-y-1">
        <Link
          href="/"
          className="text-sm text-neutral-500 underline-offset-4 transition hover:text-neutral-800 hover:underline dark:hover:text-neutral-200"
        >
          ← All worlds
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Templates</h1>
        <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          A template is a reusable structure: a single category&apos;s fields (schema)
          or a whole world&apos;s categories (world). Apply one to skip the scaffolding,
          or save your own to reuse later.
        </p>
      </div>

      <TemplateLibrary templates={templates} />
    </main>
  );
}
