/**
 * Tag-domain helpers. Tags are stored bare (no leading `#`, which is render-only)
 * and are unique per world case-insensitively (DB-enforced). Pure / framework-free
 * for testing.
 */
import { MAX_NAME_LENGTH } from "@/lib/validation";

export type TagValidation = { name: string } | { error: string };

/** Collapse whitespace, trim, then strip a leading `#` (and trim again). */
export function normalizeTagName(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^#+/, "")
    .trim();
}

/** Validate a tag name (after normalization). */
export function validateTagName(raw: string): TagValidation {
  const name = normalizeTagName(raw);
  if (name.length === 0) return { error: "Tag can’t be empty." };
  if (name.length > MAX_NAME_LENGTH) {
    return { error: `Tag must be ${MAX_NAME_LENGTH} characters or fewer.` };
  }
  return { name };
}

/** Two tag names collide if they match case-insensitively (matches the DB index). */
export function sameTag(a: string, b: string): boolean {
  return normalizeTagName(a).toLowerCase() === normalizeTagName(b).toLowerCase();
}
