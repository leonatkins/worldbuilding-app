# Step 7 — Subject CRUD + Tags + Field Values

**Status:** Approved (grilled 2026-06-28)
**Roadmap step:** 7
**Depends on:** step 4 (`subjects`, `field_values`, `list_value_subjects`,
`relationships`), step 6 (categories + schema fields), step 5.5 (soft delete)
**Source design:** [`design.md`](design.md) §4.2–4.3 · PRD §5, §6.5, §6.7 · ADR
0001 (facts) · 0003 · 0004 · 0005 (soft delete)

First step to write `field_values` **and** `relationships`. Adds the `tags` /
`subject_tags` tables (migration `0003_tags`). `!`/facts/@mention layer on later
(steps 8/9/11); `[+ Add field]` inline value editing is the baseline path here.

---

## 1. Scope
| Capability | Summary |
|---|---|
| **Subject create** | Minimal name-only, inline on category page; stays on the category page for fast repeat-add (no redirect — [changed post-launch](../CHANGELOG.md), see §4). |
| **Subject page** | §6.7 layout (no facts yet): name (inline edit), category, tags, schema block w/ inline value editing, backlinks. |
| **Field values** | Inline edit per type (10 types); `field_values` hybrid storage; `relationships` maintained for List/Link. |
| **Tags** | `tags`+`subject_tags` (migration `0003`); apply/create/remove on subject; world-level rename/delete. |
| **Subject list** | On category page; sort (name / last edited) persisted in localStorage; Recently Deleted toggle. |
| **Edit / category change** | Inline; category change clears values (counted confirm). |
| **Delete (soft)** | Delete → Recently Deleted → 30-day purge (ADR 0005). |

### Explicitly NOT in this step
- No facts (step 8), `@mention` (step 9), backlink→List promotion (step 10),
  `!` command (step 11), search (step 12).
- No custom `inverse_label` for backlinks (step 10) — backlinks labelled by source
  field name.
- Date field: freeform text + learned autofill v1 only (no format-skeleton v2, no
  date math — PRD §3 forbids calendars).

---

## 2. Routing (ADR 0003)
```
/worlds/[worldId]/categories/[categoryId] category page → + subject list (step 7)
/worlds/[worldId]/subjects/[subjectId]    subject page (flat; survives category change)
```

## 3. Migration `0003_tags`
Step-4 conventions (`account_id DEFAULT auth.uid()`, RLS own-rows, drizzle-generate
+ hand-append RLS):
- `tags`(id, account_id, world_id FK→worlds CASCADE, name, created_at)
- `subject_tags`(subject_id FK→subjects CASCADE, tag_id FK→tags CASCADE, account_id,
  created_at, **PK(subject_id, tag_id)**)
- **`UNIQUE (world_id, lower(name))`** on tags — per-world, **case-insensitive**
  (breaks from the no-name-uniqueness rule elsewhere; tags are identity-ish).
- tags/subject_tags do NOT get `deleted_at` (tag delete is immediate; subjects'
  soft-delete handles recovery of the tagging via restore).

## 4. Subject create (minimal)
- Inline name input in the category page's subject-list section. **Name only**
  (category from context). Enter → create → **stays on the category page**, input
  clears and refocuses for fast repeat-add (matches the facts composer's
  fast-capture pattern, step 8). The new subject appears in the list;
  navigate to it via its row link. Validation: `validateName`.
  (Originally redirected into the new subject's page — changed post-launch
  after testing found the forced navigation broke rapid multi-subject entry.)
- Global `+` "New subject" from an ambiguous context → category sub-menu (step 6/7
  shared chrome).

## 5. Subject page (§6.7, minus facts)
Top-to-bottom: **Name** (inline editable) · **Category** (label + change `<select>`)
· **Tags** (pills + add) · **Schema fields** block · **Referenced by** (backlinks).

### 5.1 Field values
- Filled fields shown read-only; hover → edit affordance; click → inline edit in
  place. Empty fields hidden behind **[+ Add field]** (lists category's unfilled
  fields).
- Per-type widget + storage:

