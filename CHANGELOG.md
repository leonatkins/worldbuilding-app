# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Deleting a category with subjects is no longer blocked — it now confirms first,
  showing the subject count and a few names, since soft-delete hides them losslessly
  with the category and restore brings them back.
- Subject page: field values moved above facts, the "Fields" heading removed, and each
  value now renders as a compact click-to-edit pill (e.g. "Age: 12 Years") instead of a
  full-width row with a separate Edit button.

### Fixed
- Fixed a React hydration error on the world, category, and subject pages caused by
  `@dnd-kit`'s non-SSR-safe `aria-describedby` id — each `DndContext` now has a stable
  `id` (`category-list`, `schema-fields`, `facts-list`).
- Removed the duplicated category icon from the category page's back link ("← categories").
- All create/rename forms (worlds, categories, subjects) now surface the styled in-app
  validation error instead of the browser's native popup (`noValidate`).
- World switcher now lists every world (including the current one) and its trigger
  shows the active world's name — `createWorld` was missing `revalidatePath("/")`,
  so the shared app layout served a stale worlds list after creating a world.
- Visiting a soft-deleted world's URL now shows the Tombstone screen with one-click
  Restore instead of a raw 404 (`worlds/[worldId]` was filtering out deleted rows
  before the deleted-vs-missing check, unlike category/subject pages).
- Deleting a category that still has subjects is now blocked with an explanatory
  panel ("move or delete them first") instead of silently succeeding — there was no
  live-subject guard in `deleteCategory` and the DB FK cascades.
- Empty/whitespace world names now surface the styled in-app validation error
  instead of the browser's unstyled native popup (`noValidate` on the world forms).
- After resetting a password the recovery session is ended, forcing sign-in with the
  new password (`updatePassword` now calls `signOut()` before redirecting).

### Added
- **@mention autocomplete (roadmap step 9):** facts become a live reference graph.
  - Type `@` in a fact to mention any subject in the world — a caret-anchored,
    non-covering typeahead (world-scoped search, recently-edited by default,
    exact-name match first; ↑/↓/Enter/Tab to pick, Esc/space to dismiss). The
    composer/editor are now a constrained `contentEditable` with atomic mention
    chips ([ADR 0007](docs/adr/0007-mention-input-handrolled-contenteditable.md)),
    not a textarea; paste is coerced to plain text.
  - Stored `@{id}` markers render as live, **rename-safe** links resolved in one
    batch per page. A soft-deleted target renders grayed with an inline **Restore**
    popover; a purged target renders "unknown/deleted" with a **Replace** popover.
    Hovering a mention (or a backlink) shows a lazy, cached card — the subject's
    category + filled fields.
  - Saving a fact mirrors its mentions into the `relationships` table
    (`syncFactRelationships`, delete-then-insert, self-references skipped), driving
    the **Referenced by** rail.
  - **Referenced by** moved to a right side-rail (stacks on narrow screens),
    grouped by source subject and combining fact + field origins; a backlink hides
    when the source subject *or* its source fact is soft-deleted, and returns on
    restore (ADR 0006 Option A read filter).
  - `lib/facts` (`parseFact`/`serializeFact`/`mentionedIds`, unit-tested) and the
    fact half of `lib/mentions` (`resolveMentions`) are now implemented.
  - Spec: `docs/step-9-mention-autocomplete-spec.md`.
- **Facts engine (roadmap step 8):** a subject's primary content.
  - Fast-capture composer (Enter to save, Shift+Enter for a newline; the cursor
    returns to a fresh input after each save). In-progress *new* fact text is
    autosaved to `localStorage` and restored on reload — never lose typing.
  - Inline edit (Save commits; Cancel/Escape reverts), drag-reorder (`dnd-kit`,
    midpoint `position`), and soft delete with a per-subject Recently Deleted
    section. `facts.deleted_at` + a `purge-facts` 30-day `pg_cron` job
    (migration 0005). Fact body is plain text; `@mention` rendering arrives in
    step 9.
  - Spec: `docs/step-8-facts-engine-spec.md`.
- **Reachability + Tombstone ([ADR 0006](docs/adr/0006-ancestor-reachability-tombstone.md)):**
  a world/category/subject page now resolves only if it *and* every ancestor is
  live. A live child under a soft-deleted parent — or a self-deleted entity —
  shows a friendly **Tombstone** with a one-click Restore instead of a stale page
  or a bare 404. (Fixes the subject page resolving its category name unfiltered.)
- **Subject CRUD + tags + field values (roadmap step 7):**
  - Subjects: minimal name-only create (redirects into the new subject page),
    sortable list (localStorage), inline rename, category change (clears field
    values with a counted confirm), and soft delete with Recently Deleted.
  - Subject page (§6.7 layout, minus facts): inline name, category, tag pills with
    autocomplete + create, the schema-field value block, and inbound backlinks.
  - Field values for all 10 types with hybrid storage — scalars in `scalar_value`,
    Link in `linked_subject_id`, List in `list_value_subjects`. Date is freeform
    text with a no-AI learned-autofill from the world's own past dates; Link/List
    use a searchable subject typeahead. List/Link writes keep `relationships`
    (backlinks) in sync via delete-then-insert.
  - Backlinks render grouped by source field name (no fragile inverse grammar).
  - Tags: `tags` + `subject_tags` (migration 0004), world-scoped and
    case-insensitively unique per world; rename propagates everywhere.
  - Spec: `docs/step-7-subject-crud-spec.md`.
