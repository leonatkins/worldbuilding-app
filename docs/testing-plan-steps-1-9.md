# Manual Testing Plan — Steps 1–9

Covers everything shipped from repo init through the @mention system (roadmap steps 1–9, all ✅). Steps 10–15 (search, templates, dashboard, `!` field autocomplete, backlink→List promotion, onboarding) are not built — don't test for them.

No E2E/component tests exist yet (only `lib/` unit tests in Vitest). This plan is the only coverage for UI flows, server actions, RLS, and DB-backed behavior, so go through it fully.

## How to use this doc

- Work top to bottom; later sections assume data created in earlier ones (a world, a category, a subject).
- Mark each line ✅ pass / ❌ fail / ⚠️ note-but-not-a-bug.
- For every ❌, capture: what you did, what you expected, what happened, browser console errors if any.
- Skip anything listed under **Known non-bugs** at the bottom — those are confirmed gaps, not regressions.

> **Resume point (2026-07-01):** Sections 1–3 (Auth, World CRUD, Category + Schema Editor) were already run in a prior pass — results are annotated inline, several bugs were found and fixed, left as-is. **Start at [§4 Subject CRUD](#4-subject-crud-step-7)** and work through §8. You'll need a world with at least one category from your earlier run (or create a fresh one — either works, §4 doesn't depend on the exact data from §1–3).

## 0. Setup

1. `npm install`
2. Copy `.env.example` → `.env.local`, fill in Supabase project URL + anon key (and Google OAuth client if testing that path).
3. `npm run db:migrate` — applies `drizzle/0000`–`0005`.
4. `npm test` — should pass (Vitest, `lib/` unit tests). If this fails, fix before doing manual testing.
5. `npm run dev` — app at `http://localhost:3000`.
6. Have two browser profiles/incognito windows handy — useful for testing auth isolation and multi-account RLS later.

---

## 1. Auth (Step 3)

| # | Test | Expected |
|---|------|----------|
| 1.1 | Visit `/` while logged out | Redirected to `/login?next=/` | PASS
| 1.2 | Sign up with email/password | Account created, redirected to `/verify-email` (not let into the app yet) | COULD NOT VERIFY
| 1.3 | Try visiting `/` before verifying | Still gated to `/verify-email` | COULD NOT VERIFY
| 1.4 | Click "resend" on verify-email page | Resend confirmation works, no error | COULD NOT VERIFY
| 1.5 | Verify email (check inbox/Supabase logs), log in | Lands on `/` (worlds list) | COULD NOT VERIFY
| 1.6 | Log out, log back in with correct password | Works | PASS
| 1.7 | Log in with wrong password | Clear error, no crash | PASS
| 1.8 | "Forgot password" → request reset | Email sent; link goes to `/reset-password?step=update` | PASS. FIX APPLIED: `updatePassword` now calls `supabase.auth.signOut()` before redirecting to `/login?reset=success`, so the user must re-authenticate with the new password (was: left silently signed in). Password-complexity rules beyond the 8-char minimum are a separate product decision, left as-is for now. — verify
| 1.9 | Set new password via that link, log in with new password | Works; old password no longer works | PASS
| 1.10 | Sign in with Google | OAuth flow → `/auth/callback` → lands in app, account auto-bootstrapped | PASS
| 1.11 | Open app in second browser profile, sign up as a second account | Confirms accounts are isolated (used in step 7 RLS check below) | COULD NOT VERIFY

---

## 2. World CRUD (Step 5)

| # | Test | Expected |
|---|------|----------|
| 2.1 | On `/`, create a world with a typed name | World appears in list, 5 default categories seeded automatically | PASS
| 2.2 | Create a world using the 🎲 random-name button | Two-word name generated, no empty/garbage name | PASS
| 2.3 | Try creating a world with an empty/whitespace-only name | Rejected with validation message | PASS. FIX APPLIED: the "highly contrasted white" message was the browser's native validation popup (input had `required` with no `noValidate`). Added `noValidate` to the create + rename world forms so empty/whitespace names route through the existing styled server-error paragraph (`text-red-600`). — verify
| 2.4 | Create a second world, switch between worlds via the world switcher | URL changes (world id in path, per ADR 0003), correct categories/subjects shown per world | FAIL → FIX APPLIED. Root cause: `createWorld` never called `revalidatePath("/")` (unlike rename/delete/restore), so the shared `(app)` layout kept serving a cached worlds list — the new world was absent and `world-switcher` fell back to the hardcoded `"World"` label because the active world wasn't in the stale list. Added `revalidatePath("/")` to `createWorld`. — verify (both worlds should now list, and the trigger should show the current world's name)
| 2.5 | Rename a world inline | Name updates immediately, persists on reload | PASS
| 2.6 | Delete a world | Moves to "Recently Deleted" section at bottom of `/`, disappears from active list/switcher | PASS
| 2.7 | Restore a deleted world from Recently Deleted | Reappears in active list with all categories/subjects/facts intact | PASS
| 2.8 | "Delete now" (purge) a deleted world | Permanently gone, no longer in Recently Deleted | PASS
| 2.9 | Visit a deleted world's URL directly (before purge) | Tombstone screen with one-click Restore (not a 404) | FAIL → FIX APPLIED. Root cause: `worlds/[worldId]/page.tsx` filtered `.is("deleted_at", null)` in the query, so a soft-deleted world returned no row and hit `notFound()` before any deleted-check. Rewrote it to mirror the category/subject pages: fetch without the filter, then branch to `<Tombstone kind="world">` (component already supported worlds). — verify (should show Tombstone + Restore; Restore should land back on the world page, cf. 7.3)
| 2.10 | Second account (browser profile from 1.11) | Should see zero worlds belonging to account 1 — confirms RLS | DID NOT VERIFY

