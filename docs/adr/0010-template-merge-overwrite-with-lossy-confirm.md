# Template merge is overwrite + confirm-when-lossy via the Q9/Q10 matrix

**Status:** accepted

Applying a **schema** template can merge its fields into an *existing* category
(PRD §6.3: "merges its fields into the existing schema — it does not wipe"). When
a snapshot field collides with an existing field of the same name, what happens?
And what happens to the existing field's *values* when the incoming type or
config is incompatible?

This ADR records two coupled decisions: (1) merge **overwrites** on a same-name
collision (case-insensitive match, ignoring type), and (2) the lossiness of any
overwrite is decided by the Q9/Q10 field-**value** compatibility matrix, which
fires a single confirm listing every lossy collision with its affected-value
count — accept or cancel the whole apply (no per-field piecemeal).

## Context

The deferred open-questions Q9 (re-point a List/Link field that holds values)
and Q10 (change a field's *type* with existing values) were pulled into scope for
step 13 because template-merge *is* a type/config change on a field that may
already hold values. Leaving them deferred meant template-merge would silently
drop or silently keep data with no coherent rule.

Storage grounding (design §4.2): scalars in `field_values.scalar_value` (jsonb);
Link in `field_values.linked_subject_id`; List in `list_value_subjects` join
rows. "Lossy" = some existing values would be cleared by the transition.

## Considered Options

- **Skip on collision (earlier proposal):** non-destructive but silently drops
  the template's version even when the existing field is empty — surprising, and
  defeats the point of applying a template.
- **Overwrite every collision, no confirm:** delivers the template's version but
  can silently clear user data on a lossy transition — violates the never-lose-
  data spine (ADR 0005/0008).
- **Overwrite + confirm only when lossy (chosen):** overwrite delivers the
  template's version (usually the user's intent on apply); the lossy-detect +
  single-confirm protects the never-lose-data spine without friction on the
  common empty-field case.

## The Q9/Q10 matrix (decided)

| Transition | Behavior | Lossy? |
|---|---|---|
| Same type, config-only change, values survive (Number unit, Scale min/max not excluding current, Select *adds* options) | Migrate silently | No |
| `Select → MultiSelect` (widening) | Migrate silently | No |
| `MultiSelect → MultiSelect` where all current values survive | Migrate silently | No |
| Select/MultiSelect option-set change that *drops* an option a subject holds | Prune orphaned values only | Yes |
| Cross-scalar-type (Text→Number etc.) | Per-value parse; keep parseable, clear failures | Yes |
| Cross-storage-family (Scalar ↔ Link/List) | Clear all values on field | Yes |
| List/Link target-category change (Q9) | Clear all values on field | Yes |
| `MultiSelect → Select` narrowing where any subject holds >1 value | Clear all values on field | Yes |

Lossy transitions trigger the confirm with precise per-field counts (e.g.
*"Class: 3 of 50 values will be cleared"*).

## Consequences

- The matrix lives in `lib/templates/merge.ts` (`classifyTransition`), pure and
  fully unit-tested. The merge planner (`lib/templates/plan-merge.ts`) returns
  the lossy collisions; the server action performs the actual per-value
  pruning/parsing/clearing (it has DB access).
- Empty-field collisions overwrite silently (no confirm) — the common case.
- The same matrix backs the existing manual type-change / re-point paths (Q9
  re-point already cleared values; now it's governed by the matrix's
  `clear-all` cell with a counted confirm).
- Ties the never-lose-data family (ADR 0005/0008): template-merge is the first
  *bulk* lossy surface; the single confirm (not per-field) keeps it usable.
