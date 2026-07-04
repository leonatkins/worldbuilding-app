"use server";

/**
 * World-scoped search (step 12, PRD §6.8). Searches three sources, unioned into
 * one flat list of matching subjects:
 *   1. subject names,
 *   2. fact text — literal substring, plus the dual match (ADR 0001, design §4.1):
 *      a fact whose `@{id}` marker points at a subject whose *name* matches, even
 *      though that name is never stored in the fact's bytes,
 *   3. schema field values — matched on both the field's name and its value
 *      (`"<Field>: <value>"`), with Link/List resolving through the linked
 *      subject's current name (the same dual-match idea extended to fields).
 *
 * Filters: category (any-of / OR) and tag (all-of / AND), combinable with the
 * query. With no query (or a 1-char query) and no filters it lists the world's
 * subjects, most-recently-updated first, capped — the page's default browse view.
 *
 * There is no full-text index yet (PRD §6.8 is plain substring/dual-match). Fact
 * bodies and field values need mention/format resolution before they're
 * comparable to free text, so — like `fuzzyMatchFields` (step 11) — matching is
 * done by loading the world's rows and filtering in JS rather than in SQL. Fine
 * at this app's scale; a `to_tsvector` index is the future optimization (see the
 * AI/search hook note in design §7).
 */
import { createClient } from "@/lib/supabase/server";
import { activeOnly } from "@/lib/db/soft-delete";
import { MENTION_PATTERN, mentionedIds } from "@/lib/facts";
import { formatScalarValue } from "@/lib/field-values";
import type { FieldType } from "@/lib/schema-fields";
import { MIN_QUERY_LENGTH, type SearchArgs, type SearchOutcome } from "@/lib/search";

/** Default cap on results (the browse view and the full search page). */
const DEFAULT_LIMIT = 100;
/** Default cap on the header dropdown preview. */
const PREVIEW_LIMIT = 8;

/** Full search used by the /search page: query + category (OR) + tag (AND) filters. */
export async function searchWorld(
  worldId: string,
  args: SearchArgs,
): Promise<SearchOutcome> {
  return runWorldSearch(worldId, {
    query: args.query,
    categoryIds: args.categoryIds,
    tagIds: args.tagIds,
    limit: args.limit ?? DEFAULT_LIMIT,
  });
}

/** Lightweight, filter-less search for the persistent header dropdown. */
export async function searchWorldPreview(
  worldId: string,
  query: string,
  limit: number = PREVIEW_LIMIT,
): Promise<SearchOutcome> {
  return runWorldSearch(worldId, { query, categoryIds: [], tagIds: [], limit });
}

type Subject = {
  id: string;
  name: string;
  category_id: string;
  updated_at: string;
  category: { name: string } | null;
};

type Match = { nameMatch: boolean; snippet?: string };

async function runWorldSearch(
  worldId: string,
  args: { query: string; categoryIds: string[]; tagIds: string[]; limit: number },
): Promise<SearchOutcome> {
  const { categoryIds, tagIds, limit } = args;
  const q = args.query.trim().toLowerCase();
  const hasQuery = q.length >= MIN_QUERY_LENGTH;
  const supabase = await createClient();

  // Universe: every live subject in the world (+ its category name).
  const { data: subjRows } = await activeOnly(
    supabase
      .from("subjects")
      .select("id, name, category_id, updated_at, category:categories(name)")
      .eq("world_id", worldId),
  );
  const subjects = (subjRows ?? []) as unknown as Subject[];
  const nameById = new Map(subjects.map((s) => [s.id, s.name]));

  // Tag membership, only needed when a tag filter is active (AND semantics).
  let tagsBySubject: Map<string, Set<string>> | null = null;
  if (tagIds.length > 0) {
    const { data: st } = await supabase
      .from("subject_tags")
      .select("subject_id, tag_id, tags!inner(world_id)")
      .eq("tags.world_id", worldId);
    tagsBySubject = new Map();
    for (const row of (st ?? []) as { subject_id: string; tag_id: string }[]) {
      const set = tagsBySubject.get(row.subject_id) ?? new Set<string>();
      set.add(row.tag_id);
      tagsBySubject.set(row.subject_id, set);
    }
  }

  const matched = new Map<string, Match>();
  if (hasQuery) {
    await collectMatches(supabase, q, subjects, nameById, matched);
  }

  // Candidate subjects: matches (query) or the whole world (browse), then filters.
  let candidates = hasQuery ? subjects.filter((s) => matched.has(s.id)) : [...subjects];
  if (categoryIds.length > 0) {
    candidates = candidates.filter((s) => categoryIds.includes(s.category_id));
  }
  if (tagIds.length > 0 && tagsBySubject) {
    const tagSet = tagsBySubject;
    candidates = candidates.filter((s) => {
      const held = tagSet.get(s.id);
      return held ? tagIds.every((t) => held.has(t)) : false;
    });
  }

  // Most-recently-updated first; then float an exact name match to the top when
  // there's a query (Array.sort is stable, so the date order holds within ties).
  candidates.sort((a, b) => msOf(b.updated_at) - msOf(a.updated_at));
  if (hasQuery) {
    candidates.sort(
      (a, b) => Number(b.name.toLowerCase() === q) - Number(a.name.toLowerCase() === q),
    );
  }

  const total = candidates.length;
  const results = candidates.slice(0, limit).map((s) => ({
    id: s.id,
    name: s.name,
    categoryName: s.category?.name ?? null,
    snippet: matched.get(s.id)?.snippet,
  }));
  return { results, total };
}

