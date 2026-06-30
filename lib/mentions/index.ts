/**
 * Mention resolution + relationship (backlink) maintenance.
 *
 * Responsibilities:
 * - Resolve mention ids to their current subjects (name, category, deleted state)
 *   for live render — rename-safe, batched one query per page.
 * - On fact save, mirror the fact's mentioned ids into the relationships table so
 *   backlinks ("Referenced by") stay accurate.
 *
 * The relationships table is the single source for backlinks regardless of whether
 * a reference originated from a fact mention or a List/Link field (design §4.4).
 * The field half lives in app/actions/field-values.ts (`syncFieldRelationships`);
 * this is its fact-origin twin.
 *
 * These helpers take the Supabase client as a parameter (matching the field-values
 * helper style) so this module stays free of framework/client imports and the
 * caller owns auth/RLS context.
 *
 * AI hook point: auto-tag suggestions (PRD §7.3) could read a subject's facts +
 * relationships here. NOT built in this phase.
 */
import { mentionedIds } from "@/lib/facts";
// Type-only: pulls the client's shape, not its runtime `cookies()` dependency.
import type { createClient } from "@/lib/supabase/server";

export type RelationshipOrigin = "fact" | "field";

type Supa = Awaited<ReturnType<typeof createClient>>;

/** The minimal subject shape used to render a resolved mention. */
export type ResolvedMention = {
  name: string;
  categoryId: string | null;
  deletedAt: string | null;
};

/**
 * Batch-resolve mention ids to their current subjects. One query, no soft-delete
 * filter — we keep deleted rows so the renderer can tell "soft-deleted" (present,
 * `deletedAt != null`) from "purged" (absent from the map). Empty input → empty map.
 */
export async function resolveMentions(
  supabase: Supa,
  ids: string[],
): Promise<Map<string, ResolvedMention>> {
  const distinct = Array.from(new Set(ids));
  const map = new Map<string, ResolvedMention>();
  if (distinct.length === 0) return map;

  const { data } = await supabase
    .from("subjects")
    .select("id, name, category_id, deleted_at")
    .in("id", distinct);

  for (const row of (data ?? []) as {
    id: string;
    name: string;
    category_id: string | null;
    deleted_at: string | null;
  }[]) {
    map.set(row.id, {
      name: row.name,
      categoryId: row.category_id,
      deletedAt: row.deleted_at,
    });
  }
  return map;
}

/** Convenience single-id wrapper over {@link resolveMentions}. */
export async function resolveMention(
  supabase: Supa,
  id: string,
): Promise<ResolvedMention | null> {
  const map = await resolveMentions(supabase, [id]);
  return map.get(id) ?? null;
}

/**
 * Rebuild the fact-origin relationship rows for one fact: delete-then-insert
 * (idempotent, mirrors `syncFieldRelationships`). One row per distinct mentioned
 * id, skipping self-references; duplicates collapse via the
 * (from,to,origin,fact_id,field_id) unique constraint. No-op when nothing remains.
 */
export async function syncFactRelationships(
  supabase: Supa,
  factId: string,
  fromSubjectId: string,
  body: string,
): Promise<void> {
  await supabase
    .from("relationships")
    .delete()
    .eq("fact_id", factId)
    .eq("origin", "fact");

  const targetIds = mentionedIds(body).filter((id) => id !== fromSubjectId);
  if (targetIds.length === 0) return;

  await supabase.from("relationships").insert(
    targetIds.map((toId) => ({
      from_subject_id: fromSubjectId,
      to_subject_id: toId,
      origin: "fact" as const,
      fact_id: factId,
    })),
  );
}
