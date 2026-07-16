# Step 15b — In-world Navigation Revamp

**Status:** Shipped (2026-07-15) — built + live-verified (Playwright smoke test). Visual treatment (Spyglass emphasis, papery-cartographer theme) deferred to step 16.
**Roadmap step:** 15b (of the 15a/15b split; see `step-15-grill-notes.md`)
**Depends on:** step 12 (`searchWorld`, the `/search` surface → Browse), step 15a
(view history, `RecentSubjects`, account Home), step 16 (the `CreateMenu` this step
retires)
**Source design:** [`step-15b-grill-notes.md`](step-15b-grill-notes.md) (Q1–Q9) ·
[ADR 0014](adr/0014-journal-navigation-no-tabs-no-palette.md) (nav model) ·
[ADR 0013](adr/0013-world-level-subject-browsing.md) (Browse primary, category demoted)
· `CONTEXT.md` (Overview, Browse, Spyglass)

The final structural step before the visual pass. The parent step-15 plan specced an
in-world **Overview / Browse / Manage tab bar** + a **⌘K command palette**; grilling
against the documented "journal/ledger, not slick SaaS" identity **cut both** (ADR
0014). This step replaces them with a journal **front page** you open to, navigation by
in-page links + the **Spyglass** (the elevated, named search instrument), a **dissolved
Manage**, and inline create on every landing surface.

---

## 1. Scope
| Capability | Summary |
|---|---|
| **Overview front page** | The world index route (`/worlds/[worldId]`) becomes a recency-led journal front page: "recently edited/viewed in this world" leads, a secondary **categories index** (icon · name · count) follows, plus start-here actions. *Not* a metrics dashboard. |
| **No tab bar** | `layout.tsx` keeps only the Spyglass sub-header — no Overview/Browse/Manage tabs. Surfaces are reached by in-page links + Spyglass + world switcher. |
| **The Spyglass** | The existing `GlobalSearchBar`, elevated + renamed into an emphasized find-and-jump instrument: live dropdown while typing, **Enter → Browse with the query applied**. |
| **Browse** | `/search` renamed → `/worlds/[worldId]/browse`. Flat filterable subject list; adds a **sort toggle** (Recently edited / A–Z) and **inline New-subject** (active-filter prefill, else an inline category picker). No group-by-category. |
| **Manage dissolved** | Category management inlines behind an **Edit toggle** on the front-page index (reuses `CategoryManager` verbatim); world-template save becomes a world-level action; tag management is reached from the Browse tag filter. |
| **Category detail page** | Kept as an *authoring* surface: members (left) + schema editor (right); the `/schema` route folds in and redirects; `SaveAsTemplateButton kind="schema"` moves onto it. Reached from the management lane, not a reading-lane click. |
| **Create inline everywhere** | New subject on the front page, on Browse, and in the category detail members list; new category in the front-page index Edit mode; new world on Home + the **world switcher**. |
| **Global `+` retired** | The `CreateMenu` and its `?create=` deep-linking are removed. |

### Explicitly NOT in this step
- **No visual restyle.** Tokens, the papery-cartographer register, the Spyglass's
  final visual treatment, mobile polish → step 16.
- **No new search capability.** Browse reuses `searchWorld` as-is; only its route,
  sort control, and inline-add are new.
- **No ⌘K / command palette.** Rejected (ADR 0014). A keyboard shortcut may *focus the
  Spyglass*, nothing more.
- **No category-as-folder navigation.** Front-page category clicks go to
  Browse-filtered, never "into" a category (ADR 0013).

---

## 2. Decisions (from grilling — Q1–Q9)
1. **No tabs, no command palette** — both read as SaaS chrome; against the vibe (ADR 0014).
2. **Front page is recency-led (journal)**, categories a secondary index; category click
   → Browse-filtered (keeps categories a filter, not a folder — ADR 0013).
3. **Empty/new world** (5 default categories, 0 subjects) falls back to the categories
   index + "create your first subject."
4. **The Spyglass** carries find + jump (replaces both a generic search box and a
   palette); live dropdown, Enter → Browse.
5. **Manage dissolves** to contextual homes; `CategoryManager` mounts behind an Edit
   toggle (checked feasible — 684-line self-contained island, clean props, too heavy to
   sit always-open, so hidden at rest).
6. **Browse**: `/browse` route, sort toggle (client, `subjects-sort` localStorage
   pattern), inline New-subject with category picker (**closes open-question Q7**), no
   group-by.
7. **Category detail page** kept as authoring/focus; no subject-page back-link *by
   design* (flat IA — category isn't a parent folder).
8. **Create inline on every landing surface**; **global `+` retired**, New-world → world
   switcher (deletes the `?create=` re-pointing work).
9. **Category detail layout**: two columns desktop, stack (members → editor) on mobile.

---

## 3. Files (to build / change)
- `app/(app)/worlds/[worldId]/page.tsx` — becomes the Overview front page (was the Manage
  content). World-scoped recency (reuse `RecentSubjects`, add `.eq(world_id)`) + a new
  lightweight read-only categories-index component with an Edit toggle mounting
  `CategoryManager` + inline New-subject composer.
- `app/(app)/worlds/[worldId]/layout.tsx` — Spyglass sub-header only (no tabs); rename
  `global-search-bar.tsx` treatment/label to the Spyglass.
- `app/(app)/worlds/[worldId]/search/` → **`browse/`** — route rename; add sort toggle +
  inline New-subject (category-picker when unfiltered).
- `app/(app)/worlds/[worldId]/categories/[categoryId]/page.tsx` — two-column
  members + schema editor; absorb the `/schema` route (redirect) + `SaveAsTemplateButton
  kind="schema"`.
- **Remove** `create-menu.tsx` (+ its `?create=` focus wiring in `CreateWorldForm`,
  `CategoryManager`, `subjects-list`); add "+ New world" to the world switcher.
- `app/actions/subjects.ts` — inline-create paths (no redirect into the new subject).
- `CONTEXT.md` — done (Overview, Spyglass). ROADMAP/CHANGELOG — reconciled alongside.

Reused verbatim: `CategoryManager`, `TagManager`, `RecentSubjects`, `searchWorld`.

---

## 4. Verification (plan)
Drive live (Playwright) + `tsc`/lint/build:
- Entering a world lands on the front page (recency lead; categories index; no tabs);
  empty world shows the create-first-subject fallback.
- Spyglass: live dropdown; Enter → `/browse?q=…`.
- Browse: sort toggle persists; inline New-subject prefills an active category filter and
  shows the picker when unfiltered; created subject appears without a redirect.
- Front-page category click → Browse filtered to it; Edit toggle reveals `CategoryManager`
  in place.
- Category detail page: two columns; old `/schema` URL redirects in; schema-template save
  present.
- Global `+` gone; New-world reachable from the world switcher; no dead `?create=` links.
