# Step 9 — @mention Autocomplete

**Status:** Approved (grilled 2026-06-30)
**Roadmap step:** 9
**Depends on:** step 8 (facts engine), step 7 (subjects, field-origin `relationships`),
step 4 (`facts`, `relationships` tables)
**Source design:** [`design.md`](design.md) §4.1, §4.3 · CONTEXT.md (Mention,
Backlink) · [ADR 0001](adr/0001-facts-as-plain-text-with-id-markers.md) (plain
text + `@{id}`) · [ADR 0005](adr/0005-soft-delete-recently-deleted.md) /
[ADR 0006](adr/0006-ancestor-reachability-tombstone.md) (soft delete /
reachability) · [ADR 0007](adr/0007-mention-input-handrolled-contenteditable.md)
(hand-rolled mention input)

Turns a fact's plain text into a live reference graph: type `@` to mention any
subject in the world, see mentions render as live-named links, and see the
inbound view ("Referenced by") on every subject. Implements `lib/facts` and the
fact half of `lib/mentions`, both stubbed since step 4.

---

## 1. Scope
| Capability | Summary |
|---|---|
| **Mention input** | Constrained `contentEditable` (ADR 0007): text nodes + atomic mention chips showing the live name. Replaces the step-8 plain-textarea composer/editor. |
| **Typeahead** | `@` at a word boundary opens a caret-anchored, non-covering popover; world-scoped subject search; pick inserts a chip. |
| **Live render** | Stored `@{id}` renders as a bold link to the subject; resolved live (rename-safe), batched one query per page. |
| **Deleted / purged mentions** | Soft-deleted target → grayed, click → **Restore**; purged target (id unresolvable) → "unknown/deleted", click → **Replace** with another subject. |
| **Hover tooltip** | Hovering a mention (or a backlink) shows a small popover: the subject's category + its filled schema fields. Lazy-fetched on hover, cached. |
| **Relationships** | `createFact`/`updateFact` rebuild `origin:'fact'` rows (delete-then-insert); drives backlinks. |
| **Backlinks ("Referenced by")** | Right side-rail on the subject page, grouped by source subject, combining fact + field origins. |

### Explicitly NOT in this step
- **No create-on-mention.** A no-match query stays literal `@text` (no chip, no
  new subject). Inline create is deferred (pairs with the `!` create-field flow,
  step 11).
- **No backlink organization / promote-to-List** — that is step 10.
- **No fact search / dual-match** — step 12 (ADR 0001 records the consequence).
- No cross-world mentions (a world is a closed reference graph).

---

