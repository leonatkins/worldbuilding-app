# Step 5 — World CRUD

**Status:** Approved (grilled 2026-06-27)
**Roadmap step:** 5
**Depends on:** step 4 (`worlds`, `categories` tables), step 3 (`accounts`, auth, RLS)
**Source design:** [`design.md`](design.md) §4.4 (starting points), §5 (auth/RLS) · PRD §6.1
**ADRs:** [0003 — world identity in URL](adr/0003-world-identity-in-url.md) · [0004 — data access via Supabase client](adr/0004-data-access-via-supabase-client.md)

This is the **first feature step with writes.** The tables already exist (step 4);
this step adds the server actions, routing, and UI for creating, switching,
renaming, and deleting worlds, and seeds the default categories on creation. No
new tables, no migration.

---

## 1. Scope

### In scope

| Capability | Summary |
|---|---|
| **Create** | Inline form on the worlds list: name (with a random-name dice button) → seed 5 default categories → redirect into the new world. |
| **Switch** | The worlds list at `/` is the primary switcher; an in-world **quick switcher** dropdown in the top bar jumps between worlds without returning to `/`. |
| **Rename** | Inline edit on the worlds list. |
| **Delete** | Inline two-step confirm on the worlds list; CASCADE removes the world's categories/subjects/facts (wired in step 4). |
| **Sort** | The list is sortable (5 orderings); choice persisted in `localStorage`. |
| **World home** | A minimal `/worlds/[worldId]` route that resolves the world, lists its (seeded) categories, and 404s on a foreign/missing id. Fleshed out in step 6. |

### Explicitly NOT in this step

- **No free-tier "max 2 worlds" enforcement** — gating is a late roadmap step
  (design §6). Worlds are unlimited for now.
- **No template / blank starting points** — design §4.4 lists three creation
  paths; only **Default** (seed 5 categories) ships now. The name input grows
  into the starting-point picker in **step 13** (templates).
- **No category or schema editing** — the world home only *displays* seeded
  categories; editing/reordering/adding fields is **step 6**.
- No subjects, facts, tags, or search.
- **No auto-creation of a first world** on signup — first run shows an empty
  state with a "Create your first world" CTA.

---

## 2. Data access model (ADR 0004)

**All reads and writes go through the Supabase client ("door 1")**, which carries
the user's auth token. Consequences this step relies on:

- `account_id` is **auto-stamped** by the `DEFAULT auth.uid()` from step 4 — app
  code never sets it.
- **RLS enforces ownership** on every read/update/delete — no manual
  `WHERE account_id = …` filter, and a foreign/non-existent `worldId` simply
  returns no rows (→ 404).
- **Drizzle is NOT used for queries here.** It remains the schema/migration
  blueprint (`lib/db/schema.ts`) only. Reserve it for genuinely complex reads in
  later steps (e.g. step-12 search) where door 1's query surface is too clumsy.

Server actions still call `supabase.auth.getUser()` to confirm a session before
acting (defense in depth; RLS is the real guard).

---

## 3. Routing (ADR 0003)

A world's identity lives in the **URL**, not in a stored "current world."

| Route | Purpose |
|---|---|
| `/` | Worlds list / switcher. Always the list — never auto-jumps to a last-opened world. |
| `/worlds/[worldId]` | A world's home. Step 5: lists seeded categories, proves the world resolves, 404s on foreign/missing id. |

**Top bar** (in `app/(app)/layout.tsx`, shown across authenticated surfaces):

- The **"Worldbuilding" wordmark links to `/`** (the list / way out of a world).
- A **quick switcher** dropdown (popover, not a modal): the user's worlds
  (recently-updated first), the current world highlighted, click to switch; an
  **"Open all worlds"** item at the bottom links to `/`. Reads the world list via
  door 1; reads the current `worldId` from the route.

---

## 4. Server actions (`app/actions/worlds.ts`)

All `"use server"`, all through the Supabase server client (door 1).

- **`createWorld(name)`** — validate (§7); insert the world; insert the 5 default
  categories (§5) in one `insert([...])`. **Undo-on-failure:** if the category
  insert fails, delete the just-created world and return an error (avoids a
  half-seeded world). On success, `redirect('/worlds/<newId>')`.