| Type | Widget | Stored |
|---|---|---|
| Text | text input | `scalar_value` |
| Number | number input (+ `unit` suffix) | `scalar_value` |
| Boolean | toggle | `scalar_value` |
| Select | dropdown of `select_options` | `scalar_value` |
| Multi-select | chip multi-select | `scalar_value` |
| Date | **freeform text** + learned autofill | `scalar_value` |
| Scale | slider (`scale_min/max`) | `scalar_value` |
| Color | swatch picker | `scalar_value` |
| Link | searchable subject typeahead (single) | `linked_subject_id` |
| List | searchable subject typeahead (multi) | `list_value_subjects` |

- **Date learned autofill:** client-side autocomplete from the world's existing
  Date-field values (learned vocabulary; frequency-ranked). No AI/cloud/date-math.
- **Link/List picker:** searchable typeahead filtering by name within the TARGET
  category; scrollable; may cover a little screen (no big overlay). One value per
  `(subject, field)` (unique constraint); List allows many member subjects.
- **`relationships` sync:** on Link/List save/change/clear, **delete-then-insert**
  that `(subject, field)`'s rows (`origin='field'`, `field_id`, from=subject,
  to=each linked). Idempotent; unique constraint guards dupes.
- Validation: Number numeric; Scale in bounds; Select ∈ options; Multi-select ⊆
  options.

### 5.2 Backlinks ("Referenced by")
- Inbound List/Link refs grouped **by source field name** (no inverse grammar):
  "Mentor → Aragorn, Frodo". Label = forward field name. Read-only, auto-maintained
  from `relationships`. Custom `inverse_label` deferred to step 10.

### 5.3 Tags
- Pills with × to remove; type-to-add input with **autocomplete over world tags** +
  "Create #new" inline (creates tag + links). Stored bare; `#` render-only.
- World-level rename/delete has a UI: the **Tag manager**, a collapsible section
  on world home (`/worlds/[worldId]`) listing every tag with its live subject
  count. Rename is inline, same shape as category/subject rename. Delete is
  hard and cascading (§3, ADR 0008) — its confirm step names the affected
  subject count as a safeguard, since there's no Recently Deleted to fall back
  on. (Post-launch addition — the `renameTag`/`deleteTag` actions existed from
  this step's original build but had no UI entry point until this fix.)

## 6. Subject edit
- **Name:** inline editable title.
- **Category change:** `<select>` of world categories. Clears ALL the subject's
  `field_values` (+ `list_value_subjects` + field-origin `relationships`) — no field
  is shared across categories. **Counted blocking confirm** (critical): "Move … This
  clears N field values. Facts and tags are kept." Facts/tags survive. Inbound
  links left as-is (accepted edge).

## 7. Subject delete (soft, ADR 0005)
- Delete (red) → `deleted_at = now()` → Recently Deleted (category page toggle) →
  Restore / Delete-now → 30-day pg_cron purge (CASCADE).

## 8. Subject list (category page)
- Lists active subjects (filter `deleted_at IS NULL`); each row links to the
  subject page and carries inline **Rename**/**Delete** actions (same
  view/rename/confirm-delete pattern as the category manager's rows —
  post-launch addition; originally the list had no row actions).
- Sort: **Last edited (default)** / Name A–Z / Z–A; persisted in localStorage
  (`useSyncExternalStore`, worlds-list pattern).
- Recently Deleted toggle.

## 9. Server actions
`app/actions/subjects.ts` (create/rename/changeCategory/softDelete/restore/purge),
`app/actions/field-values.ts` (setValue per type + relationships sync),
`app/actions/tags.ts` (create/apply/remove/rename/delete). All door 1, validated.

## 10. UX / polish
Overlay rule, micro-interactions (~150ms, reduced-motion), skeleton `loading.tsx`
for category page + subject page; no flash. Theme deferred.

## 11. Definition of done
- [ ] Migration `0003_tags` applied (tables + RLS + case-insensitive unique).
- [ ] Subject create (minimal → redirect), list (sort + localStorage + Recently
      Deleted), soft-delete/restore/purge.
- [ ] Subject page: inline name, category change (counted clear), tags
      (apply/create/remove), schema block inline value editing (all 10 types),
      backlinks grouped by field.
- [ ] `field_values` hybrid storage correct; `relationships` delete-then-insert for
      List/Link.
- [ ] Date freeform + learned autofill; Link/List searchable typeahead.
- [ ] All door 1; reads filter `deleted_at IS NULL`; no manual `account_id`.
- [ ] `build` passes, `lint` clean, `test` green.
- [ ] Docs updated (README, CHANGELOG, ROADMAP step 7 → ✅).
