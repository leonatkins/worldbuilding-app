/**
 * Soft-delete query helpers (ADR 0005). Every door-1 (Supabase client) read must
 * scope to live rows or, for the "Recently Deleted" views, to deleted rows. RLS
 * is ownership-only and cannot do this — and the trash views must still read
 * deleted rows — so the filter lives in app code. Centralizing it here keeps the
 * `deleted_at` predicate consistent and greppable instead of scattered as raw
 * `.is("deleted_at", null)` calls that are easy to forget on a new query.
 *
 * Usage:
 *   const { data } = await activeOnly(supabase.from("worlds").select("..."));
 *   const { data } = await deletedOnly(supabase.from("worlds").select("..."));
 */

/** The slice of the PostgREST filter builder we need: `.is` / `.not`, chainable. */
type SoftDeleteFilterable<T> = {
  is(column: string, value: null): T;
  not(column: string, operator: "is", value: null): T;
};

/** Restrict a query to live rows (`deleted_at IS NULL`). The default everywhere. */
export function activeOnly<T extends SoftDeleteFilterable<T>>(query: T): T {
  return query.is("deleted_at", null);
}

/** Restrict a query to soft-deleted rows — only the "Recently Deleted" views. */
export function deletedOnly<T extends SoftDeleteFilterable<T>>(query: T): T {
  return query.not("deleted_at", "is", null);
}
