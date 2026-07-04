# Future Visual Styles — Candidate Directions

The current look (strict black/white/gray, system-ui, no motion beyond
`transition` on hover states) is a placeholder — functional enough to build
and test features against, not a final identity. This doc sketches five
distinct directions the product could take, each internally consistent, to
choose from (or mix) once the feature set settles. None of these are
implemented; this is a menu, not a plan.

For each: the palette, type, layout/density change, motion language, how the
core surfaces (world list, category schema, subject page, field command,
mentions, backlinks) would look and behave, and what it'd cost to build.

## Before any of these: a token layer

Right now there is no design-token abstraction — `app/globals.css` defines
exactly two CSS variables (`--background`, `--foreground`), and every
component hardcodes Tailwind utilities directly (`bg-neutral-100`,
`text-neutral-500`, `dark:bg-neutral-800`, …) repeated across ~25 files.
That's fine for one style, but it means **switching styles today means
find-and-replace across the codebase**, not a config change.

Whichever direction gets picked, the first real step is the same:
1. Define semantic tokens in `globals.css` / `tailwind.config` — `--surface`,
   `--surface-raised`, `--border`, `--text-primary`, `--text-muted`,
   `--accent`, `--accent-foreground`, `--danger`, etc. — instead of literal
   neutral/red shades.
2. Sweep components to reference the tokens (`bg-surface` instead of
   `bg-white dark:bg-neutral-900`), collapsing the current manual
   `dark:` pairing into the token's own light/dark values.
3. Only after that sweep does "try a different style" become "change the
   token values in one file" instead of a multi-file, error-prone pass.

This is real, unglamorous work (component library-sized effort) — call it
1-2 days for a dev who already knows the component tree. It pays for itself
the moment a second style direction gets tried, or if theming (user-chosen
themes, not just light/dark) is ever wanted.

---

## A. Quiet Paper — refined version of today

The lowest-cost option: keep the monochrome, minimal spirit, but make it feel
*designed* rather than *default*.

- **Palette**: still neutral-first, but warm the gray off pure black/white —
  `#fafaf9`/`#1c1917` (stone, not neutral) backgrounds, one considered accent
  (a muted ink-indigo, `#4338ca` at ~10% usage) reserved for: primary actions
  that create/commit something (Save, Create, Confirm), active/selected
  states (current world in the switcher, active tab), and the field-command
  badge — nowhere else. Everything else stays grayscale.
- **Type**: system-ui stays for body text; headings move to a single
  distinctive display face (e.g. a variable serif or a warm grotesque like
  Instrument Sans) at slightly larger sizes with tighter tracking — enough to
  give the product a "hand," not enough to slow down reading data.
- **Layout/density**: unchanged — this style is about polish, not
  restructuring. Slightly more generous vertical rhythm between sections
  (current `space-y-6`-ish → `space-y-8`) since density isn't this app's
  constraint.
- **Motion**: subtle only. 150ms ease-out fade+8px slide on route
  transitions and popovers (replacing the current instant show/hide);
  field/fact save success gets a 400ms green-tinted flash on the pill/row
  that then settles back to neutral — the only moment color appears outside
  the accent's fixed roles.
- **Field command**: keep this audit's exact fix (monospace + tint + badge)
  as the final design — it already fits this direction natively.
- **Mentions/backlinks**: mention links get the accent color permanently
  (not just an underline) — since Quiet Paper *has* an accent now, mentions
  are the natural place to spend it (they're the app's core "structure"
  gesture).
- **Cost**: **Low.** No new dependencies (motion can be plain CSS
  transitions), no new fonts required (one Google Font import if a display
  face is picked), token layer + a pass to apply the one accent color
  correctly. Realistic: 2-3 days after the token layer lands.

## B. Scriptorium — illuminated-manuscript / literary

Leans into "worldbuilding" as a *writing* act — the app should feel like a
well-kept journal or grimoire, not a dashboard.

- **Palette**: warm parchment backgrounds (`#f7f2e8` light / `#211c14` dark —
  not pure black, a deep ink-brown), text in near-black warm ink
  (`#2a2118`), a single deep accent per *category* rather than per app —
  e.g. categories could each carry a muted jewel tone (burgundy, forest,
  slate) chosen from a fixed small palette, shown as a thin left-border
  accent on that category's subject rows and field pills. Structural chrome
  (header, buttons) stays a neutral warm gray so category colors don't fight
  each other.
- **Type**: a serif display face for `<h1>`s and category names (e.g. Fraunces
  or Lora), serif or humanist-serif for fact/body text too — this is the one
  direction where body copy itself goes serif, since "reading entries" is
  the core loop. Monospace reserved only for the field command (a nice
  contrast: command vs. prose becomes serif-vs-mono, reinforcing #1's fix
  thematically instead of just via tint).
