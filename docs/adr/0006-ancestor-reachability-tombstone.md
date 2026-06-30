# A routable entity resolves only if every ancestor is live; else a Tombstone

**Status:** accepted

Soft delete (ADR 0005) deliberately does not cascade, so a live child can sit
under a soft-deleted parent (a subject under a deleted category, a category
under a deleted world). We rule that **a routable entity (world, category,
subject) resolves only if it *and* every ancestor is live**. When the chain is
broken — or the entity is itself soft-deleted — the route renders a **Tombstone**:
a friendly screen naming what's in Recently Deleted and offering Restore, instead
of a bare 404. Facts are not routable (ADR 0001 — no `/facts/[id]`; they render
only inside a subject), so they inherit reachability from their subject and need
no check of their own.

## Context

ADR 0005 keeps restore lossless by *not* cascading soft delete: deleting a world
leaves its categories/subjects untouched, just unreachable via the filtered
lists. But direct URLs (bookmarks, `@mention` links, browser back) still
resolved a live child even when an ancestor was in the trash, because each
resolver only filtered its *own* `deleted_at` — never the chain above it
(`subjects/[subjectId]/page.tsx` didn't check the world or category;
`categories/[categoryId]/page.tsx` didn't check the world; the subject page even
resolved its category name with no filter at all — open-questions Q1). The
in-between state ("live child, dead ancestor") was undefined (Q2). Step 8 adds
facts, a fourth level, which forced the question to be settled.

## Considered Options

- **Plain 404 for broken chains (consistent with ADR 0005's "deleted URL
  404s").** One code path, ships immediately. Rejected: a 404 is a white lie for
  an entity that isn't actually deleted, and gives the user no hint that the fix
  is "restore the ancestor."
- **Cascade soft delete to children.** Makes every resolver's own filter
  sufficient. Rejected: breaks ADR 0005's lossless restore (you'd have to track
  and reverse the cascade).
- **Ancestor-live check + Tombstone screen (chosen).** Each resolver verifies the
  whole ancestor chain; any break (or a self-delete) renders one reusable
  Tombstone that names the deleted ancestor and links to Restore. More helpful,
  one screen, no schema change.

## Consequences

- **Resolvers walk the chain.** `subjects/[subjectId]` must confirm its category
  *and* world are live; `categories/[categoryId]` must confirm its world is live;
  `worlds/[worldId]` checks itself. The unfiltered category-name resolve (Q1) is
  fixed by this.
- **One reusable Tombstone screen** serves all cases — subject under dead
  category, subject under dead world, category under dead world, *and* an
  entity that is itself soft-deleted — parameterized by which ancestor died, with
  copy like "This subject's category is in Recently Deleted." It replaces the bare
  404 for soft-deleted entities too, so there is a single "this isn't here right
  now" experience. "Tombstone" is an internal code/docs term, never shown to
  users (they see only friendly copy). The skeleton mascot art (deferred to the
  near-launch visual-polish pass) slots into this screen later; step 8 ships it
  functional with a placeholder.
- **`@mention`s to an unreachable subject** render as a dead/`(deleted)` link,
  already true for genuinely-deleted subjects — consistent.
- **Restore stays the recovery path:** restoring the deleted ancestor brings the
  whole subtree back to life automatically; the Tombstone just points the user
  there.
