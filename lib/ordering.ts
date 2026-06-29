/**
 * Fractional ordering (design §4.1). Items carry a `position double precision`;
 * to move one between two neighbors we store the midpoint of their positions, so
 * a reorder is a single-row update with no mass renumber. Floats give effectively
 * unlimited halving room; rebalance only if precision is ever exhausted (not
 * expected at realistic counts). Used by categories, schema fields, and facts.
 */

/**
 * Position for an item dropped between `before` and `after` (either null at the
 * ends). Empty list → 1; at the start → after-1; at the end → before+1; between →
 * the average.
 */
export function midpointPosition(
  before: number | null,
  after: number | null,
): number {
  if (before === null && after === null) return 1;
  if (before === null) return (after as number) - 1;
  if (after === null) return (before as number) + 1;
  return (before + after) / 2;
}