- **Layout/density**: slightly more generous margins, a subtle
  paper-grain/texture background (a tiled SVG noise, very low opacity — no
  perf cost), thin decorative rules (a single hairline with a small
  flourish glyph) between major sections instead of plain `border-t`.
- **Motion**: "settle" easing (slight overshoot, like a page settling after
  being turned) on panel open/close — 250ms. Deleting a subject/fact does a
  brief "fold" (scaleY toward 0 from the top, like a page closing) rather
  than an instant removal.
- **Field command**: the badge becomes a small wax-seal-style glyph (still
  just CSS/emoji, no image asset needed) instead of a text "FIELD" pill.
- **Mentions/backlinks**: mentions render like manuscript cross-references —
  small caps or a subtly different ink shade, no underline needed since the
  serif+ink treatment already reads as "linked term" in this style's
  language (test this for real accessibility/discoverability before
  committing — it's the one place this direction could regress #8's fix).
- **Cost**: **Medium.** Two font loads (display + body serif), a category→
  color-token mapping (schema change: either a fixed enum or a stored
  color per category), an SVG texture asset, token layer. Realistic:
  1-1.5 weeks including the category-color plumbing.

## C. Atlas — cartographer / map

Leans into "world" literally — the product chrome feels like a map legend
and field journal.

- **Palette**: muted earth-tone base — sepia/tan backgrounds (`#ece4d3`
  light, deep slate `#1a2129` dark), ink-blue for structure/links
  (`#2c4a6e`), a small fixed set of "map legend" colors for field *types*
  specifically (Text=ink, Number=blue, Date=green, Boolean=amber,
  Select/MultiSelect=purple, Link/List=teal) — every field pill, the
  create-field confirm banner, and the field-command badge all pick up
  their type's color consistently. This directly extends #1's fix into a
  full system: not just "this is a command" but "this is a *Date* command."
- **Type**: a grotesque with slightly condensed capitals for headings
  (map-label energy — e.g. Barlow Condensed), regular grotesque for body.
- **Layout/density**: category list styled like a map legend (icon + name in
  a bordered "key" box); the category page's field list gets a left rail of
  small type-color swatches instead of relying on text labels alone;
  breadcrumbs styled as a "route" (dotted line connecting crumbs, like a
  trail on a map) — this would also be the natural place to fix finding #9
  for good, since a trail-styled breadcrumb has its own consistent
  icon+label spacing rule everywhere by construction.
- **Motion**: "unfurl" — panels/dropdowns scale in from a corner (like
  unrolling a map corner) at 200ms; backlink promotion (step 10) gets a
  brief "pin drop" bounce on the destination List field's pill.
  Drag-reorder (schema fields, categories) gets a subtle compass-needle
  rotate on the drag handle while active instead of just `opacity: 0.5`.
- **Field command**: badge becomes the field's type-color swatch (a small
  colored dot) instead of a neutral "FIELD" text pill — reads faster once
  you've learned the legend.
