# Roles (subject-level field bundles) deferred out of MVP

**Status:** accepted

A "Role" was a named, reusable bundle of schema fields owned by a category
(e.g. `Mentor` on Character), allowing subject-level variation — Gandalf holds
`Mentor` and shows `Mentees`; Frodo does not. It required a `roles` table, a
`subject_roles` join, dual ownership on `schema_fields` (category OR role), and
field-composition logic at render time.

We cut it because the PRD's existing rule — **empty schema fields are hidden by
default** — already solves the motivating problem for the 90% case. Add
`Mentees` to the Character category; it's invisible on Frodo (empty), visible on
Gandalf (filled). Roles added picker-scoping and multi-field bundling on top,
but those are marginal gains that complicate the first migration and introduce a
third structure mechanism alongside category schema and templates — pushing
against the product's own friction-asymmetry principle.

## Consequences

- `schema_fields` is owned by its category only (no `role_id`).
- `roles` and `subject_roles` tables are not built in this phase.
- The `!` field autocomplete (step 11) covers category fields only.
- Revisit post-MVP if real usage shows subjects drowning in irrelevant
  category-level fields that hide-empty can't cleanly suppress.
