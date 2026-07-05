/**
 * Drizzle schema — the single source of truth for the database structure.
 *
 * STATUS: step 4 (Data model migration #1). Defines the core worldbuilding
 * tables on top of `accounts` (step 3). See docs/step-4-data-model-spec.md for
 * the full rationale behind every column, cascade, and constraint.
 *
 * What Drizzle manages here: tables, enums, inter-table FKs + cascades, unique
 * constraints, and the `gen_random_uuid()` / `now()` / `auth.uid()` defaults.
 *
 * What Drizzle does NOT manage (hand-appended to the generated migration SQL,
 * same pattern as 0000_accounts.sql): Row-Level Security — `ENABLE ROW LEVEL
 * SECURITY` + the per-table own-rows policy. Those live in the migration file,
 * not here.
 *
 * Cross-cutting conventions (spec §2):
 * - Every table carries a denormalized `account_id` (DEFAULT auth.uid(), FK to
 *   accounts ON DELETE CASCADE) so each RLS policy is a flat one-liner with no
 *   join up the ownership tree (design §5). Postgres stamps the owner on insert;
 *   app code never sets it.
 * - `created_at` on all tables; app-managed `updated_at` on editable ones.
 * - Ordering via `position double precision` (midpoint insertion).
 *
 * Deferred to their feature step: tags + subject_tags (step 7). Templates
 * arrived in step 13; `onboarding_seen_at` on accounts in step 14;
 * `subject_views` (view history) in step 15a.
 *
 * AI hook point: none here — AI features (PRD §7) are not built in this phase.
 */

import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  doublePrecision,
  unique,
  primaryKey,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/* Enums (spec §2.4)                                                          */
/* -------------------------------------------------------------------------- */

/** The kind of a schema field — the only legal values for `schema_fields.type`. */
export const fieldType = pgEnum("field_type", [
  "List",
  "Link",
  "Text",
  "Number",
  "Boolean",
  "Select",
  "MultiSelect",
  "Date",
  "Scale",
  "Color",
]);

/** Where a relationship/backlink came from — a fact mention or a List/Link field. */
export const relationshipOrigin = pgEnum("relationship_origin", ["fact", "field"]);

/** Template kind — one category's fields, or a full world's category structure. */
export const templateKind = pgEnum("template_kind", ["schema", "world"]);

/* -------------------------------------------------------------------------- */
/* Shared column builders (spec §2.1–2.2)                                     */
/* -------------------------------------------------------------------------- */

/**
 * Denormalized owner column present on every table. Postgres auto-stamps it from
 * the logged-in session (`auth.uid()`); the RLS policy added in the migration
 * pins each row to its owner. ON DELETE CASCADE: deleting the account removes
 * everything they own.
 */
const accountId = () =>
  uuid("account_id")
    .notNull()
    .default(sql`auth.uid()`)
    .references(() => accounts.id, { onDelete: "cascade" });

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/** App-managed: server actions set this on update; there is no DB trigger. */
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/** Fractional ordering key — midpoint insertion, rebalance if exhausted. */
const position = () => doublePrecision("position").notNull();

/**
 * Soft-delete marker (ADR 0005). NULL = live; non-NULL = in "Recently Deleted"
 * since that time. A `pg_cron` job hard-deletes rows older than 30 days. Present
 * on worlds, categories, subjects, and facts. Every read must filter `deleted_at IS NULL`
 * (door 1 / app code) — RLS is ownership-only and the trash view must still read
 * deleted rows. See lib/db/soft-delete.ts.
 */
const deletedAt = () => timestamp("deleted_at", { withTimezone: true });

/* -------------------------------------------------------------------------- */
/* Accounts (step 3) — identity mirror; FK to auth.users, bootstrap trigger,  */
/* and RLS all live in the accounts migration's raw SQL, not here.            */
/* -------------------------------------------------------------------------- */

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey(),
  tier: text("tier").notNull().default("free"),
  // Step 14 onboarding: NULL = never opened the guide → auto-open on first
  // login. Stamped on first dismiss (per-account, so a new device for the same
  // user is not re-onboarded). RLS is already owner-readable; no policy change.
  onboardingSeenAt: timestamp("onboarding_seen_at", { withTimezone: true }),
});

/* -------------------------------------------------------------------------- */
/* Ownership spine                                                            */
/* -------------------------------------------------------------------------- */

/** Account-owned top-level container. A "world" is a setting, not a planet. */
export const worlds = pgTable("worlds", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: accountId(),
  name: text("name").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: deletedAt(),
});

/** A group of subjects within a world (e.g. Characters, Locations). */
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: accountId(),
  worldId: uuid("world_id")
    .notNull()
    .references(() => worlds.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  icon: text("icon"),
  position: position(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: deletedAt(),
});

/**
 * A typed field definition owned by a category. Type-specific config lives in
 * typed nullable columns (not JSONB) so Postgres enforces the List/Link →
 * category FK. `target_category_id` is RESTRICT: a category cannot be deleted
 * while another category's List/Link field still points at it (forced cleanup).
 */