## 2. Fact text model — `lib/facts`
Implements the existing stub. `body` is unchanged from ADR 0001: plain text with
`@{id}` markers; **any** `@{id}` in the body is a mention (no provenance tracking,
no escaping — a hand-typed `@{…}` is treated as a mention and simply renders
"unknown/deleted" if it doesn't resolve).

- `MENTION_PATTERN = /@\{([^}]+)\}/g` (exists).
- `parseFact(body): FactToken[]` — ordered `{type:'text'} | {type:'mention', id}`.
- `serializeFact(tokens): string` — inverse; chips → `@{id}`, text verbatim.
- `mentionedIds(body): string[]` — distinct ids, source for relationship sync.
- Pure, synchronous, unit-tested (no name resolution here — that is `lib/mentions`).

## 3. Mention resolution + relationships — `lib/mentions`
- **Batch resolve:** `resolveMentions(ids): Map<id, {name, category, deletedAt}>`
  — one `select id, name, category_id, deleted_at from subjects where id in (…)`.
  Ids absent from the map = purged → render placeholder. Replaces the per-id
  `resolveMention` stub shape (kept as a thin wrapper if needed).
- **Sync (fact origin):** on `createFact`/`updateFact`, `syncFactRelationships`
  mirrors step-7's `syncFieldRelationships`: `delete where fact_id = X and
  origin='fact'`, then insert one row per distinct mentioned id. **Skip
  self-references** (`from == to`); duplicates collapse (distinct ids + the
  `(from,to,origin,fact_id,field_id)` unique constraint).
- No relationship mutation on `deleteFact`/`restoreFact` — rows persist; reads
  filter (§6). `purgeFact` hard-deletes the fact → rows CASCADE away.

## 4. Mention input — constrained `contentEditable` (ADR 0007)
Replaces the step-8 textarea in both the **composer** (new fact) and the inline
**editor** (existing fact).
- Two node kinds only: text nodes + `<span data-mention-id contentEditable={false}>`
  chips rendering the live name. `paste` coerced to `text/plain`.
- **Load:** `parseFact(body)` + `resolveMentions` → build chips.
- **Save:** `serializeFact(childNodes)` → `@{id}` string → `createFact`/`updateFact`.
- **Draft (never-lose-typing, memory `fact_draft_autosave`):** the *serialized*
  `@{id}` string is persisted to `localStorage` (`fact-draft:{subjectId}`) for a
  **new** fact only; restored via `parseFact` + resolve on reload. Edits keep no
  draft (revert-on-dismiss, unchanged from step 8).

### Typeahead
- **Trigger:** `@` at a word boundary (start or after whitespace); query = chars
  after `@` to the caret. Anchored to the caret rect; non-covering popover.
- **Search:** new `searchSubjectsInWorld(worldId, query, limit=10)` —
  `world_id`, `deleted_at IS NULL`, `ilike name`; empty query → 10 most
  recently-edited (`updated_at desc`), else alphabetical. ~150ms debounce.
- **Exact-name match** ranks first / sole; identical names (allowed) → show all
  matches to disambiguate.
- **Keyboard:** ↑/↓ move, Enter/Tab pick, **Esc / space / outside-click** dismiss
  to literal `@query`. Typeahead-open captures Enter so picking never triggers the
  composer's Enter-to-save. Combobox a11y (`role=listbox/option`,
  `aria-activedescendant`).
- **No match:** "No matches"; `@text` left as literal text (create deferred).

## 5. Live render of a mention
Per resolved state, from the batched map:
- **Live:** bold link → subject page.
- **Soft-deleted:** grayed, non-link; click → inline Restore popover (calls
  `restoreSubject`; non-covering, not a modal).
- **Purged (absent from map):** muted "unknown/deleted"; click → Replace popover
  (subject search → rewrites that `@{id}` in the body via `updateFact`).
- **Hover (any state with a known subject):** lazy tooltip — category + filled
  schema fields (hide-empty, same rule as the subject page), cached per subject.

## 6. Backlinks — "Referenced by"
- **Placement:** right **side-rail** on the subject page (stacks below main
  content on narrow screens); hidden entirely when empty.
- **Shape:** grouped by **source subject** (one entry per referencing subject),
  combining fact + field origins into one list; entry = subject name (link) +
  category, with the same hover tooltip as mentions.
- **Read filter (Option A):** the backlinks query joins source fact and source
  subject and requires **both** `deleted_at IS NULL`. A soft-deleted source hides;
  Restore brings it back automatically; purge has already CASCADEd the row. No
  delete/restore-time bookkeeping.

## 7. Files
- `lib/facts/index.ts` — implement `parseFact`/`serializeFact`/`mentionedIds` (+ tests).
- `lib/mentions/index.ts` — `resolveMentions`, `syncFactRelationships`.
- `app/actions/subjects.ts` — add `searchSubjectsInWorld`.
- `app/actions/facts.ts` — call `syncFactRelationships` in `createFact`/`updateFact`;
  add a `replaceMention`/body-rewrite path for the purged-Replace action.
- `…/subjects/[subjectId]/` — new mention editor component (chips + typeahead),
  rendered mention component (states + tooltip), backlinks side-rail; wire into
  `facts-list.tsx` / `subject-page.tsx`; `page.tsx` loads backlinks + batched
  mention names.

## 8. Verification
- **Round-trip:** `serializeFact(parseFact(body)) === body` (unit, incl. multiple
  + adjacent markers, no markers).
- **Typeahead:** `@` → world-wide results; pick → chip; Esc → literal; Enter while
  open does not save the fact.
- **Live render:** rename a mentioned subject → every fact updates with no edit;
  soft-delete it → grayed + Restore works; purge (or fake-missing id) →
  "unknown/deleted" + Replace works.
- **Relationships/backlinks:** mention A from B's fact → A's "Referenced by" lists
  B; remove the mention + save → gone; soft-delete B (or B's fact) → backlink
  hides; restore → reappears; self-mention writes no backlink.
- **Draft:** type a new fact with a mention, reload before save → chips restored.
- **Build:** lint + `tsc` clean (no `any`).
