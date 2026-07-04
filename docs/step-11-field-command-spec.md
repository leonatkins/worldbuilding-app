# Step 11 — Field Command (`!` field autocomplete)

**Status:** Approved (grilled 2026-07-04)
**Roadmap step:** 11
**Depends on:** step 9 (`MentionInput`/ADR 0007, caret-anchored `@` typeahead),
step 7 (`field_values` writes: `setScalarValue`/`setLinkValue`/`setListValue`,
`SubjectPicker`'s category-scoped `searchSubjects`), step 6 (`schema_fields`,
`createField`)
**Source design:** PRD §6.6 (`!` field autocomplete) · design.md §4.3
(relationships & backlinks, "three gradient bridges") · CONTEXT.md (Field
command, Mention, Backlink)

Turns a fresh fact line into the second deliberate bridge (alongside step 10's
backlink promotion) by which loose facts crystallize into schema structure:
typing `!` at the very start of the composer opens a typeahead over the
subject's category's fields; picking one and typing a value fills that field
directly instead of saving a fact. An unmatched name offers to create the
field on the spot for the four types simple enough to infer from typed text.

---

## 1. Scope
| Capability | Summary |
|---|---|
| **Trigger** | `!` only opens the field typeahead as the very first character of an otherwise-empty `FactComposer` instance — never mid-fact, never in the inline fact editor. |
| **Field-name typeahead** | Fuzzy (subsequence) match over the category's fields, client-side, reusing the existing popover UI/keyboard nav from `@` mentions. Query is a single whitespace-bounded token, same boundary rule as `@`. |
| **Fill (existing field)** | Value text after `!fieldname ` is parsed per the field's type and written through the existing field-value actions; the line clears, no fact is created. |
| **Fill (Link/List)** | The value supports the existing `@` mention trigger, scoped to the field's target category via the existing `searchSubjects` action. |
| **Create new field** | An Enter-time name that doesn't exactly match any field offers an inline `Create "Name" · Type` confirm, type guessed from the typed value — Text/Number/Date/Boolean only. |

### Explicitly NOT in this step
- **No field-command in the fact editor** — editing an existing saved fact
  never reinterprets its first line as a command; that surface is unchanged.
- **No mid-fact `!`** — unlike `@`, `!` is not detected anywhere except
  position 0 of a fresh line; typed elsewhere it is always literal text.
- **No Select/MultiSelect/Scale/Color/Link/List creation via `!`** — these
  need config (an options list, scale bounds, a target category) that doesn't
  fit a one-line confirm. They remain fillable by `!` once they exist, just
  not creatable this way; use the schema editor (step 10 §2 route) instead.
- **No additive/union List semantics** — `!members @Aragorn` replaces the
  field's members (matching `setListValue`), it does not union like step 10's
  `promoteToListField`.
- **No multi-field lines** — one `!fieldname value` per Enter, matching the
  PRD's examples; no `!age 12 !height 150cm` compound syntax.

---

## 2. Trigger & scope
- Detection lives in `MentionInput` (`mention-input.tsx`, ADR 0007), behind a
  new optional `fieldCommand` prop. Only `FactComposer` passes it; `FactEditor`
  does not, so editing existing facts is entirely unaffected.
- `!` is recognized only when it is the first character typed into a
  composer instance that is otherwise still empty — not per-line inside a
  multi-line fact (shift+Enter), not anywhere else `@` is legal.
- Once field-command mode is active for the current line, it stays active
  until the line clears (success) or Escape cancels a pending create-prompt;
  there is no separate "escape hatch" back to plain-fact mode mid-line —
  deleting the leading `!` and continuing to type is how a user recovers if
  they didn't mean to trigger it.

## 3. Field-name matching
- Query = the run of non-whitespace characters immediately after `!` (same
  boundary as the existing `@` regex, anchored to content-start instead of
  `(^|\s)`).
- Matching is a hand-rolled, case-insensitive **subsequence** fuzzy match
  (`!bday` → `Birthday`) over the category's fields — both filled and empty,
  no fill-state filtering — run client-side against the `fields` list already
  loaded on the subject page. No new server round-trip.
- Picking a result (arrow keys + Enter/click, mirroring `@`) rewrites the
  typed query to the field's exact real name plus a trailing space
  (`!Birthday `) as plain, editable text — not an atomic chip, since nothing
  about it needs to survive past this Enter.
- **Enter-time resolution requires an exact, case-insensitive name match.**
  Fuzzy matching is a live-typing aid only; if Enter is hit (whether or not
  the dropdown was ever opened) and the name doesn't exactly match a real
  field, it falls through to §5 (create new field).

