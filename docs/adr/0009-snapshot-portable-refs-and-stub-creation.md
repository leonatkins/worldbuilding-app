# Snapshot portable references and stub-category creation

**Status:** accepted

Templates store a **snapshot** of category/field structure (design §4.5): a
frozen, detached, UUID-free blob. Applying a template unpacks that blob into
real `categories` + `schema_fields` rows in a destination world. The question
this ADR answers: how does a List/Link field in a snapshot refer to its target
category, when UUIDs are world-specific and useless elsewhere?

## Context

A `schema_fields` row's `target_category_id` is a real FK to `categories.id`,
constrained `ON DELETE RESTRICT`. At apply time we create fresh categories (new
UUIDs) and must wire each List/Link field's `target_category_id` to one of them.
A snapshot can't hold the source world's UUIDs — they won't exist in the
destination, and a stub-category / re-point dance would be fragile.

Two apply shapes share the problem:
- **world template** — creates several categories at once; a field in one may
  target a sibling also being created;
- **schema template** — creates (or merges into) one category; a field may
  target a category that already exists in the destination world, or one that
  doesn't.

## Considered Options

- **Store the target's source UUID:** rejected — world-specific, useless after
  copy, and forces a re-point/repair step on every apply.
- **Store the target by name everywhere:** works for schema templates (resolve
  in the destination world), but a world template creates its own siblings —
  two categories in one snapshot could share a name and a name-based ref would
  be ambiguous.
- **World templates use a portable `localKey`; schema templates use the target's
  *name*; missing schema targets auto-create an empty stub category (chosen):**
  - World: each category in the snapshot gets a stable `localKey` (`"cat-1"`,
    `"cat-2"`, …); List/Link targets reference a sibling by `localKey`,
    resolved at apply time by mapping `localKey → newUUID`.
  - Schema: List/Link targets store the target's *name*, resolved by name
    lookup in the destination world (case-insensitive). If the named target is
    absent, an empty **stub category** is auto-created *before* the field is
    inserted (the `RESTRICT` constraint requires the target to exist), so the
    field is immediately functional. Reported inline ("Applied X · also created
    category: Y"), no modal.

## Consequences

- The snapshot TS type (`lib/templates/types.ts`) is the single shape shared by
  hardcoded built-ins and the `templates.content` jsonb column — both hold
  `target: { localKey? } | { name? }`, never a UUID.
- Apply is source-agnostic: `applyWorldSnapshot` and `applySchemaToNewCategory`
  (`lib/templates/apply.ts`) return insert payloads with fresh UUIDs + a stub
  plan; the server action performs the writes under an undo-on-failure chain.
- Stub categories are cheap, empty, and deletable; the user fills them in-world
  via the existing editors. A future "delete the stub I just made?" affordance
  is post-launch polish, not required for correctness.
- Renaming a target category in the destination world after a schema-template
  apply does **not** break already-applied fields (they store the UUID, not the
  name) — the name is only a portable *apply-time* reference.
