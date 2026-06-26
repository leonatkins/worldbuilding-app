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

Early development. Architecture, tooling, and **auth** (step 3) are in place;
product features (worlds, subjects, facts) are next. See
[`docs/ROADMAP.md`](docs/ROADMAP.md).

## Stack

- **Next.js 16** (App Router, React 19, TypeScript)
- **Tailwind CSS v4**
- **Supabase** — Postgres, Auth (email + Google), Row-Level Security
- **Drizzle** ORM (migrations in git)
- Hosting: Vercel + Supabase cloud

AI features are specified in the PRD but **not built** in this phase.

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

1. **Apply the migration:** `npm run db:migrate` — creates the `accounts` table,
   the `auth.users` → `accounts` bootstrap trigger, and its RLS policy.
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
- [Changelog](CHANGELOG.md)

## License

TBD — intended to be open source (PRD §6.4).
