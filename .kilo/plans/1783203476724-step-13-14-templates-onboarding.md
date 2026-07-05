# Step 13 (Templates) + Step 14 (Onboarding) — Grill-Resolved Plan

**Status:** planning complete, ready to spec → implement
**Date:** 2026-07-04
**Method:** `/grilling` + `/domain-modeling` — relentless interview walking the design
tree; decisions recorded as resolved, with glossary terms and ADR candidates at the
end. Source: PRD §6.3, §11; design §4.4–4.5; `lib/worlds.ts`, `app/actions/worlds.ts`,
`lib/db/schema.ts`; open-questions Q9/Q10.

**Sequencing (C1):** **two specs, two PRs, two migrations.** Templates (step 13) ships
first; Onboarding (step 14) ships second, so its guide's Templates section describes a
shipped feature. Each PR independently reviewable/revertable; two migrations give
rollback isolation (reverting one doesn't drag the other). Combined grill notes
(`docs/step-13-14-grill-notes.md`) stay as the thinking record; this plan is the
handoff.

---

## STEP 13 — TEMPLATES

### A1 — Scope: private + built-in only ✅
Build: curated **built-in official templates** (schema + world) + **private "save as
template"** from the user's own worlds/categories + **apply-template** wired into world
creation and the schema editor. **Deferred** (post-launch social step): publish public,
browse others', ratings, genre filter, moderation. Why: no user base yet → a public
library launches empty, no rating signal, adds moderation.

### A2 — Built-ins hardcoded in app code ✅
Built-in templates are typed TS constants (same pattern as `DEFAULT_CATEGORIES` in
`lib/worlds.ts`), sharing the **exact snapshot shape** as DB templates. The `templates`
table holds **only user-authored private templates**. Library list =
`[...BUILTINS, ...userTemplates]`; `applyTemplate(snapshot)` is source-agnostic. Why:
design §4.4 ("defaults hardcoded in app code, not a DB table"); git-versioned content;
no system-account/seed/`is_official` machinery.

### A3 — Snapshot format + portable references ✅
A **snapshot** is the frozen, detached, UUID-free copy of category/field **structure**
(`content jsonb`, design §4.5). Structure only — **no subjects, facts, values, or
UUIDs**. Saving = photograph the structure; applying = unpack into real `categories` +
`schema_fields`. A copy, never a live link (cookie-cutter, not the cookie).

Portable references (UUIDs are world-specific, useless elsewhere):
1. Snapshots store **portable local keys + the target category's *name***, never UUIDs.
   List/Link target → `{ localKey?: "cat-2", name: "Spell" }`.
   - **World templates:** resolve via `localKey` internally (create categories first,
     map `localKey → newUUID`, then create fields).
   - **Schema templates:** resolve the target by **name** in the destination world.
2. **On schema-template apply, if the named target category is absent → auto-create an
   empty stub category** (no fields/subjects — cheap, deletable) so the Link/List field
   is immediately functional. Report inline: *"Applied D&D Character · also created
   category: Spell."* No modal.

Illustrative schema-template snapshot:
```jsonc
{
  kind: "schema",
  category: { name: "D&D Character", icon: "🧙" },
  fields: [
    { name: "Class",  type: "Select", selectOptions: ["Fighter","Wizard"] },
    { name: "Level",  type: "Number", unit: null },
    { name: "Spells", type: "List",   target: { name: "Spell" } },
    { name: "Alignment", type: "Select", selectOptions: ["LG","NG"] }
  ]
}
```

### A4 — Schema-template apply: both merge + new-from-template ✅
Two entry points over one shared field-unpack routine:
- **Merge into an existing category** (primary; PRD §6.3 "merges its fields into the
  existing schema — it does not wipe"). Entry: the category's schema editor → "Apply
  template." Snapshot's category name/icon ignored.
- **New category from template** (thin convenience). Entry: category creation → "New
  from template." Snapshot's name/icon prefill the new category (editable); fields come
  along. = `createCategory(name, icon)` + same unpack.

### A5 — Merge collision: OVERWRITE + confirm-when-lossy ✅
(OVERRIDES the earlier "skip" proposal.) Merge **overwrites** on a same-name collision
(case-insensitive name match, ignoring type). Confirmation fires **only when the
overwrite is lossy** — i.e. the existing field holds ≥1 value, OR the type/config
change would force clearing per the Q9/Q10 matrix below. Empty-field collisions
overwrite silently. One confirm listing every lossy collision with its affected-value
count; accept or cancel the whole apply (no per-field piecemeal).

**Why overwrite + lossy-confirm over skip:** overwrite delivers the template's version
(usually the user's intent on apply); the lossy-detect + confirm protects the
never-lose-data spine (Q9/Q10 value-clearing) without friction on the common
empty-field case. Skip was non-destructive but silently dropped the template's version
even when the user's field was empty — surprising.

### Q9/Q10 compatibility matrix — NOW IN SCOPE (pulled from deferred) ✅
Storage grounding: scalars in `field_values.scalar_value` (jsonb); Link in
`field_values.linked_subject_id`; List in `list_value_subjects` join table.

| Transition | Behavior | Lossy? |
|---|---|---|
| Same type, config-only change, values survive (Number unit, Scale min/max not excluding current, Select *adds* options) | Migrate silently | No |
| `Select → MultiSelect` (widening: single → `[single]`) | Migrate silently | No |
| `MultiSelect → MultiSelect` where all current values survive the new option set | Migrate silently | No |
| Select/MultiSelect option-set change that *drops* an option a subject holds | **Prune orphaned values only** (clear the orphaned ones, keep the rest) | Yes |
| Cross-scalar-type (Text→Number etc.) | **Per-value parse; keep parseable, clear failures** | Yes |
| Cross-storage-family (Scalar ↔ Link/List — bytes incompatible) | Clear all values on field | Yes |
| List/Link target-category change (per Q9 — existing members point at old category) | Clear all values on field | Yes |
| `MultiSelect → Select` narrowing where any subject holds >1 value | Clear all values on field | Yes |

Lossy transitions trigger the A5 confirm with precise per-field counts (e.g. *"Class:
3 of 50 values will be cleared (dropped options: Wizard)"*).

**Resolve open-questions.md:** mark Q9 (re-point List/Link) and Q10 (type-change
matrix) RESOLVED with a pointer to this plan / the step-13 spec.

### A6 — World-template apply: preview-only ✅
Pick template → **read-only preview screen** listing the categories+fields to be
created → confirm → create (undo-on-failure, same as today's `createWorld`). No
pre-creation editing; tweaks happen in-world via existing editors + schema-template
merge (A4). Honors "one-click, no modal" (§6.3/§10.6) while blocking surprises on big
templates. Wire world-template apply through the existing `createWorld` path (replaces
the `DEFAULT_CATEGORIES` seed step with the snapshot unpack).

### A7 — Save-as-template entry points ✅
Two sources, mirroring the two template kinds:
- **Schema template** from a category: category schema editor → "Save as template."
  Serializes that category's name/icon + fields into a `kind:"schema"` snapshot.
- **World template** from a world: world settings/home → "Save as template."
  Serializes all *live* (non-soft-deleted) categories + their fields into a
  `kind:"world"` snapshot (subjects/facts/values excluded per A3). Soft-deleted
  categories skipped silently.

Saving prompts for a template name inline (defaults to source name). List/Link targets
stored by target-category *name* (schema templates) or `localKey` (world templates)
per A3. Saved to the user-private `templates` table (A2).

### A8/A8b — Full in-place template editor + new-blank-template entry ✅
Templates are **editable in place** via a full structural editor (edit fields, add/
remove, reorder, rename) within the template library — a third editor surface alongside
category and world. Plus a **"New template"** entry: open the editor on an empty
snapshot and author categories+fields from scratch, then save. Symmetric with editing
existing templates.

**Detachment preserved (critical):** editing a template mutates only the snapshot blob,
never any already-applied world's rows. A3's frozen-snapshot principle holds in the
template→applied direction: applied worlds are independent copies. (Source→template
direction is also detached: editing the source category/world after save-as does not
update the template.)

### A9 — Limits / free-tier gating / edge cases ✅
- **Templates are content → unlimited on both tiers.** No count gating. A free user
  with 2 worlds can hold unlimited private templates.
- **Names NOT unique per owner** (unlike tags). Two templates can share a name; the
  library list disambiguates by kind/created-at. Avoids naming-collision friction on
  save-as.
- **World-template apply vs. the 2-world free cap:** applying a world template creates
  a new world, so it counts toward the 2-world limit. No gating code now (wired through
  `createWorld`; gating built later per design §6). Note the interaction only.
- **Defensive snapshot cap:** ≤50 categories, ≤100 fields/category, as a sanity guard
  against runaway serialization. Surfaced in the A6 preview if a template exceeds it.

### Step 13 schema changes
- **New `templates` table** (user-authored private templates only):
  `id uuid PK defaultRandom`, `account_id uuid notNull default auth.uid() FK→accounts
  cascade`, `name text notNull`, `kind text notNull` (`"schema" | "world"`),
  `content jsonb notNull` (the snapshot), `created_at`, `updated_at`. RLS own-rows
  policy. **No** `is_official` flag (built-ins live in code per A2). Names not unique.
- **Built-in templates** as TS constants in `lib/templates/builtins.ts` (or similar),
  sharing the snapshot TS type with `templates.content`.

---

## STEP 14 — ONBOARDING GUIDE PANEL

### B1 — Surface: header icon + right Sheet ✅
Persistent `?` help icon in the app header (next to `CreateMenu`/sign-out), opening a
right-side `<GuidePanel>` Sheet client component that slides in from the right (dismiss
on Escape/outside-click — same pattern as the `WorldSwitcher` popover in
`app/(app)/world-switcher.tsx`). Keeps app content visible beside the guide, which is
the guide's whole job (point at app surfaces). Matches existing chrome conventions.

### B2 — First-login detection: server column on accounts ✅
PRD §11 rejects a *forced interactive tutorial* / *sample world* but specifies an
informational panel that "shows on first login automatically, dismissable with one
click" (line 308). First-login detection IS needed. Add **`accounts.onboarding_seen_at
timestamptz NULL`** (migration co-delivered with step-14's other changes, or its own
step-14 migration). Server renders the panel open on the first authenticated load where
the column is null; a server action stamps it on dismiss. Per-account: same user on a
new device won't be re-onboarded.

### B3 — Content: hardcoded MDX/TSX in app code ✅
Guide copy is hardcoded MDX/TSX constants in app code (mirrors A2: git-versioned, no
DB table, no per-env seed). MDX so `!`/`@` examples render as code blocks. Sections =
PRD §11's six topics: what a world/category/subject/fact is; `!` commands; @mentions;
schema fields; AI features — plus a **Templates** section (B6). Each a short skimmable
block; `!`/schema/Templates positioned as "power-user, read when ready" (PRD §11 line
314).

### B4 — Seen-stamp timing: stamp on dismiss ✅
Stamp `onboarding_seen_at` when the panel is **dismissed during its auto-open
session** — via the dismiss button, outside-click, or Escape. Honors PRD §11
"dismissable with one click" literally (the dismiss is the signal). If the user closes
the tab without dismissing, the auto-open recurs next login (another shot at seeing
it). Re-opening from the icon later never touches the flag (already seen; icon is just
re-access). Never re-onboards a user who *did* dismiss.

### B5 — Copy coupling: conceptual now, locational at polish pass ✅
Step 14 ships **conceptual copy only** (what things ARE, how the model fits; never
where a specific button sits). Survives the deferred visual-polish pass (memory
`project_visual_polish_pass`) restyle-free. The near-launch polish pass (final steps)
will **add locational copy** once UI placements are finalized (drift risk gone because
the UI is settled by then). The only locational line in step 14 is re-access ("reopen
this guide from the `?` icon"), stable because B1 fixed its header placement.

### B6 — Cross-link: yes, a Templates section ✅
Add a short "Templates" section to the guide, positioned alongside the `!`/schema
power-user content. Conceptual only (per B5): what a template is, the two kinds
(schema/world), apply vs save-as, where to find the library. Not mentioning templates
one step after they ship would be a gap.

### Step 14 schema changes
- **`accounts.onboarding_seen_at timestamptz NULL`** (additive; NULL = not yet seen).
  No RLS change needed (accounts is already owner-readable).

---

## Glossary terms to add to CONTEXT.md (implementation task)

(domain-modeling skill: capture as they crystallise. Plan mode can't edit CONTEXT.md,
so the implementing agent adds these.)

- **Snapshot** — the frozen, detached, UUID-free copy of category/field structure a
  template stores; unpacked on apply. Structure only (no subjects/facts/values).
- **Apply (a template)** — unpack a snapshot into real `categories` + `schema_fields`
  rows in a destination world; a copy, never a live link.
- **Stub category** — an empty category auto-created on schema-template apply to satisfy
  a Link/List field whose named target is absent in the destination world.
- **Template** — a named, reusable structure (schema = one category's fields; world =
  full category structure) stored as a snapshot; built-in (code) or private (DB).
- **Onboarding guide** — an informational panel (not a tutorial) accessible from a
  persistent help icon, auto-opened once on first login, dismissable, re-accessible.

## ADR candidates (promote if hard-to-reverse + surprising + real trade-off)

1. **Snapshots store portable name-based refs (not UUIDs); schema-template apply
   auto-creates missing stub categories (A3).** Promote — shapes the snapshot data
   model (hard to reverse), surprising (why name not UUID?), real trade-off (name vs
   key). → `docs/adr/0009-snapshot-portable-refs-and-stub-creation.md` (next free
   number).
2. **Template merge is overwrite + confirm-when-lossy via the Q9/Q10 matrix (A5).**
   Promote — merge behavior is hard to reverse (data-loss surface), surprising
   (overwrites, contradicts an earlier skip proposal; also pulls Q9/Q10 from
   deferred), real trade-off (overwrite vs skip vs confirm-each). Ties to the
   soft-delete / never-lose-data family (ADR 0005/0008). →
   `docs/adr/0010-template-merge-overwrite-with-lossy-confirm.md`.
3. **Templates have a full in-place editor + new-blank-template entry (A8/A8b).**
   Promote — surprising (a template is an *editable structure*, not just a frozen
   photograph; expands step-13 scope beyond a library list), real trade-off
   (recreate-only vs full editor). Borderline on hard-to-reverse (additive) but the
   editable-snapshot model shapes the data flow. →
   `docs/adr/0011-templates-are-editable-structures.md`.
4. **Onboarding seen-state is a server column on accounts (B2).** Borderline —
   additive column, mild surprise, real trade-off (server vs localStorage). Promote
   only if the implementing agent judges it passes the three-bar test; otherwise skip.
5. **Guide copy conceptual-only at step 14, locational deferred to polish pass (B5).**
   Skip ADR — not hard to reverse, not surprising. Just a sequencing note.

---

## Build / implementation order

**Step 13 (Templates) — first:**
1. Schema migration: add `templates` table (+ RLS own-rows policy).
2. `lib/templates/`: snapshot TS type (shared by built-ins + DB rows), built-in
   constants, `serializeCategory`/`serializeWorld` (A7), `applyTemplate`/unpack
   routine (A3/A4/A6), merge-with-collision using the Q9/Q10 matrix (A5).
3. World-template apply wired into `createWorld` path (A6 preview + unpack replacing
   the `DEFAULT_CATEGORIES` seed for the template starting point).
4. Schema-template apply: merge entry in schema editor + new-from-template entry in
   category creation (A4).
5. Save-as-template: category schema editor entry + world settings entry (A7).
6. Template library + in-place editor + new-blank-template entry (A8/A8b).
7. Free-tier gating note + defensive snapshot cap (A9).
8. Tests: snapshot round-trip (serialize→apply = identical structure, UUIDs remapped);
   merge collisions across every Q9/Q10 matrix cell (migrate/prune/clear per cell);
   stub-category auto-creation; world-template apply undo-on-failure.

**Step 14 (Onboarding) — second (after step 13 ships):**
1. Schema migration: add `accounts.onboarding_seen_at`.
2. `<GuidePanel>` client component (right Sheet, Escape/outside-click dismiss) +
   `?` icon in `app/(app)/layout.tsx` header (B1).
3. Server: pass `autoOpenGuide` prop when `onboarding_seen_at` is null; server action
   `markOnboardingSeen` stamps on dismiss (B2/B4).
4. Guide content: hardcoded MDX/TSX, six PRD sections + Templates section,
   conceptual-only copy (B3/B5/B6).
5. Tests: first-login auto-opens; dismiss stamps; re-open from icon doesn't re-stamp;
   cross-device (same account, new device) doesn't re-onboard.

## Validation plan
- `npm run lint`, `npm run typecheck`, `npm run build` clean after each PR.
- Step-13 spec authored from this plan; step-14 spec authored after step 13 ships.
- Manual: apply each built-in template into a blank world; merge a schema template into
  a populated category and confirm the lossy-detect + counts fire correctly; save-as
  a world with a soft-deleted category and confirm it's skipped; edit a template
  in-place and confirm an already-applied world is unchanged (detachment).
- Manual (step 14): fresh account → guide auto-opens; dismiss → re-open from icon; new
  browser same account → no re-onboard.
- Update `docs/open-questions.md`: mark Q9, Q10 RESOLVED with pointers to this plan /
  the step-13 spec.
- Update `docs/step-13-14-grill-notes.md`: flip A5–A9, B1–B6, C1 to ✅ resolved (this
  plan is the source of truth; the notes are the record).

## Risks / open items
- **Q9/Q10 matrix is now in scope** (pulled from deferred) — adds spec surface to step
  13. The matrix is fully decided above; no further grill needed.
- **Detachment discipline (A8):** the in-place editor must only mutate the snapshot
  blob, never any live world's rows. Test explicitly: edit a template, confirm an
  applied world is byte-identical before/after.
- **Two migrations:** keep `templates` (step 13) and `onboarding_seen_at` (step 14) as
  separate migrations for rollback isolation, even though both are additive.
- **Free-tier gating not built** (design §6 "gating built later") — world-template
  apply is wired through `createWorld` so the future gate covers it; no gating code
  now.
