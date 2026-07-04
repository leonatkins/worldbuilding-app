# Visual / UX Audit — 2026-07-04

Full click-through of every page (world list, world/categories, category/schema
editor, subject page, facts + field command + mentions, backlink select, auth)
in light + dark mode, plus a mobile (390px) pass. Screenshots taken with
Playwright against the live dev server (`Claude QA World`); not committed
(`.playwright-mcp/` is gitignored).

Reference point supplied by the user, used as the bar for "needs visual
treatment": *the `!command` text typed as a field-command value should read as
a command, not as plain prose.*

**Update — same day:** all nine findings below were addressed (code fix,
investigate-and-correct, or evaluated-as-non-issue — see the **Status** line
on each) and re-verified live in the browser, light/dark/mobile as relevant.
`tsc`, `eslint`, `vitest` (68 tests), and `next build` all pass. See
[`docs/visual-styles-2026-07-04.md`](visual-styles-2026-07-04.md) for the
follow-up: candidate future site-wide visual styles, since several of these
findings (notably #1 and #2) are really "the current style is a placeholder"
symptoms.

## Findings

### 1. Field-command text has no visual treatment at all — flagship issue
While typing a field command (`!Is Alive yes`, `!Birthday 4/27/1304`), the
entire line renders as completely plain text — same font, weight, and color
as a normal fact. There is no box, chip, monospace, or color to mark it as a
command instead of prose, even though:
- A resolved `@mention` gets a distinct treatment (bold, real link).
- The create-new-field confirm banner that appears on Enter *is* nicely
  styled (`Create "Birthday" · Date` with `↵ confirm` / `esc cancel` hints).

Only the in-between state — the moment the user is actually typing the
command — looks identical to a fact. This is the exact gap flagged before
starting the audit. Suggest wrapping the leading `!FieldName` token (or the
whole line, while recognized as a field command) in a pill/monospace/tinted
background so it's visually obvious before Enter is even pressed.

*Files: `mention-input.tsx` (field-command detection/render path).*

**Status: Fixed.** The whole line now switches to a monospace font with a
tinted background/border while it's recognized as a field command (tracked
via a new `fieldMode` state, recomputed on every keystroke), plus a small
non-interactive "FIELD" badge in the corner of the box (hidden while the
create-confirm banner is showing, to avoid saying the same thing twice).
Verified in light + dark, through both the fill-existing-field and
create-new-field paths, and confirmed ordinary `@`-mention facts are
untouched (no font/background change, no badge).

### 2. Signup page has a different visual identity than the rest of the app
`/signup` is a bold split-screen page: indigo/purple gradient brand panel,
pull quote, tagline, "Free tier" copy, indigo accent button. Every other
screen in the app — including `/login`, which is the same auth family — is
strict black/white/gray with zero color accents. Landing on signup feels
like a different, unfinished, or mismatched product. Decide once: either
bring the brand panel to `/login` too, or drop it from `/signup` to match the
app's minimal language; either way, decide if indigo is "the" accent color
worth reusing elsewhere (primary buttons, active states) or a one-off.

*Files: `app/(marketing)/signup/*`, `app/(marketing)/login/*`.*

**Status: Corrected, not a bug — no change made.** `login/page.tsx` carries an
explicit comment: *"Sign-in. Minimal, single-column, centered — deliberately
calm and sparse. Sign-up (/signup) uses a contrasting split-screen layout by
design."* This audit's original framing (an accidental inconsistency) was
wrong — it's a deliberate acquisition-vs-utility contrast, a legitimate and
common pattern. Leaving both pages as they are; see the visual-styles doc for
whether a future unified style keeps or drops this contrast on purpose.

### 3. Grammar bug: "every characters shares"
Category page and schema-edit page both read: *"Schema fields are the
structured, queryable facts every **characters shares**."* The template
lower-cases the category name directly into "every {name} shares" — broken
subject/verb agreement for every category, since names are normally plural
(Characters, Locations, Factions…). Same string is duplicated in two files.

*Files: `categories/[categoryId]/page.tsx:99`, `categories/[categoryId]/schema/page.tsx:72`.*

**Status: Fixed.** Reworded to *"Schema fields are the structured, queryable
facts every subject in this category shares"* — grammatically correct
regardless of the category's name/plurality, in both files. Also fixed the
breadcrumb icon spacing on the schema page while in there (see #9 — same
file, same edit).

### 4. "Sign out" wraps to two lines on mobile
At 390px width (iPhone-class), the header's account cluster (world switcher,
"+", email, Sign out) has no wrap strategy. The email is hidden responsively,
but "Sign out" isn't, and breaks into `Sign` / `out` on its own two lines on
every page. Add `whitespace-nowrap`, or collapse the account cluster into a
menu below some breakpoint.

