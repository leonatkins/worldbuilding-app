# Step 16 — Visual identity (papery-cartographer) — Grill Notes

**Status:** IN PROGRESS (grilling 2026-07-16, `/grill-with-docs`)
**Supersedes:** `step-16-ui-polish-grill-notes.md` (that was the first slice —
create-menu/guide/dice — mostly shipped and partly retired by 15b). This grill is
the *site-wide visual identity* pass that was deferred there.

**Inputs:** `worldbuilding-style-guide.md` (target vibe), `visual-styles-2026-07-04.md`
(candidate directions A–E), `visual-ux-audit-2026-07-04.md` (9 findings, all fixed).
Current state: `globals.css` has 2 CSS vars, `system-ui`, OS-only dark mode, no token
layer; ~25 files hardcode `bg-neutral-*`/`dark:` utilities.

Register chosen (ROADMAP): **papery-cartographer = Scriptorium + Atlas**, read as
*motif/register*, not two extra color systems.

**→ The color model from Q1/Q3/Q5 is recorded as
[ADR 0015](adr/0015-two-axis-color-chrome-vs-content.md) — chrome vs content.**

---

## Decisions

### Q1 — Color system  ✅ RESOLVED
The three source docs contradicted (style-guide "one rare accent" vs Scriptorium
per-category jewel tones vs Atlas per-field-type legend). Resolution:

- **Base:** style guide governs — **single dusty-blue accent, used rarely**, warm
  neutral (parchment/tan) base. Accent is never a large block; reserved for
  interactive/active moments.
- **Per-category color: KEPT, but muted.** Categories carry a user-picked color from
  a **curated pale/neutral/muted palette only** (no saturated jewel tones). Subtle
  usage. [mechanics → Q2]
- **Per-field-type rainbow legend (Atlas): DEFERRED.** Field types differentiated by
  icon + label + a single-hue tint, not six hues. Full legend is a possible later
  opt-in.
- **"Cartographer" = iconography + layout motif + motion** (Spyglass, map-legend
  category index, trail breadcrumbs, "unfurl"), NOT a palette. **"Scriptorium" =
  serif type + parchment + wax-seal field badge.**

*Net: one accent, two register motifs, one muted per-category tint, no rainbow.*

### Q2 — Category color mechanics  ✅ RESOLVED
- **(a) Store a curated palette KEY, not a hex** (`color: "sage" | "clay" | …`) mapping
  to a light+dark token pair. A stored hex can't re-theme for dark mode; a curated set
  can't be misused into something garish. Migration = nullable `color text` on
  `categories` (no column exists today).
- **(b) Placement: structural only** — thin left-border on the category's rows in Browse
  + the category index, faint wash behind the icon chip. Never a filled row background.
- **(c) Defaults:** the 7 seed categories are pre-assigned muted colors so a fresh world
  looks intentional; user-created categories default neutral (null) and are pickable.

### Q3 — Two tints (world + category)  ✅ RESOLVED
- **(a) One shared curated palette** for world + category. **Palette is BROAD** (not a
  token 6–8) — many pale/muted swatches. The picker additionally surfaces an **"already
  in use"** group showing colors currently assigned to this world's categories (or to
  the user's worlds, when picking a world color) so a user can reuse an existing color.
- **(b) The collision rule — each tint owns a territory, never the same element:**
  - **World color = chrome / the "outside"** — worlds-list card, switcher entry dot, a
    thin rule in the in-world header, the Overview masthead. Answers *"which world?"*
  - **Category color = content / the "inside"** — left-border on category rows, icon-chip
    wash. Answers *"what kind of thing?"*
