"use client";

/**
 * Global "+" create menu in the app chrome (step 6; polished step 16). A
 * non-covering popover whose options adapt to the current world (read from the URL
 * — ADR 0003): New world always; inside a world also New subject + New category.
 * A smart router — rather than duplicating the create forms, each item navigates
 * to the surface that owns the inline form and appends `?create=<kind>` so that
 * surface focuses its input on arrival (New world → Home's name field, fixing the
 * former no-op link).
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function currentWorldId(pathname: string): string | null {
  const match = pathname.match(/^\/worlds\/([^/]+)/);
  return match ? match[1] : null;
}

function currentCategoryId(pathname: string): string | null {
  const match = pathname.match(/^\/worlds\/[^/]+\/categories\/([^/]+)/);
  return match ? match[1] : null;
}

export function CreateMenu() {
  const pathname = usePathname();
  const worldId = currentWorldId(pathname);
  const categoryId = currentCategoryId(pathname);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item =
    "block rounded-md px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Create"
        className="flex h-9 w-9 items-center justify-center rounded-md bg-neutral-900 text-xl leading-none text-white shadow-sm transition hover:-translate-y-px hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
      >
        +
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
        >
          {worldId && (
            <Link
              href={
                categoryId
                  ? `/worlds/${worldId}/categories/${categoryId}?create=subject`
                  : `/worlds/${worldId}`
              }
              role="menuitem"
              onClick={() => setOpen(false)}
              className={item}
            >
              New subject
            </Link>
          )}
          {worldId && (
            <Link
              href={`/worlds/${worldId}?create=category`}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={item}
            >
              New category
            </Link>
          )}
          <Link
            href="/?create=world"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={item}
          >
            New world
          </Link>
        </div>
      )}
    </div>
  );
}
