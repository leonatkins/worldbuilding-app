# Roadmap

Ordered simplest-first: architecture before features. Each feature step is its
own spec → plan → implementation cycle. See
[`design.md`](design.md)
for the design.

Status: ✅ done · 🚧 in progress · ⬜ not started

| # | Step | Status |
|---|------|--------|
| 1 | **Repo + tooling** — git, Next.js + TS + Tailwind, ESLint, README/CHANGELOG/.env.example/.gitignore | ✅ |
| 2 | **Supabase + Drizzle wired** — clients, env, migration tooling, empty schema | ✅ |
| 3 | **Auth** — Supabase email + Google, protected routes, account bootstrap | ✅ |
| 4 | **Data model migration #1** — worlds, categories, schema_fields, subjects, field_values, facts, relationships | ✅ |
| 5 | **World CRUD** — create/switch/rename/delete, default categories on creation | ✅ |
| 6 | **Category + schema editor** — categories (CRUD, reorder, icon) + schema field *definitions* (typed, configure, reorder). No subjects; writes **no** `field_values` (apply-to-subjects is automatic via hide-empty). | ✅ |
| 7 | **Subject CRUD** — create/edit/archive, tags (adds `tags`+`subject_tags`, migration #2), list view, **subject page + inline field-*value* editing** (first `field_values` **and** `relationships` writes). `!`/facts layer on later. | ✅ |
| 8 | **Facts engine** — text + `@{id}` markers, ordered entry, inline edit, drag reorder | ✅ |
| 9 | **@mention autocomplete** — typeahead, live render, raw backlinks | ✅ |
| 10 | **Backlink organization** — select backlinks → promote to List fields | ⬜ |
| 11 | **`!` field autocomplete** — inline schema fill + create-field | ⬜ |
| 12 | **Search & filtering** — names + fact content, category/tag filters, tag browser | ⬜ |
| 13 | **Templates** — schema + world templates, library | ⬜ |
| 14 | **Onboarding guide panel** | ⬜ |
| 15 | **Global dashboard** — account-level home: recently viewed (view history), recently edited/created across all worlds, tips, announcements/updates, live events, release notes. Placement flexible. | ⬜ |

**Cross-cutting:** **Soft delete** (ADR 0005) — every Delete is soft → "Recently Deleted" → 30-day `pg_cron` purge, project-wide (worlds/categories/subjects). Built into steps 5–7 (step 5 retrofit) with `deleted_at` columns.

**Not in scope (future):** AI features (PRD §7), Roles (ADR 0002), mobile/PWA, desktop, billing
implementation. AI leaves only hook-point comments in code (see design §7).

## Definitions of done (steps 1–2, this phase)

- [x] `npm install` succeeds; `npm run build` passes; `npm run lint` clean.
- [x] Tailwind v4 wired (PostCSS + `@import "tailwindcss"`).
- [x] Drizzle config + empty schema present; `drizzle-kit` recognized (v0.31.10).
- [x] Supabase browser + server client stubs in place; `.env.example` documents
      required vars.
- [x] Module boundaries scaffolded (`lib/db`, `lib/facts`, `lib/mentions`,
      `lib/supabase`) with documented stubs — no feature logic.
- [x] README, CHANGELOG, design doc, roadmap committed.
