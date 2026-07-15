# Step 15b — Nav Revamp — Grill Notes

**Status:** RESOLVED (`/grill-with-docs 15b`, 2026-07-14) — design tree closed (Q1–Q9);
ready to write the 15b spec. The nav model changed fundamentally from the parent plan:
**no tabs, no command palette** (see ADR 0014).
**Date:** 2026-07-05 (grilled 2026-07-05); resolved 2026-07-14
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

## Resolved (grill pass 2026-07-14)

### Q1 — No in-world tabs. The world view opens to a journal-style front page. ✅
The originally-specced **Overview/Browse/Manage tab bar is cut.** A persistent tab
strip is the most recognizable piece of SaaS-app chrome, which fights the documented
vibe (`worldbuilding-style-guide.md`: *"a well-kept journal or ledger, not a slick
SaaS product"*; Scriptorium: *"not a dashboard"*). User independently moved away from
tabs; reframed against the style guide, the replacement is a journal/ledger **index /
front page** — you open a world and land on *its page*, and reach other surfaces by
**in-page links + the ⌘K command palette**, not tabs.

Also killed the word **"dashboard"** for this surface (user reached for it; it pulls
back toward the rejected metrics-dashboard feel). Canonical term stays **Overview**
(glossary updated); name may still shift to "Index"/"Front page."

### Q2 — Front page is recency-led (journal), categories as a secondary index. ✅
Leads with **"recently edited/viewed in this world"** (resume-where-you-left-off —
the dominant returning intent), with the world's **categories as a quiet secondary
contents strip** ("the shape of this world"). A category click goes to **Browse
filtered to that category**, *not* into a category folder — this keeps categories as
orientation, not primary subject-nav, so it does **not** regress ADR 0013. Empty/new
world (5 default categories, 0 subjects) falls back to the categories index + "create
your first subject," mirroring Home's empty-state pattern.

### Q3 — "Manage" dissolves; no Manage screen/route. ✅
"Manage" was a tab-shaped bucket (three unrelated islands grouped only because a tab
needed contents). With no tabs, it dissolves to contextual homes:
- **Category management** → inline on the front-page categories index, behind a quiet
  **"Edit" toggle** (resting = read-only index; edit reveals the existing
  `CategoryManager` verbatim). Feasibility checked: `category-manager.tsx` is 684 lines
  / self-contained with clean props (`worldId, categories, deletedCategories`) — too
  heavy to sit always-open, but portable, so mount it *behind the toggle*, no rewrite.
  Resting index is a new lightweight read-only component (icon · name · count, click →
  Browse-filtered).
- **Tag management** → reached from the **tag filter in Browse** (invert the existing
  tag-manager→filter "Browse" link: the filter becomes the tag's home).
- **Save-as-template (world)** → world-level action (palette and/or a quiet header "⋯").

### Q4 — No command palette. The search bar is elevated + named "the Spyglass." ✅
A ⌘K command palette is *more* SaaS-chrome than tabs (Linear/Notion/Raycast) and would
mostly re-wrap what already exists (persistent `GlobalSearchBar` = jump; `+` CreateMenu
= create; world switcher = navigate). Dropped. Instead the existing search bar is
**elevated into a named, emphasized instrument — "the Spyglass"** (glossary added):
search = *spotting through the glass*, a quiet lookup framed as an object, not a
command overlay. Nav = in-page links + Spyglass + CreateMenu + world switcher.

### Vibe direction (surfaced here, scope = step 16) 🧭
User's instinct for the whole app: **"papery + pirate."** Sharpened to the **restrained
cartographer / age-of-exploration register** (parchment, ink, spyglass, compass, charts,
wax seals — *instruments & materials*), **not** talk-like-a-pirate kitsch (skulls,
doubloons) which would break "low-saturation, calm, not flashy." This = the documented
**Scriptorium** base (style guide) + the **Atlas** cartographic layer (visual-styles.md
direction C) blended. Confirmed. Threads through the step-16 visual pass (tokens, icons,
motion), not just 15b — but it's why Search became the Spyglass.

### Q5 — Category detail page: kept as an *authoring/focus* surface, not subject-nav. ✅
Risk was orphaning: front-page category click → Browse-filtered (Q2), Browse already
lists a category's subjects, and the subject page has no "← category" back-link. Resolved:
- **Keep it, restructured per ADR 0013** — members (left) + schema editor (right);
  retire the standalone `/schema` route (redirect into the page). Its distinct value =
  the one place you see a category's members *and* edit its fields together.
- **Role narrows to authoring/focus, not navigation.** Finding subjects = Browse (flat);
  working *on* a category = the detail page.
- **Reached from the management lane:** front-page index **Edit mode** rows
  (`CategoryManager`) get "open ↗", plus a "view category ↗" affordance on Browse's
  active category-filter chip. Not from a reading-lane click.
- **Missing back-link is by design, not a gap** — flat IA, category isn't a parent
  folder you climb back to; subject page keeps its `CategoryChanger` widget, no back-link.
  (Resolves the contradiction flagged above + updates ADR 0013's back-link assumption.)

→ Nav cluster (Q1/Q3/Q4/Q5) captured as **ADR 0014**; ADR 0013 gets a superseding note.

### Q6 — Browse specifics. ✅
- **Route:** rename `/search` → `/worlds/[worldId]/browse` (ADR 0013).
- **Spyglass ↔ Browse:** the Spyglass shows **live dropdown results while typing** (quick
  spot) and **Enter opens Browse with the query applied** — same surface, no-query =
  browse-all, with-query = results (ADR 0013's "same surface lists everything and runs a
  query"). The old separate `/search` page *is* Browse now.
- **Sort control:** toggle **Recently edited (default) / A–Z**, client-side, reusing the
  `subjects-sort` localStorage pattern.
- **Inline "New subject":** active category filter → prefill it; **no filter → inline
  category picker** in the add row; stay open for repeat-add, per-row "open ↗", no
  redirect. **Closes open-question Q7** (global new-subject category picker).
- **Group-by-category toggle: dropped** — redundant with the front-page categories index
  (orientation) + Browse's category filter; would blur "flat list, category is a filter
  not a folder."

### Q7 — Front page has "New subject" too. ✅
Subject-create is a **start-here action on the Overview front page** (a quiet inline
composer + category picker, same component as Browse's no-filter add), in addition to
Browse. So subject-create lives on: **front page, Browse, and the category detail page's
member list**. Category-create = front-page index Edit mode; world-create = Home.

### Q8 — Retire the global `+` CreateMenu. ✅
Every create now has an inline home on a landing surface (Q7), so the persistent header
`+` is redundant chrome — retired, consistent with cutting tabs/palette. **"New world"
moves into the world switcher dropdown** (its natural home). **Deletes the `?create=`
re-pointing task entirely.**

### Q9 — Category detail page layout (spec-detail, sensible defaults). ✅
- **`SaveAsTemplateButton kind="schema"`** moves onto the detail page, in/beside the
  schema-editor column (its old `/schema` route folds in and redirects here).
- **Two columns desktop** — members (left) + schema editor (right); **stack on mobile**
  (members first, then editor — no tab, consistent with the no-tabs model). Confirm at
  build time.

---

## Grill outcome
Design tree fully resolved (Q1–Q9). Ready to write the **15b spec**. Docs updated this
pass: glossary (`Overview` redefined, `Spyglass` added), **ADR 0014** (nav model),
**ADR 0013** superseding note. Stale docs to reconcile separately: **ROADMAP table**
(steps 13/14/15a/16 not marked done; step 15 pre-rescope) and **CHANGELOG** (only
through step 12).
- Browse net-new features: sort control (default recently-edited + A–Z toggle — client
  vs `searchWorld` param), persisted group-by-category toggle (localStorage like
  `subjects-sort`?), inline "New subject" (prefill active category filter, stay open,
  per-row "open ↗", no redirect).
- Category page restructure: two-column members(left) + schema-editor(right); retire
  `/schema` route (redirect); drop read-only `SchemaSummary`; rehome
  `SaveAsTemplateButton kind="schema"`; mobile/responsive for the two columns.
- `CreateMenu` re-pointing after CategoryManager moves.
- Navigation TO the demoted category page given the missing back-link (contradiction
  above).
- The ⌘K command palette itself (was part of the 15b plan) — scope, triggers, actions.

---

## Glossary / ADR impact
- **Glossary: DONE this pass** — `Overview` redefined (journal front page, no tab
  bar, *dashboard/tab* added to Avoid); `Browse` unchanged.
- **ADR 0013 needs a superseding note** — its core holds (Browse primary, category
  page demoted) but it's framed around an "in-world tab structure (Overview/Browse/
  Manage)," now cut. The tab-cut is itself ADR-worthy (hard-ish to reverse, surprising
  without context, a real vibe-vs-convention trade-off) — likely a new ADR or a
  revision to 0013.
