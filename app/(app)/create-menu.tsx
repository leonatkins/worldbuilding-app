"use client";

/**
 * Global "+" create menu in the app chrome (step 6). A non-covering popover whose
 * options adapt to the current world (read from the URL — ADR 0003). Always offers
 * New world; inside a world also New category. (New subject is added in step 7.)
 * It routes to the surface that owns the inline create form rather than
 * duplicating those forms.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function currentWorldId(pathname: string): string | null {
  const match = pathname.match(/^\/worlds\/([^/]+)/);
  return match ? match[1] : null;
}

export function CreateMenu() {
  const pathname = usePathname();
  const worldId = currentWorldId(pathname);
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
        className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-300 text-lg leading-none text-neutral-700 transition hover:-translate-y-px hover:border-neutral-400 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:border-neutral-500 dark:hover:bg-neutral-800"
      >
        +
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
        >
          <Link href="/" role="menuitem" onClick={() => setOpen(false)} className={item}>
            New world
          </Link>
          {worldId && (
            <Link
              href={`/worlds/${worldId}`}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={item}
            >
              New category
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
