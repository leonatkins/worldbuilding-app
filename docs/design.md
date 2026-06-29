# Design: Entry-Based Worldbuilding App

**Status:** Approved
**Date:** 2026-06-25
**Author:** Leon (with Claude)
**Source PRD:** [`../worldbuilding-prd.md`](../worldbuilding-prd.md)

This document is the technical design layer on top of the product PRD. The PRD
defines *what* and *why*; this defines *how it is built* and records the design
decisions made during brainstorming. Where this document and the PRD disagree on
mechanism, this document wins. The PRD remains the source of truth for product
intent (including AI features, which are **not built** in this phase — see §7).

---

## 1. The core thesis (and the moat)

A world is a collection of subjects; a subject is a collection of **facts**.
Facts are the frictionless default. Structure (schema fields) is always a
**deliberate pull**, never pushed on the user.

### The facts-first gradient — top-level design constraint

The product's defensibility is **not** the fact feature in isolation — it is the
*gradient* from fast, loose capture to optional, crystallized structure,
navigated inline without ever leaving the typing flow.

Competitors (World Anvil, Kanka) are **top-down**: open a subject → confront a
template → fill fields; everything that doesn't fit gets buried in prose. This
app is **bottom-up**: open a subject → blinking cursor → type. Structure grows
*out of* facts via three bridges (`!` command, backlink→list promotion, and a
future passive fact→schema suggestion).

What prevents "everything becomes schema" is **not a rule about what may be a
field** — policing that would be its own rigidity. It is **friction asymmetry**:

- A fact costs zero deliberate effort (cursor, type, Enter, done).
- A field costs a deliberate act (`!` command).

Entropy therefore points toward facts. Users climb to structure only when *not*
having it hurts more than making it. That inversion is the moat — a **UX
property, not a data-model rule**.

**Every feature must be tested against this constraint:** *Does it push structure
on the user, or let it emerge? If it pushes, it is wrong.* This sharpens and
folds in PRD §10's UX principles.

### Heuristic: fact vs field (taught, never enforced)

A schema field earns its place only when **all three** hold:

1. **Value is an atom** — number, date, boolean, one choice, one link. If it
   wants to be a nuanced sentence, it's a fact.
2. **You would query it across the category** — filter, sort, compare. If never
   cross-queried, a field buys nothing.
3. **Applies consistently** across the category.

Examples: `Likes`, `Lies told` → **facts** (open-ended, never cross-queried).
`Alignment`, `Population`, `Birthday`, `Mentor` → **fields** (atoms you'd filter
or link by). The app **does not enforce** this — the onboarding guide teaches it
so users self-sort; if a user wants a queryable `Likes` Multi-select, they may.

---

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend + backend | **Next.js 15 (App Router, React 19, TypeScript)** | One codebase, server + client, page routing. |
| Styling | **Tailwind CSS v4** | Fast, consistent, colocated styling. |
| Database | **Postgres (Supabase)** | Relational data with strong querying; managed. |
| Auth | **Supabase Auth** | Email/password + Google OAuth out of the box. |
| Security | **Row-Level Security (RLS)** | Ownership enforced at the database layer. |
| ORM | **Drizzle** | Schema-as-TypeScript, type-safe queries, migrations in git. |
| Hosting | **Vercel + Supabase cloud** | Standard, low-ops. |

No `any` in TypeScript (per global rules) — use `unknown` or a proper type.

---

## 3. Architecture & module boundaries

Each unit has one purpose, a defined interface, and is independently testable.

```
app/
  (marketing)/        public landing, auth pages
  (app)/              authenticated product surfaces (worlds, subjects, ...)
  api/ , actions      server-only write paths
lib/
  db/                 Drizzle schema + migrations (NOT the query layer — see ADR 0004:
                      all reads/writes go through the Supabase client; Drizzle is the blueprint)
  facts/              fact text model: parse / serialize / render @{id} markers
  mentions/           mention resolution + relationship (backlink) maintenance
  supabase/           browser + server Supabase clients (auth, RLS context)
drizzle/              generated SQL migrations (version-controlled)
docs/                 PRD, specs, roadmap
```

