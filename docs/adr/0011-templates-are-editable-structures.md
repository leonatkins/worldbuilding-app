# Templates are editable structures

**Status:** accepted

A template is not only a frozen photograph read at apply time — it is an
**editable structure**: the library offers a full in-place editor (edit fields,
add/remove, reorder, rename) plus a "New template" entry that authors a
categories+fields snapshot from scratch, then saves. This expands step 13's
scope beyond a library list.

## Context

The snapshot model (design §4.5) is detached: applying a template copies the
blob into real rows; editing the template afterward must not touch any already-
applied world. The question is whether editing the *snapshot itself* is a
first-class feature, or whether templates are save-as-only (recreate to change).

## Considered Options

- **Recreate-only (save-as, no editor):** simplest; matches a strict
  "snapshot = frozen photograph" reading. But editing a large world template
  means re-deriving the whole world's structure just to change one field —
  wasteful and friction-heavy.
- **Full in-place editor + new-blank-template entry (chosen):** the library
  opens a structural editor on any private template; a "New template" entry
  opens the same editor on an empty snapshot. Symmetric with editing existing
  templates. Detachment is preserved: editing mutates only the snapshot blob
  (`templates.content` jsonb), never any already-applied world's rows.

## Consequences

- The template editor is a third editor surface (alongside category schema and
  world). It reuses the existing schema-editor UI patterns rather than being
  built from scratch.
- Built-in templates remain read-only (they live in code; edit by forking into
  a private copy via save-as).
- The snapshot TS type (`lib/templates/types.ts`) and parser
  (`lib/templates/parse.ts`) are the contract the editor writes against; an
  invalid edit fails parse + save with an inline error, never corrupting the
  stored blob.
- Detachment discipline is explicit: a test asserts that editing a template
  leaves an already-applied world byte-identical (the editor writes only to
  `templates.content`).
