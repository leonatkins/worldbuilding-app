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
| 10 | **Backlink organization** — select backlinks → promote to List fields | ✅ |
| 11 | **`!` field autocomplete** — inline schema fill + create-field | ✅ |
| 12 | **Search & filtering** — names + fact content, category/tag filters, tag browser | ✅ |
| 13 | **Templates** — schema + world templates, library (ADRs 0009–0011) | ✅ |
| 14 | **Onboarding guide panel** | ✅ |
| 15a | **Home + view history** — account-level Home (recently viewed via `subject_views`, recently edited across worlds, Tips + What's-new); ADR 0012 | ✅ |
| 15b | **In-world navigation revamp** — journal **front page** (recency-led + categories index), the **Spyglass** (find/jump), Manage dissolved, Browse flat + inline add, `+` retired. **No tabs, no command palette** (ADR 0014). Spec: `step-15b-spec.md` | ✅ |
| 16 | **Visual identity** — papery-**cartographer** register (Scriptorium + Atlas). Grilled 2026-07-16 → `step-16-visual-identity-grill.md`; color model = [ADR 0015](adr/0015-two-axis-color-chrome-vs-content.md). Split into 16a–16d below. First slice (create-menu/guide/control polish) shipped. | 🚧 |
| 16a | **Foundation & sweep** — semantic tokens (Tailwind v4 `@theme`), Newsreader + Courier Prime (serif everywhere, zero sans), System/Light/Dark toggle + no-flash script, motion tokens, radius→0, grid texture + hard offset shadows, Spyglass treatment, token sweep of ~25 files, ESLint guardrail, contrast + hover-on-touch fixes. **No migrations, no new assets.** | 🚧 |
| 16b | **Color identity** — `worlds.color` + `categories.color` (palette key) + `categories.identity_field_id`; broad pale palette, pickers w/ "in use" grouping, at-creation pickers, livery pennant, Color-swatch v2 / Date v2. **3 migrations.** | ⬜ |
| 16c | **Custom icon set** — ~20–30 monoline cartographic glyphs (extends `DiceIcon`), new picker, `categories.icon` emoji→key **data migration** + backfill, suggested-category chips re-glyphed. **Largest slice; isolated, lands any time.** | ⬜ |
| 16d | **Delight** — peeking mascot easter egg, hatched empty-state illustrations (compass rose / cartouche). Genuinely deferrable. | ⬜ |
| 17 | **Mobile pass** — the app has never had one. Touch targets, safe areas, responsive audit, and the **press-and-hold action menu** replacing hover-reveal Rename/Delete (16a only gates hover behind `@media (hover:hover)` as a stopgap). | ⬜ |

> **Step 15 was rescoped** during the 2026-07-04 grill into **15a** (Home, done),
> **15b** (nav revamp, spec'd) and a new **16** (visual polish). The original "global
> dashboard" is 15a; 15b deliberately moved the whole app **away from a tabbed/dashboard
> nav** toward a journal front page — see [ADR 0014](adr/0014-journal-navigation-no-tabs-no-palette.md).

**Cross-cutting:** **Soft delete** (ADR 0005) — every Delete is soft → "Recently Deleted" → 30-day `pg_cron` purge, project-wide (worlds/categories/subjects). Built into steps 5–7 (step 5 retrofit) with `deleted_at` columns.

**Launch checklist (not a step):** verify `pg_cron` on the cloud project (open-questions Q5 — the one real blocker); Supabase custom domain + Google OAuth branding.

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