/** Populate `matched` from fact text (literal + dual) and field values. */
async function collectMatches(
  supabase: Awaited<ReturnType<typeof createClient>>,
  q: string,
  subjects: Subject[],
  nameById: Map<string, string>,
  matched: Map<string, Match>,
): Promise<void> {
  // The live universe, scoped by subject id — cleaner than an embedded
  // `subjects!inner` filter and, for field_values, unambiguous (it has two FKs
  // to subjects — subject_id and linked_subject_id — so the embed is not).
  const subjectIds = subjects.map((s) => s.id);

  // 1. Subject names.
  const nameMatchIds = new Set<string>();
  for (const s of subjects) {
    if (s.name.toLowerCase().includes(q)) {
      nameMatchIds.add(s.id);
      matched.set(s.id, { nameMatch: true });
    }
  }

  // 2. Facts — literal substring, unioned with the dual match (a fact mentioning
  // a name-matched subject). Attributed to the fact's owner subject.
  const { data: factRows } = await supabase
    .from("facts")
    .select("subject_id, body")
    .in("subject_id", subjectIds)
    .is("deleted_at", null);
  for (const f of (factRows ?? []) as { subject_id: string; body: string }[]) {
    const literal = f.body.toLowerCase().includes(q);
    const dual = !literal && mentionedIds(f.body).some((id) => nameMatchIds.has(id));
    if (literal || dual) addSnippet(matched, f.subject_id, () => factSnippet(f.body, nameById));
  }

  // 3. Field values — `"<Field>: <value>"`, Link/List resolved through names.
  const { data: fvRows } = await supabase
    .from("field_values")
    .select("id, subject_id, scalar_value, linked_subject_id, schema_fields!inner(name, type)")
    .in("subject_id", subjectIds);
  const fvs = (fvRows ?? []) as unknown as {
    id: string;
    subject_id: string;
    scalar_value: unknown;
    linked_subject_id: string | null;
    schema_fields: { name: string; type: FieldType };
  }[];

  // List members (resolved to names) for the List field values above.
  const listFvIds = fvs.filter((fv) => fv.schema_fields.type === "List").map((fv) => fv.id);
  const membersByFv = new Map<string, string[]>();
  if (listFvIds.length > 0) {
    const { data: lm } = await supabase
      .from("list_value_subjects")
      .select("field_value_id, subject_id")
      .in("field_value_id", listFvIds);
    for (const row of (lm ?? []) as { field_value_id: string; subject_id: string }[]) {
      const name = nameById.get(row.subject_id);
      if (!name) continue; // member soft-deleted / not in the live universe
      const arr = membersByFv.get(row.field_value_id) ?? [];
      arr.push(name);
      membersByFv.set(row.field_value_id, arr);
    }
  }

  for (const fv of fvs) {
    const { name, type } = fv.schema_fields;
    let value = "";
    if (type === "Link") {
      value = fv.linked_subject_id ? (nameById.get(fv.linked_subject_id) ?? "") : "";
    } else if (type === "List") {
      value = (membersByFv.get(fv.id) ?? []).join(", ");
    } else {
      value = formatScalarValue(type, fv.scalar_value);
    }
    const searchable = `${name}: ${value}`;
    if (searchable.toLowerCase().includes(q)) {
      addSnippet(matched, fv.subject_id, () => searchable);
    }
  }
}

/**
 * Record a match for `subjectId`, attaching `snippet` only if the subject isn't
 * already a name match (which needs no snippet) and doesn't already have one.
 */
function addSnippet(matched: Map<string, Match>, subjectId: string, snippet: () => string): void {
  const cur = matched.get(subjectId);
  if (!cur) {
    matched.set(subjectId, { nameMatch: false, snippet: snippet() });
  } else if (!cur.nameMatch && !cur.snippet) {
    cur.snippet = snippet();
  }
}

/** Plain-text fact snippet: `@{id}` markers resolved to current names. */
function factSnippet(body: string, nameById: Map<string, string>): string {
  return body.replace(MENTION_PATTERN, (_m, id: string) => nameById.get(id) ?? "unknown");
}

function msOf(iso: string): number {
  return new Date(iso).getTime();
}