## 4. Filling an existing field
- **Scalar types** (Text, Number, Boolean, Select, MultiSelect, Date, Scale,
  Color): the typed value is parsed by a new free-text layer over
  `coerceScalarValue` (`lib/field-values.ts`) — trimmed, case-insensitive:
  - Select/MultiSelect matched against the field's configured options
    (MultiSelect splits on commas).
  - Boolean accepts yes/no/true/false/y/n.
  - Number/Scale/Date/Text/Color otherwise unchanged from `coerceScalarValue`.
  - No match/invalid value → inline error, the line stays exactly as typed,
    editable, nothing consumed (same "never lose typing" rule as everywhere
    else — open-questions Q6).
  - Writes through the existing `setScalarValue` action.
- **Link**: the value supports the existing `@` mention trigger, but scoped
  to `field.target_category_id` via the already-existing
  `searchSubjects(targetCategoryId, query, excludeId)` action
  (`subject-picker.tsx`) — not the unscoped `searchSubjectsInWorld` mentions
  use. A second `@` mention in a Link value is an error ("Link only takes
  one"), not a silent last-wins overwrite. Writes through `setLinkValue`.
- **List**: same category-scoped `@` trigger, any number of mentions. Writes
  through `setListValue` — **full replace**, matching normal List-field
  editing everywhere else (not the additive union `promoteToListField` uses).
- On success: composer clears and remounts exactly like a normal fact save
  (the existing `editorKey`-bump pattern), and `router.refresh()` shows the
  updated value in the field block immediately.

## 5. Create new field
- Reached only at Enter, when the typed name doesn't exactly match a real
  field (§3). There is no separate "Create new field" row in the live
  dropdown — while typing the name, the dropdown just shows fuzzy matches or
  the existing "No matches" state, since there's no value yet to guess a type
  from.
- Type is guessed from the already-typed value by a new pure
  `guessFieldType` helper (`lib/schema-fields.ts`): numeric string → `Number`;
  date-like pattern → `Date`; yes/no/true/false (case-insensitive) →
  `Boolean`; else → `Text` (always-safe fallback).
- An inline confirm banner appears above the input (rendered by
  `MentionInput`, sibling to its existing dropdown popover):
  `Create "Birthday" · Date` with `[↵ confirm]` / `[esc cancel]`.
- Confirm → creates the field via the existing `createField` action
  (`app/actions/schema-fields.ts`, category = the subject's own category, no
  target/options/scale config since only the four simple types are reachable
  here), then fills it via `setScalarValue`; composer clears, `router.refresh()`.
- Cancel (Escape) → banner closes; the typed text remains in the composer,
  untouched and still editable (delete the leading `!` to save it as a plain
  fact instead, or keep adjusting).
- Only Text/Number/Date/Boolean are creatable this way. Select, MultiSelect,
  Scale, Color, Link, and List still require the full schema editor.

## 6. Files
- `lib/schema-fields.ts` — `guessFieldType(raw: string)` and a subsequence
  fuzzy-match helper (e.g. `fuzzyMatchFields(fields, query)`); pure, tested.
- `lib/field-values.ts` — free-text parsing layer (Boolean/Select/MultiSelect
  normalization) feeding into the existing `coerceScalarValue`; tested.
- `.../subjects/[subjectId]/mention-input.tsx` — the `fieldCommand` prop:
  content-start `!` detection, field-name typeahead, nested category-scoped
  `@` handling for Link/List values, the create-field confirm banner,
  Enter-time resolution and dispatch to `fieldCommand`'s callbacks.
- `.../subjects/[subjectId]/facts-list.tsx` (`FactComposer`) — builds and
  passes `fieldCommand`, wiring its callbacks to
  `setScalarValue`/`setLinkValue`/`setListValue`/`createField`, same pattern
  `FieldEditor` already uses in `subject-page.tsx`.
- `.../subjects/[subjectId]/subject-page.tsx` — threads `category.id` and
  `fields` down into `<FactsList>` (not currently passed).
- `CONTEXT.md` — **Field command** glossary entry (done).
- `docs/ROADMAP.md` — step 11 flips to ✅ once shipped.

## 7. Verification
- `!` as the first character of a fresh composer line opens the field
  dropdown; `!` anywhere else (mid-fact, or in the fact editor) stays literal
  text.
- `!bday` fuzzy-matches `Birthday`; picking it rewrites to `!Birthday ` as
  plain text (not a chip).
- A valid value + Enter fills the field via the existing write actions,
  clears the composer, and the new value shows up immediately in the field
  block — no fact is created.
- `!members @Aragorn` only offers subjects from the field's target category;
  Enter replaces the field's members (not additive); a second mention on a
  Link field errors.
- An invalid value (bad Select option, non-numeric Number, a second Link
  mention) shows an inline error; the line stays editable, nothing is saved.
- `!Birthday 4/27/1304` with no existing `Birthday` field shows
  `Create "Birthday" · Date` on Enter; confirming creates and fills it in one
  flow; Escape cancels and leaves the typed text untouched in the composer.
- Select/MultiSelect/Scale/Color/Link/List are never offered in the
  create-new flow — only Text/Number/Date/Boolean.
- Build: lint + `tsc` clean (no `any`).