- **(c)** The category tint extends to the **subject page header** (a subject inherits its
  category's tint). NOT onto individual fact rows — too granular.
- **(d) Defaults + creation:** new worlds auto-assign a cycling pale color (so consecutive
  worlds differ at a glance in the list/switcher); color is also **settable at creation
  time**, not only on edit. Same for categories.
- **(e) Naming:** plain **"Color"** in UI copy (`World color` / `Category color`).
  Precedent: `icon` is called an icon, not a "sigil". *Livery* is reserved — see Q5.

### Q4 — Shading: hatched vs solid  ✅ RESOLVED
**Solid for surfaces; hatching reserved as illustrative ink.**

Blocking reason: the style guide already commits to a faint grid/graph-paper texture
behind everything. **The grid IS the paper — it already spent the texture budget.** A
second repeating texture (hatch) over a regular grid *moirés* (interference bands that
shimmer on scroll / at fractional zoom). One repeating texture per surface. Supporting:
hatch fails below ~20px (needs ~2px spacing; a 16px glyph fits 4–6 lines → mush), its
optical density flips unpredictably in dark mode, and hatch-everywhere fights the
"calm, unhurried, low-saturation" ledger vibe (a ledger is mostly empty paper).

**Hatching is allowed only where it earns its keep:** empty states (hatched compass
rose / cartouche), the mascot, the Spyglass at rest + Overview masthead, and possibly
an engraved hard-offset-shadow on large elements (prototype before committing).

### Q4b — Custom cartographic icon set  ✅ IN SCOPE (confirmed)
Replaces emoji entirely. **Extends the `DiceIcon` precedent**: monoline outline, 24px
grid, `strokeWidth 1.5`, `currentColor` — so each glyph inherits its category tint for
free (this is what makes Q2b's icon-chip wash work with no extra plumbing). Glyphs are
cartographic symbols, flat, **at most one hatch element** each (e.g. a mountain's shadow
face carrying 3 hatch strokes) so they read as engraving at 24px and survive at 16px.

**Cost — the largest single item in step 16, bigger than the token layer:** ~20–30 hand-
drawn glyphs, a new picker, storage changes from emoji char → **icon key**
(`categories.icon` stores `"🧑"` today), a migration path for existing emoji, and the
suggested-category chips (`🌲 Biomes`, `📅 Events`…) need re-glyphing too.

### Q5 — "Livery": chrome or content?  ✅ RESOLVED — content, at Level 2

**Finding (verified in code):** a `Color` field's *entire* visual effect today is a 16px
`rounded-full` dot in the field pill on the subject page (`subject-page.tsx:784-789`),
edited via a native `<input type="color">`. It appears nowhere else — not in Browse,
lists, or mentions. "Livery already exists" was technically true but practically hollow.

**The governing rule (two axes, not one):**
- **Chrome colors** — pale, app-owned, appear as **washes and borders** (world = outside,
  category = inside). Q3b's territory rule.
- **Content colors** — freeform, user-owned, saturated if the fiction says so, and may
  appear **wherever the content appears — but only as small contained marks** (never
  washes/borders/backgrounds).

These are different channels, so they can coexist on one row: a pale category edge
(chrome, *"what kind"*) + a small crimson mark (content, *"House Lannister"*).

**Level 2 chosen — "identity color":** a category may designate **one** Color field as its
*identity field* (nullable `identity_field_id` on `categories`); that value then renders
as a small mark beside the subject's name in **Browse, lists, and mention chips**. This
is the one place a *saturated* color legitimately enters the UI — it's the user's
fiction, not our styling. (Level 1 = swatch-v2 only, too little reach. Level 3 = livery
tinting subject chrome — **rejected**: third tint tier + override cascade + fruit salad
at the most numerous entity.)

**Shape:** not a pill/dot. A **swallowtail pennant** — rectangle with a V-notch cut into
the bottom edge. All straight lines/sharp corners, heraldic, and a **non-circular
silhouette** (at 10px a circle reads as a generic status dot; a pennant doesn't). Full
pennant on the subject page, plain sharp rectangle at list size where the notch stops
resolving. One family, two sizes.

"Livery" survives as **content the user's world contains** — ship it as a default `Color`
field named *Livery* in the built-in **Factions** (and Characters) template.

### Q6 — Sharp corners, product-wide  ✅ RESOLVED
Style guide says *"zero rounded corners anywhere"*; user says *"favor sharp corners
overall."* Sharpened via the same chrome/content axis as Q5:

- **Chrome / containers → absolute zero radius, no exceptions.** Buttons, inputs, cards,
  pills, panels, swatches, menus, the Spyglass. **Radius token = 0.**
- **Illustration / glyphs → exempt.** A compass rose, a wax seal, the die's body are
  *depicting round objects*, not applying a corner radius. (`DiceIcon`'s `rx="4"` stays.)

Nothing in the UI is soft; circles in artwork remain legal.

**Sweep cost:** code today is `rounded-md`/`rounded-lg`/`rounded-full` throughout (~25
files); the Color swatch is `rounded-full`. Mechanical, but touches nearly every
component — folds into the token sweep.

### Q7 — Typography  ✅ RESOLVED
- **Serif everywhere, no exceptions** — buttons, inputs, dropdowns, 12px schema rows, not
  just fact prose. Rationale (user): the product *prioritizes concision*, so the reading
  load is light and serif survives at small sizes.
- **One variable family with an optical-size (`opsz`) axis** — not a display+body pair.
  Display treatment at `<h1>` and UI-legible treatment at 12px come from the same file.
  **Pick: Newsreader** (warm, journal-ish, `opsz`, open). Alternates if it disappoints in
  situ: Source Serif 4, Literata. Rejected: Fraunces/Playfair/Lora — too high-contrast or
  heavy to survive 12px rows.
- **Mono = Courier Prime**, reserved for the field command. *The guide picks this for us:*
  "no sans-serif anywhere" — **Courier Prime is a serifed typewriter face (complies); IBM
  Plex Mono is a sans (violates).** Serif-vs-mono is what marks a command as a command
  (Scriptorium's insight), and a typewriter face against a serif reads as "typed into a
  ledger." **Zero sans in the product.**
- **Delivery:** `next/font/google` — self-hosted at build time, no CDN request, no layout
  shift (`size-adjust` fallback metrics). Two families total.
- **Cost: nearly free.** `globals.css` sets `font-family: system-ui` on `body` and
  essentially no component overrides it → serif-everywhere is one line + the imports.
  The guide's italic/uppercase-tracked/muted rules then become token classes.

### Q8 — Theme mechanism + token architecture  ✅ RESOLVED
- **(a) Three-way theme: System / Light / Dark**, via `data-theme` on `<html>` +
  localStorage (today it's `@media (prefers-color-scheme)` — OS-only, no user control).
  **Requires a tiny blocking inline script in `<head>`** to set `data-theme` before first
  paint — otherwise first paint is the wrong theme and snaps, violating the standing
  *"no flashes"* rule.
- **(b) Token set (semantic, register-flavoured where still semantic):**
  `surface`, `surface-raised` · `rule` (borders — *"rule"* is the printing term for a
  line: on-vibe **and** semantic) · `ink`, `ink-muted`, `ink-faint` (text) · `accent`,
  `accent-soft` · `danger` · `tint-*` (the broad pale palette from Q3a).
  Rejected `parchment` as a token name — it's a *literal color*, not a role, and it lies
  the moment dark mode inverts it. `surface` survives.
- **(c) Sweep = a net DELETION, not a rename.** A token carries both light and dark
  values, so every `dark:` variant collapses:
  `border-neutral-200 bg-white text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900
  dark:text-neutral-100` → `border-rule bg-surface text-ink`. This is also what makes the
  three known `gray-on-color` contrast findings (worlds-list, subjects-list,
  category-manager) disappear *structurally* rather than being patched individually.
- **Incremental is safe** because tokens are additive — `--color-surface` doesn't break
  existing `bg-neutral-100`, so both coexist during migration. **Phasing:**
  1. Foundation — tokens + fonts + theme toggle + no-flash script (nothing looks different)
  2. **One screen end-to-end (Overview)** — the only way to discover missing tokens is to
     fully convert one real screen; cheap to fix the set now, expensive after 25 files
  3. Sweep the rest file-by-file
  4. **Guardrail** — ESLint rule banning raw `neutral-*`/`gray-*` in `className` so new
     code can't reintroduce hardcoded colors / regress the contrast findings

### Q9 — Motion  ✅ RESOLVED
Contradiction: style guide says *"nothing bounces"*; Scriptorium prescribes *"slight
overshoot"*; Atlas prescribes a *"pin-drop bounce"*. **Guide wins — zero overshoot, no
springs, no motion library.** ("Settle" survives as *damping*, not overshoot: paper
settles, it doesn't boing.) Motion direction = candidate **A (Quiet Paper)**: subtle
CSS, fade + small slide. Spec below grounded in the `emil-design-eng` skill.

**Motion tokens** (built-in CSS easings are too weak to read as intentional):
```css
--ease-out:    cubic-bezier(0.23, 1, 0.32, 1);   /* enter/exit */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);  /* on-screen movement */
```
**Never `ease-in`** — it delays initial movement exactly when the user is watching.

**Frequency audit — what does NOT animate:**
| Surface | Frequency | Decision |
|---|---|---|
| **Spyglass results dropdown** | 100s/day (core loop) | **No animation** (cf. Raycast) |
| Hover on rows/links | tens/day | color/opacity only, 150ms |
| Switcher, pickers, typeahead | occasional | 200ms fade + 4–8px slide |
| Fold-on-delete, guide panel | rare | 250ms |
| Empty states, mascot | first-time | may afford delight |

**Rules:** all durations <300ms (press 100–160 · dropdowns 150–250 · panels 250) ·
buttons get `transform: scale(0.97)` on `:active` @160ms · **never enter from `scale(0)`**
(start `scale(0.95)` + `opacity:0`) · popovers are **origin-aware** (`transform-origin` at
the trigger, not center — switcher + icon picker are wrong today) · **CSS transitions not
keyframes** (transitions retarget mid-flight) · `@starting-style` for enter · **no stagger
on Overview recency lists** (opened many times/day → frequency rule says reduce) ·
`prefers-reduced-motion` = gentler not zero (keep opacity/color, drop movement) ·
**fold-on-delete** (`scaleY`→0 from top) retained from Scriptorium — not a bounce.

### ⚠️ Defect found — hover-reveal on touch
Style guide: *"low-priority actions (like delete) stay invisible until you hover"* —
implemented in `subjects-list`, `worlds-list`, `category-manager`. **Touch devices have no
hover**, so those Rename/Delete controls are permanently visible or unreachable. Needs
`@media (hover: hover) and (pointer: fine)` gating + a touch fallback. A real mobile
defect hiding inside an aesthetic rule.

## ⚠️ THE OPAQUE-PANEL RULE (app-wide, enforced)

> **Any box-bordered container MUST have an opaque background (`bg-surface-raised`).
> Panels are sheets laid ON the paper, not windows onto it.**

**Enforced by `npm run audit:panels`** (`scripts/audit-panels.mjs`, exits non-zero with
file:line). Documented at source in `app/globals.css` beside the texture that causes it.

### Why this is a *class* of bug, not a one-off
The grid texture sits behind everything. A bordered panel with **no background** lets the
grid show straight through, which reads as a missing background. Crucially **the bug is
invisible without the texture** — while the page background was flat white, a transparent
panel on white simply *looks* white. So the app accumulated **26 of them across 12 files**
without anyone being able to see it. Adding the texture didn't cause the bug; it
*revealed* it.

The style guide asked for this all along — *"sections are separated with thin hairline
borders **and a subtle surface-color change**"*. The surface change was simply never
implemented, and nothing could show that until now.

### The distinction that decides it
| Pattern | Meaning | Background? |
|---|---|---|
| `border` (box) | a **panel** | **YES** — `bg-surface-raised` |
| `border-b` / `border-t` / … (edge) | a **divider** | no — stays transparent |
| `border-dashed` | an **empty state** | no — bare paper is the point |
| paints its own fill (Color swatch's inline style, native `<input type="color">`) | — | no — a surface token would be wrong |

### Scale of the fix (2026-07-16)
26 panels across 12 files. One idiom accounted for **13** of them —
`divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 …`,
the app's standard list-panel pattern, which had never had a background. Every file using
it inherited the gap. Swept onto tokens (`divide-rule` / `border-rule` /
`bg-surface-raised`) in the same pass.

### Palette anchors (starting values, tune in situ)
| | Light | Dark |
|---|---|---|
| `surface` | `#f7f2e8` parchment | `#211c14` warm ink-brown (never cool/pure black) |
| `ink` | `#2a2118` warm brown-black | `#ece4d3` warm parchment |
| `rule` | `#e0d8c8` | `#3a3226` |
| `accent` | `#4a6fa5` dusty blue | `#7a9cc9` same hue, brightened |

Plus the broad `tint-*` pale palette (sage, clay, slate, dust-rose, …), each with a
light/dark pair.

---

## Future note — Lore & category descriptions (NOT this step)

User flagged: we may later add **lore** (long-form prose about a subject) and **plain-text
descriptions on categories**. Deliberately **plain-text**, *"so users don't get caught up
on formatting"*; md/rich-text possibly later.

**⚠️ Glossary collision to resolve before building it:** `CONTEXT.md` defines **Fact** as
*"a short note of one or two sentences… never a prose paragraph"* and lists *paragraph*
under _Avoid_. So **Lore is a deliberately distinct concept, not "a long Fact"** — the
two must not blur. If lore is ever built, it needs its own glossary entry drawing that
boundary explicitly.

**Typography implication (why it's noted here):** long-form lore means the body serif must
carry sustained reading, not just 12px rows — which reinforces **Newsreader** (a reading
face). **Reserve prose tokens now** (measure ~65ch, line-height ~1.6) even though nothing
uses them yet, so lore doesn't force a type re-think later.
