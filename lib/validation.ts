/**
 * Shared name validation for user-facing labels (worlds, categories, fields,
 * subjects, tags). Names are display labels, not keys — duplicates are allowed
 * everywhere except tags (which enforce per-world case-insensitive uniqueness at
 * the DB layer). Kept free of framework imports so it is trivially unit-testable.
 */

/** Max length for any user-entered name. */
export const MAX_NAME_LENGTH = 100;

export type NameValidation = { name: string } | { error: string };

/**
 * Trim surrounding whitespace, then reject empty or over-long names. No
 * uniqueness check (see module comment).
 */
export function validateName(raw: string): NameValidation {
  const name = raw.trim();
  if (name.length === 0) return { error: "Name is required." };
  if (name.length > MAX_NAME_LENGTH) {
    return { error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` };
  }
  return { name };
}
