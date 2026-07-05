"use client";

/**
 * Onboarding guide panel (step 14, B1). A right-side slide-in Sheet cloned
 * from the WorldSwitcher popover pattern (outside-click + Escape dismiss).
 * Content is hardcoded MDX-ish TSX (mirrors built-in templates: git-versioned,
 * no DB table). Conceptual copy only (B5) — what things ARE, never where a
 * specific button sits (locational copy deferred to the polish pass). The only
 * locational line is re-access from the `?` icon, fixed by B1.
 *
 * `autoOpen` (from the server: `onboarding_seen_at IS NULL`) opens the panel on
 * first login; the first dismiss stamps `onboarding_seen_at` (B4) and never
 * re-opens automatically. The icon toggles re-access afterward.
 */
import { useEffect, useState } from "react";
import { markOnboardingSeen } from "@/app/actions/onboarding";

export function GuidePanel({ autoOpen }: { autoOpen: boolean }) {
  const [open, setOpen] = useState(autoOpen);
  // Track whether we're still in the auto-open session (haven't dismissed once).
  const [firstSession, setFirstSession] = useState(autoOpen);
  const [closing, setClosing] = useState(false);

  // Escape closes; outside-click closes (the backdrop). Mirrors the
  // WorldSwitcher popover dismissal pattern.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function dismiss() {
    if (closing) return;
    setClosing(true);
    // Stamp only on the first-session dismiss (B4). Re-open-from-icon dismiss
    // leaves the flag alone (already seen).
    if (firstSession) {
      setFirstSession(false);
      void markOnboardingSeen();
    }
    // Brief slide-out animation, then unmount.
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 150);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Open guide"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-300 text-lg leading-none text-neutral-700 transition hover:-translate-y-px hover:border-neutral-400 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:border-neutral-500 dark:hover:bg-neutral-800"
      >
        ?
      </button>

      {open && (
        <div
          className={`fixed inset-0 z-40 ${closing ? "" : "bg-black/20"}`}
          onClick={dismiss}
        >
          <aside
            role="dialog"
            aria-label="Guide"
            onClick={(e) => e.stopPropagation()}
            className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-150 dark:bg-neutral-900 ${
              closing ? "translate-x-full" : "translate-x-0"
            }`}
          >
            <header className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
              <h2 className="text-base font-semibold tracking-tight">Guide</h2>
              <button
                type="button"
                onClick={dismiss}
                aria-label="Close guide"
                className="text-neutral-400 transition hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                ✕
              </button>
            </header>

            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-6 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
              <Section title="Worlds, subjects, and facts">
                <p>
                  A <strong>world</strong> is a collection of <strong>subjects</strong>;
                  a subject is a collection of <strong>facts</strong>. A fact is a
                  short note — one or two sentences — never a prose paragraph.
                </p>
                <p>
                  Everything else hangs off a subject. Add a fact when you write
                  something down; add structure (below) only when you&apos;d filter
                  or compare by it.
                </p>
              </Section>

              <Section title="@mentions">
                <p>
                  Type <code>@</code> inside a fact to mention another subject by
                  name. The mention renders live as that subject&apos;s current
                  name, and the other subject gets a backlink to this one.
                </p>
                <p>
                  Mentions are how loose facts connect into structure over time —
                  no need to plan the links up front.
                </p>
              </Section>

              <Section title="Tags">
                <p>
                  A tag is a label you apply to subjects for cross-cutting concerns
                  (like <code>#deceased</code> or <code>#arc-1</code>). Tags are
                  scoped to a world, so renaming or deleting one updates every
                  subject carrying it at once.
                </p>
              </Section>

              <Section title="Schema fields" powerUser>
                <p>
                  Schema fields are the structured, queryable facts every subject in
                  a category shares — optional, and added only when you&apos;d
                  filter or compare by the value. Pick a type per field (Text,
                  Number, Select, Link to another subject, …).
                </p>
              </Section>

              <Section title="The ! field command" powerUser>
                <p>
                  Typing <code>!</code> as the first character of a fresh fact fills
                  a schema field directly instead of writing a fact — a typeahead
                  matches the category&apos;s fields by name, and the value that
                  follows is parsed for that field&apos;s type.
                </p>
              </Section>

              <Section title="Templates" powerUser>
                <p>
                  A template is a reusable structure: a single category&apos;s
                  fields (a <em>schema</em> template) or a whole world&apos;s
                  categories (a <em>world</em> template). Apply one to skip the
                  scaffolding, or save your own to reuse later. Built-in templates
                  ship with the app; yours live privately in your library.
                </p>
              </Section>

              <Section title="AI features">
                <p>
                  An in-world Q&amp;A over your subjects and facts is coming in a
                  later step. This guide will point at it once it ships.
                </p>
              </Section>
            </div>

            <footer className="border-t border-neutral-200 px-5 py-3 text-xs text-neutral-500 dark:border-neutral-800">
              Reopen this guide any time from the <code>?</code> icon in the header.
            </footer>
          </aside>
        </div>
      )}
    </>
  );
}

function Section({
  title,
  powerUser,
  children,
}: {
  title: string;
  powerUser?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
        {title}
        {powerUser && (
          <span className="ml-2 text-xs font-normal text-neutral-400">power-user</span>
        )}
      </h3>
      {children}
    </section>
  );
}
