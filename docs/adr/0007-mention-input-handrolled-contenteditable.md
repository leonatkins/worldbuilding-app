# Mention input is a hand-rolled constrained `contentEditable`, not a rich-text library

**Status:** accepted

The `@mention` editor (step 9) is a hand-rolled, **constrained** `contentEditable`
div — not a rich-text library (Tiptap/Lexical/ProseMirror) and not a plain
`<textarea>`. It allows exactly two node kinds: plain text nodes and **atomic
mention chips** (`<span data-mention-id contentEditable={false}>` rendering the
subject's live name). No bold/italic/headings; `paste` is coerced to `text/plain`.
Serializing walks `childNodes` → text + `@{id}` (the [ADR 0001](0001-facts-as-plain-text-with-id-markers.md)
storage form); parsing does the inverse to rebuild chips.

## Context

A fact stores `@{id}` markers but must *show* the live subject name — both while
typing a new fact and while re-editing an existing one. A plain `<textarea>`
can't render a name in place of a raw id, so it can't carry mentions through an
edit. That forces a richer input than the step-8 textarea.

## Considered Options

- **Constrained `contentEditable`, hand-rolled (chosen):** atomic chips + text
  nodes, browser owns caret/selection/atomic-chip deletion, zero dependencies.
  Maps cleanly onto `lib/facts` (`parseFact`/`serializeFact`/`mentionedIds`).
  Cost: `contentEditable` cross-browser quirks (paste, IME composition, trailing
  `<br>`), bounded by disallowing all formatting.
- **Textarea + backdrop mirror (`react-mentions` style):** transparent textarea
  over a rendered layer with placeholder tokens. Rejected: caret/scroll-sync math
  is at least as fragile as `contentEditable`, for a worse editing model.
- **Rich-text library (Tiptap/Lexical):** robust, but a heavyweight dependency
  for what is text-plus-chips, against the hand-rolled, minimal grain of the
  codebase (everything to date is dependency-light). Rejected as overkill; it
  remains the escape hatch if the hand-rolled editor's quirks prove too costly.

## Consequences

- This is the most JS-heavy widget in the app; the step's risk concentrates in
  the `@`-detection-on-input, caret-anchored typeahead positioning, and paste
  sanitization. Kept tractable because the DOM is only ever a flat list of two
  node types, making serialize/parse total and trivial.
- Reversible at a cost: swapping to a library later means rewriting the editor
  component, but **not** the storage format (ADR 0001) or `lib/facts` — those are
  the stable contract the editor is built against.
- The draft-autosave (never-lose-typing) persists the *serialized* `@{id}` string
  to `localStorage`, not editor DOM, so drafts are library-agnostic and survive a
  reload with chips intact.
