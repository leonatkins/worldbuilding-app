# Step 16 (visual polish) — UI Polish & Create-Flow — Grill Notes

**Status:** First batch built (uncommitted)
**Date:** 2026-07-05
**Method:** `/grill-with-docs`

## Context
Visual-polish + create-flow feedback from clicking through the freshly-built Home
(step 15a). The first slice of step 16 (the deferred visual-polish pass). Two items
are functional (the `+` create menu; the "New world" no-op bug) and couple to the
step-15 nav revamp; the rest are pure polish. No ADRs/glossary — nothing
architectural.

## Decisions
- **`+` create menu** (`create-menu.tsx`): stays a **smart router**, but each item
  now navigates *and* focuses the destination's inline form via `?create=<kind>`
  (fixes the dead "New world" — it was `<Link href="/">`). **Context-aware** items
  (Home → New world; in-world → New subject / New category / New world). **Filled
  icon-only** prominence (primary, distinct from the ghost `?`).
- **Starting-point control** (`worlds-list.tsx`): custom **styled radio dots**
  (accent fill when selected) — not a segmented control.
- **Dice**: custom monochrome **outline-die SVG** (`_components/dice-icon.tsx`,
  `currentColor`) replacing the 🎲 emoji. The app's first custom icon.
- **Guide panel** (`_components/guide-panel.tsx`): **polish + collapse advanced** —
  core sections (worlds/subjects/facts, @mentions, tags) upfront; power-user
  sections (schema, `!`, templates) behind a "Show advanced" toggle; dividers +
  tighter hierarchy. **Slide-in animation** added (mount off-screen → transition in;
  it previously mounted already-open), backdrop fade, ~300ms ease-out,
  `prefers-reduced-motion` honored.

## Focus wiring (`?create=`)
`CreateWorldForm` (Home, `world`), `CategoryManager` (world page, `category`),
`subjects-list` (category page, `subject`) each focus + scroll their add-input when
the param is present. The new-subject *surface* is finalized in 15b; for now it
focuses the existing category-page form.

## Still deferred in step 16
Site-wide visual style + tokens, dark/light theme, skeleton mascot, Date v2 / Color
swatch, onboarding *locational* copy, visual-ux-audit follow-ups.