- **`renameWorld(worldId, name)`** — validate; update `name` and `updated_at`
  (app-managed; door 1 update sets it explicitly). RLS scopes to owner.
- **`deleteWorld(worldId)`** — delete the world; CASCADE handles children. RLS
  scopes to owner.

> Atomicity note: the "undo-on-failure" approach is not perfectly atomic (a
> server crash between the two inserts could orphan an empty world — rare and
> harmless, user can delete it). Upgrade to a single Postgres function
> (`rpc`) if this ever matters.

---

## 5. Default categories (seed)

Hardcoded **TypeScript constant** in app code (design §4.4 — "hardcoded in app
code, not a DB table"), passed into `createWorld`'s category insert:

| Name | Icon | Position |
|---|---|---|
| Characters | 🧑 | 1.0 |
| Locations | 📍 | 2.0 |
| Factions | 🏛️ | 3.0 |
| Items | 🗡️ | 4.0 |
| Systems | ⚙️ | 5.0 |

- `position` is `double precision` (float) — unit gaps leave midpoint-insertion
  room.
- **No schema fields** are seeded (structure stays a deliberate pull, design §1).
- After seeding the categories are **fully ordinary** rows — nothing marks them
  as "default"; the user may rename, reorder, delete, or add fields (step 6).

---

## 6. UX

General rule: **no modals** anywhere (project-wide). Inline forms and in-place
editing only; dropdown/popover menus are fine.

- **Empty state** (no worlds): a "Create your first world" CTA.
- **Create form** (inline on the list): a single name input + a **dice/shuffle
  button** that fills a suggested name from two combined curated wordlists (e.g.
  *Whispering Hollow*, *Crimson Vale*) — hardcoded client-side, no dependency,
  fully overtypable.
- **Sort `<select>`** on the list. Options and default:
  1. **Last updated (newest first)** — *default*
  2. Date created (newest first)
  3. Date created (oldest first)
  4. Name (A–Z)
  5. Name (Z–A)
  Choice persisted in `localStorage` (per-device view preference; no schema
  change, no server round-trip).
- **Rename:** click the name (or a pencil) → inline text input → Enter/blur saves.
- **Delete:** per-world "⋯" → the row morphs into an inline confirm ("Delete
  *Name*? This removes all its subjects and facts. [Delete] [Cancel]"). Two-step,
  no modal.
- **Quick switcher:** see §3.

---

## 7. Validation (create + rename)

- **Required** — reject empty/whitespace-only (no fallback name; the dice button
  covers the inspiration-less).
- **Trim** leading/trailing whitespace before saving.
- **Max length 100** — enforced client (`maxlength`) and **server** (the real gate).
- **Duplicates allowed** — consistent with "no name-uniqueness on
  categories/schema_fields" (step-4 spec §4); names are display labels, not keys.
  No warning.
- Min length 1 after trim.

---

## 8. Definition of done

- [ ] `/` lists the user's worlds with the empty state, create form (+ dice),
      sort `<select>` (localStorage-persisted), inline rename, inline delete.
- [ ] `createWorld` seeds the 5 default categories atomically (undo-on-failure)
      and redirects into the new world.
- [ ] `/worlds/[worldId]` resolves the world, lists its categories, and 404s on a
      foreign/missing id.
- [ ] Top bar: wordmark → `/`, quick switcher with current-world highlight and
      "Open all worlds".
- [ ] All data access via the Supabase client (door 1); no Drizzle queries; no
      manual `account_id` / ownership filters.
- [ ] Validation enforced server-side (§7).
- [ ] `npm run build` passes, `npm run lint` clean.
- [ ] Docs updated (README, CHANGELOG, ROADMAP step 5 → ✅) in the same commit.

---

## 9. Feeds later steps

- **Step 6 (category editor):** when creating a *new* category, offer a short
  list of **suggested categories** (e.g. Species, Biomes) as quick-picks — same
  hardcoded-suggestions pattern as the default seed, opt-in per category.
- **Step 8 (facts engine):** **autosave in-progress fact text** (per subject, in
  `localStorage`) and restore on reload/navigation — never lose typing. Broader
  principle: unsaved text input should survive a reload.
- **Quick switcher** may grow search/filtering once a user has many worlds.