---

## 3. Category + Schema Editor (Step 6)

Work inside one world's home page (`/worlds/[worldId]`).

| # | Test | Expected |
|---|------|----------|
| 3.1 | View the 5 default categories | All present, in a sensible order, with icons | PASS. Note: `CreateCategoryForm` already renders on world home. A world-level "create subject / global subjects list filtered by category" is roadmap **step 12** (search & filtering), not built yet — deferred to step 12 per decision (this pass stays scoped to steps 1–9 regressions).
| 3.2 | Create a new category, set name + emoji icon | Appears in list | PASS. Note: categories support drag-reorder but no A–Z/recency sort dropdown (subjects already have one). Confirmed real gap, scoped out of this pass per decision.
| 3.3 | Drag-reorder categories | Order persists on reload | PASS
| 3.4 | Rename a category inline | Updates immediately | FAIL → FIX APPLIED & VERIFIED LIVE. The reload "error" was a React **hydration mismatch** from `@dnd-kit` (`aria-describedby="DndDescribedBy-0"` server vs `-1` client) — dnd-kit's `DndContext` derives that id from a non-SSR-safe module counter. Nothing to do with the rename itself; it fired on every world-page load. Fixed by giving each `DndContext` a stable `id` prop (`category-list`, `schema-fields`, `facts-list`), which also covers the category and subject pages. Verified: world page now reloads with no hydration warning in the dev log.
| 3.5 | Delete a category with no subjects in it | Soft-deletes, moves to Recently Deleted | PASS
| 3.6 | Try deleting a category that has subjects in it | Confirm dialog naming the subject count (+ a few names); on confirm, category and its subjects soft-delete together and restore together | FIX APPLIED (per updated requirement — confirm, don't hard-block). `deleteCategory` still hard-blocks on Link/List fields from *other* categories (referential integrity), but subjects no longer block: the confirm dialog now shows "Its N subjects (a, b, c, …) go with it. It moves to Recently Deleted…". Verified live (deleteCategory succeeded on a category with subjects). — verify
| 3.7 | Restore a deleted category | Reappears, any subjects under it become visible again too | PASS
| 3.8 | Open a category page, add a schema field of each type: Text, Number, Boolean, Select, MultiSelect, Date, Scale, Color, Link, List | All 10 types create successfully with correct per-type config UI | Re-triaged — no code defect found. (a) "Cannot add schema fields": DB confirmed migrated (`schema_fields` exists), the add-field form + "+ Add field" button (`schema-editor.tsx`) are sound, typecheck + all 53 unit tests pass. The schema editor lives on the category *detail* page (`/worlds/[worldId]/categories/[categoryId]`), reached by clicking a category name on the world home — likely a discoverability issue, not a broken insert. If "+ Add field" genuinely does nothing for you, capture the console/network error and reopen. (b) "! in fact writing" = expected gap: `!` field autocomplete is roadmap step 11, not built; the app is bottom-up by design (`docs/design.md` §1) with the schema editor as the explicit path for now. (c) "schema fields below facts" describes the *subject* page (per-subject field *values* below facts, intentional), not the schema editor. RELATED WANT (deferred to backlog): default always-visible schema fields.
| 3.9 | Select field: try saving with 0 options | Rejected (needs ≥1 option) |
| 3.10 | Select field: add duplicate option names | Deduped or rejected |
| 3.11 | Scale field: set min ≥ max | Rejected |
| 3.12 | Number field: optional unit (e.g. "kg") | Saves and displays with unit later on subject page |
| 3.13 | Link field: must pick a target category | Can't save without one |
| 3.14 | List field: must pick a target category | Can't save without one |
| 3.15 | Reorder schema fields | Order persists |
| 3.16 | Delete a schema field that has existing values on subjects | Confirm whether this is blocked or silently drops values — note behavior, don't assume bug (compatibility matrix is an open TODO per Q10) |

---

## 4. Subject CRUD (Step 7)

| # | Test | Expected |
|---|------|----------|
| 4.1 | Create a subject in a category (name only) | Appears in category's subject list | PASS. NOTE: WHEN CREATING A SUBJECT, IT SHOULD NOT OPEN THE SUBJECTS PAGE.
| 4.2 | List view sorting | Subjects listed sensibly (alphabetical or recency — confirm consistent) | PASS. NOTE: AFTER SELECTING A SORTING TYPE, THE BORDER OF THE SORT DROPDOWN TURNS ORANGE UNTIL YOU CLICK AWAY.
| 4.3 | Inline rename a subject | Updates immediately | SEMI-PASS. NO OPTION TO RENAME FROM THE SUBJECTS LIST.
| 4.4 | Change a subject's category | Confirm dialog warns that field values will be cleared (since schema differs); confirm count of affected values | PASS
| 4.5 | Delete a subject | Soft-deletes, appears in category's Recently Deleted | SEMI-PASS. NO OPTION TO DELETE IN SUBJECT LIST.
| 4.6 | Restore a subject | Reappears with all facts/field values intact | PASS
| 4.7 | Open a subject page, fill in a value for every field type from 3.8 | Each type has an appropriate inline editor (text box, number input, toggle, single-select, multi-select, date picker, slider/scale, color picker, subject picker for Link, multi-subject picker for List) | SEMI-PASS. YES/NO SHOULD BE A TOGGLE SWITCH. MULTI-SELECT AUTO-SAVES AFTER A SINGLE SELECTION. SHOULD SAVE AFTER CONFIRMATION. COLOR PILL SHOULD SHOW THE COLOR, NOT THE HEX CODE. SUBJECT LINK/LIST SHOULD SHOW IT AS A CLICKABLE MENTION. RATING SHOULD SHOW THE MIN AND MAX.
| 4.8 | Link field: pick another subject as target | Saves; creates a `relationships` row (origin="field") — verify via the target subject's backlinks | PASS
| 4.9 | List field: add multiple subjects | All appear, removable individually | PASS
| 4.10 | Add tags to a subject (new tag + existing tag) | Tag created, attached | FAIL. CAN ONLY ADD ONE TAG PER SUBJECT. NO OPTION TO ADD AN EXISTING TAG
| 4.11 | Add a tag with different casing than an existing one (e.g. "Hero" vs "hero") | Treated as same tag (case-insensitive unique per world) | NO WAY TO VERIFY. HOW SHOULD I KONW IF THEY ARE TREATED AS THE SAME TAG?
| 4.12 | Rename a tag | Propagates to all subjects using it | FAIL. NO TAG VIEW ACCESSIBLE.
| 4.13 | Hide-empty-fields behavior | Fields with no value set shouldn't clutter the subject page (this replaces the cut Roles feature, ADR 0002) | PASS

---

## 5. Facts Engine (Step 8)

On a subject page, in the Facts section.

| # | Test | Expected |
|---|------|----------|
| 5.1 | Type a fact and press Enter | Saves immediately, composer clears and refocuses for the next fact (fast capture) |
| 5.2 | Type text, press Shift+Enter | Inserts a newline instead of saving |
| 5.3 | Start typing a new fact, **don't save**, reload the page | Draft text is restored from autosave, with a "Draft saved" label visible next to Save while it has unsaved content |
| 5.4 | Start a new-fact draft, open the same subject in a second tab | Draft should sync across tabs (storage event) — confirm |
| 5.5 | Save a fact, then start editing it inline, reload mid-edit | This should **not** restore via draft autosave (autosave only covers new, never-saved facts) — confirm the in-progress inline edit is simply lost, which is expected |
| 5.6 | Inline-edit an existing fact, click Save | Commits new text |
| 5.7 | Inline-edit an existing fact, click Cancel (or press Escape) | Reverts to original text, no save |
| 5.8 | Drag-reorder facts | New order persists on reload |
| 5.9 | Delete a fact | Soft-deletes into a collapsible "Recently Deleted" section for that subject |
| 5.10 | Restore a deleted fact | Reappears in its position among live facts |
| 5.11 | "Delete now" a fact from Recently Deleted | Gone permanently |
| 5.12 | Try saving an empty/whitespace-only fact | Rejected |

---

## 6. @mention Autocomplete (Step 9)

This is the newest and most complex piece — test thoroughly.

### Typing & triggering

| # | Test | Expected |
|---|------|----------|
| 6.1 | Type `@` at the start of a fact or after a space | Typeahead dropdown opens |
| 6.2 | Type `@` in the middle of a word (e.g. `foo@bar`) | Dropdown does **not** open |
| 6.3 | Open `@`, type nothing | Shows ~10 most-recently-edited subjects in the world |
| 6.4 | Open `@`, type a partial name | Filters to matching subjects (substring match), alphabetical |
| 6.5 | Type a name that exactly matches a subject (case-insensitive) plus other partial matches exist | Exact match floats to the top |
| 6.6 | Type a space, `@`, `{`, or `}` while the dropdown is open | Closes/breaks the active query as expected |
| 6.7 | Navigate suggestions with Arrow Up/Down | Highlight moves correctly, wraps or stops at ends (confirm which) |
| 6.8 | Press Enter or Tab on a highlighted suggestion | Inserts a mention chip + trailing space, caret lands right after the space, and does **not** also trigger the fact composer's save-on-Enter |
| 6.9 | Press Escape or type a literal space while dropdown open with a partial `@query` | Dismisses dropdown, text stays as literal typed text (not converted to a chip) |
| 6.10 | Paste rich/formatted text (e.g. from a Word doc or webpage) into the composer | Coerced to plain text, no stray HTML/formatting |
| 6.11 | Mention the subject you're currently writing the fact on (self-mention) | Chip inserts fine, but check the target subject's own backlinks — should **not** show a self-referencing backlink |

### Rendering saved mentions

| # | Test | Expected |
|---|------|----------|
| 6.12 | Save a fact with a mention to a live subject, reload page | Renders as a bold link |
| 6.13 | Hover over a mention chip | After a short delay (~250ms), a hover card appears showing the target's category + filled fields |
| 6.14 | Hover the same mention again shortly after | Loads instantly from cache (no repeat loading flicker) |
| 6.15 | Click a live mention | Navigates to that subject |
| 6.16 | Soft-delete the mentioned subject, go back and view the fact | Mention renders grayed-out (not a broken link) |
| 6.17 | Click the grayed mention | Inline popover with a Restore action appears |
| 6.18 | Restore via that popover | Mention immediately renders live again (no save/reload needed) |
| 6.19 | Purge (hard-delete) a mentioned subject instead of soft-deleting | Mention renders as an italic "unknown/deleted" chip |
| 6.20 | Click the purged-mention chip | Inline popover lets you search the world and pick a replacement subject |
| 6.21 | Pick a replacement | Fact body updates to point at the new subject, relationships re-sync |
| 6.22 | Rename the mentioned subject (don't touch the fact at all) | Mention text updates automatically next render — no stale cached name anywhere |

### Backlinks rail

| # | Test | Expected |
|---|------|----------|
| 6.23 | View a subject that's mentioned in facts and/or used as a Link/List field value elsewhere | "Referenced by" rail appears on the right side (stacks below content on narrow/mobile widths) |
| 6.24 | A subject referenced by both a fact mention and a field value from the *same* source subject | Appears once in the rail (deduped), not twice |
| 6.25 | A subject with zero references | Rail does not render at all (not an empty box) |
| 6.26 | Hover a backlink entry | Same hover card as inline mentions, same cache |
| 6.27 | Soft-delete the *source subject* of a backlink (the one doing the mentioning) | Backlink disappears from the target's rail |
| 6.28 | Restore that source subject | Backlink reappears |
| 6.29 | Soft-delete just the *fact* that contains the mention (source subject stays live) | Fact-origin backlink disappears; if that source subject also has a field-origin reference to the same target, that one stays |
| 6.30 | Restore that fact | Backlink reappears |

---

## 7. Cross-cutting: Soft Delete & Tombstones

| # | Test | Expected |
|---|------|----------|
| 7.1 | Directly navigate (paste URL) to a soft-deleted world/category/subject | Tombstone screen, one-click Restore — never a raw 404 or crash |
| 7.2 | Navigate to a *live* subject whose parent category or world is soft-deleted | Also shows Tombstone (ancestor reachability check), even though the subject itself isn't deleted |
| 7.3 | Restore from a Tombstone screen | Lands you back on the normal page for that entity |
| 7.4 | Note (can't directly test): 30-day pg_cron purge job | Just confirm "Delete now" works as the manual equivalent; don't expect to verify the cron timer itself |

---

## 8. End-to-end regression sweep

Do one full flow back-to-back to catch integration issues unit tests can't:

1. Create a world → confirm 5 default categories.
2. Add a category with 3+ field types including a Link field.
3. Create two subjects in it; on subject A, set the Link field to point at subject B.
4. On subject A, write a fact mentioning subject B via `@`.
5. Go to subject B, confirm "Referenced by" shows subject A once (combining the field + fact origin).
6. Edit subject A's fact, delete the mention, save.
7. Confirm subject B's backlink for the fact origin disappears but the field-origin reference (if you check by re-adding a different fact later) still works independently.
8. Soft-delete subject A entirely, confirm subject B's rail goes to zero/disappears appropriately, confirm subject A's own page now shows a Tombstone.
9. Restore subject A, confirm everything reappears correctly on both ends.

---

## Known non-bugs / deferred (don't report these)

- **Steps 10–15 not built:** search/filtering, promoting backlinks to List fields, `!` field autocomplete, templates, onboarding panel, global dashboard. None of these exist yet.
- **Roles cut from MVP** (ADR 0002) — there is no "roles" concept; hide-empty-fields is the replacement.
- **AI features** — not built, out of scope for MVP entirely.
- **`field_values.updated_at` not bumped on upsert** — known gap (open question Q4).
- **pg_cron purge-on-access fallback** not yet verified/built — only the manual "Delete now" purge path is testable.
- **Global "+ New subject" with no category in URL** routes to world home instead of an in-place category picker — known limited affordance (Q7), not a crash bug.
- **Date/Color field display polish** is deferred to a later visual pass — rough-but-functional rendering is expected (Q8).
- **Changing a schema field's type with existing values** has no defined compatibility matrix yet — note behavior, don't assume it's wrong (Q10).
- **No mobile/PWA/desktop support** — desktop browser testing only.

---

## Bug report template

For each ❌, capture:

```
**What I did:** 
**Expected:** 
**Actual:** 
**Steps to reproduce:** 
**Console errors (if any):** 
**Browser/OS:** 
```
