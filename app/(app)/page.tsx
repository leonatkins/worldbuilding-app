/**
 * Home — the account-level landing (step 15a). Above the worlds list it surfaces
 * two recency blocks — Recently viewed (from `subject_views` view history, ADR
 * 0012) and Recently edited (subjects by `updated_at`) — both cross-world and
 * live-only, hidden when empty so new accounts still land on the worlds list. A
 * light editorial footer (a rotating Tip + What's new) closes it out. The worlds
 * list island (create/rename/delete/Recently Deleted) is reused intact.
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
import { RecentSubjects, type RecentSubject } from "./_components/recent-subjects";
import { HomeTip, WhatsNewPanel } from "./home-editorial";
import { WHATS_NEW } from "@/lib/home";
import type { TemplateListItem } from "@/lib/templates/types";

const RECENCY_LIMIT = 6;

// A subject embedded with just enough to render + a liveness check on it and its
// world (subjects carry a denormalized world_id; a live subject can sit under a
// soft-deleted world). Category/world are to-one FK embeds.
type EmbeddedSubject = {
  id: string;
  name: string;
  world_id: string;
  deleted_at?: string | null;
  categories: { name: string } | null;
  worlds: { name: string; deleted_at: string | null } | null;
};

function toRecent(s: EmbeddedSubject): RecentSubject {
  return {
    id: s.id,
    worldId: s.world_id,
    name: s.name,
    categoryName: s.categories?.name ?? null,
    worldName: s.worlds?.name ?? null,
  };
}

/** Live = the subject and its world are both not soft-deleted. */
function isLive(s: EmbeddedSubject | null | undefined): s is EmbeddedSubject {
  return !!s && !s.deleted_at && !!s.worlds && !s.worlds.deleted_at;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ apply?: string; applySchema?: string; world?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  // Live worlds for the list; soft-deleted ones for the Recently Deleted view
  // (ADR 0005); template metadata for the create dropdown; and the two recency
  // feeds. All RLS-scoped to the signed-in account. We over-fetch the recency
  // rows and filter liveness (subject + world) in JS, then cap — cheaper than
  // fragile embedded-column filters.
  const [{ data: active }, { data: deleted }, templates, { data: viewed }, { data: edited }] =
    await Promise.all([
      activeOnly(supabase.from("worlds").select("id, name, created_at, updated_at")),
      deletedOnly(supabase.from("worlds").select("id, name, deleted_at")),
      listTemplateMetadata(),
      supabase
        .from("subject_views")
        .select(
          "last_viewed_at, subjects!inner(id, name, world_id, deleted_at, categories(name), worlds!inner(name, deleted_at))",
        )
        .order("last_viewed_at", { ascending: false })
        .limit(30),
      activeOnly(
        supabase
          .from("subjects")
          .select("id, name, world_id, categories(name), worlds!inner(name, deleted_at)")
          .order("updated_at", { ascending: false })
          .limit(30),
      ),
    ]);

  const worlds = (active ?? []) as World[];
  const deletedWorlds = (deleted ?? []) as DeletedWorld[];

  const recentlyViewed = ((viewed ?? []) as unknown as { subjects: EmbeddedSubject | null }[])
    .map((r) => r.subjects)
    .filter(isLive)
    .map(toRecent)
    .slice(0, RECENCY_LIMIT);

  const recentlyEdited = ((edited ?? []) as unknown as EmbeddedSubject[])
    .filter(isLive)
    .map(toRecent)
    .slice(0, RECENCY_LIMIT);

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
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Home</h1>
        <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          A world is a collection of subjects; a subject is a collection of facts.
        </p>
      </div>

      {/* Panelled, horizontally-distributed layout: a wide left column (tip,
          recently viewed, worlds) and a right rail (recently edited, what's new).
          Stacks to one column on small screens. */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <HomeTip />
          <RecentSubjects heading="Recently viewed" subjects={recentlyViewed} />
          <div className="space-y-3">
            <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Your worlds
            </h2>
            <WorldsList worlds={worlds} deletedWorlds={deletedWorlds} templates={templates} />
          </div>
        </div>

        <aside className="flex flex-col gap-6">
          <RecentSubjects heading="Recently edited" subjects={recentlyEdited} />
          <WhatsNewPanel whatsNew={WHATS_NEW.slice(0, 3)} />
        </aside>
      </div>

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
