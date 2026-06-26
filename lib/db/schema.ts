/**
 * Drizzle schema — the single source of truth for the database structure.
 *
 * STATUS: stub. Tables are defined in roadmap step 4 ("Data model migration #1").
 * This file intentionally contains NO table definitions yet — only the planned
 * shape, so the architecture is legible before implementation.
 *
 * Planned tables (see docs/design.md §4):
 *
 *   accounts        — one per authenticated user (tier: free | paid)
 *   worlds          — account-owned; free tier limited to 2
 *   categories      — per world; name, icon, position
 *   schema_fields   — typed field definitions; owned by a category; type-specific
 *                    config in typed nullable columns (target_category_id FK,
 *                    select_options, scale_min/max, unit) — not JSONB
 *   tags            — world-scoped, renameable; normalized (not array on subjects)
 *   subjects        — one category; archivable
 *   subject_tags    — join table: subject ↔ tag
 *   field_values        — a subject's value per field; scalar_value (jsonb),
 *                         OR linked_subject_id (FK→subjects, for Link fields)
 *   list_value_subjects — join table for List field values; FK→subjects ON DELETE CASCADE
 *   facts           — ordered (position: float); plain text with inline @{id} mention markers
 *   relationships   — subject -> subject; origin = fact mention | List/Link field
 *   templates       — schema + world templates (shareable snapshots)
 *
 * Key invariants to encode in step 4:
 * - Facts store plain text + @{id} markers, never the referenced name. The id is
 *   the stable reference; names resolve live at render (rename-safe). See lib/facts.
 * - schema_fields are always owned by a category (no role ownership — see ADR 0002).
 * - Row-Level Security policies scope every table to the owning account.
 *
 * AI hook point: none here — AI features (PRD §7) are not built in this phase.
 */

export {};
