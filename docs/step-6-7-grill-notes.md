# Steps 6 + 7 — Grill Notes (working)

**Status:** In progress (grilling 2026-06-28). Converts into `step-6-*-spec.md` +
`step-7-*-spec.md` when complete. Not a final spec — a running capture of decisions
as they crystallize.

Source: [`design.md`](design.md) §4–5 · PRD §5, §6.2, §6.5, §6.7 · ADR 0003
(world identity in URL) · ADR 0004 (data access via Supabase client).

---

## Scope seam — step 6 vs step 7 (Q1, locked)

The subject page and field-value editing were the ambiguity. Resolved split:

- **Step 6 — categories + schema field *definitions* only.**
  - Category CRUD (create/rename/delete/reorder/icon) + schema-field CRUD
    (add/configure/reorder/delete) at a category-scoped route.
  - **No subjects required.** Writes **zero `field_values`.** "Apply-to-subjects"
    is automatic: empty fields are hidden (design §4.2), so a new field definition
    just exists — nothing to backfill per subject.
- **Step 7 — subjects + tags + subject page, *including* inline field-*value* editing.**
  - First step to write `field_values` AND `relationships` (relationships are
    populated from List/Link field values — design §4.2/§4.3).
  - Adds `tags` + `subject_tags` tables (migration #2; deferred from step 4).
  - `!` command (step 11) and facts (step 8) layer onto the subject page later;
    `[+ Add field]` inline value editing is the baseline path built in step 7.

Recorded in ROADMAP step 6/7 rows.

## Routing (Q2, locked) — all under `/worlds/[worldId]` (ADR 0003)

```
/worlds/[worldId]                         world home = CATEGORY MANAGER
                                          (list/create/rename/reorder/icon/delete categories)
/worlds/[worldId]/categories/[categoryId] category page
                                          step 6: schema editor section (this category's fields)
                                          step 7: + subject list for this category
/worlds/[worldId]/subjects/[subjectId]    subject page (step 7)
```

- **Subject URLs are flat** (`/subjects/[id]`), NOT nested under category — a
  subject can change category (PRD §6.5); nesting would break its URL/bookmarks/
  backlinks. Category scopes the *list*, not the subject's canonical address.
- **Schema editor is a section** on the category page, not its own route. Category
  page = "everything about this category" (schema + subjects). Step 6 and step 7
  build the same page incrementally. Route-level inline section → respects no-modals.

## Reorder mechanism (Q3, locked) — categories, schema fields, facts (step 8)

- **Drag-and-drop via `dnd-kit`** for all three (consistent; facts already require
  drag per roadmap step 8). Fully typed (no `any`), keyboard-accessible.
- On drop: set the moved row's `position` (`double precision`) to the **midpoint**
  (average) of its two new neighbors — one `update`, no mass renumber. Float column
  exists precisely to allow infinite halving (design §4.1). Rebalance only if
  precision ever exhausts (not expected).

## Category manager UX (Q4, locked) — on `/worlds/[worldId]`

Mirrors the step-5 worlds-list pattern (inline forms, no modals).

- **Create:** inline name input + emoji + Create.
- **Suggested categories:** quick-pick chips (e.g. Species, Biomes, Events,
  Organizations) that pre-fill name+icon — opt-in, overtypable. Hardcoded, same
  pattern as the default seed (step-5 spec §9).
- **Icon:** small **curated emoji set** (~30 worldbuilding-relevant) in a popover —
  NOT a full emoji-picker dependency. Swappable later.
- **Rename:** inline edit.
- **Validation:** reuse `validateName` (trim, required, max 100, duplicates allowed).
- **Delete — RESTRICT wall (a):** if another category's List/Link field points at
  this category (`schema_fields.target_category_id ON DELETE RESTRICT`), the DB
  blocks the delete. Show an **actionable inline panel** listing each blocking
  field, and per blocker offer to either:
    1. **Delete the blocking field** inline, or
    2. **Re-point it** to a different category.
  Once all blockers cleared, the delete proceeds — no navigation away.
- **Delete — with subjects (b):** two-step inline confirm naming the count
  ("Delete Characters? This permanently removes 12 subjects and their facts.").
  CASCADE handles the rest. (Counts are 0 until step 7.)

## Schema field editor (Q5, locked) — schema section on category page

Add a field = pick `field_type` + fill type-specific config (step-4 typed columns):

| Type | Config collected | Column(s) |
|---|---|---|
| Text, Boolean, Date, Color | none | — |
| Number | optional unit | `unit` |
| Select, Multi-select | option list (≥1) | `select_options text[]` |
| Scale | min + max (min < max) | `scale_min`, `scale_max` |
| List, Link | target category (required; may be self) | `target_category_id` |

- **Add UI:** inline — name + type picker; selecting a type reveals its config
  inputs below. Save appends with `position` after the last field. No modal.
- **Select/Multi-select options:** inline editable list (add/remove/reorder).
- **List/Link target:** `<select>` of the world's categories (self allowed). This
  is what creates the Q4 RESTRICT dependency.
- **Edit existing field:** name/options/scale/unit/target all editable inline later.
- **Type change:** in **step 6, freely changeable** (no values exist yet).
- **Reorder:** drag-and-drop (Q3).

## Subject creation (Q6, locked) — step 7

- **Minimal create:** inline on the category page subject-list section. Collects
  **name only** (category implied by context). Enter → create → **redirect to the
  new subject page** (`/subjects/[id]`). Tags/fields/facts added on the page after.
- Keeps creation ~1 action (speed of capture); new subject opens to empty-but-fine
  page (no blank-page anxiety). Validation: reuse `validateName`.

## Loading UX (Q7, locked) — convention for all new world-scoped routes

- Route-level `loading.tsx` with a **skeleton** (grey placeholder shapes matching
  the page layout), NOT a spinner or white screen. Shown instantly during nav,
  swapped for content. (A skeleton IS the page's loading state — doesn't cover or
  block — fits the overlay constraint.)
- **No theme flash:** base bg on `html`/`body` so the skeleton respects dark/light
  before paint.
- **No tips** on load (pages load <1s; tips → step-14 onboarding panel).

## Creation affordances (Q7, locked) — two-layer system

- **Layer 1 — Global `+`** in the top bar (`app/(app)/layout.tsx`), always present.
  Non-covering popover, context-aware via URL:
  - Always: **New world**
  - Inside a world: **+ New category**, **+ New subject**
  - **Ambiguous "New subject"** (no category in URL): expands to a **category
    sub-menu** in the same popover (option 1) — non-covering, non-blocking.
- **Layer 2 — In-context inline create** on every list:
  - `/` → create-world form (exists) + row "⋯" menu
  - `/worlds/[id]` → inline category create + per-row "⋯" → Add subject / Rename / Delete
  - `/categories/[id]` → inline subject create + schema Add field
  - subject page → tags / fields / facts inline
- Redundancy is deliberate (creation reachable wherever you'd look).

## UI polish principle (project-wide, locked)

Subtle tasteful micro-interactions + motion on EVERY surface as built (not a one-off):
hover/focus/active transitions (faint lift/scale/brighten — buttons "lean in"),
smooth state/entrance animations. Guardrails: subtle + fast (~150ms), respect
`prefers-reduced-motion`, never block, never janky. Skeleton loaders, no flashes.
See memory `feedback_ui_polish_microinteractions` + `emil-design-eng` skill.

## Tags (Q8, locked) — step 7, migration #2 (`0002_tags`)

- **Tables** (step-4 conventions: `account_id DEFAULT auth.uid()`, RLS own-rows,
  drizzle-generate + hand-append):
  - `tags`(id, account_id, world_id FK→worlds CASCADE, name, created_at)
  - `subject_tags`(subject_id FK→subjects CASCADE, tag_id FK→tags CASCADE,
    account_id, created_at, PK(subject_id, tag_id))
- **Uniqueness — breaks from elsewhere:** `UNIQUE (world_id, lower(name))` —
  per-world, **case-insensitive**. (Two `#deceased` in one world = bug, unlike
  subject/category/field names which allow dups.)
- **Storage:** bare name stored; `#` is render-only.
- **Apply on subject:** pills + type-to-add input, autocomplete over world's tags +
  "Create #new" inline (creates tag + links in one go). Remove = pill ×.
- **Rename/delete:** lightweight world-level tag management (rename propagates via
  normalization; delete cascades from subjects). Full tag *browser* (counts,
  click-to-filter) = step 12.

## Subject editing + category change (Q9, locked) — resolves deferred edge #3

- **Name:** inline editable title on subject page (§6.7).
- **Category change:** `<select>` of world's categories on the subject page. Because
  schema_fields are owned by exactly one category, changing category orphans ALL
  field_values (no field is shared across categories).
  - **On change: clear all the subject's `field_values`** (+ their
    `list_value_subjects` + field-origin `relationships`). **Counted blocking
    confirm** (legit critical alert — destroys data): "Move Aragorn to Locations?
    This clears 3 field values set for Characters. Facts and tags are kept."
  - **Facts + tags survive** (not category-bound).
  - **Inbound edge — ACCEPT, don't fix:** other subjects' List/Link fields that
    targeted the old category and point at this subject are left as-is (still a
    valid subject ref; relationship row still correct). Cleaning up inbound
    type-mismatch is disproportionate; revisit only if it bites.

## Field-value editing + relationships (Q11, locked) — step 7

Subject page schema block (§6.7): filled fields read-only, hover→edit affordance,
click→inline edit in place; empty fields hidden behind **[+ Add field]** (lists
category's unfilled fields).

Per-type widget + storage (step-4 hybrid):

| Type | Widget | Stored in |
|---|---|---|
| Text | text input | `scalar_value` jsonb |
| Number | number input (+ `unit` suffix) | `scalar_value` |
| Boolean | toggle | `scalar_value` |
| Select | dropdown of `select_options` | `scalar_value` |
| Multi-select | chip multi-select | `scalar_value` |
| **Date** | **freeform text** (NOT a date picker) + learned autofill | `scalar_value` |
| Scale | slider bounded by `scale_min/max` | `scalar_value` |
| Color | swatch picker | `scalar_value` |
| Link | searchable subject typeahead (single) | `linked_subject_id` |
| List | searchable subject typeahead (multi) | `list_value_subjects` |

- **Date = freeform, the differentiator.** Competitors force Gregorian pickers;
  invented calendars ("3E 2931") need text. PRD §3 forbids calendars/timelines, so
  NO date math/sorting — just consistency help.
  - **Local date-format learner (no AI, no cloud):** autocomplete from the world's
    OWN existing Date-field values (learned vocabulary of eras/months/separators),
    frequency-ranked, all client-side; smarter as more dates entered. v1 = datalist
    suggestions; v2 (defer) = detect format skeleton + pre-fill separators.
- **Link/List picker = searchable typeahead** (resolves design §9 "picker at
  scale"): type-to-filter by name within the TARGET category. Scrollable; may cover
  a little screen (fine) — just no big overlays. Reuses fuzzy-subject-search that
  `@mention` (step 9) needs.
- **`relationships` sync (first writes):** on Link/List save/change/clear,
  **delete-then-insert** that `(subject, field)`'s rows (`origin='field'`,
  `field_id` set, from=this subject, to=each linked). Simple, correct, idempotent;
  step-4 unique constraint guards dupes. Only that one field's rows are rebuilt.
- **Backlinks — NO inverse grammar (avoids the PRD §5 "Mentored by" bug).**
  Default: "Referenced by" section grouping inbound links BY SOURCE FIELD NAME
  ("Mentor → Aragorn, Frodo"); label = forward field name, framed as a role,
  direction shown. **Optional custom `inverse_label` per List/Link field DEFERRED
  to step 10** (Backlink organization) — nullable column added then; until then
  label = forward field name.
- Validation per type: Number numeric; Scale within bounds; Select value ∈ options;
  Multi-select ⊆ options.

## Delete model (Q10, locked) — SOFT DELETE, project-wide → ADR 0005

Replaces "Archive". Users want a decisive red **Delete**; archive == delete + undo.

- **Action "Delete" (red)** → item to **"Recently Deleted"** → restorable → **30-day
  auto-purge** (`pg_cron` hard-delete, which then CASCADEs) + manual "Delete now".
- **Project-wide:** worlds, categories, subjects (chosen over subjects-only).
- **Schema:** `deleted_at timestamptz NULL` (NULL = live) on worlds, categories,
  subjects (subjects: **rename `archived_at` → `deleted_at`**). Added in step-7
  migration `0002` + pg_cron jobs. pg_cron extension must be enabled.
- **Every read filters `deleted_at IS NULL`** (app code / door 1; RLS can't —
  ownership-only + trash view must read deleted rows). Shared helper to standardize.
- **Soft-deleting a parent hides children** (no cascade on soft delete) → **restore
  is lossless**. Only auto-purge does the real CASCADE.
- **Soft-deleted URL 404s**; recover via Recently Deleted view (per level: worlds on
  `/`, categories on category manager, subjects on category page).
- **Step 5 RETROFIT:** `deleteWorld` → soft; `/` gains Recently Deleted + restore.
- Subject list view (was Q10): sort Last edited (default) / Name A–Z / Z–A,
  persisted in `localStorage` (worlds-list pattern); Recently-Deleted toggle.

## Global Dashboard (NEW roadmap step — NOT 6/7) — see memory `project_dashboard`

User idea: an account-level dashboard with **recently viewed** (needs view-history
tracking), **recently edited**, **recently created** — all GLOBAL across every world
— plus **tips, announcements, updates, live events, release notes**. Becomes its own
roadmap step (added to ROADMAP). Recently edited/created use existing
`created_at`/`updated_at` (cross-world reads are fine under RLS). Recently-viewed
needs new storage (view-history) — grilled in that step. Optional hook: start
logging subject views in step 7 so history exists by the time the dashboard ships
(decide in dashboard grill). Tips relocate here (not on load screens).

## Theme / visual identity (deferred, locked) — NOT before step 6

User chose: visual identity / design system done in a **dedicated polish pass near
launch**, not before step 6. Steps 6/7+ built on placeholder neutral Tailwind,
revisited then. Same pass carries the **cute peeking mascot easter egg** (rare,
dismissable, reduced-motion-safe; lean worldbuilding-flavored familiar over generic
skeleton). Meanwhile still apply theme-agnostic micro-interactions during 6/7.
See memory `project_visual_polish_pass`.

## Overlay constraint (project-wide, clarified) — supersedes "no modals"

NOT a modal ban. Constraint: never blur the background, never cover content, never
block access to features behind a dismissable overlay. **Critical alerts** (e.g.
destructive-delete confirms) MAY block. Popovers/inline panels/non-covering floats
all allowed. See memory `feedback_avoid_modals`.

---

## Deferred to step 7 — value-migration edge cases (FULLY NOTED)

These all concern existing `field_values`, which don't exist until step 7. Built/
handled there:

1. **Re-point a List/Link field that already has values** (from Q4a): on re-point,
   **clear that field's existing values** (they reference now-wrong-category
   subjects) — show the affected count in the same panel before confirming.
2. **Change a field's *type* with existing values** (from Q5): incompatible type
   change **clears** the field's values (counted warning); compatible widenings
   (e.g. Select → Multi-select) **migrate** rather than clear. Define the exact
   compatibility matrix in the step-7 spec.
3. **Change a subject's category** (from Q1 seam): the subject's `field_values` for
   fields not present in the new category are orphaned. Handling TBD in step-7
   grill (likely: clear non-matching values, counted warning) — GRILL THIS.

---

## Open / not yet grilled

- Step 7: subject create flow (where, required name+category, optional tags).
- Step 7: subject edit — name, **category change** (+ edge #3 above), archive
  (soft-delete location/restore UX).
- Step 7: subject **list view** (sort by name / last edited; archived filter).
- Step 7: **tags** — migration #2 (`tags`, `subject_tags`), world-scoped, apply/
  remove on subject (pills), rename-in-one-place, world-level tag management,
  tag autocomplete.
- Step 7: **field-value editing** per type incl. List/Link **subject picker at
  scale** (design §9 deferred item lands here), and **`relationships` write/delete**
  maintenance from List/Link values.
- Step 7: migration #2 mechanics (same RLS / `account_id DEFAULT auth.uid()` /
  drizzle-generate + hand-append pattern).
- Both: validation reuse, build/lint/test DoD, docs updates.
