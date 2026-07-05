# Step 15b — Nav Revamp — Grill Notes (IN PROGRESS)

**Status:** Grilling in progress (`/grill-with-docs 15b`) — NOT yet fully resolved.
**Date:** 2026-07-05
**Parent design record:** `docs/step-15-grill-notes.md` (steps 15a/15b/15c), ADR 0013.

This file captures the in-progress grilling of the 15b implementation before building.
The high-level 15b design was already grilled (see parent + ADR 0013); this pass is to
pin down implementation specifics and produce the 15b spec.

---

## Current-code findings (from exploration, 2026-07-05)

- **`worlds/[worldId]/layout.tsx`** — minimal server layout; renders **only** the
  `GlobalSearchBar` in a thin sub-header. No tabs/sub-nav yet → natural (empty) host
  for the new tab bar. Only layout with `worldId` in scope.
- **`worlds/[worldId]/page.tsx`** (world index) — currently **is** the Manage content:
  `CategoryManager` + `TagManager` + `SaveAsTemplateButton kind="world"`. No stats, no
  flat subject list. Computes per-category & per-tag subject counts inline.
- **`/search`** (`search/page.tsx` + `search-filters.tsx`, `searchWorld` in
  `app/actions/search.ts`) — flat filterable subject list. **Already has a no-query
  "browse-all" mode.** Category filter = OR chips; tag filter = AND. Sort is **always
  `updated_at` desc** (name-exact floated on query). **Gaps vs Browse spec:** no sort
  control, no group-by-category toggle, no inline "New subject" add.
- **Category page** (`categories/[categoryId]/page.tsx`) — read-only `SchemaSummary` +
  `SubjectsList` (inline name-only add, localStorage sort, recently-deleted). Schema
  **editor** lives on the separate **`/schema` route** along with
  `SaveAsTemplateButton kind="schema"`.
- **`CreateMenu`** (`create-menu.tsx`, step 16) — deep-links adapt to URL:
  New subject → `/worlds/{id}` (or `/worlds/{id}/categories/{cat}?create=subject`),
  New category → `/worlds/{id}?create=category`, New world → `/?create=world`. These
  targets are coupled to where the inline forms live → **must be re-pointed** when
  CategoryManager moves to `/manage`.
- **Recency (15a)** — `RecentSubjects` presentational component already supports
  omitting `worldName` (built with Overview reuse in mind). Queries are **inline in
  Home `page.tsx`, cross-world**, not extracted; world-scoping = add `.eq("world_id")`
  (or `.eq("subjects.world_id")` on the embedded join). `recordSubjectView` unchanged.
- **World stats** — none exist; any "N subjects / N categories" is net-new derivation.
- **subjects.ts** — `deleteSubject` redirects to the category page (kept — page still
  exists). `createSubject` returns `{}` (client navigates into new subject).

### ⚠️ Contradiction found (to resolve during grill)
Parent grill notes claim the subject page's **"← category" back-link** keeps pointing
at the category page. **That back-link does not exist** — the subject page shows the
category as a `CategoryChanger` widget (plain text + "change" select), with **no link**
to the category page. So how a user reaches the demoted category page is an open
question (Browse chip "view" affordance + Manage category-row link are the real paths).

---

## Open decisions

### Q1 — Does the world-level Overview tab exist? (ROOT of the tree) — **OPEN**
Tension surfaced: the **account-level Home** (worlds list, step 15a, cross-world
recency) is the decided "dashboard." The parent notes *also* spec a **world-level
Overview** index tab as a "rich hub" (stats + world-scoped recency + quick actions).
User flagged this as likely redundant with Home.

Options:
- **(A)** 3 tabs, Overview index = rich hub (stats + world recency + quick actions).
- **(B)** 2 tabs, **Browse is the world index** + Manage; no Overview (dashboard role
  stays only at account Home). Least code, no duplication. ← user leaning here.
- **(C)** 3 tabs, Overview is *thin* — world recency rails + quick actions, no net-new
  stats.

**Pending user decision.** (Browse and Manage are unaffected by this choice; only
whether Overview exists and what the world index route renders.)

### Remaining questions to grill (not yet asked)
- Browse net-new features: sort control (default recently-edited + A–Z toggle — client
  vs `searchWorld` param), persisted group-by-category toggle (localStorage like
  `subjects-sort`?), inline "New subject" (prefill active category filter, stay open,
  per-row "open ↗", no redirect).
- Category page restructure: two-column members(left) + schema-editor(right); retire
  `/schema` route (redirect); drop read-only `SchemaSummary`; rehome
  `SaveAsTemplateButton kind="schema"`; mobile/responsive for the two columns.
- `CreateMenu` re-pointing after CategoryManager → `/manage`.
- Navigation TO the demoted category page given the missing back-link (Q above).
- Manage tab: relocate the three islands verbatim; retarget `?create=category`.
- Tab bar implementation in `layout.tsx` (active state via `usePathname`, ADR 0003).

---

## Glossary / ADR impact (pending)
- Glossary: confirm **Overview** term survives (depends on Q1) + **Browse**.
- ADR 0013 already covers world-level Browse primary + category page demoted.
