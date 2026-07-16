/**
 * A labeled block of recent subjects for Home / world Overview (step 15a).
 * Presentational (server) — the caller supplies already-filtered, live-only rows.
 * Renders nothing when empty so the block simply disappears for new accounts.
 */
import Link from "next/link";

export type RecentSubject = {
  id: string;
  worldId: string;
  name: string;
  categoryName: string | null;
  /** Shown as context on Home (cross-world); omit inside a single world. */
  worldName?: string | null;
};

export function RecentSubjects({
  heading,
  subjects,
}: {
  heading: string;
  subjects: RecentSubject[];
}) {
  if (subjects.length === 0) return null;

  return (
    <section className="space-y-2 border border-rule bg-surface-raised p-4">
      <h2 className="label-structural font-medium">{heading}</h2>
      <ul className="flex flex-col gap-1">
        {subjects.map((s) => (
          <li key={`${s.worldId}:${s.id}`}>
            <Link
              href={`/worlds/${s.worldId}/subjects/${s.id}`}
              className="flex items-baseline justify-between gap-3 px-2 py-1.5 transition-colors duration-150 ease-[var(--ease-out)] hover:bg-accent-soft"
            >
              <span className="truncate font-medium">{s.name}</span>
              <span className="shrink-0 text-xs text-ink-muted">
                {[s.worldName, s.categoryName].filter(Boolean).join(" · ")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
