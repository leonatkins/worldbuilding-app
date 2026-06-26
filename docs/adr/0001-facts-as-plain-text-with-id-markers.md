# Facts are plain text with `@{id}` mention markers

**Status:** accepted

A fact is stored as a single run of plain text with inline `@{id}` markers for
mentions (`Trained under @{a1b2} before meeting @{c3d4}`). The referenced
subject's name is **never** stored in the fact — not even as a cache; the id is
the only reference, and the name is resolved live at render time. This
supersedes the PRD's original "hybrid object model" (§6.6, §12), which stored
mentions as `{ type, id, displayName }` segment objects with a cached
`displayName`.

## Considered Options

- **Hybrid segment object model (PRD original):** array of text/mention segments,
  mention carries a cached `displayName`. Rename-safe only if the cache is kept
  fresh; introduces a staleness window and a richer storage format to migrate.
- **Plain text + `@{id}` markers (chosen):** one TEXT column, a trivial
  parser/serializer (`lib/facts`), no cached names, so no staleness window at
  all. Markers may appear anywhere, any number of times.

## Consequences

- Renaming a subject updates every fact that mentions it instantly, with zero
  find-and-replace and no cache invalidation.
- Because names are not in the stored text, **search by mentioned name must be
  resolved at query time.** Global search (PRD §6.8) runs a **dual match**:
  resolve the query term to subject ids and match facts whose `@{id}` markers
  contain those ids, **unioned** with a literal substring match on the fact's
  own text. A fact that mentions "Gandalf" is found even though "Gandalf" never
  appears in its stored bytes.
- `@{id}` syntax is internal and changeable; it is not domain language and does
  not belong in `CONTEXT.md`.
