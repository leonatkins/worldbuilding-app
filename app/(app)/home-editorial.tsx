"use client";

/**
 * Home editorial panels (step 15a): a rotating Tip and the latest What's-new
 * entries, each a self-contained panel so Home can place them independently.
 * Tips rotate client-side (random start on mount, then cycling) to keep Home
 * feeling alive without any server state. Content lives in lib/home.ts.
 */
import { useEffect, useState } from "react";
import { TIPS, type WhatsNewEntry } from "@/lib/home";

/** Compact rotating hint. */
export function HomeTip() {
  // Stable index 0 for SSR; randomize + rotate on the client (async callbacks
  // only, so the server and first client render agree — no hydration mismatch).
  const [tip, setTip] = useState(0);
  useEffect(() => {
    const kick = setTimeout(() => setTip(Math.floor(Math.random() * TIPS.length)), 0);
    const id = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 12000);
    return () => {
      clearTimeout(kick);
      clearInterval(id);
    };
  }, []);

  return (
    <section className="rounded-lg border border-neutral-200 bg-surface-raised p-4 dark:border-neutral-800">
      <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">Tip</h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
        {TIPS[tip]}
      </p>
    </section>
  );
}

/** Latest release notes. Static; `whatsNew` is the already-sliced list. */
export function WhatsNewPanel({ whatsNew }: { whatsNew: WhatsNewEntry[] }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-surface-raised p-4 dark:border-neutral-800">
      <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">What&rsquo;s new</h2>
      <ul className="mt-2 space-y-2">
        {whatsNew.map((e) => (
          <li key={`${e.date}:${e.title}`} className="text-sm">
            <span className="font-medium text-neutral-800 dark:text-neutral-200">{e.title}</span>
            <span className="text-neutral-600 dark:text-neutral-400"> — {e.body}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
