/**
 * Fact text model.
 *
 * A fact is PLAIN TEXT with inline `@{id}` markers for mentions — not JSONB, not
 * a segment object model. The id is the stable reference; the referenced
 * subject's name is NEVER stored in the fact and is resolved live at render time
 * (rename-safe). Markers may appear anywhere, any number of times.
 *
 *   Stored:   "Trained under @{a1b2} before meeting @{c3d4} in the south."
 *   Rendered: "Trained under Gandalf before meeting Elrond in the south."
 *
 * This module owns parsing, serializing, and tokenizing that format. Rendering
 * to React (resolving ids -> current names -> links) and keeping the
 * relationships table in sync live in lib/mentions.
 *
 * Pure, synchronous, no DB. Name resolution (id -> current name -> link) and the
 * relationships sync live in lib/mentions.
 *
 * AI hook point: contradiction detection (PRD §7.2) and fact->schema suggestion
 * (PRD §6.6, paid) would consume parsed facts here. NOT built in this phase.
 */

/**
 * The marker syntax embedded in stored fact text. `id` is a subject id. ANY
 * `@{…}` is a mention (no provenance, no escaping — a hand-typed marker that does
 * not resolve simply renders "unknown/deleted"). The capture group is non-greedy
 * by virtue of `[^}]+`, so adjacent markers (`@{a}@{b}`) split cleanly.
 */
export const MENTION_PATTERN = /@\{([^}]+)\}/g;

/** A parsed fact token: a run of literal text, or a mention referencing a subject. */
export type FactToken =
  | { type: "text"; value: string }
  | { type: "mention"; id: string };

/**
 * Split stored fact text into ordered text/mention tokens. Text runs between
 * markers are emitted verbatim; empty runs (e.g. between adjacent markers, or at
 * the string edges) are skipped so `serializeFact` round-trips exactly.
 */
export function parseFact(text: string): FactToken[] {
  const tokens: FactToken[] = [];
  let lastIndex = 0;
  // Fresh regex run: reset lastIndex since MENTION_PATTERN is a shared /g instance.
  MENTION_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MENTION_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    tokens.push({ type: "mention", id: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    tokens.push({ type: "text", value: text.slice(lastIndex) });
  }
  return tokens;
}

/** Rebuild stored fact text from tokens; inverse of `parseFact`. */
export function serializeFact(tokens: FactToken[]): string {
  return tokens
    .map((t) => (t.type === "text" ? t.value : `@{${t.id}}`))
    .join("");
}

/** Extract the distinct subject ids mentioned in a fact (drives relationships). */
export function mentionedIds(text: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  MENTION_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MENTION_PATTERN.exec(text)) !== null) {
    const id = match[1];
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}