- **Mentions/backlinks**: mention chips get a thin ink-blue underline
  (matches the "route" motif); backlink promotion arrows use the same
  ink-blue "connection line" visual both in the field summary
  (`Link — one subject · → Locations`) and conceptually in a future
  graph/map view of a world (this style is the one that scales best toward
  an eventual visual world-map feature, if that's ever on the roadmap).
- **Cost**: **Medium-high.** Font load, a fixed FieldType→color token map
  (touches `lib/schema-fields.ts`'s labels/hints table plus every place a
  field type renders), new texture/legend-box component, token layer.
  Realistic: 1.5-2 weeks — the FieldType color system is the bulk of it
  since it threads through schema editor, field pills, field command, and
  hover cards consistently.

## D. Terminal — structured-data / developer-forward

Leans into what the app *actually is under the hood*: a typed schema editor
with a facts engine. This is the direction most different from the other
three — it embraces density and precision over warmth.

- **Palette**: dark-mode-first (light mode becomes the "secondary" theme,
  not the default) — near-black `#0d0d0f` surfaces, a single bright accent
  (electric cyan or lime, `#22d3ee`-ish) used *only* for interactive/focus
  states and the field-command mode, everything else desaturated gray-blue.
- **Type**: monospace everywhere, not just field commands — body text, fact
  content, field pills, all in a monospace face (JetBrains Mono / Berkeley
  Mono-style). This is the one direction where #1's fix stops being special
  (a mono field-command line no longer contrasts with mono prose) — instead
  the contrast would need to come from the tint/badge/border alone, which
  is worth flagging explicitly if this direction is picked: the current fix
  would need the border/tint half strengthened to compensate.
- **Layout/density**: noticeably tighter — smaller vertical padding on rows
  (schema fields, subjects, facts), more visible structure (thin 1px
  borders everywhere instead of relying on whitespace), field type shown as
  a small bracketed tag (`[Date]`, `[Link→Locations]`) inline rather than
  trailing gray text — closer to how the schema *already* reads in
  `summarizeField()`'s output, just typographically leaned into.
- **Motion**: near-instant (~80-100ms), no easing flourishes — this style's
  personality is "snappy tool," not "considered craft." Popovers/dropdowns
  should feel like they have zero latency. The one deliberate animation:
  a terminal-style cursor blink on the field-command badge while `fieldMode`
  is active, reinforcing "you're in a command context" through motion
  instead of (or in addition to) color.
- **Field command**: badge becomes literal terminal chrome — e.g. a small
  `>` prompt glyph before the typed text, blinking cursor block at the caret
  when idle.
- **Mentions/backlinks**: mentions render like a symbol reference in an IDE
  (subtle bracket or `→` prefix, accent-colored), hover card styled like a
  tooltip/type-hint popup.
- **Cost**: **Medium.** One font load, token layer, but most of the "cost"
  is a density pass across nearly every list/row component (schema editor,
  subject list, fact list) to tighten padding — mechanical but touches many
  files. Realistic: 1-1.5 weeks.

## E. Vivid Studio — bold, colorful, playful SaaS

The opposite instinct from "tone the signup page down" (audit finding #2) —
instead, make the *whole app* as bold as `/signup` already is. Closest in
spirit to mainstream consumer SaaS (Linear/Notion-adjacent but louder).

- **Palette**: the signup page's indigo/purple gradient becomes the app's
  actual brand color, used throughout — primary buttons, active nav states,
  the field-command mode, category icons get colorful rounded-square
  backgrounds instead of bare emoji. Multiple accent colors are fine here
  (unlike A-D) — each world could even get a user-chosen accent (a "world
  color") shown in its switcher entry and header.
- **Type**: a friendly geometric sans for headings (e.g. Cabinet Grotesk /
  General Sans), same or a paired sans for body — rounder terminals, larger
  headings than today.
- **Layout/density**: generous padding, bigger rounded corners (`rounded-xl`/
  `2xl` instead of `rounded-md`), soft drop shadows on cards (schema field
  rows, subject cards) instead of flat hairline borders, category list
  becomes a card grid with color-tinted backgrounds rather than a plain
  list.
- **Motion**: the most animated of the five — spring-based (not just eased)
  transitions on everything: cards lift slightly on hover, a short
  confetti/particle burst on first-time actions (creating a world, filling
  the first schema field), the create-field confirm banner slides/bounces
  in. This is the direction most likely to want a real animation library
  (Framer Motion / Motion One) rather than plain CSS transitions, since
  spring physics and orchestrated multi-element animations are painful in
  raw CSS.
- **Field command**: the "FIELD" badge becomes a small colored pill matching
  the app's brand gradient, with a gentle pulse animation while active —
  the most visually loud version of #1's fix among all five directions.
- **Mentions/backlinks**: mention chips get a colored pill background (like
  the current `@mention` chip style, but in brand color instead of neutral)
  — visually louder than any other direction's mention treatment, probably
  the easiest of the five to misjudge into "too much" for a text-dense
  facts list, worth prototyping on a real fact-heavy subject before
  committing.
- **Cost**: **High.** New animation dependency + learning/maintenance cost,
  token layer, full component pass (borders→shadows, `rounded-md`→
  `rounded-xl`, category-icon treatment), plus product-level decisions this
  audit can't make alone (per-world custom accent colors implies new schema
  + UI for picking one). Realistic: 3-4 weeks, and the direction with the
  most ongoing cost per new feature (every new component needs the spring
  motion + color treatment applied deliberately, not just inherited for
  free the way a flat neutral style is).

---

## Comparison at a glance

| | A. Quiet Paper | B. Scriptorium | C. Atlas | D. Terminal | E. Vivid Studio |
|---|---|---|---|---|---|
| Feel | Refined default | Literary/warm | Map/legend | Dev tool | Playful SaaS |
| Accent colors | 1 | Per-category | Per-field-type | 1 (bright) | Multi/per-world |
| Body font | System sans | Serif | Grotesque | Monospace | Geometric sans |
| Motion | Subtle CSS | Settle/fold CSS | Unfurl CSS | Near-instant CSS | Spring (new dep) |
| Solves #1 (field cmd) natively | Keeps current fix | Serif-vs-mono contrast | Type-color badge | Needs strengthening | Loudest version |
| Solves #2 (signup/login) | N/A — stays intentional | N/A | N/A | N/A | Resolves by making signup the norm |
| New deps | None | Fonts | Fonts | Font | Fonts + motion lib |
| Rough cost (after token layer) | 2-3 days | 1-1.5 wks | 1.5-2 wks | 1-1.5 wks | 3-4 wks |

**Recommendation if forced to pick one now**: A (Quiet Paper) as the next
step regardless of long-term direction — it's the only option cheap enough
to not be a real bet, and it's a strict subset of B/C/D's foundations (token
layer, one restrained accent) so nothing in it is wasted if a bolder
direction is chosen later.
