# Step 12 — Search & Filtering

**Status:** Approved (grilled 2026-07-04), shipped
**Roadmap step:** 12
**Depends on:** step 9 (`@mention` markers, `searchSubjectsInWorld`), step 8
(`facts`), step 7 (`field_values`, `list_value_subjects`, tags), step 6
(`schema_fields`)
**Source design:** [`../worldbuilding-prd.md`](../worldbuilding-prd.md) §6.8 ·
[`design.md`](design.md) §4.1 (fact dual-match) ·
[ADR 0001](adr/0001-facts-as-plain-text-with-id-markers.md) (why fact search is a
dual match) · CONTEXT.md (Search)

A world-scoped search over subject names, fact text, and schema field values,
combinable with category and tag filters, plus a tag browser — PRD §6.8. The
search space is a whole world (unbounded), so it follows the existing
debounced-server-round-trip idiom (`searchSubjectsInWorld`), not the
preloaded-client-filter one (`fuzzyMatchFields`). Built as a standalone
`/search` page under a new per-world layout rather than folded into the
category-browse UI, since that UI is expected to change.

---

## 1. Scope
| Capability | Summary |
|---|---|
| **Per-world layout** | New `app/(app)/worlds/[worldId]/layout.tsx` (the first layer with `worldId` in scope) hosts a persistent header search bar across every world page. |
| **Header dropdown** | Debounced typeahead previewing the top ~8 matching subjects from any page; a "See all N results" item + Enter route to the full page. |
| **`/search` page** | URL-state (`q`, repeatable `category`, `tag`) results page: query box, category/tag filter facets, flat subject result list with match snippets. |
| **Search sources** | Subject name (`ilike`), fact text (literal + dual match), and field values (field name *and* value; Link/List resolved through linked subjects' names) — unioned into one flat subject list. |
| **Filters** | Category (multi-select, OR) and tag (multi-select, AND), combinable with the query. |
| **Tag browser** | The `/search` tag-filter list (names + per-tag subject counts) *is* the browser. A "Browse" link per tag in `TagManager` deep-links to `/search?tag=<id>`. |
| **Browse fallback** | No query (or a 1-char query) and no filters → list the world's subjects, most-recently-updated first, capped at 100. |

### Explicitly NOT in this step
- **No full-text index.** Plain substring + dual match, matched by loading the
  world's rows and filtering in JS (like `fuzzyMatchFields`). A `to_tsvector`
  index is a future optimization (design §7 hook).
- **No in-page result highlighting.** A result links to the subject page; facts
  have no URL anchors to deep-link to.
- **No relevance scoring.** Order is most-recently-updated, with an exact
  name match floated to the top when there's a query.
- **No AI/semantic search.** PRD §7 World Q&A is a separate future feature.

---

## 2. Decisions (from grilling)
1. **Surface**: new per-world layout with a persistent header bar; full
   results/filters at `/worlds/[worldId]/search`.
2. **Header behavior**: live debounced (~300ms) dropdown preview from any page,
   min 2 chars; results click straight to a subject; "See all N results" / Enter
   route to `/search`. No filters in the dropdown.
3. **Result shape**: one flat list of subjects. Each shows name + category and a
   snippet saying *why* it matched (fact text, or `"<Field>: <value>"`); a pure
   name match has no snippet.
4. **Sources**: subject name (`ilike`); fact text (literal `ilike`-equivalent
   substring, unioned with the dual match — a fact whose `@{id}` marker points at
   a name-matched subject, ADR 0001); field values (matched on `"<Field>:
   <value>"`, so both the field name and its value hit; Link/List resolve
   through the linked subject's current name).
5. **Category filter**: multi-select, OR.
6. **Tag filter**: multi-select, AND.
7. **Tag browser**: the filter list itself, with counts; a `TagManager` "Browse"
   link deep-links in.
8. **State**: URL `searchParams` — shareable, back-button-safe, server-read.
9. **Live vs submit**: live debounced; both query and filter changes write the
   URL via `router.replace` (not push) so history isn't flooded.
10. **Min query length**: 2. Below that, browse behavior (filters still apply).
11. **Browse fallback**: all subjects, most-recently-updated, capped 100, with a
    "Showing 100 of N" note when truncated.
12. **Soft delete**: excluded everywhere (`deleted_at IS NULL`).
13. **Ranking**: most-recently-updated; exact case-insensitive name match floated
    to the top when there's a query (mirrors `searchSubjectsInWorld`).

---

## 3. Implementation notes
- **`field_values` has two FKs to `subjects`** (`subject_id`, `linked_subject_id`),
  so a `subjects!inner(...)` embed is ambiguous and fails. The search action
  world-scopes facts and field values by `.in("subject_id", <live subject ids>)`
  — the ids are already loaded as the search universe — rather than embedding.
- **`"use server"` export restriction**: the query-length constant and result
  types live in the plain module `lib/search.ts` (a server-action module may
  only export async functions); `app/actions/search.ts` imports them.

---

## 4. Files
- `lib/search.ts` — `MIN_QUERY_LENGTH`, `SearchResult`/`SearchOutcome`/`SearchArgs`.
- `app/actions/search.ts` — `searchWorld` (page) and `searchWorldPreview`
  (header), sharing one `runWorldSearch` core: union of name/fact/field matches,
  filters, browse fallback, ranking.
- `app/(app)/worlds/[worldId]/layout.tsx` — per-world layout with the header bar.
- `app/(app)/worlds/[worldId]/global-search-bar.tsx` — debounced preview dropdown.
- `app/(app)/worlds/[worldId]/search/page.tsx` — server component; reads
  `searchParams`, loads filter facets, renders results.
- `app/(app)/worlds/[worldId]/search/search-filters.tsx` — client query box +
  category/tag facet toggles that write the URL.
- `app/(app)/worlds/[worldId]/tag-manager.tsx` — per-tag "Browse" link.
- `CONTEXT.md` — **Search** glossary entry.

Reused unchanged: `formatScalarValue` (`lib/field-values.ts`), `mentionedIds` /
`MENTION_PATTERN` (`lib/facts`), `activeOnly` (`lib/db/soft-delete`).

---

## 5. Verification
Verified live (Playwright, Claude QA World) in addition to `tsc`/lint/build:
- Header dropdown: 1 char shows nothing; 2+ shows matches from any page; a
  fact-mention dual match surfaces the owning subject with the resolved snippet
  (e.g. "Aaron" via a fact mentioning `@Legolas`); "See all N results" routes to
  `/search?q=…`.
- `/search`: name, literal-fact, and dual-match queries; field search on both a
  value substring and the field name; category OR; tag AND; browse-all fallback
  with recency order; URL reflects and reproduces state.
- `TagManager` "Browse" lands on `/search` pre-filtered to that tag.
- Soft-deleted subjects never appear.
