# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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
- World delete is no longer immediate — it moves the world to "Recently Deleted"
  (restorable for 30 days) instead of hard-deleting (ADR 0005).

[Unreleased]: https://example.com/compare
