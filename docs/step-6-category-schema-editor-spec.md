# Step 6 — Category + Schema Editor

**Status:** Approved (grilled 2026-06-28)
**Roadmap step:** 6
**Depends on:** step 4 (`categories`, `schema_fields` tables), step 5 (world routing,
door-1 data access), **step 5.5 soft-delete foundation** (ADR 0005 — `deleted_at`
columns + Recently Deleted; built first, see §0)
**Source design:** [`design.md`](design.md) §4.2, §4.4 · PRD §6.2 · ADR 0003
(world identity in URL) · ADR 0004 (data access via Supabase client) · ADR 0005
(soft delete)

Editor for a world's **categories** and each category's **schema field
definitions**. No subjects, and **writes no `field_values`** — "apply-to-subjects"
is automatic because empty fields are hidden (design §4.2). Field *value* entry is
step 7.

---

## 0. Prerequisite — step 5.5 soft-delete foundation (ADR 0005)

Built and committed **before** step 6 proper, because category delete uses it:

- **Migration `0002_soft_delete`:** `deleted_at timestamptz NULL` on `worlds` and
  `categories`; rename `subjects.archived_at` → `deleted_at`; enable `pg_cron` +
  three daily purge jobs (`DELETE … WHERE deleted_at < now() - interval '30 days'`).
- **Schema:** add `deletedAt` to `worlds`/`categories`/`subjects` in `lib/db/schema.ts`.
- **Shared helper** (`lib/db/soft-delete.ts` or inline): every door-1 read filters
  `.is("deleted_at", null)` unless explicitly reading the trash.
- **Step-5 retrofit:** `deleteWorld` sets `deleted_at` (soft) instead of hard
  delete; `restoreWorld` + `purgeWorld` (delete now) actions added; `/` gains a
  **Recently Deleted** section (toggle) listing soft-deleted worlds with Restore /
  Delete-now. World resolver (`/worlds/[id]`) filters `deleted_at IS NULL` → 404.

---

## 1. Scope

### In scope
| Capability | Summary |
|---|---|
| **Category manager** | On `/worlds/[worldId]`: list, create (+ suggested chips + emoji), rename, reorder (drag), delete (soft; actionable RESTRICT panel). |
| **Category page** | `/worlds/[worldId]/categories/[categoryId]`: schema editor section (step 7 adds the subject list here). |
| **Schema field editor** | Add/configure (per-type config), rename, reorder (drag), delete fields. |
| **Recently Deleted (categories)** | Toggle on the category manager; restore / delete-now. |

### Explicitly NOT in this step
- No subjects, no `field_values`, no value entry (step 7).
- No `inverse_label` on fields (deferred to step 10, Backlink organization).
- No free-tier limits, no templates.

---

## 2. Routing (ADR 0003)
```
/worlds/[worldId]                         category manager (world home, enhanced)
/worlds/[worldId]/categories/[categoryId] category page → schema editor section
```
Subjects are flat (`/worlds/[worldId]/subjects/[id]`, step 7), never nested under
category (a subject can change category). Schema editor is a **section** on the
category page, not a separate route (respects the overlay rule — it's inline).

## 3. Data access (ADR 0004)
Door 1 (Supabase client) for all reads/writes; `account_id` auto-stamped; RLS
enforces ownership; reads filter `deleted_at IS NULL` (§0). No Drizzle queries.

---

## 4. Category manager (`/worlds/[worldId]`)
Mirrors the step-5 worlds-list pattern; inline, no big overlays.

- **Create:** inline name input + emoji + Create.
- **Suggested categories:** quick-pick chips (Species, Biomes, Events,
  Organizations, Deities, Languages…) pre-filling name+icon; opt-in, overtypable.
  Hardcoded constant (like `DEFAULT_CATEGORIES`).
- **Icon:** small **curated emoji set** (~30 worldbuilding emoji) in a non-covering
  popover. No emoji-picker dependency.
- **Rename:** inline edit.
- **Reorder:** drag-and-drop (`dnd-kit`); on drop set `position` = midpoint of new
  neighbors (one update).
- **Delete (soft):**
  - **RESTRICT wall:** if another category's List/Link field targets this category
    (`schema_fields.target_category_id ON DELETE RESTRICT`), the eventual hard
    purge would be blocked — but soft delete just hides it. To keep the trash sane,
    detect referencing fields *at delete time* and show an **actionable inline
    panel** listing each blocking field, each with: **Delete the field** or
    **Re-point to another category**. (Re-pointing with values is a step-7 concern;
    none exist in step 6.) Once cleared, soft-delete proceeds.
  - Confirm names the soon-to-cascade content count (0 until step 7).
- **Recently Deleted:** toggle reveals soft-deleted categories; Restore / Delete now.
- **Validation:** reuse `validateName` (trim, required, max 100, dups allowed).

## 5. Schema field editor (section on the category page)
Add a field = name + `field_type` + type-specific config:

| Type | Config | Column(s) |
|---|---|---|
| Text, Boolean, Date, Color | none | — |
| Number | optional unit | `unit` |
| Select, Multi-select | option list (≥1) | `select_options` |
| Scale | min + max (min < max) | `scale_min`, `scale_max` |
| List, Link | target category (required; self allowed) | `target_category_id` |

- **Add UI:** inline — name + type picker (chips/dropdown of 10 types); selecting a
  type reveals its config inputs below. Save appends with `position` after last.
- **Select/Multi-select options:** inline editable list (add/remove/reorder), ≥1.
- **List/Link target:** `<select>` of the world's categories (self allowed). Creates
  the §4 RESTRICT dependency.
- **Edit:** name/options/scale/unit/target editable inline. **Type freely
  changeable in step 6** (no values exist); value-migration rules deferred to
  step 7.
- **Reorder:** drag-and-drop (midpoint `position`).
- **Delete:** removes the field (hard — schema definitions are not soft-deleted; no
  values exist yet). Confirm inline.

## 6. UX / polish
- Overlay rule: no blur/cover/block; small non-covering popovers fine. Critical
  destructive confirms may block.
- Micro-interactions: hover/focus transitions on buttons/rows (~150ms, reduced-
  motion safe). Theme deferred (placeholder neutrals).
- Loading: route-level `loading.tsx` skeletons for the category manager + category
  page; no white/theme flash.

## 7. Server actions (`app/actions/categories.ts`, `app/actions/schema-fields.ts`)
`"use server"`, door 1. `createCategory`, `renameCategory`, `reorderCategory`,
`deleteCategory` (soft) / `restoreCategory` / `purgeCategory`, plus
re-point/delete-field helpers for the RESTRICT panel; `createField`, `updateField`,
`reorderField`, `deleteField`. Validation server-side.

## 8. Definition of done
- [ ] Step 5.5 foundation merged: migration applied, step-5 retrofit, Recently
      Deleted on `/`.
- [ ] Category manager: list/create(+chips+emoji)/rename/drag-reorder/soft-delete/
      Recently Deleted.
- [ ] RESTRICT delete panel is actionable (delete field / re-point).
- [ ] Category page schema editor: add (all 10 types + config)/edit/drag-reorder/
      delete.
- [ ] Drag-reorder writes midpoint `position`.
- [ ] All access door 1; reads filter `deleted_at IS NULL`; no Drizzle queries; no
      manual `account_id`.
- [ ] `build` passes, `lint` clean, `test` green (unit tests for validation,
      midpoint, suggested/emoji constants).
- [ ] Docs updated (README, CHANGELOG, ROADMAP step 6 → ✅).
