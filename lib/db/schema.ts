/**
 * Drizzle schema — the single source of truth for the database structure.
 *
 * STATUS: stub. Tables are defined in roadmap step 4 ("Data model migration #1").
 * This file intentionally contains NO table definitions yet — only the planned
 * shape, so the architecture is legible before implementation.
 *
 * Planned tables (see docs/superpowers/specs/2026-06-25-worldbuilding-app-design.md §4):
 *
 *   accounts        — one per authenticated user (tier: free | paid)
 *   worlds          — account-owned; free tier limited to 2
 *   categories      — per world; name, icon, position
 *   schema_fields   — typed field definitions; owner is a category OR a role
 *   roles           — named field bundles, owned by a category (live/linked)
 *   subjects        — one category; tags[]; archivable
 *   subject_roles   — which roles a subject holds (composition)
 *   field_values    — a subject's value per applicable field
 *   facts           — ordered; plain text with inline @{id} mention markers
 *   relationships   — subject -> subject; origin = fact mention | List/Link field
 *   templates       — schema + world templates (shareable snapshots)
 *
 * Key invariants to encode in step 4:
 * - Facts store plain text + @{id} markers, never the referenced name. The id is
 *   the stable reference; names resolve live at render (rename-safe). See lib/facts.
 * - schema_fields.owner is exactly one of (category_id, role_id).
 * - Row-Level Security policies scope every table to the owning account.
 *
 * AI hook point: none here — AI features (PRD §7) are not built in this phase.
 */

export {};
