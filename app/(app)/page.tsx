/**
 * Authenticated home — the worlds list and switcher (step 5). Fetches the user's
 * worlds via the Supabase client (door 1; RLS returns only their own rows) and
 * hands them to the client list island for sorting, creation, rename, and delete.
 *
 * Step 13: world-template apply. `?apply=<templateId>` opens a read-only preview
 * (A6); `?applySchema=<templateId>` routes to the schema-apply picker (chooses
 * a destination world + new-or-merge). Both honor the createWorld undo chain.
 */
import { createClient } from "@/lib/supabase/server";
import { activeOnly, deletedOnly } from "@/lib/db/soft-delete";
import { WorldsList, type World, type DeletedWorld } from "./worlds-list";
import { getTemplate, listTemplateMetadata } from "@/app/actions/templates";
import { ApplyTemplateDialog } from "./apply-template";
import type { TemplateListItem } from "@/lib/templates/types";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ apply?: string; applySchema?: string; world?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  // Live worlds for the list; soft-deleted ones for the Recently Deleted view
  // (ADR 0005). RLS scopes both to the signed-in account.
  const [{ data: active }, { data: deleted }, templates] = await Promise.all([
    activeOnly(supabase.from("worlds").select("id, name, created_at, updated_at")),
    deletedOnly(supabase.from("worlds").select("id, name, deleted_at")),
    // Metadata only — no `content` jsonb — for the create dropdown + count.
    listTemplateMetadata(),
  ]);

  const worlds = (active ?? []) as World[];
  const deletedWorlds = (deleted ?? []) as DeletedWorld[];

  // Lazy: fetch + parse the one template referenced by an apply query param,
  // rather than parsing every private template's full snapshot on every home load.
  let applying: TemplateListItem | null = null;
  let applyingSchema: TemplateListItem | null = null;
  if (sp.apply) {
    const r = await getTemplate(sp.apply);
    if (r.template) applying = r.template;
  } else if (sp.applySchema) {
    const r = await getTemplate(sp.applySchema);
    if (r.template) applyingSchema = r.template;
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Your worlds</h1>
        <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          A world is a collection of subjects; a subject is a collection of facts.
        </p>
      </div>
      <WorldsList worlds={worlds} deletedWorlds={deletedWorlds} templates={templates} />

      {applying && applying.content?.kind === "world" && (
        <ApplyTemplateDialog template={applying} mode="world" />
      )}
      {applyingSchema && applyingSchema.content?.kind === "schema" && (
        <ApplyTemplateDialog
          template={applyingSchema}
          mode="schema"
          worlds={worlds}
          selectedWorldId={sp.world}
        />
      )}
    </main>
  );
}
