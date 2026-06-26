/**
 * Drizzle schema — the single source of truth for the database structure.
 *
 * STATUS: step 3 (Auth). Only `accounts` is defined so far — it has to exist now
 * because the sign-up bootstrap trigger inserts into it (see the accounts
 * migration under ./drizzle). The remaining tables land in step 4 ("Data model
 * migration #1"); their planned shape is documented below so the architecture is
 * legible before implementation.
 *
 * Planned tables (see docs/design.md §4):
 *
 *   accounts        — one per authenticated user (tier: free | paid)   ← step 3 ✅
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

import { pgTable, uuid, text } from "drizzle-orm/pg-core";

/**
 * One row per authenticated user. `id` mirrors `auth.users.id` (Supabase Auth
 * owns identity; this table owns app-level account data). The foreign key to
 * auth.users, the bootstrap trigger that inserts a row on sign-up, and the RLS
 * policy are all added in the accounts migration's raw SQL — drizzle-kit does
 * not manage the auth schema, so those live in the migration, not here.
 */
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey(),
  tier: text("tier").notNull().default("free"),
});
