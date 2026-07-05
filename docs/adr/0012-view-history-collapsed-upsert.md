# View history is a collapsed per-subject upsert, not an event log

**Status:** accepted

Home and each world's Overview surface "Recently viewed" subjects (step 15a). To
do that the app must record *which subjects an account opens, and when*. This ADR
records how that record is stored: a single `subject_views` row per
`(account_id, subject_id)` whose `last_viewed_at` is **upserted** on each view —
not an append-only log of individual view events.

## Context

"Recently viewed" only ever needs the *most recent* open per subject, in recency
order, capped at a handful. There is no product requirement (now or on the near
roadmap) for per-view analytics — view counts, time-of-day histograms, a full
trail. The account is single-user and cross-device, and the app is server-rendered
with RLS scoping every table to its owner (denormalized `account_id`, design §5).

Recording fires from a mount effect on the subject page (`recordSubjectView`
server action), not during RSC render — writing during render is an anti-pattern
and interacts badly with caching.

## Considered Options

- **Append-only event log** (`subject_view_events`, one row per open): richest
  future analytics, but unbounded growth, needs a prune job, and every read
  becomes a `GROUP BY subject_id, MAX(viewed_at)` aggregate. Pays for a capability
  nothing needs yet.
- **Client `localStorage` only:** zero schema, but per-device (not cross-device),
  lost on clear, and can't be filtered server-side against soft-deletes. Wrong fit
  for an account-level surface.
- **Collapsed per-subject upsert (chosen):** `PRIMARY KEY (account_id, subject_id)`,
  `last_viewed_at` bumped on conflict. The table is bounded by the number of
  distinct subjects the account has ever opened (small); the read is a trivial
  `ORDER BY last_viewed_at DESC LIMIT N`. No prune job.

## Consequences

- Table: `subject_views(account_id, subject_id, last_viewed_at)`, PK on
  `(account_id, subject_id)`, RLS own-rows, both FKs `ON DELETE CASCADE`.
- The `subject_id` cascade means the 30-day hard purge (ADR 0005) auto-removes
  view rows; soft-deleted subjects (and subjects under a soft-deleted world) are
  filtered out on read via `activeOnly` — deleted things stay in Recently Deleted,
  not on Home.
- We deliberately forgo per-view analytics. If that need ever arrives, it is an
  additive event table alongside this one, not a migration of it.
- No `updated_at` column: `last_viewed_at` *is* the recency key.
