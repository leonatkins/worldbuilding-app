"use client";

/**
 * Onboarding guide panel (step 14, B1; reformatted + animated step 16). A
 * right-side slide-in Sheet (outside-click + Escape dismiss). Content is hardcoded
 * TSX (mirrors built-in templates: git-versioned, no DB table). Conceptual copy
 * only (B5) — what things ARE, never where a button sits. Core concepts are shown
 * upfront; the power-user sections collapse behind "Show advanced".
 *
 * `autoOpen` (server: `onboarding_seen_at IS NULL`) opens the panel on first
 * login; the first dismiss stamps `onboarding_seen_at` (B4) and never re-opens
 * automatically. The icon toggles re-access afterward.
 *
 * Animation: the panel mounts off-screen (`translate-x-full`) and slides in the
 * next frame (`visible`), so opening animates too (it previously mounted already
 * open). `prefers-reduced-motion` drops the transition.
 */
import { useEffect, useState } from "react";
import { markOnboardingSeen } from "@/app/actions/onboarding";

const ANIM_MS = 300;

export function GuidePanel({ autoOpen }: { autoOpen: boolean }) {
  const [open, setOpen] = useState(autoOpen);
  const [visible, setVisible] = useState(false);
  // Track whether we're still in the auto-open session (haven't dismissed once).
  const [firstSession, setFirstSession] = useState(autoOpen);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Slide in: once mounted (open), flip to the on-screen position next frame.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Escape / outside-click dismiss (mirrors the WorldSwitcher popover pattern).
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
    if (!visible) return; // already closing
    setVisible(false);
    // Stamp only on the first-session dismiss (B4). Re-open-from-icon leaves it.
    if (firstSession) {
      setFirstSession(false);
      void markOnboardingSeen();
    }
    // Slide out, then unmount + reset the advanced accordion.
    setTimeout(() => {
      setOpen(false);
      setShowAdvanced(false);
    }, ANIM_MS);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => (open ? dismiss() : setOpen(true))}
        aria-label="Open guide"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-300 text-lg leading-none text-neutral-700 transition hover:-translate-y-px hover:border-neutral-400 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:border-neutral-500 dark:hover:bg-neutral-800"
      >
        ?
      </button>

      {open && (
        <div
          className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 motion-reduce:transition-none ${
            visible ? "opacity-100" : "opacity-0"
          }`}
          onClick={dismiss}
        >
          <aside
            role="dialog"
            aria-label="Guide"
            onClick={(e) => e.stopPropagation()}
            className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none dark:bg-neutral-900 ${
              visible ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
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

            <div className="flex-1 overflow-y-auto px-6 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
              <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                <Section title="Worlds, subjects, and facts">
                  <p>
                    A <strong>world</strong> is a collection of <strong>subjects</strong>;
                    a subject is a collection of <strong>facts</strong>. A fact is a
                    short note — one or two sentences — never a prose paragraph.
                  </p>
                  <p>
                    Everything else hangs off a subject. Add a fact when you write
                    something down; add structure only when you&apos;d filter or
                    compare by it.
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

                <div className="py-5">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    aria-expanded={showAdvanced}
                    className="flex w-full items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500 transition hover:text-neutral-800 dark:hover:text-neutral-200"
                  >
                    <span className="inline-block w-3 text-center leading-none">
                      {showAdvanced ? "▾" : "▸"}
                    </span>
                    {showAdvanced ? "Hide advanced" : "Show advanced"}
                  </button>

                  {showAdvanced && (
                    <div className="mt-1 divide-y divide-neutral-200 dark:divide-neutral-800">
                      <Section title="Schema fields">
                        <p>
                          Schema fields are the structured, queryable facts every
                          subject in a category shares — optional, and added only
                          when you&apos;d filter or compare by the value. Pick a type
                          per field (Text, Number, Select, Link to another subject, …).
                        </p>
                      </Section>

                      <Section title="The ! field command">
                        <p>
                          Typing <code>!</code> as the first character of a fresh fact
                          fills a schema field directly instead of writing a fact — a
                          typeahead matches the category&apos;s fields by name, and
                          the value that follows is parsed for that field&apos;s type.
                        </p>
                      </Section>

                      <Section title="Templates">
                        <p>
                          A template is a reusable structure: a single
                          category&apos;s fields (a <em>schema</em> template) or a
                          whole world&apos;s categories (a <em>world</em> template).
                          Apply one to skip the scaffolding, or save your own to
                          reuse later.
                        </p>
                      </Section>
                    </div>
                  )}
                </div>

                <Section title="AI features">
                  <p>
                    An in-world Q&amp;A over your subjects and facts is coming in a
                    later step. This guide will point at it once it ships.
                  </p>
                </Section>
              </div>
            </div>

            <footer className="border-t border-neutral-200 px-6 py-3 text-xs text-neutral-500 dark:border-neutral-800">
              Reopen this guide any time from the <code>?</code> icon in the header.
            </footer>
          </aside>
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 py-5">
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{title}</h3>
      {children}
    </section>
  );
}
