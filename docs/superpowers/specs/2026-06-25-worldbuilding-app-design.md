# Design: Entry-Based Worldbuilding App

**Status:** Approved
**Date:** 2026-06-25
**Author:** Leon (with Claude)
**Source PRD:** [`../../../worldbuilding-prd.md`](../../../worldbuilding-prd.md)

This document is the technical design layer on top of the product PRD. The PRD
defines *what* and *why*; this defines *how it is built* and records the design
decisions made during brainstorming. Where this document and the PRD disagree on
mechanism, this document wins. The PRD remains the source of truth for product
intent (including AI features, which are **not built** in this phase — see §7).

---

## 1. The core thesis (and the moat)

A world is a collection of subjects; a subject is a collection of **facts**.
Facts are the frictionless default. Structure (schema fields, roles) is always a
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
- A field costs a deliberate act (`!` command, or building a Role).

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
3. **Applies consistently** across the category (or a Role's worth of subjects).

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
  db/                 Drizzle client + schema + queries
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
accounts
  worlds                       (per account; free tier limited)
    categories                 (Characters, Locations, ... ; icon; per world)
      schema_fields  ──────┐   (typed field definitions; owner = category OR role)
      roles  ──────────────┘   (named field bundles, per category)
    subjects                   (one category; tags[]; archivable)
      subject_roles            (which roles a subject holds)
      field_values             (this subject's value per applicable field)
      facts                    (ordered plain text + @{id} markers)
    relationships              (subject → subject; origin = fact mention | List/Link field)
    templates                  (schema templates + world templates; shareable)
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
- Facts are **ordered** within a subject (drag-and-drop; stored via a position
  value). Editable/deletable inline.

`lib/facts` owns parse/serialize/render of this format. `lib/mentions` owns
resolving an ID to its current subject and keeping the relationships table in
sync on save.

### 4.2 Schema fields

Field types per PRD §5: List, Link, Text, Number, Boolean, Select, Multi-select,
Date, Scale, Color. Type-specific configuration (select options, scale range,
target category for List/Link) stored with the field definition.

A **schema field is owned by either a category or a role** (exactly one). A
subject stores only its **values**, keyed by field. At render, the set of fields
shown on a subject = its category's fields + the fields of every role it holds,
filtered to those with values (empty fields hidden, per PRD §6.7).

`List`/`Link` field values reference subjects and feed the relationships table
(backlinks), exactly like fact mentions.

### 4.3 Roles (subject-level field presets)

A **Role** is a named, reusable bundle of schema fields, **owned by a category**
(e.g. `Mentor` is a Character role). It solves subject-level variation: Gandalf
holds `Mentor` and shows `Mentees`; Frodo holds no such role and stays clean.

- A subject can hold **multiple roles**; their fields **compose** with the
  category's base fields.
- Roles are **live/linked**: editing a role definition (add/remove a field)
  updates every subject holding it immediately — same rule the PRD sets for
  category schema changes (§6.2).
- **Removal is data-safe:** removing a role from a subject **keeps** any entered
  values — they detach into plain subject-level fields rather than being deleted.
  Empty fields simply disappear. Re-applying re-links.
- Relationship to existing PRD concepts — one idea ("a named set of fields") at
  different scopes:
  - **Category schema** → every subject in the category.
  - **Role** → this subject (and others that hold the role).
  - **Schema / World Templates** (PRD §6.3) → shareable snapshots.

### 4.4 Relationships & backlinks

A single `relationships` table records subject→subject references, with an origin
(fact mention or List/Link field). It powers:

- **Backlinks** ("Mentioned in") on every subject page.
- **Backlink organization:** on a subject's page, select several backlinks and
  **promote them into a List field** on that subject (e.g. select the characters
  whose facts mention being mentored by Gandalf → create a `Students` List). Loose
  mentions crystallize into structure on demand — one of the three gradient
  bridges.

*(The earlier "unorganized backlink threshold notification" idea was dropped.)*

---

## 5. Auth & security

- Supabase Auth: email/password + Google OAuth.
- Every world/category/subject/fact row is owned by an account. **RLS policies**
  ensure a query can only ever return rows the authenticated account owns — a
  safety net beneath the application code.
- Server-only write paths (server actions / route handlers); no privileged keys
  reach the client.

---

## 6. Monetization (model only; gating built later)

Per PRD §9: free tier limited to 2 worlds; paid unlimited. Content (subjects,
facts, schema, roles) is unlimited on both tiers. Gating logic is a late roadmap
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

See [`../../ROADMAP.md`](../../ROADMAP.md). Simplest-first; architecture before
features. This phase delivers steps 1–2 (repo, tooling, Supabase/Drizzle wiring)
plus this spec and the roadmap. Feature steps (3+) follow as their own
plan → implementation cycles.

---

## 9. Open questions (deferred, non-blocking)

- Fact ordering: drag-and-drop only, or also pin-to-top? (PRD §12)
- Template library moderation: open vs. curated? (PRD §12)
- `@{id}` marker exact syntax is internal and changeable; `@{uuid}` is the
  working choice.
