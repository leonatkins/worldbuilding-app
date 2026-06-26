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

Early scaffold. Architecture and tooling in place; features not yet built. See
[`docs/ROADMAP.md`](docs/ROADMAP.md).

## Stack

- **Next.js 15** (App Router, React 19, TypeScript)
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
and database connection string into `.env.local`.

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