**Data flow (write example — adding a fact):**
1. Client (React/Next.js) captures text + inline `@{id}` markers.
2. Knocks on a server action: "save this fact for this subject."
3. Server verifies auth (Supabase) and ownership.
4. Drizzle writes to Postgres; RLS double-checks ownership at the DB layer.
5. Relationships table updated from the fact's `@{id}` markers (drives backlinks).
6. UI shows the fact and drops the cursor into a fresh input (<5s, per PRD §10.2).

Every feature is a variation on this loop.

---

## 4. Data model

```
Soft delete (ADR 0005): worlds, categories, subjects carry
`deleted_at timestamptz nullable` (NULL = live). Delete is soft → "Recently
Deleted" → 30-day pg_cron purge; every read filters `deleted_at IS NULL`.

```
accounts
  worlds                       (per account; free tier limited; deleted_at)
    categories                 (icon; position: float; deleted_at)
      schema_fields            (typed; owned by category; position: float)
    tags                       (world-scoped; name; renameable in one place)
    subjects                   (one category; deleted_at timestamptz nullable — NULL = live, ADR 0005)
      subject_tags             (join: which tags a subject holds)
      field_values             (this subject's value per applicable field)
      facts                    (ordered plain text + @{id} markers; position: float)
    relationships              (from_subject_id → to_subject_id; origin: fact|field; fact_id?, field_id? nullable)
    templates                  (schema + world templates; content jsonb snapshot, unpacked into real rows on apply)
```

### 4.1 Facts (the critical decision — PRD §12 flag)

A fact is **plain text** with inline **`@{id}` markers** for mentions. Not JSONB,
not a segment object model — just text with embedded markers.

```
Stored:    Trained under @{a1b2} before meeting @{c3d4} in the south.
Rendered:  Trained under Gandalf before meeting Elrond in the south.
```

- The **ID is the truth**; the subject's name is **never stored in the fact** —
  it is resolved live at render time. Renaming a subject updates every fact
  showing it, automatically, with no find-and-replace and no broken links.
- A fact with no mentions is literally just text. No required structure.
- Markers may appear **anywhere** in the text, **any number of times**
  (mid-sentence, multiple per fact). The `@{...}` token is the distinguishing
  syntax; the user never sees raw markers — they render as bold, clickable links.
- Facts are **ordered** within a subject (drag-and-drop; stored via a `position float` column). Insert between two facts by averaging their positions; rebalance to integer multiples if precision is ever exhausted (not expected at realistic fact counts). Editable/deletable inline.

`lib/facts` owns parse/serialize/render of this format. `lib/mentions` owns
resolving an ID to its current subject and keeping the relationships table in
sync on save.

- **Search consequence:** because names are not stored in the fact, global
  search (PRD §6.8) by mentioned name is a **dual match** — resolve the query
  term to subject IDs and match facts whose `@{id}` markers contain those IDs,
  **unioned** with a literal substring match on the fact text. A fact that
  mentions "Gandalf" is found even though the name never appears in its stored
  bytes. Recorded in [ADR 0001](../../adr/0001-facts-as-plain-text-with-id-markers.md).

### 4.2 Schema fields

Field types per PRD §5: List, Link, Text, Number, Boolean, Select, Multi-select,
Date, Scale, Color. Type-specific config is stored in **typed nullable columns**
(not a JSONB blob) so Postgres can enforce referential integrity:

| Column | Used by |
|---|---|
| `target_category_id uuid FK→categories` | List, Link |
| `select_options text[]` | Select, Multi-select |
| `scale_min integer, scale_max integer` | Scale |
| `unit text` | Number |

`target_category_id` is a foreign key with `ON DELETE RESTRICT` — deleting a
category that List/Link fields still reference is blocked at the DB layer, forcing
explicit cleanup in the category-delete flow.

A **schema field is owned by its category** (exactly one). A subject stores only
its **values**, keyed by field. At render, the set of fields shown on a subject =
its category's fields, filtered to those with values (empty fields hidden, per
PRD §6.7). See [ADR 0002](adr/0002-no-roles-in-mvp.md) for why subject-level
field bundles (Roles) were deferred.

**`List` fields are subject references only** — "multiple subjects from a
specified category." Free-text lists (e.g. "favorite foods") are not a field
type; they belong as a **fact** (`Likes: apples, lembas bread`). `Multi-select`
covers predefined option lists but not freeform text entry.

**`field_values` storage is a hybrid** — split by whether the value references a subject:

| Field types | Storage |
|---|---|
| Text, Number, Boolean, Select, Multi-select, Date, Scale, Color | `scalar_value jsonb` on `field_values` |
| Link (single subject) | `linked_subject_id uuid FK→subjects ON DELETE SET NULL` on `field_values` |
| List (multiple subjects) | `list_value_subjects(field_value_id, subject_id FK→subjects ON DELETE CASCADE)` join table |

Subject-reference values get real FK columns so Postgres blocks or clears them
on subject delete — no silent orphans. Scalar values have no referential
integrity concern so JSONB is fine. The `relationships` table is still populated
from both on write (backlink source).

`List`/`Link` field values reference subjects and feed the relationships table
(backlinks), exactly like fact mentions.

### 4.3 Relationships & backlinks

A single `relationships` table records subject→subject references, with an origin
(fact mention or List/Link field). It powers:

- **Backlinks** ("Mentioned in") on every subject page.
- **Backlink organization:** on a subject's page, select several backlinks and
  **promote them into a List field** on that subject (e.g. select the characters
  whose facts mention being mentored by Gandalf → create a `Students` List). Loose
  mentions crystallize into structure on demand — one of the three gradient
  bridges.

*(The earlier "unorganized backlink threshold notification" idea was dropped.)*

### 4.4 World creation starting points

On world creation the user picks one of three starting points:

1. **From a world template** — applies a community or saved template (unpacks jsonb snapshot into real categories + schema fields).
2. **Default** — seeds the five default categories (Characters, Locations, Factions, Items, Systems) with no schema fields. Defaults are hardcoded in app code, not a DB table.
3. **Blank** — empty world, no categories.

### 4.5 Templates

Stored as a single `content jsonb` column — a frozen snapshot of the category/field
structure at save time. Applying a template unpacks that blob into real `categories`
and `schema_fields` rows; the template itself is never queried field-by-field.
Two kinds (per PRD §6.3): **schema templates** (one category's fields) and
**world templates** (full category structure, no subjects or facts).

---

## 5. Auth & security

- Supabase Auth: email/password + Google OAuth.
- A Postgres trigger on `auth.users` insert creates the `accounts` row
  automatically — atomic with sign-up, no broken-state window where a user
  exists in Auth but has no account row.
- Every table carries a denormalized `account_id` column. **RLS policies** are
  `WHERE account_id = auth.uid()` — one-liners, no join chains up the ownership
  tree. Fast and simple; the redundancy cost per row is negligible for a
  single-owner app with no multi-tenancy.
- Server-only write paths (server actions / route handlers); no privileged keys
  reach the client.

---

## 6. Monetization (model only; gating built later)

Per PRD §9: free tier limited to 2 worlds; paid unlimited. Content (subjects,
facts, schema) is unlimited on both tiers. Gating logic is a late roadmap
step; the data model anticipates it (account tier) but the build does not
implement billing in this phase.

---

## 7. AI — NOT built in this phase

All AI features (PRD §7: World Q&A, contradiction detection, auto-tags) remain in
the PRD as **future work**. This phase builds **no AI infrastructure** — no Claude
key, no AI routes, no quotas.

The only trace in code is **inline hook-point comments** at the natural seams
(e.g. above the fact-save path, the search module, the tag editor) marking where
and how AI *could* later attach — e.g. `// AI hook point: contradiction detection
could scan here`. These comments are kept accurate as surrounding code changes.

---

## 8. Build order (roadmap)

See [`ROADMAP.md`](ROADMAP.md). Simplest-first; architecture before
features. This phase delivers steps 1–2 (repo, tooling, Supabase/Drizzle wiring)
plus this spec and the roadmap. Feature steps (3+) follow as their own
plan → implementation cycles.

---

## 9. Open questions (deferred, non-blocking)

- **Fact pin-to-top:** drag-and-drop covers ordering, but should users be able to
  pin important facts to the top of the list regardless of position? Defer to
  step 8 (facts engine) — resolve when building the reorder UI.
- **Template library moderation:** public templates are community-contributed —
  is there any reporting, curation, or quality control, or fully open? Defer to
  step 13 (templates) — low stakes until the library exists.
- `@{id}` marker exact syntax is internal and changeable; `@{uuid}` is the
  working choice.
- **List/Link value picker at scale:** when a category has hundreds of subjects,
  how does the user select values for a List or Link field without a modal wall
  of options? Cover when reaching schema editor (step 6) or facts engine (step 8).
