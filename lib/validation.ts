/**
 * Shared name validation for user-facing labels (worlds, categories, fields,
 * subjects, tags). Names are display labels, not keys — duplicates are allowed
 * everywhere except tags (which enforce per-world case-insensitive uniqueness at
 * the DB layer). Kept free of framework imports so it is trivially unit-testable.
 */

/** Max length for any user-entered name. */
export const MAX_NAME_LENGTH = 100;

/**
 * Max length for a fact body. A fact is "a short note of one or two sentences"
 * (CONTEXT.md / design §4.1) — never a prose paragraph. Bounded generously
 * enough for two long sentences while discouraging essays.
 */
export const MAX_FACT_LENGTH = 1000;

export type NameValidation = { name: string } | { error: string };

export type FactValidation = { body: string } | { error: string };

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

/** Trim a fact body, then reject empty or over-long text. */
export function validateFactBody(raw: string): FactValidation {
  const body = raw.trim();
  if (body.length === 0) return { error: "A fact can't be empty." };
  if (body.length > MAX_FACT_LENGTH) {
    return { error: `A fact must be ${MAX_FACT_LENGTH} characters or fewer.` };
  }
  return { body };
}
