# Roadmap

Ordered simplest-first: architecture before features. Each feature step is its
own spec → plan → implementation cycle. See
[`superpowers/specs/2026-06-25-worldbuilding-app-design.md`](superpowers/specs/2026-06-25-worldbuilding-app-design.md)
for the design.

Status: ✅ done · 🚧 in progress · ⬜ not started

| # | Step | Status |
|---|------|--------|
| 1 | **Repo + tooling** — git, Next.js + TS + Tailwind, ESLint, README/CHANGELOG/.env.example/.gitignore | ✅ |
| 2 | **Supabase + Drizzle wired** — clients, env, migration tooling, empty schema | ✅ |
| 3 | **Auth** — Supabase email + Google, protected routes, account bootstrap | ⬜ |
| 4 | **Data model migration #1** — worlds, categories, subjects, facts, roles, subject_roles, schema_fields, field_values, relationships | ⬜ |
| 5 | **World CRUD** — create/switch/rename, default categories on creation | ⬜ |
| 6 | **Category + schema editor** — typed fields, reorder, apply-to-subjects | ⬜ |
| 7 | **Roles** — per-category field bundles, apply/remove on subjects, live composition | ⬜ |
| 8 | **Subject CRUD** — create/edit/archive, tags, list view | ⬜ |
| 9 | **Facts engine** — text + `@{id}` markers, ordered entry, inline edit, drag reorder | ⬜ |
| 10 | **@mention autocomplete** — typeahead, live render, raw backlinks | ⬜ |
| 11 | **Backlink organization** — select backlinks → promote to List fields | ⬜ |
| 12 | **`!` field autocomplete** — inline schema fill + create-field (category & role fields) | ⬜ |
| 13 | **Search & filtering** — names + fact content, category/tag filters, tag browser | ⬜ |
| 14 | **Templates** — schema + world templates, library | ⬜ |
| 15 | **Onboarding guide panel** | ⬜ |

**Not in scope (future):** AI features (PRD §7), mobile/PWA, desktop, billing
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