- **Category + schema editor (roadmap step 6):** manage a world's categories and
  each category's typed schema fields.
  - Category manager on `/worlds/[worldId]`: create (curated emoji picker +
    suggested quick-picks), rename, drag-reorder (`dnd-kit`, midpoint `position`),
    and soft delete. Deleting a category referenced by another category's
    List/Link field opens an actionable panel to delete or re-point each blocker.
  - Category page `/worlds/[worldId]/categories/[categoryId]` with an inline schema
    editor: add/edit/drag-reorder/delete fields across all 10 types with per-type
    config (options, scale bounds, unit, target category).
  - Global `+` create menu in the top bar; route-level loading skeletons.
  - Spec: `docs/step-6-category-schema-editor-spec.md`.
- **Soft delete (ADR 0005):** every Delete is now soft — items move to a
  "Recently Deleted" view, are restorable, and are hard-purged after 30 days
  (best-effort `pg_cron`). Applied to worlds (step-5 retrofit) and categories;
  `deleted_at` added to `worlds`/`categories`/`subjects` (migrations 0002/0003).
  Reads filter `deleted_at IS NULL` via shared `activeOnly`/`deletedOnly` helpers.
- **World CRUD (roadmap step 5):** create, switch, rename, and delete worlds.
  - Creating a world seeds five default categories (Characters, Locations,
    Factions, Items, Systems) atomically (undo-on-failure); a 🎲 button suggests
    a random name.
  - Worlds list at `/` with five sort orderings (default: last updated), the
    choice persisted in `localStorage`; inline rename and two-step delete confirm
    (no modals).
  - World identity lives in the URL (`/worlds/[worldId]`); an in-world quick
    switcher in the top bar jumps between worlds. See
    [ADR 0003](docs/adr/0003-world-identity-in-url.md).
  - All reads/writes go through the Supabase client so RLS enforces ownership;
    Drizzle is retained as the schema/migration blueprint only. See
    [ADR 0004](docs/adr/0004-data-access-via-supabase-client.md).
  - Spec: `docs/step-5-world-crud-spec.md`.
- **Tests:** Vitest unit tests for the world name validation, default-category
  seed, and random-name generator (`npm test`).
- **Data model (roadmap step 4):** core schema migration — `worlds`,
  `categories`, `schema_fields`, `subjects`, `facts`, `field_values`,
  `list_value_subjects`, `relationships`, plus `field_type` /
  `relationship_origin` enums.
  - Denormalized `account_id` (DEFAULT `auth.uid()`) on every table with an
    own-rows RLS policy, so each row is visible/writable only by its owner.
  - Ownership cascades on delete; `target_category_id` RESTRICT (forced cleanup),
    `linked_subject_id` SET NULL (no orphans).
  - Spec: `docs/step-4-data-model-spec.md`.
- **Auth (roadmap step 3):** Supabase email/password + Google OAuth, with email
  verification gate and password reset.
  - `accounts` table + migration: FK to `auth.users` (ON DELETE CASCADE),
    sign-up bootstrap trigger, and own-row RLS policy.
  - `proxy.ts` (Next 16 middleware) refreshes the session cookie and gates every
    route: unauthenticated → `/login?next=…`, unverified → `/verify-email`.
  - Route groups: `(app)/` protected home with sign-out; `(marketing)/` public
    auth pages — `/login`, `/signup` (visually distinct layouts), `/verify-email`,
    `/reset-password`, and the `/auth/callback` OAuth/email handler.
  - Server-only auth actions in `app/actions/auth.ts`.
- Technical design spec for the entry-based worldbuilding app (`docs/design.md`),
  including the facts-first gradient principle and the `@{id}` fact storage model.
- Ordered build roadmap (`docs/ROADMAP.md`).
- Project scaffold: Next.js 15 + TypeScript + Tailwind v4, ESLint config, base
  `app/` routes, and module-boundary stubs (`lib/db`, `lib/facts`,
  `lib/mentions`, `lib/supabase`).
- Drizzle ORM config and empty schema; Supabase browser/server client stubs.
- Baseline project files: README, `.env.example`, `.gitignore`.

### Changed
- "Referenced by" now groups inbound links by **source subject** (combining fact
  and field origins) in a side-rail, replacing the step-7 grouping by source field
  name.
- Editing a field value now also bumps the subject's `updated_at`, so value edits
  count toward "Last edited" sort (previously only name/category changes did).
- World delete is no longer immediate — it moves the world to "Recently Deleted"
  (restorable for 30 days) instead of hard-deleting (ADR 0005).

[Unreleased]: https://example.com/compare
