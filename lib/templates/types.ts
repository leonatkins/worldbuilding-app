/**
 * Template snapshot types (step 13). A snapshot is the frozen, detached,
 * UUID-free copy of category/field **structure** (design §4.5). Structure only —
 * no subjects, facts, values, or UUIDs. Two kinds mirror the `template_kind`
 * enum: `schema` (one category's fields) and `world` (full category structure).
 *
 * This single TS type is shared by:
 * - the hardcoded built-in templates in `lib/templates/builtins.ts`, and
 * - the `templates.content` jsonb column (parsed via `parseSnapshot`).
 *
 * Portable references (A3): List/Link targets are stored by the target
 * category's *name* (schema templates) or `localKey` (world templates), never by
 * UUID — UUIDs are world-specific and useless elsewhere. On schema-template
 * apply, a missing named target auto-creates an empty stub category.
 */
import type { FieldType } from "@/lib/schema-fields";

/** A List/Link field's target, referenced portably (no UUID). */
export type SnapshotTarget = {
  /**
   * World templates only: the local key of a sibling category in the same
   * snapshot, resolved by mapping `localKey → newUUID` at apply time.
   */
  localKey?: string;
  /**
   * Schema templates only: the target category's *name*, resolved by lookup in
   * the destination world. Absent → auto-create an empty stub category (A3).
   */
  name?: string;
};

/** A single field in a snapshot. Only structure — never a value. */
export type SnapshotField = {
  name: string;
  type: FieldType;
  target?: SnapshotTarget;
  selectOptions?: string[] | null;
  scaleMin?: number | null;
  scaleMax?: number | null;
  unit?: string | null;
  inverseLabel?: string | null;
};

/** One category in a snapshot (its name/icon + ordered fields). */
export type SnapshotCategory = {
  /** World templates only: stable key fields use to reference this category. */
  localKey?: string;
  name: string;
  icon: string | null;
  fields: SnapshotField[];
};

/** A snapshot of a single category's fields (schema template). */
export type SchemaSnapshot = {
  kind: "schema";
  category: { name: string; icon: string | null };
  fields: SnapshotField[];
};

/** A snapshot of a whole world's category structure (world template). */
export type WorldSnapshot = {
  kind: "world";
  categories: SnapshotCategory[];
};

/** Union of the two snapshot shapes — what `templates.content` holds. */
export type Snapshot = SchemaSnapshot | WorldSnapshot;

/** The kind string, matching the `template_kind` pgEnum. */
export type TemplateKind = "schema" | "world";

/** A library entry — built-in or DB row — with everything the UI needs. */
export type TemplateListItem = {
  /** Stable id: `"builtin:<key>"` for built-ins, the DB uuid for private. */
  id: string;
  name: string;
  kind: TemplateKind;
  /** True for hardcoded built-ins (never editable; never deleted). */
  builtin: boolean;
  /** The snapshot; `undefined` when the list only needs metadata. */
  content?: Snapshot;
  createdAt?: string;
};

/**
 * Defensive caps (A9): sanity guards against runaway serialization. Surfaced in
 * the world-template preview if a snapshot exceeds them.
 */
export const MAX_TEMPLATE_CATEGORIES = 50;
export const MAX_FIELDS_PER_CATEGORY = 100;

/** Type guard: is this snapshot a world template? */
export function isWorldSnapshot(s: Snapshot): s is WorldSnapshot {
  return s.kind === "world";
}

/** Type guard: is this snapshot a schema template? */
export function isSchemaSnapshot(s: Snapshot): s is SchemaSnapshot {
  return s.kind === "schema";
}