export const schemaFields = pgTable("schema_fields", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: accountId(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: fieldType("type").notNull(),
  position: position(),
  targetCategoryId: uuid("target_category_id").references(() => categories.id, {
    onDelete: "restrict",
  }),
  selectOptions: text("select_options").array(),
  scaleMin: integer("scale_min"),
  scaleMax: integer("scale_max"),
  unit: text("unit"),
  // Optional role name shown on the *target* side's backlink (step 10). Only
  // meaningful for List/Link; falls back to `name` when unset.
  inverseLabel: text("inverse_label"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** A thing in the world (a character, place, item…), belonging to one category. */
export const subjects = pgTable("subjects", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: accountId(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  // Denormalized from category for world-scoped queries / simpler RLS.
  worldId: uuid("world_id")
    .notNull()
    .references(() => worlds.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  // Soft delete (ADR 0005), formerly archived_at.
  deletedAt: deletedAt(),
});

/**
 * An ordered piece of prose about a subject. Stored as plain text with inline
 * `@{id}` mention markers; the referenced name is never stored (ADR 0001).
 */
export const facts = pgTable("facts", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: accountId(),
  subjectId: uuid("subject_id")
    .notNull()
    .references(() => subjects.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  position: position(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: deletedAt(),
});

/**
 * A subject's value for one schema field. Hybrid storage: `scalar_value` (jsonb)
 * for scalar field types, `linked_subject_id` for a single Link. List values are
 * stored in `list_value_subjects`. `linked_subject_id` is SET NULL so deleting
 * the linked subject clears the link rather than orphaning the row.
 */
export const fieldValues = pgTable(
  "field_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: accountId(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    fieldId: uuid("field_id")
      .notNull()
      .references(() => schemaFields.id, { onDelete: "cascade" }),
    scalarValue: jsonb("scalar_value"),
    linkedSubjectId: uuid("linked_subject_id").references(() => subjects.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique().on(t.subjectId, t.fieldId)],
);

/**
 * Join table: which subjects are members of a List field's value. Composite
 * primary key (no surrogate id). CASCADE on both sides — removing a subject
 * drops it from every list it was in.
 */
export const listValueSubjects = pgTable(
  "list_value_subjects",
  {
    fieldValueId: uuid("field_value_id")
      .notNull()
      .references(() => fieldValues.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    accountId: accountId(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.fieldValueId, t.subjectId] })],
);

/**
 * A directed backlink from one subject to another, derived from either a fact
 * mention or a List/Link field. `fact_id` / `field_id` record the origin; both
 * cascade so the backlink disappears when its source does.
 */
export const relationships = pgTable(
  "relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: accountId(),
    fromSubjectId: uuid("from_subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    toSubjectId: uuid("to_subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    origin: relationshipOrigin("origin").notNull(),
    factId: uuid("fact_id").references(() => facts.id, { onDelete: "cascade" }),
    fieldId: uuid("field_id").references(() => schemaFields.id, {
      onDelete: "cascade",
    }),
    createdAt: createdAt(),
  },
  (t) => [
    unique().on(t.fromSubjectId, t.toSubjectId, t.origin, t.factId, t.fieldId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Tags (step 7)                                                              */
/* -------------------------------------------------------------------------- */

/**
 * A world-scoped, renameable label applied to subjects (PRD §5). Normalized (not
 * a text[] on subjects) so a rename updates everywhere in one write. Names are
 * unique per world, case-insensitively — enforced by a `lower(name)` unique index
 * hand-added in the migration (drizzle can't express the expression index here),
 * unlike the duplicate-allowing names elsewhere. Stored bare; the `#` is render-only.
 */
export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: accountId(),
  worldId: uuid("world_id")
    .notNull()
    .references(() => worlds.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

/** Join table: which tags a subject holds. Composite PK, both sides CASCADE. */
export const subjectTags = pgTable(
  "subject_tags",
  {
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    accountId: accountId(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.subjectId, t.tagId] })],
);

/* -------------------------------------------------------------------------- */
/* Templates (step 13)                                                        */
/* -------------------------------------------------------------------------- */

/**
 * A user-authored private template (step 13). Built-in official templates are
 * hardcoded TS constants (lib/templates/builtins.ts) and never live here — so
 * there is no `is_official` flag. `content` is the frozen snapshot (design
 * §4.5): category/field structure only, UUID-free, portable across worlds. Two
 * kinds: a `schema` template (one category's fields) or a `world` template
 * (full category structure, no subjects/facts/values). Names are NOT unique
 * per owner (unlike tags) — the library disambiguates by kind/created_at.
 */
export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: accountId(),
  name: text("name").notNull(),
  kind: templateKind("kind").notNull(),
  content: jsonb("content").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* -------------------------------------------------------------------------- */
/* View history (step 15a)                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Which subjects an account has recently opened — powers "Recently viewed" on
 * Home and each world's Overview (ADR 0012). A *collapsed* record: one row per
 * (account, subject), `last_viewed_at` upserted on each open — not an append-only
 * event log, since we only ever want the most-recent open per subject. The
 * composite PK is the upsert conflict target. Both FKs cascade, so the 30-day
 * hard purge (ADR 0005) auto-removes rows for purged subjects; soft-deleted
 * subjects are filtered out on read (`activeOnly`), never surfaced here.
 */
export const subjectViews = pgTable(
  "subject_views",
  {
    accountId: accountId(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.subjectId] })],
);
