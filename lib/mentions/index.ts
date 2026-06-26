/**
 * Mention resolution + relationship (backlink) maintenance.
 *
 * Responsibilities:
 * - Resolve a mention id to its current subject (name, category) for live render.
 * - On fact save, diff the fact's mentioned ids against the relationships table
 *   and sync rows so backlinks ("Mentioned in") stay accurate.
 * - List/Link schema field values also create relationships, via the same table.
 * - Backlink organization (roadmap step 11): promote selected backlinks into a
 *   List field on the target subject.
 *
 * The relationships table is the single source for backlinks regardless of
 * whether a reference originated from a fact mention or a List/Link field
 * (see design §4.4).
 *
 * STATUS: stub — implemented across roadmap steps 9-11. Depends on lib/db schema
 * (step 4) and lib/facts (step 9).
 *
 * AI hook point: auto-tag suggestions (PRD §7.3) could read a subject's facts +
 * relationships here. NOT built in this phase.
 */

export type RelationshipOrigin = "fact" | "field";

/** Resolve a mention id to its current display name (rename-safe). */
export async function resolveMention(_id: string): Promise<{ id: string; name: string } | null> {
  throw new Error("not implemented: resolveMention (roadmap step 10)");
}

/** Sync the relationships table for a subject after its facts/fields change. */
export async function syncRelationships(_subjectId: string): Promise<void> {
  throw new Error("not implemented: syncRelationships (roadmap step 10)");
}
