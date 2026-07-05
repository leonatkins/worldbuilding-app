# Worldbuilding App — Style Guide

The general look and feel to carry over from the to-do app, described qualitatively — no exact values, just the vibe and the rules behind it.

---

## Overall Vibe

Paper notebook / drafting-table aesthetic. Warm, literary, low-saturation. Should feel like a well-kept journal or ledger, not a slick SaaS product. Calm and unhurried, not flashy.

---

## Color Feel

- Warm, muted neutrals as the base — parchment/tan background, off-white surfaces, warm brown-toned text. Nothing stark black-and-white.
- One cool accent color (a dusty, muted blue) breaks up the warmth. It shows up rarely and only for interactive or active moments — never as a large background or block of color.
- A secondary, softer version of that same accent is used as a faint background tint for "selected/active" states — subtler than the accent itself.
- Dark mode is the same palette inverted: near-black backgrounds, warm light text, the same accent hue just brightened slightly so it still pops against the dark surface.
- Borders and dividers are always soft and low-contrast, never harsh black lines.

**Rule of thumb:** the accent color is a highlight, used sparingly, never a base color.

---

## Typography Feel

- Serif typeface throughout — this is the single biggest thing that makes it feel literary/notebook rather than modern app UI. No sans-serif anywhere.
- Structural labels (section headers, category-style labels) are small, uppercase, letter-spaced, and muted-colored — quiet and editorial, like a masthead, not loud.
- Meta/system text (hints, placeholders, empty states, small asides) is italic and muted-colored — clearly secondary to real content.
- Actual content text is upright, regular weight, full-contrast color, comfortable line spacing.

**Rule of thumb:** italic + muted = ambient/system text. Upright + full contrast = real content. Uppercase + tracked + muted = structural labels.

---

## Shape & Texture Feel

- Zero rounded corners anywhere — everything is sharp-edged and geometric.
- A faint grid/graph-paper texture sits behind everything, reinforcing the "paper" feeling.
- Shadows are hard-edged and offset (like a stamped sticker or cutout), not soft or blurry.
- Sections within the app (header, body, footer, etc.) are separated with thin hairline borders and a subtle surface-color change, not heavy dividers or big gaps.

**Rule of thumb:** sharp, flat, and thin — nothing soft, nothing rounded, nothing heavy.

---

## Interaction Feel

- Hover states quietly increase contrast — muted text/borders shift toward full strength, nothing flashy.
- Active/selected states get a soft background tint (the secondary accent), not solid color fill.
- Binary toggle states (like checkboxes) are the one place the full accent color shows up solid.
- Low-priority actions (like delete) stay invisible until you hover over their row — the resting state stays clean and uncluttered.
- All color/opacity changes transition smoothly and slowly — nothing snaps instantly, nothing bounces.

---

## Principles to Carry Forward

1. Serif type + warm paper tone + faint grid texture is the whole identity — everything else follows from that.
2. Accent color is rare and reserved for interactive moments only.
3. Sharp corners, thin borders, hard offset shadows — flat and geometric, never soft.
4. Italic/muted vs. upright/full-contrast is the visual language for system text vs. real content.
5. Dark mode is just an inverted version of the same palette and structure — not a redesign.

---

*Not covered here (design later, per-component): entity rows for World/Category/Subject/Fact, `@mention` reference chips, `!fieldname` inline command styling, and a longer-form prose style for Fact content.*
