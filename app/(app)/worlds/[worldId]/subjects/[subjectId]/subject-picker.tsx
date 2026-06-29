"use client";

/**
 * Searchable subject picker for Link (single) and List (multi) field values
 * (step 7). Resolves the design §9 "picker at scale" item: a type-to-filter
 * typeahead over the target category (server action searchSubjects, limit 20),
 * rather than a giant dropdown. The results popover may scroll and slightly
 * overlap nearby content — it never becomes a big covering overlay.
 */
import { useRef, useState, useTransition } from "react";
import { searchSubjects } from "@/app/actions/subjects";

type Ref = { id: string; name: string };

export function SubjectPicker({
  targetCategoryId,
  excludeId,
  multiple,
  selected,
  onChangeSingle,
  onChangeMulti,
}: {
  targetCategoryId: string;
  excludeId: string;
  multiple: boolean;
  selected: Ref[];
  onChangeSingle?: (s: Ref | null) => void;
  onChangeMulti?: (s: Ref[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Ref[]>([]);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);

  function search(q: string) {
    setQuery(q);
    setOpen(true);
    startTransition(async () => {
      const found = await searchSubjects(targetCategoryId, q, excludeId);
      setResults(found.filter((r) => !selected.some((s) => s.id === r.id)));
    });
  }

  function pick(s: Ref) {
    if (multiple) {
      onChangeMulti?.([...selected, s]);
      setQuery("");
      setResults([]);
    } else {
      onChangeSingle?.(s);
      setQuery("");
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {selected.map((s) => (
          <span
            key={s.id}
            className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
          >
            {s.name}
            <button
              type="button"
              aria-label={`Remove ${s.name}`}
              onClick={() =>
                multiple
                  ? onChangeMulti?.(selected.filter((x) => x.id !== s.id))
                  : onChangeSingle?.(null)
              }
              className="text-neutral-400 transition hover:text-red-600 dark:hover:text-red-400"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {(multiple || selected.length === 0) && (
        <div className="relative">
          <input
            type="text"
            value={query}
            onFocus={() => search(query)}
            onChange={(e) => search(e.target.value)}
            placeholder="Search subjects…"
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-100"
          />
          {open && results.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => pick(r)}
                    className="block w-full px-3 py-1.5 text-left text-sm text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                  >
                    {r.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {open && query.trim() && results.length === 0 && (
            <p className="absolute z-20 mt-1 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-400 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
              No matches.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
