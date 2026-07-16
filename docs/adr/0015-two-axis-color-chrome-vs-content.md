# Color has two axes: app-owned chrome tints are pale and structural; user-owned content colors are freeform and contained

**Status:** accepted

Step 16 (the visual identity pass) introduces color to a product that has been
strictly monochrome. Three separate wants collided: the style guide's *"one cool
accent, used rarely, never a large block"*, a per-**world** and per-**category** tint
for orientation, and **livery** — a subject's own colors (House Lannister *is* crimson
and gold). Resolving them as one system produced fruit salad; resolving them as **two
independent axes** did not. This ADR records the split and the rules that keep it
stable.

## Context

The documented identity (`docs/worldbuilding-style-guide.md`) is a *"well-kept journal
or ledger… calm and unhurried, low-saturation"* with **one** dusty-blue accent reserved
for interactive moments. The chosen register (Scriptorium + Atlas) shipped two *further*
color systems in its source material — Scriptorium's per-category jewel tones and
Atlas's per-field-type legend palette (Text=ink, Date=green, Boolean=amber…). Adopting
the label wholesale would put **three** color languages on a single schema-editor
screen at once, which is precisely the "slick SaaS product" register the identity
rejects.

The insight that unlocked it: **these colors are not the same kind of thing.**

- A category's tint is **app chrome** — a UI affordance that helps you *scan the
  product*. It exists to serve orientation and must stay calm.
- A faction's livery is **worldbuilding content** — a *fact about the fiction*, exactly
  like `Is Alive` or `Home → Rivendell`. It exists to depict the user's world.

Forcing content through the chrome constraint would render Lannister gold as "pale
sand" — censoring the user's world to protect our UI. Forcing chrome to be as free as
content produces the fruit salad. Hence two axes, each with its own rules.

## Decision

**Chrome colors** — app-owned, **pale/muted only**, drawn from a curated palette stored
as a **key** (not a hex, which cannot re-theme for dark mode). They appear as **washes
and borders**, under a strict territory rule so two tints never contend for one element:

- **World color = the "outside"** (worlds-list card, switcher dot, header rule, Overview
  masthead) — answers *"which world am I in?"*
- **Category color = the "inside"** (left-border on category rows, icon-chip wash, and
  inherited by the subject page header) — answers *"what kind of thing is this?"*

**Content colors** — user-owned, **freeform and saturated if the fiction says so**, and
may appear **wherever the content appears, but only as small contained marks** — never
washes, borders, or backgrounds. Livery is a `Color` **field value**, surfaced via a
category's optional **identity field** (`categories.identity_field_id`) as a swallowtail
pennant beside the subject's name in Browse, lists, and mention chips.

Because the two axes use different *shapes* (wash/border vs. contained mark), they can
coexist on one row without competing: a pale category edge plus a small crimson pennant
read as two distinct channels, not as two colors fighting.

## Considered Options

- **Adopt Scriptorium + Atlas literally** (per-category jewel tones *and* per-field-type
  legend colors): three color languages on one screen; violates "accent is rare, never a
  block"; the field-type legend also threads a color decision through every schema
  surface. **Rejected.**
- **Style guide purism — one accent, no tints at all:** coherent, but throws away real
  orientation value (six worlds in the switcher are hard to tell apart) and gives the
  user no way to record their world's colors. **Rejected.**
- **Livery as chrome (tinting a subject's own page/rows) — "Level 3":** what the user
  first reached for. Rejected because it adds a *third* tint tier, forces an
  inherit-vs-override cascade to be resolved on every subject row, and reintroduces the
  fruit salad at the **most numerous entity in the app**.
- **Livery as content, with reach — "Level 2" (chosen):** the color does real work
  (visible in Browse/lists/mentions) without touching chrome. Cost: one nullable
  `identity_field_id` on `categories` plus threading the value into list queries.
- **Livery as content, no reach — "Level 1":** the status quo. A `Color` field's entire
  effect today is a 16px dot in one field pill on one page — machinery that technically
  exists but does nothing. **Rejected as too little.**

## Consequences

- **Two migrations for chrome** (`worlds.color`, `categories.color` — nullable text,
  storing a palette key) and **one for content** (`categories.identity_field_id`).
- **The per-field-type legend palette (Atlas) is explicitly deferred**, not forgotten.
  Field types are differentiated by icon + label + a single-hue tint. Recording the
  rejection so it isn't re-proposed: a six-hue legend cannot coexist with "color is
  rare" while two tint axes already exist.
- **A new component gets a new rule, not a new argument.** The question "may this be
  colored?" is answered by asking *"is it chrome or content?"* — chrome gets a pale tint
  in its territory, content gets a contained mark. This is the durable value of the ADR.
- **Saturated color is legal in exactly one place** — a content mark. If saturated color
  ever appears as a wash or a background, the model has been violated.
- **"Livery" is not a feature or a new entity.** It survives as a default `Color` field
  named *Livery* in the built-in Factions/Characters templates — content the user's world
  contains, requiring no new machinery.
- **A stored hex is a latent dark-mode bug.** Chrome keys re-derive per theme; the
  freeform content hex is *deliberately* exempt (the fiction's crimson is crimson in both
  themes) and must therefore always sit on a contained mark whose contrast is
  theme-independent — never behind text.
