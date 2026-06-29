# Open Questions & Things to Think About

A living list of decisions, edges, and risks surfaced while building steps 5–7
and reviewing the codebase (see [`architecture-review-2026-06.md`](architecture-review-2026-06.md)).
Not bugs with tickets — these are the "come back to this" items so nothing is
lost between steps. Grouped by theme; each has a recommendation so a future
session can act without re-deriving the context.

Legend: 🟡 address before it bites · 🟢 minor / when convenient · 🔵 needs a
product decision.

---

## Correctness / consistency

### Q1 🟡 Subject page resolves its category without the active filter
`subjects/[subjectId]/page.tsx` loads the subject's own category by id with no
`deleted_at IS NULL`. A subject whose category was soft-deleted still renders the
category name and back-link as if live. Every *other* read is filtered via
`activeOnly`/`deletedOnly`; this is the lone exception.
**Recommend:** decide the intended behavior for "subject in a soft-deleted
category" (it can exist because soft-delete doesn't cascade to children). Likely:
treat the category as gone — either 404 the subject too, or show a "category was
deleted — restore it or move this subject" banner. At minimum, filter the resolve
so the stale name doesn't show. Tie this to Q2.

### Q2 🔵 What is the experience of a child under a soft-deleted parent?
Soft delete deliberately doesn't cascade (so restore is lossless), which means
live subjects can sit under a deleted category, and live categories under a
deleted world. Today nothing surfaces them because the *lists* are filtered, but
direct URLs still resolve (except where 404'd). Restore is the happy path; the
in-between state is undefined.
**Recommend:** define one rule project-wide: "a child is reachable only if all
its ancestors are live." Implement as an ancestor-active check on the direct-URL
resolves (subject → category → world). Cheap, and it makes the soft-delete model
fully coherent. Worth a short grill before step 8 since facts add another child.

### Q3 🟢 Field-value edits don't bump `subjects.updated_at`
Editing a field value writes `field_values` but not the parent subject's
`updated_at`, so "Last edited" sort and the future dashboard's "recently edited"
miss value edits.
**Recommend:** treat a value edit as editing the subject — stamp
`subjects.updated_at = now()` in `setScalarValue`/`setLinkValue`/`setListValue`/
`clearFieldValue`. Do the same when step 8 writes facts.

### Q4 🟢 `field_values.updated_at` not bumped on upsert
Column exists (`defaultNow()`) but `onConflict` upserts don't set it, so it
reflects create time. Harmless until something reads per-value recency.
**Recommend:** set `updated_at: new Date().toISOString()` in the upsert payloads
when convenient; or drop the column if nothing will ever need it.

## Operational

### Q5 🟡 `pg_cron` availability is unverified on the cloud project
The 30-day purge runs in a best-effort `DO` block with an exception handler, so a
missing/disabled extension fails silently. If cron isn't actually scheduled,
Recently Deleted never auto-empties and "deleted" rows live forever.
**Recommend:** (1) confirm `pg_cron` is enabled on project `rwlavanchioqmuehfttp`
and the purge jobs are registered (`SELECT * FROM cron.job;`); (2) document a
manual purge fallback (a SQL snippet / admin action) in case it isn't; (3)
consider a lightweight "purge on access" safety net (when a user opens Recently
Deleted, hard-delete anything already >30 days) so correctness doesn't depend on
cron alone.

## UX / interaction

### Q6 🟢 Scalar editor "Done" without "Save" drops input
Dismissing an inline scalar editor without an explicit save discards typed text
silently. Minor now, but it contradicts the "never lose typing" principle that
fact autosave (memory `fact_draft_autosave`) will establish in step 8.
**Recommend:** either autosave on blur, or warn on dismiss-with-changes. Settle
the pattern in the step-8 autosave grill and apply it to field values too for
consistency.

### Q7 🟢 Global "+ New subject" doesn't expand a category sub-menu
The grilled Q7 design: when no category is in the URL, the create menu expands an
in-place category picker (non-covering) so you can pick the target. Today it just
routes to the world home. Functional, not the full affordance.
**Recommend:** implement the in-popover category sub-menu when there's a world
but no category context. Low priority; the inline create on each category page
already covers the common path.

### Q8 🟢 Date / Color value display polish
Date is freeform text with learned-autofill (datalist) — works, but the learner
is v1 (suggestions only). Color stores a value but the read display is basic.
**Recommend:** the deferred Date v2 (detect a format skeleton from prior entries
and pre-fill separators) and a proper Color swatch chip are good candidates for
the near-launch visual polish pass (memory `project_visual_polish_pass`), not
worth interrupting feature work now.

## Deferred value-migration edges (from the step 6/7 grill)

These were explicitly logged during grilling and are restated here so they aren't
buried in `step-6-7-grill-notes.md`.

### Q9 🟢 Re-point a List/Link field that already has values
When a field's `target_category_id` changes, existing values point at
now-wrong-category subjects. Current handling clears that field's values on
re-point (with a count shown). Confirm this still holds end-to-end once there's
real data, and that the count shown matches what's cleared.

### Q10 🔵 Change a field's *type* with existing values
Incompatible type changes should clear values (counted warning); compatible
widenings (e.g. Select → MultiSelect) should migrate, not clear. The exact
compatibility matrix was deferred.
**Recommend:** write the compatibility matrix explicitly (which type→type
migrates vs clears) before exposing type-change on fields that have values. Until
then, the safe default is clear-with-confirm.

### Q11 🟢 Change a subject's category clears non-matching values
Implemented (counted blocking confirm; facts + tags survive; inbound links left
as-is by design). No action — listed for completeness. Revisit the "inbound
type-mismatch left as-is" choice only if it causes confusion in practice.

---

## How to use this file
- When you act on an item, move it to a "Resolved" note or delete it with a
  pointer to the commit/ADR.
- Promote anything that becomes hard-to-reverse + surprising + a real trade-off
  into an ADR (the F1/Q2 soft-delete reachability rule is the most likely
  candidate).
- Re-read before step 8 (facts) — Q2, Q3, and Q6 all intersect facts.
