# Step 10 — Backlink Organization

**Status:** Approved (grilled 2026-07-01)
**Roadmap step:** 10
**Depends on:** step 9 (`relationships`, backlinks side-rail, hover tooltip), step 7
(`field_values`/`list_value_subjects`, `SubjectPicker`, `setListValue`), step 6
(schema editor, `schema_fields`)
**Source design:** [`design.md`](design.md) §4.3 (relationships & backlinks,
promote-to-List, "three gradient bridges") · CONTEXT.md (Mention, Backlink) ·
step-9 spec §6 (current backlink rail, which this step extends, not replaces)

Turns the passive "Referenced by" rail into an active tool: select several
backlinks and promote them into a List field, one of the three bridges by which
loose facts crystallize into schema structure. Also resolves the `inverse_label`
question left open since step 6/7 (backlinks are grouped by source subject, not
by field — a per-field label only matters as extra context, not as the grouping
key), and splits the category page into a read-only summary + a dedicated editor
route.

---

## 1. Scope
| Capability | Summary |
|---|---|
| **Category page split** | `/categories/[categoryId]` becomes read-only (field list, no controls). All schema mutation (add/edit/delete/reorder) moves to a new `/categories/[categoryId]/schema` route. |
| **`inverse_label`** | Optional text on `Link`/`List` fields, set in the (now dedicated) schema editor. Falls back to the field's own forward name when unset — never a blank label. |
| **Backlink hover context** | The existing hover tooltip gains a line showing *why* a source subject appears: resolved field label(s) for field-origin rows, "Mentioned in N facts" for fact-origin rows. The flat rail itself is unchanged. |
| **Select mode** | A "Select" toggle in the "Referenced by" rail turns entries into checkboxes. Checking one locks the rail to that entry's category — mismatched entries disable live, since a List field's members are all one category. |
| **Promote** | With ≥1 selected, an inline (non-navigating, non-overlay) panel offers: add to an existing matching List field on this subject (additive — union with current members), or create a new one (name input; target category inferred from the lock). |

### Explicitly NOT in this step
- **No new bridge for facts→fields** — that's the `!` command, step 11. Field
  creation *from the promote flow* is allowed (it's its own bridge, per design
  §4.3) and isn't blocked by the category page's new read-only default.
- **No cross-category List fields.** `target_category_id` stays single-category
  (unchanged step-6 data model) — promotion enforces this in the UI rather than
  changing the constraint.
- **No un-promote / bulk-remove.** Removing a promoted member from a List field
  is the existing per-member "×" in `SubjectPicker` / field Clear — unchanged.
- **No change to fact-mention backlinks.** Promotion only ever *adds* a new
  field-origin `relationships` row (this subject → each selected subject); the
  original fact-mention row (selected subject → this subject) is untouched and
  keeps showing on this subject's rail exactly as before.
- **No fact search / snippets in the tooltip** — fact-origin context is a count,
  not excerpts (cheap, no truncation rules needed).

---

## 2. Category page: read-only + dedicated editor
- `/worlds/[worldId]/categories/[categoryId]` (`page.tsx`) drops the live
  `<SchemaEditor>` for a new read-only `<SchemaSummary>`: the same per-field
  summary line as today's `summarize()` (type + target/options/scale/unit), plus
  `· inverse: {inverse_label}` when set on a `Link`/`List` field. No drag handle,
  no Edit/Delete, no `+ Add field` — just a plain list and one `Edit schema` link.
- The link navigates to a **new route**, `/worlds/[worldId]/categories/[categoryId]/schema`,
  which loads the same data and renders the existing `<SchemaEditor>` unchanged
  (full CRUD/reorder), plus a back link to the category page. No modal, no
  overlay — a real route, per ADR 0003's world-scoped-URL pattern.
- This does **not** contradict the promote flow creating a field inline from the
  subject page (§5.3) — that's a distinct bottom-up bridge (design §4.3's "three
  bridges"), the same category the future `!` command (step 11) will belong to,
  not a hole in the read-only rule for the category page itself.

## 3. `inverse_label`
- Migration `0006`: `schema_fields.inverse_label text NULL`. Meaningful only for
  `Link`/`List`; always `NULL` for other types (mirrors how `unit`/`select_options`
  are type-gated today).
- Schema editor `FieldForm`: when `needsTargetCategory(type)`, show an optional
  "Inverse label" text input next to the target-category select — e.g. placeholder
  "How does the target relate back? e.g. Student, Member".
- **Resolution rule:** displayed label = `field.inverse_label?.trim() || field.name`.
  The forward field name is always a safe fallback, so a backlink is never shown
  with a blank or missing label.

## 4. Backlink rail — hover context
- The shared hover tooltip (`SubjectHoverCard`, used by both mentions and
  backlinks) gains a "Referenced via" line, built from the **full**, un-deduped
  `relationships` rows for that (source, this-subject) pair — not just the one
  row used to decide the source belongs in the flat list:
  - Field-origin rows → one entry per distinct `field_id`, using the resolution
    rule from §3.
  - Fact-origin rows → one entry, `"Mentioned in N facts"` (count only).
  - Joined with `" · "`, e.g. `"Mentor · Mentioned in 2 facts"`.
