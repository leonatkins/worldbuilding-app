# Tags are excluded from the project-wide soft-delete pattern

**Status:** accepted

ADR 0005 makes every user-facing Delete soft, project-wide. Tags are the one
exception: `deleteTag` is a hard delete — it removes the tag row outright,
which cascades (via the `subject_tags` FK) to strip the tag from every subject
that carries it, with no `deleted_at`, no "Recently Deleted" entry, and no
Restore.

This was harmless while no UI called `deleteTag`. It stops being harmless once
the Tag manager (step-7 fix pass, subject CRUD testing) puts a delete button
one click away for every tag in a world — including tags applied to many
subjects at once.

We chose not to extend full soft-delete to tags (new migration + purge-cron
entry, a bigger scope than a bug-fix pass justifies). Instead the Tag
manager's delete requires an inline confirm step naming the affected subject
count, mirroring the confirm-delete pattern already used for categories and
subjects. The delete itself remains immediate and permanent — the confirm
step is a UI safeguard, not a data-layer undo window.

## Consequences

- `tags` has no `deleted_at` column and is not part of any `pg_cron` purge job.
- A confirmed tag delete cannot be undone; recovery means manually recreating
  the tag and re-applying it to every subject that had it (no record of which
  subjects those were once the join rows are gone).
- Revisit if usage shows accidental tag deletion is a real (not just
  theoretical) source of data-loss regret — at that point, tags should adopt
  the same `deleted_at` / Recently Deleted / Restore shape as every other
  entity, per ADR 0005.
