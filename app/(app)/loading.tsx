/**
 * Route-level loading skeleton for authenticated surfaces (ADR-adjacent polish):
 * shown instantly during navigation so there's no spinner and no white/theme
 * flash — the page's shape appears, then fills in. A skeleton isn't an overlay
 * (it IS the page's loading state), so it respects the no-cover/no-block rule.
 */
export default function Loading() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      <div className="space-y-2">
        <div className="h-4 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-8 w-2/3 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-4 w-full animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
      </div>
      <div className="h-10 w-full animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-900" />
      <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="h-4 w-4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
            <div className="h-4 flex-1 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          </li>
        ))}
      </ul>
    </main>
  );
}
