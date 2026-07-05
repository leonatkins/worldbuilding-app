# World-level Browse is the primary path to subjects; the category page is demoted, not removed

**Status:** accepted

Until step 15, reaching a subject meant navigating *into* a category: world page →
click a category → that category's page lists its subjects → click a subject. Step
15b makes a flat, filterable **world-level Browse** the primary way to reach
subjects (categories become a *filter*, not a folder you must enter). We
**considered removing the category page entirely** and decided against it: it is
kept, but **demoted** to a secondary *category-detail* view. This ADR records that
choice and why removal lost.

## Context

Categories remain first-class in the **data model** — every subject belongs to
exactly one category, and schema fields are owned by a category. The goal (memory
`project-ui-category-view-revamp`) is only to stop category folders being the
*primary* navigation, not to delete the concept or the surface.

Step 12's search was deliberately built as a standalone flat, category+tag-filtered
subject list, precisely to become this Browse surface — it needs only an
empty-query = "all subjects" mode. The world view gains an in-world tab structure
(Overview / Browse / Manage), with Browse primary.

## Considered Options

- **Remove the category page entirely:** cleanest single-path IA, but real churn —
  delete the page + its subjects-list + schema-summary, rehome the inline
  add-subject flow and the schema-editor entry, and repoint ~6 link sites
  (subject back-link, category-manager rows, template-apply success link,
  create-menu, `subjects.ts` redirects). Hard to reverse. And it discards a
  genuinely useful *focus* view.
- **Keep the page unchanged, just stop linking to it as primary:** least work, but
  leaves two near-identical subject lists (the category page vs Browse filtered to
  that category) — pure redundancy.
- **Keep + repurpose as a category-detail view (chosen):** demote it (Browse is
  primary), but make it *distinct* from Browse — a per-category focus showing the
  category's **members (left) and its schema editor (right)** together, which the
  flat cross-category Browse never does. Low churn, reversible, and the page earns
  its keep.

## Consequences

- **Browse** (`/worlds/[worldId]/browse`, promoted from `/search`) is the primary
  path to subjects; category = filter chip.
- **Category page kept** (`categories/[categoryId]/page.tsx`), restructured to two
  columns: members list (left, with inline add) + the **schema editor** (right).
  The standalone `categories/[categoryId]/schema` route is **retired** (its editor
  moves onto the page; the route redirects there); the old read-only schema
  *summary* is dropped.
- **Reached as a drill-in** from the category list (Manage) and a "view" affordance
  on Browse's category chips. The subject page's "← category" back-link, the
  category-manager rows, the template-apply success link, and `subjects.ts`
  redirects **keep pointing at the category page** — near-zero link churn.
- Categories as a data concept are untouched; this is a navigation-priority change
  plus a repurposing, not a removal.
