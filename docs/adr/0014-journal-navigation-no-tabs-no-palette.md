# In-world navigation is a journal front page reached by in-page links and the Spyglass — no tabs, no command palette

**Status:** accepted

Step 15b originally specced an in-world **Overview / Browse / Manage tab bar**
(ADR 0013) plus a **⌘K command palette** for cross-surface jump/create. Building
against the documented product vibe, both were cut. This ADR records the navigation
model that replaced them and why the conventional patterns lost.

## Context

The documented identity (`docs/worldbuilding-style-guide.md`) is a *"well-kept
journal or ledger, **not** a slick SaaS product — calm and unhurried"*; the chosen
visual direction (Scriptorium + Atlas, a restrained **cartographer / age-of-exploration**
register) reinforces it. A persistent horizontal tab strip and a ⌘K command palette
are two of the most recognizable pieces of SaaS-app chrome (Notion, Linear, Raycast) —
they read as "software product," which is exactly the register the identity rejects.
Separately, most of what a command palette would do already exists: the persistent
`GlobalSearchBar` (jump to a subject), the `+` `CreateMenu` (create), and the world
switcher (navigate).

## Considered Options

- **Tab bar + ⌘K palette (original 15b / ADR 0013 plan):** conventional and
  discoverable, but both elements read as SaaS product chrome and fight the
  journal/cartographer identity.
- **A half-measure (keep tabs *or* keep the palette):** each still ships one of the two
  SaaS-chrome elements; no coherent story.
- **No tabs, no palette — a journal front page + in-page links + one named search
  instrument (chosen):** on-vibe, deletes a whole surface (Manage) and a whole
  component (palette) rather than relocating them; the cost is discoverability leaning
  on in-page links and one learned instrument instead of an always-visible tab bar.

## Consequences

- **Entering a world lands on the Overview front page** (`/worlds/[worldId]`):
  recency-led (recently edited/viewed in this world — resume where you left off), with a
  **secondary categories index** (click → Browse filtered to that category) and
  start-here actions. Deliberately *not* a metrics dashboard; empty/new worlds fall back
  to the categories index + "create your first subject."
- **Navigation = in-page links + the world switcher + the `+` CreateMenu + the
  Spyglass** — the elevated, named search-and-jump instrument that replaces both a
  generic search box and a ⌘K palette (search framed as *spotting through the glass*,
  not a command overlay).
- **"Manage" dissolves** (it was a tab-shaped bucket): category management inlines
  behind an **Edit toggle** on the front-page index, reusing `CategoryManager` verbatim;
  tag management lives in the Browse tag filter; save-as-template (world) is a
  world-level action.
- **Browse stays the primary path to subjects** (flat, filterable); the **category
  detail page** is an *authoring/focus* surface (members + schema editor) reached from
  the management lane, with **no subject-page back-link by design** — flat IA, a category
  is not a parent folder you climb back to.
- **Supersedes the "in-world tab structure" framing of ADR 0013.** ADR 0013's core
  holds (Browse primary; category page kept-but-demoted); only its tab/back-link
  assumptions change.
