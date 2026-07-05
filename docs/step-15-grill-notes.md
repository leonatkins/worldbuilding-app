# Step 15 (final) — Home + Navigation Revamp — Grill Notes

**Status:** Design grilled → building as 15a / 15b / 15c
**Date:** 2026-07-04
**Method:** `/grill-with-docs` (relentless interview → decisions + glossary + ADRs)

## Context

"The final step" before launch. It began as roadmap step 15 ("global dashboard"),
but grilling surfaced two more deferred intentions that belong with it: moving the
UI away from category-folder browsing (memory `project-ui-category-view-revamp`)
and a new global layout. We scoped the **structural** work into this step and
pushed the **visual polish** pass (theme, mascot, chosen style) to a separate
step 16.

Outcome: an account-level **Home**, a 3-tab in-world layout (Overview / Browse /
Manage) with subjects browsed directly (categories become a *filter*, not a
folder), a **⌘K command palette**, and a new `subject_views` table powering
"recently viewed." Built as three reviewable sub-steps.

Source material: ROADMAP step 15; open-questions Q3 (`subjects.updated_at` bumps on
fact/value edits — done in step 8) and Q7 (new-subject category picker); current
home `app/(app)/page.tsx`; schema `lib/db/schema.ts`; the standalone step-12
search. No PRD section exists for this step.

---

## Scope decision

- **Step 15 (structural, this step):** Home + navigation revamp + new global layout
  + remove category *browse* screens.
- **Step 16 (deferred):** visual polish — style/tokens, dark/light theme, skeleton
  mascot, Date v2 / Color swatch, onboarding locational copy, visual-ux-audit
  follow-ups.
- **Launch checklist (not a step):** Q5 `pg_cron` verification (the only real
  blocker), minor Q4/Q7. `to_tsvector` index is a non-blocking future optimization.

---

## Resolved decisions

### Home (account level)
- **Home replaces the worlds list at `/`** as the single account landing; the
  existing `worlds-list.tsx` island folds in intact as the "Your worlds" section.
- **Two recency blocks:** "Recently viewed" (from view history) and "Recently
  edited" (subjects by `updated_at`, cross-world, live-only; subsumes "created").
  Both subject-scoped; both hide when empty (new accounts still land on the worlds
  list / create form).
- **Editorial:** a **Tips** block and a **What's new** block, both hardcoded TS
  constants (like `BUILTIN_TEMPLATES`). Live events + separate announcements
  deferred; no seen-state/unread badges in v1.
- Canonical name is **Home**, not "dashboard" (resolves the Scriptorium
  "not a dashboard" aesthetic conflict). Journal-style, not a metrics dashboard.

### View history (`subject_views`)
- Tracks **subjects only** (worlds are already in the worlds block; categories are
  de-emphasized).
- One **upserted** row per `(account_id, subject_id)`, `last_viewed_at` bumped on
  each open — a collapsed record, not an event log (**ADR 0012**). RLS own-rows;
  both FKs `ON DELETE CASCADE`.
- Recorded via a `recordSubjectView(subjectId)` server action fired from a mount
  effect on the subject page (never during RSC render).
- Deletion: hard purge cascades the row away; soft-deleted subjects (and subjects
  under a soft-deleted world) are filtered out on read. Show ~6; no prune.

### Navigation revamp
- **Account shell:** slim header + a global **⌘K command palette** — find a subject
  cross-world (full dual-match, reusing a generalized `searchWorld`) + navigate
  (Home / go-to-world / current-world tabs) + create (New world / New subject). The
  header's search input becomes the palette trigger, present everywhere.
- **In-world = 3 tabs** on the existing `worlds/[worldId]/layout.tsx`:
  - **Overview** (`/worlds/[worldId]`) — rich hub: stats + world-scoped
    recently-viewed/edited + quick actions incl. inline New subject.
  - **Browse** (`/worlds/[worldId]/browse`) — the flat all-subjects list (promoted
    from `/search`; empty query = all subjects). Flat by default with a persisted
    "group by category" toggle; default sort recently-edited (A–Z toggle). Category
    is a filter chip. Inline New subject prefills the active category filter
    (resolves Q7); after create the form stays open for repeat-add, each new row
    gets an "open ↗" (no redirect).
  - **Manage** (`/worlds/[worldId]/manage`) — `CategoryManager` (the category list;
    rows link to the category detail page) + `TagManager` + world Save-as-template.
- **Category page KEPT + demoted** (follow-up grill, 2026-07-05 → **ADR 0013**).
  We reconsidered removal and chose to keep it as a secondary *category-detail*
  view, distinct from Browse: `categories/[categoryId]/page.tsx` becomes two
  columns — **members (left, inline add)** + the **schema editor (right)**. The
  standalone `categories/[categoryId]/schema` route is **retired** (editor folds
  onto the page; route redirects there); the read-only schema summary is dropped.
- **Primary vs secondary:** world-level Browse is the primary path to subjects;
  the category page is reached as a drill-in from the category list (Manage) + a
  "view" affordance on Browse category chips. The subject "← category" back-link,
  category-manager rows, template-apply link, and `subjects.ts` redirects **keep
  pointing at the category page** — near-zero link churn. Categories stay a data
  concept + filter.

---

## Glossary (recorded in CONTEXT.md)
Home · Overview · Browse · View history.

## ADRs
- **0012** — View history is a collapsed per-subject upsert, not an event log (15a).
- **0013** — Subjects browsed at the world level; category-folder nav removed (15b).

---

## Execution — 15a / 15b / 15c
Each sub-step: own spec, build, verify, PR. This file is the shared design record.

- **15a — Home + view history:** migration `0009_subject_views` + schema + RLS;
  `recordSubjectView` + subject-page mount effect; Home rebuild (recency + worlds
  island + Tips/What's-new). ADR 0012, glossary Home/View history.
- **15b — Nav revamp + layout:** 3-tab in-world layout; Overview hub; Browse
  (promote `search/` → `browse/`, primary path); Manage. Category page KEPT +
  restructured to members(left)+schema-editor(right); retire `/schema` route
  (fold in). Near-zero link churn. ADR 0013, glossary Overview/Browse.
- **15c — ⌘K palette:** generalize `searchWorld` cross-world; palette component;
  repurpose `GlobalSearchBar` as the global palette trigger.

Roadmap follow-up: mark 13/14 ✅; restructure 15 → 15a/b/c; note "dashboard" → "Home".
