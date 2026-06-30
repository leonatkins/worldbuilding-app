# Step 8 — Facts Engine

**Status:** Approved (grilled 2026-06-30)
**Roadmap step:** 8
**Depends on:** step 4 (`facts` table), step 7 (subject page), step 5.5 (soft delete)
**Source design:** [`design.md`](design.md) §4.1 · CONTEXT.md (Fact) · ADR 0001
(facts as plain text + `@{id}`) · ADR 0005 (soft delete) ·
[ADR 0006](adr/0006-ancestor-reachability-tombstone.md) (reachability/Tombstone)

The facts engine — a subject's primary content. Adds fact CRUD, fast-capture
entry, inline edit, drag-reorder, and soft delete on the subject page. Also lands
three grill decisions that intersect facts: reachability/Tombstone (ADR 0006),
`subjects.updated_at` stamping on value/fact writes (Q3), and the
never-lose-typing draft rule (Q6).

---

## 1. Scope
| Capability | Summary |
|---|---|
| **Fact create** | Fast-capture composer (textarea, **Enter** to save, **Shift+Enter** newline); cursor returns to a fresh input after save. |
| **Draft** | In-progress *new* fact text autosaved to `localStorage` (`fact-draft:{subjectId}`) and restored on reload/navigation — never lose typing (Q6 / memory `fact_draft_autosave`). |
| **Fact edit** | Inline textarea; **Save** commits, **Cancel/Escape dismiss = revert** (no draft — the saved text is the fallback). |
| **Reorder** | Drag-and-drop (`dnd-kit`), midpoint `position` (`lib/ordering`), one-row update. |
| **Delete (soft)** | One click → Recently Deleted (reversible, no confirm) → 30-day purge. Restore / Delete now per fact. |
| **updated_at (Q3)** | Every fact write *and* every field-value write stamps `subjects.updated_at = now()`. |
| **Reachability (ADR 0006)** | Subject/category resolvers verify the whole ancestor chain is live; a broken chain or self-delete renders a **Tombstone**, not a 404. |

### Explicitly NOT in this step
- **No `@mention` insertion/typeahead and no `@{id}` live render** — `body` is
  plain text here. Mentions (and therefore the `lib/facts` parser + fact-origin
  `relationships` writes) arrive in **step 9**.
- Because no fact-origin `relationships` rows exist yet, there is nothing to
  filter for deleted facts in step 8; that read-filtering lands with step-9
  mentions.
- No fact pin-to-top, no per-fact labels beyond plain text, no fact search
  (step 12).

---

## 2. Data
- `facts` (exists since step 4): `body text`, `position double precision`,
  `created_at`, `updated_at`, **`deleted_at` (added: migration `0005`)**.
- Migration `0005` also registers a best-effort `purge-facts` `pg_cron` job
  (30-day hard delete), mirroring the worlds/categories/subjects jobs in `0002`.
- A fact body is validated by `validateFactBody` (`lib/validation`): non-empty
  after trim, ≤ `MAX_FACT_LENGTH` (1000) — "one or two sentences, never a
  paragraph" (CONTEXT.md / design §4.1).

## 3. Server actions — `app/actions/facts.ts`
Door 1, RLS-scoped, `account_id` auto-stamped. `createFact` / `updateFact` /
`reorderFact` / `deleteFact` (soft) / `restoreFact` / `purgeFact`. Each mutation
calls `touchSubject` to bump `subjects.updated_at` (Q3). `nextFactPosition`
appends after the last *live* fact; `reorderFact` takes a client-computed
midpoint (mirrors `reorderField`).

## 4. UI — `…/subjects/[subjectId]/facts-list.tsx`
Client island mounted in `subject-page.tsx` as the **primary** section, above the
Fields block (facts-first, design §4). Reuses the schema-editor `dnd-kit` reorder
pattern and the `subjects-list` Recently-Deleted collapsible. The composer draft
is backed by `localStorage` via `useSyncExternalStore` (the repo's localStorage
pattern — no SSR hydration mismatch, persists every keystroke). `page.tsx` loads
`activeOnly(facts … order position)` + `deletedOnly(facts …)` and passes both
down.

## 5. Reachability / Tombstone (ADR 0006)
`subjects/[subjectId]/page.tsx` and `categories/[categoryId]/page.tsx` resolve the
entity **with** ancestor `deleted_at` (embedded), without the active filter:
`null` → `notFound()`; self or any ancestor deleted → `<Tombstone>` (names the
topmost dead level, offers Restore); else render. This also fixes Q1 (the subject
page previously resolved its category name with no filter). The Tombstone
(`app/(app)/_components/tombstone.tsx`) carries a placeholder for the skeleton
mascot, added in the near-launch visual-polish pass.

## 6. Verification
See the plan's verification section: migration + `cron.job`, facts CRUD, draft
restore on reload, `updated_at` sort, and the three Tombstone cases.
