/**
 * Editorial content for Home (step 15a). Hardcoded, git-versioned TS constants —
 * same pattern as DEFAULT_CATEGORIES / BUILTIN_TEMPLATES. No DB table, no CMS, no
 * seen-state in v1: Tips rotate client-side, What's-new shows the latest few
 * statically. Edit here + deploy to change them.
 */

/** Rotating one-liner hints shown in the Tips block. Keep them short + concrete. */
export const TIPS: string[] = [
  "Type @ inside a fact to mention another subject — it renders live and shows up as a backlink.",
  "Type ! at the start of a fact to fill a schema field instead of writing a fact.",
  "Select backlinks on a subject and promote them into a List field in one step.",
  "Save any category or world as a template, then reuse its structure in another world.",
  "Deleting is never permanent right away — everything goes to Recently Deleted first.",
  "Press ⌘K anywhere to jump to a subject or world.",
];

export type WhatsNewEntry = { date: string; title: string; body: string };

/**
 * Newest first; Home shows the latest few. Keep this in sync with CHANGELOG.md —
 * when a user-facing feature ships, add a one-line card here in the same PR that
 * updates the changelog, so "What's new" never drifts behind the app. (No CMS by
 * design; this hand-curated list is the source, mirrored from the changelog.)
 */
export const WHATS_NEW: WhatsNewEntry[] = [
  {
    date: "2026-07",
    title: "A new Home",
    body: "Your recently viewed and recently edited subjects now greet you across every world.",
  },
  {
    date: "2026-07",
    title: "Onboarding guide",
    body: "A quick guide to how worlds, subjects, and facts fit together — open it any time from the ? in the header.",
  },
  {
    date: "2026-07",
    title: "Templates",
    body: "Save a category or a whole world as a reusable template, and start new worlds from one.",
  },
  {
    date: "2026-06",
    title: "Search & filtering",
    body: "Search subjects, facts, and field values in a world, filtered by category and tag.",
  },
];