**Status: Fixed.** Added `whitespace-nowrap` + `shrink-0` to the Sign out
button/form and the right-hand account cluster in `app/(app)/layout.tsx` —
the world switcher (which already truncates) absorbs the squeeze instead.
Verified at 390px on both the world list and a subject page.

### 5. Failed login clears both fields, not just the password
Submitting a wrong password shows a clear red "Invalid login credentials"
message, but both the email and password inputs come back empty — the user
has to retype their email too. Preserve the submitted email value (or handle
the error client-side) and only clear the password.

*Files: `app/(marketing)/login/login-form.tsx`.*

**Status: Fixed.** Root cause: React 19 resets *uncontrolled* form fields
after every form-action submission, success or failure — not a bug in this
app's error handling specifically. Made the email input controlled (local
`useState`, synced via `onChange`); left the password field uncontrolled,
matching the common (and more secure) convention of not re-populating a
password after a failed attempt. Verified: email now survives a wrong
password; the field clears only on a fresh page load.

### 6. Multiple schema-field editors can be open simultaneously
On the category "Edit schema" page, clicking **Edit** on several fields in a
row opens all of their inline editors at once (no accordion / mutual
exclusion) — e.g. "Is Alive" and "Traits" editing forms stacked, both fully
expanded, drag handles gone. Not broken, but likely unintended and easy to
end up in a cluttered, "wait, what am I saving" state.

*Files: `categories/[categoryId]/schema/page.tsx` (or its client field-editor
component).*

**Status: Fixed.** Lifted the "which field is open" state from each row's
local `useState` up to the parent `SchemaEditor` as a single `editingId`
(plus the existing `adding` flag) — opening one field's editor, or "+ Add
field", now closes whichever other one was open. Verified: opening "Is
Alive" then "Traits" collapses "Is Alive" back to its summary row.

### 7. Field-command / mention dropdown can overlap the Save/Draft row
The typeahead popover (for both `!field` and `@mention`) opens directly under
the composer textbox, close enough to sit on top of the "Save fact" /
"Draft saved" row beneath it. Minor, but worth a look at the popover's
offset or z-index/spacing once the composer has multiple lines.

**Status: Evaluated — no change made.** On a second look this is standard
floating-overlay behavior: the popover has a solid background and `shadow-lg`,
so it clearly reads as "on top of" the button beneath it, the same way every
autocomplete dropdown (Slack, Linear, GitHub, …) overlaps whatever's below the
input. Re-anchoring it to the box's bottom edge instead of the caret would
risk breaking multi-line positioning for comparatively little benefit.

### 8. Mention links have no at-rest visual affordance
An inline `@mention` (e.g. "See **Ronald** often on the road.") renders as
plain bold black text — it's a real link (confirmed via DOM), but nothing
signals that at rest; an underline only appears on hover. Since mentions are
the primary way of navigating between subjects, a subtle persistent color or
underline would make them more discoverable at a glance.

**Status: Fixed.** Mentions now carry a persistent light underline
(`decoration-neutral-300` / `dark:decoration-neutral-600`) that darkens to
solid on hover — reads as "linkable" at rest without introducing a new
color, consistent with the app's monochrome language. Verified in both
themes.

### 9. Breadcrumb icon spacing inconsistent with page-header spacing
On the schema-edit page, the breadcrumb reads "← 🧑Characters" (icon glued to
text, no gap) while the `<h1>` on the same page reads "🧑 Characters" (proper
gap). Small polish nit, same icon+name pattern rendered two different ways.

**Status: Fixed.** Breadcrumb now uses `inline-flex items-center gap-2`, same
as the `<h1>` on the subject/category pages — verified the gap now matches.

## Notes / things that already work well
- **Dark mode** is thorough and consistent everywhere checked, auth pages
  included — no unstyled/broken dark-mode screens found.
- **Backlink select → promote** (step 10) is clean: checkbox mode, "Done" to
  exit, no surprises.
- **Empty-state handling** is consistent — "Referenced by," "Fields," etc.
  disappear entirely when empty rather than showing awkward placeholders.
- **Suggested-category chips** (🌲 Biomes, 📅 Events, …) create a category in
  one click, no confirm dialog needed, and disappear from the suggestion row
  once added — good zero-friction pattern.
- **Color field** uses the native OS swatch picker — simple and functional.
- Mobile reflow is otherwise solid: sidebar panels stack correctly under
  main content, forms and pill rows wrap cleanly.

## Housekeeping
While testing the suggested-category chips on **Claude QA World**, a
**"✨ Deities" category** was created (confirms the one-click-add feature
works) and left in place — deleting it was blocked by the sandbox's
destructive-action guard since this was meant to be a read-only audit.
Remove it manually if you don't want it, or ask me to in a follow-up.
