# Architecture Review — 2026-06 (through step 7)

A full read of the codebase after steps 5–7 (world CRUD, category + schema
editor, subject CRUD + tags + field values) plus the cross-cutting soft-delete
work (ADR 0005). Scope: confirm the architecture is coherent, the conventions
are applied uniformly, and there are no latent correctness traps before the
facts engine (step 8) lands. Companion to [`open-questions.md`](open-questions.md),
which tracks the decisions and edges this review surfaced.

**Verdict:** healthy. The data-access model, ownership/RLS scheme, and ordering
primitives are consistent across every feature. The issues found are small and
localized (see Findings); none block step 8.

State at review: branch `feat/steps-6-7`, build/lint clean, 32 unit tests green.

---

## 1. Layering

The code holds a clean three-layer separation:

```
app/(app)/**          server components (data load) + client islands (interaction)
app/actions/**        "use server" mutations — the only write path
lib/**                pure domain helpers (no framework, unit-tested) + clients
```

- **Pure domain logic lives in `lib/` and is framework-free** — `ordering.ts`,
  `schema-fields.ts`, `tags.ts`, `field-values.ts`, `validation.ts`,
  `world-names.ts`. Every one is unit-tested in isolation. This is the right
  seam: the rules that are easy to get wrong (tag normalization, scalar
  coercion, midpoint math, field validation) are testable without a DB.
- **Server actions are the sole mutation channel.** Client islands never touch
  Supabase directly for writes; they post `FormData` to `app/actions/*`. Reads
  happen in server components. This keeps RLS-bearing calls server-side and the
  client bundle thin.
- **Server component → client island handoff is assembly-then-render.** The
  subject page (`subjects/[subjectId]/page.tsx`) does all resolution server-side
  (subject, schema, values, list members, tags, backlinks, date vocab) and hands
  a fully-built view model to the client island. The client island owns only
  interaction state. Good split — no waterfall of client fetches.

## 2. Data access (ADR 0004) — "door 1"

Every read and write goes through the Supabase client carrying the user JWT, so
Postgres RLS enforces ownership on every row. Drizzle is schema/migration
blueprint only; it is never used as a query builder at runtime. Confirmed: no
`drizzle` query imports anywhere in `app/`.

This is applied **uniformly** — there is no second access path to audit. The one
consequence to keep in mind: RLS guarantees ownership but *not* soft-delete
filtering (see §4), so `deleted_at IS NULL` is an app-layer obligation.

## 3. Ownership & RLS

- Denormalized `account_id DEFAULT auth.uid()` on every table, with a flat
  own-rows policy per table (`account_id = auth.uid()`). No policy needs a join
  up the ownership tree. Postgres stamps the owner on insert; app code never sets
  `account_id` (verified — no action writes it).
- Inter-table integrity is FK + cascade, defined in the Drizzle schema:
  - Ownership spine cascades on delete (account → worlds → categories →
    subjects → facts/field_values…).
  - `schema_fields.target_category_id` is **RESTRICT** (forces cleanup of a
    List/Link field before its target category can be hard-deleted).
  - `field_values.linked_subject_id` is **SET NULL** (no orphan rows; a deleted
    link target renders as "(deleted)").
- Tag uniqueness is the one expression index drizzle can't model
  (`UNIQUE (world_id, lower(name))`), hand-added in migration 0004. Correctly
  documented in the schema comment.

## 4. Soft delete (ADR 0005)

- `deleted_at timestamptz NULL` on worlds, categories, subjects. NULL = live.
- Reads filter through shared helpers `activeOnly`/`deletedOnly`
  (`lib/db/soft-delete.ts`), which keeps the filter spelled the same way
  everywhere instead of scattered `.is("deleted_at", null)` calls.
- **Soft-deleting a parent only hides it** — children are not touched, so restore
  is lossless. Only the 30-day `pg_cron` purge does a real CASCADE delete.
- Read-coverage audit: list/resolve reads for worlds, categories, subjects, and
  reference resolution (backlink/list/link target names) all filter to active
  rows. **One gap found** — the subject page resolves its *own* category by id
  without the active filter (Finding F1).

## 5. Ordering

`position double precision` with midpoint insertion (`lib/ordering.ts`,
`midpointPosition`). Drag-reorder (dnd-kit) sets only the moved row's position to
the average of its new neighbors — one update, no mass renumber. Edge cases
(empty, head, tail) are handled and unit-tested. Float halving is effectively
inexhaustible for human-scale lists; a rebalance path is noted but not needed.

