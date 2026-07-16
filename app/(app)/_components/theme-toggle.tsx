"use client";

/**
 * Theme control (step 16a) — System / Light / Dark.
 *
 * The stored *preference* is tri-state; the `data-theme` attribute is always a
 * resolved `light | dark`, so CSS needs no media-query branch (see the pre-paint
 * script in `app/layout.tsx`, which must agree with `resolve()` below).
 *
 * Follows the codebase's existing cross-tab pattern (useSyncExternalStore +
 * localStorage + a custom event), same as the Browse sort toggle, and the
 * WorldSwitcher's popover shape.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

type Pref = "system" | "light" | "dark";

const THEME_KEY = "theme";
const THEME_EVENT = "theme-change";
const PREFS: Pref[] = ["system", "light", "dark"];

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onChange); // other tabs
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): Pref {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

/** Server + first client render agree on the default, avoiding a hydration mismatch. */
function getServerSnapshot(): Pref {
  return "system";
}

function resolve(pref: Pref): "light" | "dark" {
  if (pref !== "system") return pref;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyPref(pref: Pref) {
  document.documentElement.setAttribute("data-theme", resolve(pref));
}

/** A sun, a crescent, and a half-lit disc. Circles are legal here: the zero-radius
 *  rule governs chrome, not glyphs depicting round objects (grill Q6). */
function ThemeGlyph({ pref }: { pref: Pref }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-4 w-4"
      aria-hidden="true"
    >
      {pref === "light" && (
        <>
          <circle cx="12" cy="12" r="4.5" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <line
              key={deg}
              x1="12"
              y1="3.5"
              x2="12"
              y2="6"
              transform={`rotate(${deg} 12 12)`}
              strokeLinecap="round"
            />
          ))}
        </>
      )}
      {pref === "dark" && <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z" />}
      {pref === "system" && (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  );
}

export function ThemeToggle() {
  const pref = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const setPref = useCallback((next: Pref) => {
    const commit = () => {
      localStorage.setItem(THEME_KEY, next);
      applyPref(next);
      window.dispatchEvent(new Event(THEME_EVENT));
    };
    setOpen(false);

    // Cross-fade the whole document as one composited image. Gated in JS rather
    // than CSS because ::view-transition-* pseudo-elements live outside the `*`
    // selector the reduced-motion block uses, so they'd animate regardless.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !document.startViewTransition) {
      commit();
      return;
    }
    document.startViewTransition(commit);
  }, []);

  // Follow the OS live while the preference is "system" — otherwise the choice
  // is only honoured on reload.
  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyPref("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  // Re-apply when another tab changes the stored preference.
  useEffect(() => {
    applyPref(pref);
  }, [pref]);

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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Theme: ${pref}`}
        title={`Theme: ${pref}`}
        className="flex items-center px-2 py-1 text-ink-muted transition-[color,background-color,transform] duration-150 ease-[var(--ease-out)] hover:bg-surface-raised hover:text-ink active:scale-[0.97]"
      >
        <ThemeGlyph pref={pref} />
      </button>

      {open && (
        <div
          role="menu"
          // Origin-aware: scales from the trigger, not from centre.
          className="absolute right-0 z-20 mt-1 w-32 origin-top-right border border-rule bg-surface-raised py-1 shadow-stamp"
        >
          {PREFS.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={pref === option}
              onClick={() => setPref(option)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm capitalize transition-colors duration-150 ease-[var(--ease-out)] hover:bg-accent-soft ${
                pref === option ? "text-ink" : "text-ink-muted"
              }`}
            >
              <ThemeGlyph pref={option} />
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
