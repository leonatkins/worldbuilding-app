"use client";

/**
 * In-world quick switcher (step 5). A small popover in the app chrome that lets
 * the user jump between worlds without returning to the list. Hidden on surfaces
 * that aren't inside a world (e.g. the worlds list at `/`), where it'd be
 * redundant. The "current world" is read from the URL (ADR 0003), never stored.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type SwitcherWorld = { id: string; name: string };

/** Pull the world id out of a `/worlds/<id>` pathname, or null if not in a world. */
function currentWorldId(pathname: string): string | null {
  const match = pathname.match(/^\/worlds\/([^/]+)/);
  return match ? match[1] : null;
}

export function WorldSwitcher({ worlds }: { worlds: SwitcherWorld[] }) {
  const pathname = usePathname();
  const activeId = currentWorldId(pathname);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside-click or Escape.
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

  // Only meaningful inside a world.
  if (!activeId) return null;

  const active = worlds.find((w) => w.id === activeId);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex max-w-[12rem] items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
      >
        <span className="truncate">{active?.name ?? "World"}</span>
        <span aria-hidden className="text-xs text-neutral-400">
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 z-20 mt-1 w-60 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
        >
          <ul className="max-h-72 overflow-y-auto">
            {worlds.map((world) => (
              <li key={world.id}>
                <Link
                  href={`/worlds/${world.id}`}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={`flex items-center justify-between gap-2 px-3 py-2 text-sm transition hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                    world.id === activeId
                      ? "font-medium text-neutral-900 dark:text-neutral-100"
                      : "text-neutral-600 dark:text-neutral-400"
                  }`}
                >
                  <span className="truncate">{world.name}</span>
                  {world.id === activeId && (
                    <span aria-hidden className="text-xs text-neutral-400">
                      ✓
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          <div className="my-1 h-px bg-neutral-200 dark:bg-neutral-800" />
          <Link
            href="/"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            Open all worlds
          </Link>
        </div>
      )}
    </div>
  );
}
