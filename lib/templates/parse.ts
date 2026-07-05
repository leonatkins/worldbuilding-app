/**
 * Pure snapshot parsing + validation (step 13). Framework-free so the server
 * actions and unit tests share one parser. Validates the snapshot against the
 * defensive caps (A9) and the legal field types.
 */
import { isFieldType, type FieldType } from "@/lib/schema-fields";
import {
  isSchemaSnapshot,
  isWorldSnapshot,
  MAX_FIELDS_PER_CATEGORY,
  MAX_TEMPLATE_CATEGORIES,
  type SchemaSnapshot,
  type Snapshot,
  type SnapshotField,
  type WorldSnapshot,
} from "./types";

export type ParseResult<T> = { value: T } | { error: string };

/** Parse + validate an untyped blob (from `templates.content` jsonb) into a Snapshot. */
export function parseSnapshot(raw: unknown): ParseResult<Snapshot> {
  if (!raw || typeof raw !== "object") return { error: "Invalid snapshot." };
  const s = raw as { kind?: unknown };
  if (s.kind === "schema") return parseSchema(raw);
  if (s.kind === "world") return parseWorld(raw);
  return { error: "Unknown snapshot kind." };
}

function parseField(f: unknown, idx: number): ParseResult<SnapshotField> {
  if (!f || typeof f !== "object") return { error: `Field ${idx} is invalid.` };
  const r = f as Record<string, unknown>;
  if (typeof r.name !== "string" || r.name.trim() === "")
    return { error: `Field ${idx + 1} needs a name.` };
  if (typeof r.type !== "string" || !isFieldType(r.type))
    return { error: `Field "${r.name}" has an unknown type.` };
  const type = r.type as FieldType;
  const field: SnapshotField = { name: r.name, type };
  if (r.selectOptions !== null && r.selectOptions !== undefined) {
    if (!Array.isArray(r.selectOptions) || !r.selectOptions.every((o) => typeof o === "string"))
      return { error: `Field "${r.name}" has bad options.` };
    field.selectOptions = r.selectOptions as string[];
  }
  if (r.scaleMin !== null && r.scaleMin !== undefined) {
    if (typeof r.scaleMin !== "number") return { error: `Field "${r.name}" has a bad scale min.` };
    field.scaleMin = r.scaleMin;
  }
  if (r.scaleMax !== null && r.scaleMax !== undefined) {
    if (typeof r.scaleMax !== "number") return { error: `Field "${r.name}" has a bad scale max.` };
    field.scaleMax = r.scaleMax;
  }
  if (typeof r.unit === "string") field.unit = r.unit;
  else if (r.unit === null) field.unit = null;
  if (typeof r.inverseLabel === "string") field.inverseLabel = r.inverseLabel;
  else if (r.inverseLabel === null) field.inverseLabel = null;
  if (r.target !== null && r.target !== undefined) {
    if (typeof r.target !== "object")
      return { error: `Field "${r.name}" has a bad target.` };
    const t = r.target as { name?: unknown; localKey?: unknown };
    if (typeof t.name === "string") field.target = { name: t.name };
    else if (typeof t.localKey === "string") field.target = { localKey: t.localKey };
  }
  return { value: field };
}

function parseFields(raw: unknown, max: number): ParseResult<SnapshotField[]> {
  if (!Array.isArray(raw)) return { error: "Fields must be a list." };
  if (raw.length > max) return { error: `A category can have at most ${max} fields.` };
  const out: SnapshotField[] = [];
  for (let i = 0; i < raw.length; i++) {
    const r = parseField(raw[i], i);
    if ("error" in r) return r;
    out.push(r.value);
  }
  return { value: out };
}

function parseSchema(raw: unknown): ParseResult<SchemaSnapshot> {
  const r = raw as { category?: unknown; fields?: unknown };
  if (!r.category || typeof r.category !== "object")
    return { error: "Schema snapshot needs a category." };
  const c = r.category as { name?: unknown; icon?: unknown };
  if (typeof c.name !== "string" || c.name.trim() === "")
    return { error: "Schema snapshot needs a category name." };
  const fields = parseFields(r.fields, MAX_FIELDS_PER_CATEGORY);
  if ("error" in fields) return fields;
  return {
    value: {
      kind: "schema",
      category: { name: c.name, icon: typeof c.icon === "string" ? c.icon : null },
      fields: fields.value,
    },
  };
}

function parseWorld(raw: unknown): ParseResult<WorldSnapshot> {
  const r = raw as { categories?: unknown };
  if (!Array.isArray(r.categories)) return { error: "World snapshot needs categories." };
  if (r.categories.length > MAX_TEMPLATE_CATEGORIES)
    return { error: `A world template can have at most ${MAX_TEMPLATE_CATEGORIES} categories.` };
  const cats: WorldSnapshot["categories"] = [];
  for (let i = 0; i < r.categories.length; i++) {
    const c = r.categories[i] as Record<string, unknown> | null;
    if (!c || typeof c !== "object") return { error: `Category ${i + 1} is invalid.` };
    if (typeof c.name !== "string" || c.name.trim() === "")
      return { error: `Category ${i + 1} needs a name.` };
    const fields = parseFields(c.fields, MAX_FIELDS_PER_CATEGORY);
    if ("error" in fields) return fields;
    cats.push({
      localKey: typeof c.localKey === "string" ? c.localKey : undefined,
      name: c.name,
      icon: typeof c.icon === "string" ? c.icon : null,
      fields: fields.value,
    });
  }
  return { value: { kind: "world", categories: cats } };
}

/** Narrow helper used by server actions that already know the kind. */
export function asSchema(s: Snapshot): SchemaSnapshot {
  if (!isSchemaSnapshot(s)) throw new Error("Expected schema snapshot");
  return s;
}
export function asWorld(s: Snapshot): WorldSnapshot {
  if (!isWorldSnapshot(s)) throw new Error("Expected world snapshot");
  return s;
}
