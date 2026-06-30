# Delete is soft, project-wide, via a 30-day "Recently Deleted"

**Status:** accepted

Every user-facing **Delete** in the app (worlds, categories, subjects — and any
future deletable entity) is a **soft delete**: it stamps a `deleted_at timestamptz`
rather than removing the row. Deleted items move to a **"Recently Deleted"** view,
are restorable, and are **hard-deleted automatically after 30 days** (a `pg_cron`
job), with a manual "Delete now" also available. The action is labelled **"Delete"**
(red/decisive), not "Archive".

## Context

Users expect a real, decisive **Delete** — a grey "Archive" reads as wishy-washy
and is distrusted. But destructive deletes with only a confirm dialog still cause
data-loss regret, especially for **worlds**, where delete CASCADEs an entire
project. "Archive" and "delete with an undo window" are the same mechanism with
different framing; we pick the framing users want (Delete) and keep the safety net
(Recently Deleted). Model is the Apple Notes/Photos "Recently Deleted" pattern.

This supersedes the step-4 design's per-subject `archived_at` "archive" concept:
the column is renamed `deleted_at` and the concept generalizes to all entities.

## Considered Options

- **Hard delete + confirm only (prior step-5 world behavior):** simplest, but
  irreversible; one mistaken world delete destroys everything. Rejected.
- **"Archive" soft-delete (original design §4):** recoverable, but the grey,
  non-committal label is exactly what users dislike, and it was subject-only.
  Rejected on framing + scope.
- **Soft delete → Recently Deleted → 30-day auto-purge, project-wide (chosen):**
  decisive Delete label + universal undo window + eventual real cleanup. Cost:
  every read must filter `deleted_at IS NULL`, and step 5 needs retrofitting.

## Consequences

- **Schema:** `deleted_at timestamptz NULL` (NULL = live) on `worlds`,
  `categories`, `subjects` (subjects: rename from `archived_at`). Added in the
  step-7 migration alongside tags, plus `pg_cron` purge jobs:
  `DELETE … WHERE deleted_at < now() - interval '30 days'` per table (the hard
  delete then CASCADEs children).
- **Every read filters `deleted_at IS NULL`** in app code (door 1). RLS cannot do
  this — it is ownership-only, and the Recently Deleted view must still *read*
  deleted rows. A shared query helper standardizes the filter to reduce the
  "forgot one filter → deleted rows leak" risk. This is the main ongoing cost.
- **Soft-deleting a parent hides its children** without touching them (no cascade
  on soft delete): delete a world and its categories/subjects/facts simply become
  unreachable. **Restore is therefore lossless** — everything returns intact. Only
  the 30-day auto-purge performs the real CASCADE.
- **A soft-deleted entity's URL 404s** (resolvers filter `deleted_at IS NULL`);
  recovery is via Recently Deleted, not the dead link.
- **Recently Deleted views** live per level: worlds on `/`, categories on the
  category manager, subjects on the category page. Each offers Restore + Delete now.
- **Step 5 retrofit:** `deleteWorld` becomes soft; `/` gains a Recently Deleted
  view.
- `pg_cron` must be enabled on the Supabase project (extension).
- **Facts joined the model (step 8 / ADR 0006):** `facts.deleted_at` added
  (migration 0005) with a `purge-facts` job, so "any future deletable entity" now
  explicitly includes facts. Facts are non-routable, so they have no Tombstone of
  their own — a deleted fact simply leaves its subject's live list and sits in
  the subject's Recently Deleted section.