- The flat rail entries (name + category) are unchanged — this is additive
  context on hover only, not a new grouping.

## 5. Select mode & promote

### 5.1 Entry
- A "Select" text link appears above "Referenced by" (only when `backlinks.length
  > 0`). Clicking it turns every `<li>` into a checkbox row and disables the
  subject-name link (selection replaces navigation while active — re-enabled on
  exit). The link becomes "Done" / a "Cancel" sits alongside once selection is
  non-empty, either of which clears selection and restores the normal rail.

### 5.2 Category constraint
- The first checked backlink locks `lockedCategoryId` to that entry's category.
  Every other entry whose category differs is immediately disabled (dimmed,
  `title="List fields hold one category — deselect to change"`). Unchecking the
  last selection in the locked category clears the lock and re-enables everything.
  This prevents ever reaching "Promote" with an invalid mixed-category selection.

### 5.3 Promote
- Once ≥1 is selected, the "Select"/"Done" row is replaced by an action bar:
  `Promote {n} to List…` + `Cancel`.
- Clicking it expands an inline panel below the list, in the same rail — no
  navigation, no overlay:
  - If this subject already has ≥1 `List` field with `target_category_id ===
    lockedCategoryId`, a `<select>` lists them ("Add to existing…").
  - Always available beneath that: "or create new" — a text input (field name) +
    "Create" button.
  - Submitting either calls `promoteToListField` (§6). **Additive**: the field's
    final members = its current members ∪ the selected backlink ids (never a
    wholesale replace — this is the one place list-field writes diverge from
    `setListValue`'s normal delete-then-insert semantics, and that divergence
    should be called out in code, not just here). A new field starts with
    exactly the selected ids.
  - On success: select mode exits, the panel closes, `router.refresh()` shows the
    new/updated field in the subject's field block immediately.

---

## 6. Files
- `lib/db/schema.ts` + `drizzle/0006_*.sql` — `schema_fields.inverse_label text`.
- `app/actions/schema-fields.ts` — `draftFromForm`/`createField`/`updateField`
  read + write `inverse_label` (Link/List only, else `null`).
- `.../categories/[categoryId]/page.tsx` — new read-only `<SchemaSummary>`
  replacing the inline `<SchemaEditor>`; add "Edit schema" link.
- `.../categories/[categoryId]/schema/page.tsx` — **new route**: same data
  loading as today's category page schema section, renders the existing
  `<SchemaEditor>` + back link. `schema-editor.tsx` itself only changes to add
  the `inverse_label` input in `FieldForm`.
- `.../subjects/[subjectId]/page.tsx` — backlinks query adds `field_id` to the
  `relationships` select and the source subject's `category_id` (not just its
  name, needed for the §5.2 lock check); keep the full un-deduped origin rows
  per source subject alongside the deduped flat list; resolve `inverse_label`/
  `name` for every `field_id` present.
- `.../subjects/[subjectId]/subject-page.tsx` — `Backlink` type gains
  `categoryId` + origin info (fact count, field labels); rail gets select-mode
  state, a `SelectableBacklinkRow`, and the inline `PromotePanel`.
- `.../subjects/[subjectId]/mention.tsx` (`SubjectHoverCard`) — accepts an
  optional "Referenced via" line to render.
- `app/actions/backlinks.ts` — **new**. `promoteToListField(formData)`:
  `{worldId, subjectId, fieldId? | newFieldName?, targetCategoryId, subjectIds}`
  → resolves or creates the field, unions its current `list_value_subjects` with
  `subjectIds`, then writes through the same path `setListValue` uses. Factor
  that write (`field_values` upsert + `list_value_subjects` replace +
  `syncFieldRelationships`) out of `app/actions/field-values.ts` into a shared
  `writeListValue(supabase, subjectId, fieldId, memberIds)` so both callers stay
  in sync.

## 7. Verification
- Category page shows fields read-only with no edit affordances anywhere on it;
  "Edit schema" opens `/schema`; changes made there are reflected on return.
- `inverse_label` set on a List field → the target subject's backlink tooltip
  shows it; left unset → tooltip falls back to the forward field name; the input
  never appears for non-Link/List types.
- Select mode: entries become checkboxes; checking a Character disables a Place
  entry (with an explanatory title); unchecking re-enables it; Cancel clears
  without navigating; clicking a name mid-select does not navigate.
- Promote → existing field: result is a union, no duplicates, prior members
  survive.
- Promote → new field: creates a List field targeting the locked category,
  pre-filled with exactly the selection; shows up immediately in the field block.
- Promoting does not touch the original fact-mention backlink — it still shows,
  still counts toward "Mentioned in N facts".
- Build: lint + `tsc` clean (no `any`).
