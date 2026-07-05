# Step 13 (Templates) + Step 14 (Onboarding) — Grill Notes

**Status:** In progress · grilling before spec
**Date:** 2026-07-04
**Method:** `/grill-with-docs` (relentless interview → decisions + glossary + ADRs)
**Scope note:** steps 13 and 14 grilled together, in one build ("next 2 steps in
one"). Thorough pass — questions intentionally granular, not compressed.

Source material: PRD §6.3 (templates), §11 (onboarding); design §4.4–4.5
(templates data model, world-creation starting points); ROADMAP steps 13–15;
`open-questions.md` (Q9/Q10 value-clearing edges); existing world-creation code
(`app/actions/worlds.ts`, `lib/worlds.ts`), schema (`lib/db/schema.ts`).

---

## Design tree (branches to walk)

**A. Step 13 — Templates**
- A1. Scope: public social library vs private + built-in ......... ✅ resolved
- A2. Built-in representation: code vs DB rows .................... ✅ resolved
- A3. Snapshot format + portable cross-category refs ............. ✅ resolved
- A4. Schema-template apply destination (merge / new) ............ ✅ resolved
- A5. Merge collision handling (same-name fields) ................ 🟡 proposed
- A6. World-template apply — "modify before confirming" flow ..... ⬜ pending
- A7. Save-as-template entry points (serialize) .................. ⬜ pending
- A8. Versioning / snapshot detachment (no live link) ............ ⬜ pending
- A9. Limits / free-tier gating / edge cases ..................... ⬜ pending

**B. Step 14 — Onboarding guide panel**
- B1. Surface: side panel from persistent help icon; placement ... ⬜ pending
- B2. First-login detection: server column vs localStorage ....... ⬜ pending
- B3. Content authoring: format, sections, source of truth ....... ⬜ pending
- B4. "Seen" persistence / dismiss / re-access ................... ⬜ pending
- B5. Coupling risk: category-view revamp (memory) vs guide copy .. ⬜ pending
- B6. Cross-link: does the guide reference templates? ............ ⬜ pending

**C. Sequencing**
- C1. One spec doc or two; single branch/PR; build order ......... ⬜ pending

---

## Resolved decisions

### A1 — Scope: private + built-in only ✅
Build now:
- Curated **built-in official templates** (schema + world).
- **Private "save as template"** from the user's own worlds/categories.
- **Apply-template** wired into world creation and the schema editor.

Deferred (post-launch social step): publish public, browse others' templates,
community ratings, genre filter, moderation/reporting.

**Why:** no user base yet → a public library launches empty, has no rating
signal, and adds a moderation burden — none of which the core snapshot+apply
mechanic needs.

### A2 — Built-ins hardcoded in app code ✅
Built-in templates are typed TS constants (same pattern as `DEFAULT_CATEGORIES`
in `lib/worlds.ts`), sharing the **exact snapshot shape** as DB templates. The
`templates` table therefore holds **only user-authored private templates**.
Library list = `[...BUILTINS, ...userTemplates]`. `applyTemplate(snapshot)` is
source-agnostic.

**Why:** consistent with design §4.4 ("defaults hardcoded in app code, not a DB
table"); git-versioned authored content; no system-account / per-env seed /
`is_official` flag machinery; the table is built for user templates regardless.
Cost — editing a starter needs a deploy — is a non-issue pre-launch.

### A3 — Snapshot format + portable references ✅
A **snapshot** is the frozen, detached copy of category/field **structure** a
template stores (`content jsonb`, design §4.5). Structure only — **no subjects,
facts, values, or UUIDs**. Saving = photograph the structure; applying = unpack
into real `categories` + `schema_fields`. A copy, never a live link (cookie-cutter,
not the cookie).

Portable references (the crux — UUIDs are world-specific, useless elsewhere):
1. Snapshots store **portable local keys + the target category's *name***, never
   UUIDs. List/Link target → `{ localKey?: "cat-2", name: "Spell" }`.
   - **World templates:** resolve via `localKey` internally (all categories are
     in the snapshot; create categories first, map `localKey → newUUID`, then
     create fields).
   - **Schema templates:** resolve the target by **name** in the destination
     world.
2. **On schema-template apply, if the named target category is absent →
   auto-create an empty stub category** (no fields/subjects — cheap, deletable)
   so the Link/List field is immediately functional. Report inline:
   *"Applied D&D Character · also created category: Spell."* No modal.

**Why auto-stub over null-target/manual-fix:** honors "one-click apply, no modal"
(§6.3, §10.6); never produces a broken/unlinked field; stub is free and trivially
deletable; matches how world-creation already seeds categories without ceremony.

Illustrative schema-template snapshot:
```
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
- **Merge into an existing category** (primary; PRD §6.3 verbatim "merges its
  fields into the existing schema — it does not wipe"). Entry: the category's
  schema editor → "Apply template." Snapshot's category name/icon ignored.
- **New category from template** (thin convenience). Entry: category creation →
  "New from template." Snapshot's name/icon prefill the new category (editable);
  fields come along. = `createCategory(name, icon)` + same unpack.

**Why both, merge first:** merge is the specified, higher-value path; new-from-
template is near-free once merge exists and removes the awkward "make empty
category, then apply" dance.

---

## Proposed (awaiting confirmation)

### A5 — Merge collision handling 🟡 proposed
**Proposal:** merge is **strictly additive and never overwrites**. On a same-name
collision, **skip the incoming field**, keep the user's existing one untouched,
report inline: *"Applied D&D Character · added 3 · skipped 1 already present
(Class)."* Match by **case-insensitive name**, ignoring type.

**Why (esp. why NOT overwrite):**
- Overwrite is a data-loss trap — an existing field may hold values on many
  subjects; replacing type/config triggers the value-clearing from
  open-questions Q9/Q10. A template apply silently wiping values violates the
  "never lose data" spine. Disqualified as default.
- Duplicate ("two Class") — DB allows it (only tags are unique) but merging
  shouldn't manufacture duplicates.
- Rename ("Class (2)") — duplicate-with-lipstick.
- Skip — non-destructive, predictable; user keeps their field, template adds only
  what's new; adopting the template's version stays a deliberate manual act.

**Counter-case noted:** if skip proves surprising, add an opt-in inline
"N fields already existed — replace them?" affordance (non-destructive default).

---

## Terms to record in the glossary (at branch end)
- **Snapshot** — the frozen, detached, UUID-free copy of category/field structure
  a template stores; unpacked on apply. Structure only.
- **Apply (a template)** — unpack a snapshot into real `categories` +
  `schema_fields` rows in a destination world; a copy, never a live link.
- **Stub category** — an empty category auto-created on schema-template apply to
  satisfy a Link/List field whose named target is absent.

## Candidate ADRs (promote if hard-to-reverse + surprising + a real trade-off)
- Snapshots store portable name-based refs (not UUIDs); schema-template apply
  auto-creates missing stub categories (A3).
- Template merge is additive-only, never overwrites (A5) — ties to the
  soft-delete / never-lose-data family.
