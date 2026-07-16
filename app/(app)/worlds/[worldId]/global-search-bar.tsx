"use client";

/**
 * The Spyglass (steps 12, 15b, 16a) — the world's search-and-jump instrument and
 * the app's one recurring "instrument". A debounced typeahead that previews the
 * top matches inline (same debounce/server-round-trip idiom as the @mention
 * search, since the search space is a whole world), with a "See all results"
 * item and Enter both routing to /browse for filters. Below the 2-char minimum
 * it stays quiet — a single letter matches almost everything.
 *
 * Deliberately NOT a ⌘K command palette (ADR 0014).
 *
 * Motion: the dropdown does not animate, on purpose. This is the core loop —
 * seen 100s of times a day — and at that frequency animation reads as latency
 * (cf. Raycast, which has no open/close animation for the same reason).
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchWorldPreview } from "@/app/actions/search";
import { MIN_QUERY_LENGTH, type SearchResult } from "@/lib/search";

const DEBOUNCE_MS = 300;

export function GlobalSearchBar({ worldId }: { worldId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  // Debounced preview fetch. `seq` guards against out-of-order responses; the
  // below-minimum clear also runs in the timeout (not the effect body) so no
  // setState fires synchronously during render.
  useEffect(() => {
    const q = query.trim();
    const id = ++seq.current;
    const t = setTimeout(async () => {
      if (q.length < MIN_QUERY_LENGTH) {
        if (id === seq.current) {
          setResults([]);
          setTotal(0);
        }
        return;
      }
      const outcome = await searchWorldPreview(worldId, q);
      if (id !== seq.current) return; // a newer keystroke already fired
      setResults(outcome.results);
      setTotal(outcome.total);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, worldId]);

  // Close the dropdown on an outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function goToBrowse() {
    const q = query.trim();
    setOpen(false);
    router.push(`/worlds/${worldId}/browse${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      goToBrowse();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showDropdown = open && query.trim().length >= MIN_QUERY_LENGTH;

  return (
    <div ref={containerRef} className="relative">
      <SpyglassGlyph />
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Spot a subject, a fact, a field…"
        aria-label="Search this world"
        className="w-full border border-rule bg-surface-raised py-1.5 pl-9 pr-3 text-sm shadow-stamp outline-none transition-colors duration-150 ease-[var(--ease-out)] placeholder:text-ink-faint placeholder:italic focus:border-accent"
      />

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden border border-rule bg-surface-raised shadow-stamp-lg">
          {results.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-system">No matches.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-rule overflow-y-auto">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setOpen(false);
                      router.push(`/worlds/${worldId}/subjects/${r.id}`);
                    }}
                    className="block w-full px-3 py-2 text-left transition-colors duration-150 ease-[var(--ease-out)] hover:bg-accent-soft"
                  >
                    <span className="flex items-baseline gap-2">
                      <span className="truncate text-sm font-medium text-ink">{r.name}</span>
                      {r.categoryName && (
                        <span className="shrink-0 text-xs text-ink-muted">{r.categoryName}</span>
                      )}
                    </span>
                    {r.snippet && (
                      <span className="mt-0.5 block truncate text-xs text-ink-muted">
                        {r.snippet}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={goToBrowse}
            className="block w-full border-t border-rule px-3 py-2 text-left text-sm font-medium text-ink-muted transition-colors duration-150 ease-[var(--ease-out)] hover:bg-accent-soft hover:text-ink"
          >
            See all {total} {total === 1 ? "result" : "results"} →
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * A spyglass — a tapered tube with an eyepiece ring, not a magnifying loupe. The
 * loupe is the universal "generic search box" signifier, which is precisely the
 * SaaS register ADR 0014 rejects; this names the instrument instead.
 */
function SpyglassGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden="true"
      className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
    >
      {/* tube, tapering from eyepiece (lower-left) to objective (upper-right) */}
      <path d="M4.6 17.6 L15.9 4.9 L19.2 8.2 L6.6 19.5 Z" />
      {/* eyepiece ring */}
      <line x1="8.4" y1="12.6" x2="11.6" y2="15.8" />
    </svg>
  );
}