Subject list ordering is intentionally *client-side localStorage* (last
edited / A–Z / Z–A), not a DB `position` — subjects are not hand-ordered, so this
avoids write churn. Consistent with the worlds-list pattern from step 5.

## 6. Field values — hybrid storage

The 10 field types map onto three storage shapes:

- **scalar** → `field_values.scalar_value` (jsonb), coerced + validated server-
  side by `coerceScalarValue` (Number numeric, Scale in bounds, Select ∈ options,
  MultiSelect ⊆ options, etc.). The field's type/config is **re-read from the DB**
  in the action (`loadField`) and never trusted from the client — correct.
- **Link** → `linked_subject_id` (single).
- **List** → `list_value_subjects` join rows.

`relationships` (backlinks) are kept in sync for Link/List by **delete-then-
insert** of that one `(subject, field)`'s `origin='field'` rows — idempotent, and
scoped so it never disturbs other fields or fact-origin rows. Empty value =
delete the `field_values` row entirely (clean "hide empty" semantics).

Backlinks render **grouped by source field name** — deliberately no inverse
grammar (avoids the "Mentored by" agreement bug). Solid call.

## 7. Conventions held uniformly

- **No `any`.** Confirmed across `lib/` and `app/` — `unknown` + narrowing is
  used at the Supabase embed boundaries (e.g. tag-embed rows).
- **No stray `console.*`** in app/lib.
- Name validation funnels through `validateName` (trim / required / ≤100)
  everywhere a name is created or renamed.
- Overlay constraint respected: creation/editing is inline or in non-covering
  popovers; only the destructive counted-confirm (category change clearing
  values) blocks, which is the sanctioned "critical alert" exception.
- Migrations follow the "drizzle-generate + hand-append RLS/indexes/pg_cron"
  pattern, with the rename split into non-interactive steps (0002 add / 0003
  drop) to avoid the drizzle-kit TTY prompt.

## 8. Findings

Severity: 🟡 fix before it bites · 🟢 minor / cosmetic. Full detail and
proposed handling for each live in [`open-questions.md`](open-questions.md).

- **F1 🟡 — subject page resolves its category without `activeOnly`.**
  `page.tsx` loads the subject's own category by id with no `deleted_at` filter,
  so a subject whose category was soft-deleted still renders the category name /
  back-link as if live. The subject *should* arguably 404 or show a "category
  deleted" state. Low blast radius (the category list dropdown is filtered, so
  you can't easily reach this), but it's the one inconsistent read.

- **F2 🟢 — field-value writes don't bump `subjects.updated_at`.** Editing a
  field value upserts `field_values` but never touches the parent subject's
  `updated_at`. The "Last edited" subject sort (and the future global dashboard's
  "recently edited") won't reflect value edits. Decide whether value edits count
  as editing the subject (they almost certainly should).

- **F3 🟢 — `field_values.updated_at` not bumped on upsert.** The column exists
  with `defaultNow()` but upsert doesn't set it on conflict, so it reflects
  create time, not last write. Harmless today (nothing reads it); fix when
  anything depends on per-value recency.

- **F4 🟢 — `pg_cron` availability is unverified at runtime.** The purge job is
  best-effort behind a defensive `DO` block with an exception handler, so a
  missing extension fails silently. Recently Deleted will simply never
  auto-empty if cron isn't enabled. Needs a one-time confirm on the cloud project
  + a documented manual-purge fallback.

- **F5 🟢 — scalar editor "Done" without "Save" silently drops input.** In the
  inline scalar editors, dismissing the editor without an explicit save discards
  the typed value with no autosave/warning. Minor now; matters more once facts
  autosave (memory `fact_draft_autosave`) sets the expectation that typing is
  never lost.

- **F6 🟢 — global "+ New subject" doesn't expand the category sub-menu.** When
  no category is in the URL, the grilled design called for the create menu to
  expand a category picker in-place; today it routes to the world home instead.
  Functional, just not the full Q7 affordance.

These are catalogued (not fixed) by intent — the goal for this pass was a review
+ a durable open-questions list, not a remediation sweep.

## 9. Readiness for step 8 (facts)

The pieces step 8 needs already exist and are sound:

- `relationships` table with an `origin` discriminator (`fact` vs `field`) — the
  fact-mention path slots in alongside the working field path; the delete-then-
  insert sync pattern transfers directly.
- `facts` table with `position` (same dnd-kit midpoint reorder as categories/
  fields).
- ADR 0001 (`@{id}` markers, names never stored) is encoded in the schema.
- Subject page is already the assembly point a facts block drops into.

No refactor is required before step 8. Address F1 opportunistically; the rest are
trackable debt.
