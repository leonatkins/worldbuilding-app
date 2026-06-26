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
 * STATUS: stub — implemented in roadmap step 9 (Facts engine). Signatures below
 * are the intended interface; bodies are placeholders.
 *
 * AI hook point: contradiction detection (PRD §7.2) and fact->schema suggestion
 * (PRD §6.6, paid) would consume parsed facts here. NOT built in this phase.
 */

/** The marker syntax embedded in stored fact text. `id` is a subject id. */
export const MENTION_PATTERN = /@\{([^}]+)\}/g;

/** A parsed fact token: a run of literal text, or a mention referencing a subject. */
export type FactToken =
  | { type: "text"; value: string }
  | { type: "mention"; id: string };

/** Split stored fact text into ordered text/mention tokens. */
export function parseFact(_text: string): FactToken[] {
  throw new Error("not implemented: parseFact (roadmap step 9)");
}

/** Rebuild stored fact text from tokens. */
export function serializeFact(_tokens: FactToken[]): string {
  throw new Error("not implemented: serializeFact (roadmap step 9)");
}

/** Extract the distinct subject ids mentioned in a fact (drives relationships). */
export function mentionedIds(_text: string): string[] {
  throw new Error("not implemented: mentionedIds (roadmap step 9)");
}
