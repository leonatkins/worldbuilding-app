/**
 * Search domain types + constants (step 12). Kept out of the `"use server"`
 * action module (`app/actions/search.ts`), which may only export async
 * functions — the query-length constant and result shapes live here so both the
 * server action and the client UI can import them.
 */

/** The minimum query length before the text search fires (below this: browse). */
export const MIN_QUERY_LENGTH = 2;

export type SearchResult = {
  id: string;
  name: string;
  categoryName: string | null;
  /** Why it matched: a fact snippet or `"<Field>: <value>"`. Absent for a name match. */
  snippet?: string;
};

export type SearchOutcome = {
  results: SearchResult[];
  /** Total matches before the `limit` cap — drives the "showing N of M" note. */
  total: number;
};

export type SearchArgs = {
  query: string;
  categoryIds: string[];
  tagIds: string[];
  limit?: number;
};
