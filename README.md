# Worldbuilding App

A fast, minimal, **fact-first** worldbuilding tool. A world is a collection of
subjects; a subject is a collection of **facts** — atomic, taggable, searchable
notes that reference each other. No blank pages, no required prose, no 40-field
templates. Structure (typed schema fields) is optional and *emerges* from facts; it is
never pushed on you.

> The moat is the **gradient**: capture at the speed of thought, and let
> structure crystallize only where it earns its place. See
> [`docs/design.md`](docs/design.md).

## Status

Early development. In place: architecture, tooling, **auth** (step 3), the
**data model** (step 4), **world CRUD** (step 5), the **category + schema
editor** (step 6), **subject CRUD with tags and field values** (step 7), and the
**facts engine** (step 8) — fast-capture facts with drag-reorder, draft autosave,
and soft delete — plus project-wide **soft delete**
([ADR 0005](docs/adr/0005-soft-delete-recently-deleted.md)) with ancestor
reachability ([ADR 0006](docs/adr/0006-ancestor-reachability-tombstone.md)).
**`@mention` autocomplete** (step 9) is next. See [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Stack

- **Next.js 16** (App Router, React 19, TypeScript)
- **Tailwind CSS v4**
- **Supabase** — Postgres, Auth (email + Google), Row-Level Security. App
  reads/writes go through the Supabase client so RLS enforces ownership
  ([ADR 0004](docs/adr/0004-data-access-via-supabase-client.md)).
- **Drizzle** — schema-as-TypeScript + migrations in git (the schema blueprint,
  not the query layer).
- Hosting: Vercel + Supabase cloud

AI features are specified in the PRD but **not built** in this phase.

## Data model

The ownership spine is `account → worlds → categories → subjects`, with typed
schema fields defined per category and values stored per subject:

- **worlds / categories / subjects / facts** carry a `deleted_at` for soft delete
  (Recently Deleted → 30-day purge); every read filters live rows, and a page
  resolves only if its whole ancestor chain is live (else a Tombstone).
- **schema_fields** define a category's typed fields across 10 types (Text,
  Number, Boolean, Select, MultiSelect, Date, Scale, Color, Link, List), with
  type-specific config in typed columns.
- **field_values** use hybrid storage — scalars in `scalar_value` (jsonb), a
  single Link in `linked_subject_id`, List members in `list_value_subjects`.
- **tags / subject_tags** are world-scoped, case-insensitively unique labels;
  rename propagates everywhere.
- **relationships** are directed backlinks derived from List/Link fields (and,
  later, fact `@{id}` mentions), discriminated by `origin`.

Every table has a denormalized `account_id` (DEFAULT `auth.uid()`) with an
own-rows RLS policy, so ownership is enforced by Postgres on every query.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in Supabase values
npm run dev                  # http://localhost:3000
```

You'll need a [Supabase](https://supabase.com) project. Copy its URL, anon key,
and database connection string into `.env.local`:

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `DATABASE_URL` | Postgres connection string (for Drizzle migrations) |
| `NEXT_PUBLIC_SITE_URL` | Optional. Base URL used to build auth redirect/callback links when the request `Origin` header is absent (defaults to `http://localhost:3000`). |

### Auth setup

1. **Apply the migrations:** `npm run db:migrate` — creates the `accounts` table,
   the `auth.users` → `accounts` bootstrap trigger, and its RLS policy, then the
   core data model (`worlds`, `categories`, `schema_fields`, `subjects`, `facts`,
   `field_values`, `list_value_subjects`, `relationships`), each scoped to its
   owner by an `account_id` RLS policy.
2. **Google OAuth:** in the Supabase dashboard → Authentication → Providers →
   Google, enable the provider and set the redirect URL to
   `<your-url>/auth/callback`.
3. **Email:** email/password sign-up requires email confirmation; unverified
   users are held at `/verify-email` until they click the link.

## Usage

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — lint
- `npm test` — run unit tests (Vitest)
- `npm run db:generate` — generate a migration from the Drizzle schema
- `npm run db:migrate` — apply migrations
- `npm run db:studio` — open Drizzle Studio

## Project layout

```
app/      Next.js routes (marketing + authenticated app)
lib/      db (Drizzle), facts, mentions, supabase clients
drizzle/  generated SQL migrations
docs/     PRD, design spec, roadmap
```

## Documentation

- [Product PRD](worldbuilding-prd.md)
- [Technical design spec](docs/design.md)
- [Roadmap](docs/ROADMAP.md)
- [Architecture review (2026-06)](docs/architecture-review-2026-06.md)
- [Open questions](docs/open-questions.md)
- [Changelog](CHANGELOG.md)

## License

TBD — intended to be open source (PRD §6.4).
