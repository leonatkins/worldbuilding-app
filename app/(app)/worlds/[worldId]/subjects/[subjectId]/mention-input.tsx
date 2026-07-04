"use client";

/**
 * Constrained contentEditable mention input (ADR 0007). The DOM is only ever a
 * flat list of two node kinds: plain text nodes and atomic mention chips
 * (`<span data-mention-id contentEditable={false}>` showing the live name). No
 * formatting; paste is coerced to text/plain. Serializing walks childNodes into
 * the ADR 0001 storage form (text + `@{id}`); parsing rebuilds chips.
 *
 * React never manages the editable children — we populate once imperatively from
 * `initialTokens` and mutate the DOM directly thereafter, surfacing the serialized
 * string through `onChange`. This is the most JS-heavy widget in the app; the risk
 * is concentrated in @-detection, caret-anchored typeahead, and paste (ADR 0007).
 *
 * `fieldCommand` (step 11) layers a second, mutually-exclusive trigger onto the
 * same surface: `!` as the very first character opens a field-name typeahead
 * instead of a mention one. Domain logic (parsing a typed value per field type,
 * calling the write actions) lives in the caller's `onSubmit`/`onCreateField` —
 * this component only owns detection, the two popovers, and dispatch.
 */
import { useEffect, useRef, useState } from "react";
import { type FactToken } from "@/lib/facts";
import { searchSubjectsInWorld, searchSubjects } from "@/app/actions/subjects";
import type { ResolvedMention } from "@/lib/mentions";
import { fuzzyMatchFields, guessFieldType, FIELD_TYPE_LABELS } from "@/lib/schema-fields";
import type { SchemaField } from "../../categories/[categoryId]/schema-editor";

type Suggestion = { id: string; name: string; categoryName: string | null };

const chipClass =
  "mx-px rounded bg-neutral-100 px-1 font-semibold text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100";

export type GuessedFieldType = "Text" | "Number" | "Date" | "Boolean";

export type FieldCommand = {
  /** The subject being edited — excluded from Link/List value search results. */
  subjectId: string;
  /** The subject's category's fields — both filled and empty, name-matched. */
  fields: SchemaField[];
  /** Existing-field fill: `rawValue` is the typed text after `!fieldname `. */
  onSubmit: (field: SchemaField, rawValue: string) => Promise<{ error?: string }>;
  /** Unmatched-name confirm: type guessed from `rawValue` by the caller/UI. */
  onCreateField: (
    name: string,
    guessedType: GuessedFieldType,
    rawValue: string,
  ) => Promise<{ error?: string }>;
};

export function MentionInput({
  worldId,
  initialTokens,
  resolved,
  placeholder,
  autoFocus,
  fieldCommand,
  onChange,
  onEnter,
  onEscape,
}: {
  worldId: string;
  initialTokens: FactToken[];
  /** Live names for chips rebuilt from initialTokens (deleted/purged → fallback). */
  resolved: Record<string, ResolvedMention>;
  placeholder?: string;
  autoFocus?: boolean;
  /** Only passed by the fresh-fact composer (step 11) — never the edit surface. */
  fieldCommand?: FieldCommand;
  onChange: (serialized: string) => void;
  /** Enter with the typeahead closed — the composer/editor saves. */
  onEnter: () => void;
  onEscape?: () => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);

  // Mention (`@`) typeahead state.
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(0);
  const [caret, setCaret] = useState<{ left: number; top: number } | null>(null);
  // Where the `@` trigger sits, captured at detection so a pick can replace it.
  const trigger = useRef<{ node: Text; at: number; end: number } | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Field-command (`!`) typeahead + create-confirm state.
  const [fieldOpen, setFieldOpen] = useState(false);
  const [fieldResults, setFieldResults] = useState<SchemaField[]>([]);
  const [fieldActive, setFieldActive] = useState(0);
  const [fieldCaret, setFieldCaret] = useState<{ left: number; top: number } | null>(null);
  const [pendingCreate, setPendingCreate] = useState<{
    name: string;
    guessedType: GuessedFieldType;
    rawValue: string;
  } | null>(null);
  const [fieldError, setFieldError] = useState("");
  const [fieldPending, setFieldPending] = useState(false);
  // Whether the current line is a field command at all — drives the visual
  // treatment (monospace + tint + badge) that marks it as a command, not prose.
  const [fieldMode, setFieldMode] = useState(false);

  // Populate the editor once from the initial tokens.
  useEffect(() => {
    const root = editorRef.current;
    if (!root) return;
    root.replaceChildren();
    for (const t of initialTokens) {
      if (t.type === "text") root.appendChild(document.createTextNode(t.value));
      else root.appendChild(makeChip(t.id, resolved[t.id]?.name ?? "unknown"));
    }
    if (autoFocus) placeCaretAtEnd(root);
    // Initial tokens are a mount-time snapshot; we intentionally don't re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function emit() {
    const root = editorRef.current;
    if (root) onChange(serialize(root));
  }

  function closeTypeahead() {
    setOpen(false);
    setResults([]);
    setActive(0);
    trigger.current = null;
  }

  /**
   * Match `rest` (the field-command text after `!`) against a real field's
   * name as a prefix — field names may contain spaces ("Is Alive", "Eye
   * Color"), so the split can't just be "up to the first whitespace". Picks
   * the longest matching name when more than one is a prefix. `rawValue` is
   * whatever's left after the name, trimmed.
   */
  function findFieldByPrefix(rest: string): { field: SchemaField; rawValue: string } | null {
    if (!fieldCommand) return null;
    const lowerRest = rest.toLowerCase();
    let best: { field: SchemaField; rawValue: string } | null = null;
    for (const field of fieldCommand.fields) {
      const lowerName = field.name.toLowerCase();
      let rawValue: string | null = null;
      if (lowerRest === lowerName) rawValue = "";
      else if (lowerRest.startsWith(lowerName + " ") || lowerRest.startsWith(lowerName + "\t")) {
        rawValue = rest.slice(field.name.length).trim();
      }
      if (rawValue !== null && (!best || field.name.length > best.field.name.length)) {
        best = { field, rawValue };
      }
    }
    return best;
  }

  /**
   * When the current line is a field command (`!name value…`) whose name is
   * already locked in (a space was typed), resolve it to a real field — used
   * to decide whether/how a nested `@` in the value should search (step 11
   * §4). Returns null outside a field-command line, or while the name is
   * still being typed (no space yet — the field-name typeahead owns that).
   */
  function resolveLockedField(text: string): SchemaField | null {
    if (!fieldCommand || !text.startsWith("!")) return null;
    const rest = text.slice(1);
    const lowerRest = rest.toLowerCase();
    let best: SchemaField | null = null;
    for (const field of fieldCommand.fields) {
      const prefix = field.name.toLowerCase() + " ";
      if ((lowerRest.startsWith(prefix) || lowerRest.startsWith(field.name.toLowerCase() + "\t")) &&
        (!best || field.name.length > best.name.length)) {
        best = field;
      }
    }
    return best;
  }

  /** After any input, detect an active `@query` ending at the caret. */
  function detect() {
    const sel = window.getSelection();
    const root = editorRef.current;
    if (!sel || !sel.isCollapsed || !root || sel.rangeCount === 0) return closeTypeahead();
    const node = sel.anchorNode;
    if (!node || node.nodeType !== Node.TEXT_NODE || !root.contains(node)) return closeTypeahead();

    const textNode = node as Text;
    const offset = sel.anchorOffset;
    const before = (textNode.textContent ?? "").slice(0, offset);
    // `@` at a word boundary, then a run with no whitespace/@/braces, to the caret.
    const m = /(^|\s)@([^\s@{}]*)$/.exec(before);
    if (!m) return closeTypeahead();

    // Inside a field-command value, `@` only makes sense for a resolved
    // Link/List field — anywhere else in a `!` line it stays literal text.
    // Ordinary fact text (not a `!` line at all) is completely unaffected.
    const lineText = serialize(root);
    const isFieldLine = !!fieldCommand && lineText.startsWith("!");
    const locked = isFieldLine ? resolveLockedField(lineText) : null;
    if (isFieldLine && (!locked || (locked.type !== "Link" && locked.type !== "List"))) {
      return closeTypeahead();
    }

    const query = m[2];
    trigger.current = { node: textNode, at: offset - query.length - 1, end: offset };

    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setCaret({ left: rect.left, top: rect.bottom });
    setOpen(true);
    setActive(0);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      void runMentionSearch(locked, query).then(setResults);
    }, 150);
  }

  /** Category-scoped search inside a Link/List field-command value, else the plain world-wide mention search. */
  async function runMentionSearch(locked: SchemaField | null, query: string): Promise<Suggestion[]> {
    if (locked && fieldCommand) {
      const rows = await searchSubjects(locked.target_category_id ?? "", query, fieldCommand.subjectId);
      return rows.map((r) => ({ ...r, categoryName: null }));
    }
    return searchSubjectsInWorld(worldId, query);
  }

  function closeFieldTypeahead() {
    setFieldOpen(false);
    setFieldResults([]);
    setFieldActive(0);
  }

  /** Whether the line is a field command at all — recomputed on every input. */
  function updateFieldMode() {
    const root = editorRef.current;
    setFieldMode(!!fieldCommand && !!root && serialize(root).startsWith("!"));
  }

  /**
   * While the field name is still being typed (content is exactly `!query`,
   * caret at the end, no space yet), fuzzy-match it against the category's
   * fields. Closes the instant a space is typed — matching the `@` regex's
   * whitespace boundary (step 11 §3).
   */
  function detectField() {
    if (!fieldCommand) return closeFieldTypeahead();
    const root = editorRef.current;
    const sel = window.getSelection();
    if (!root || !sel || !sel.isCollapsed || sel.rangeCount === 0) return closeFieldTypeahead();
    const node = sel.anchorNode;
    if (!node || node.nodeType !== Node.TEXT_NODE || !root.contains(node)) return closeFieldTypeahead();
    if (node !== root.lastChild || sel.anchorOffset !== (node.textContent ?? "").length) {
      return closeFieldTypeahead();
    }

    const m = /^!([^\s!@{}]*)$/.exec(serialize(root));
    if (!m) return closeFieldTypeahead();

    setFieldResults(fuzzyMatchFields(fieldCommand.fields, m[1]));
    setFieldActive(0);
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setFieldCaret({ left: rect.left, top: rect.bottom });
    setFieldOpen(true);
  }

  function pick(s: Suggestion) {
    const t = trigger.current;
    const root = editorRef.current;
    if (!t || !root) return;
    const full = t.node.textContent ?? "";
    const after = full.slice(t.end);
    t.node.textContent = full.slice(0, t.at);

    const chip = makeChip(s.id, s.name);
    const tail = document.createTextNode(" " + after);
    t.node.parentNode?.insertBefore(chip, t.node.nextSibling);
    chip.parentNode?.insertBefore(tail, chip.nextSibling);

    // Caret just after the inserted space.
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.setStart(tail, 1);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    closeTypeahead();
    emit();
  }

  /** Rewrite the typed `!query` to the field's real name + a trailing space. */
  function pickField(field: SchemaField) {
    const root = editorRef.current;
    if (!root) return;
    root.replaceChildren(document.createTextNode(`!${field.name} `));
    placeCaretAtEnd(root);
    closeFieldTypeahead();
    setFieldMode(true);
    emit();
  }

  /** Whether the current line is a field-command line at all (gates Enter in onKeyDown). */
  function isFieldCommandLine(): boolean {
    const root = editorRef.current;
    return !!root && /^!\S/.test(serialize(root));
  }

  /** Clear the composer after a successful fill/create — never becomes a fact. */
  function clearLine() {
    const root = editorRef.current;
    if (!root) return;
    root.replaceChildren();
    closeFieldTypeahead();
    setPendingCreate(null);
    setFieldError("");
    setFieldMode(false);
    emit();
  }

  /** Enter-time resolution (step 11 §3/§4): exact name match fills, else offers to create. */
  async function resolveFieldCommand() {
    if (!fieldCommand || fieldPending) return;
    const root = editorRef.current;
    if (!root) return;
    const text = serialize(root);
    if (!text.startsWith("!")) return;
    const rest = text.slice(1);
    if (rest.trim() === "") return;

    const matched = findFieldByPrefix(rest);
    if (!matched) {
      // No real field's name is a prefix of what's typed — offer to create one,
      // using the first whitespace-bounded token as the new field's name.
      const m = /^(\S+)(?:\s+([\s\S]*))?$/.exec(rest);
      if (!m) return;
      const name = m[1];
      const rawValue = (m[2] ?? "").trim();
      setPendingCreate({ name, guessedType: guessFieldType(rawValue), rawValue });
      return;
    }

    setFieldPending(true);
    setFieldError("");
    const result = await fieldCommand.onSubmit(matched.field, matched.rawValue);
    setFieldPending(false);
    if (result.error) setFieldError(result.error);
    else clearLine();
  }

  async function confirmCreate() {
    if (!fieldCommand || !pendingCreate || fieldPending) return;
    setFieldPending(true);
    setFieldError("");
    const result = await fieldCommand.onCreateField(
      pendingCreate.name,
      pendingCreate.guessedType,
      pendingCreate.rawValue,
    );
    setFieldPending(false);
    if (result.error) setFieldError(result.error);
    else clearLine();
  }

  function cancelCreate() {
    setPendingCreate(null);
    setFieldError("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        // Capture Enter so picking never triggers the composer's save-on-Enter.
        e.preventDefault();
        e.stopPropagation();
        if (results[active]) pick(results[active]);
        else closeTypeahead();
        return;
      }
      if (e.key === "Escape" || e.key === " ") {
        // Dismiss to literal `@query`; space still types through.
        closeTypeahead();
        if (e.key === "Escape") e.preventDefault();
        return;
      }
      return;
    }

    if (fieldCommand) {
      if (pendingCreate) {
        if (e.key === "Enter") {
          e.preventDefault();
          void confirmCreate();
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          cancelCreate();
          return;
        }
      }

      if (fieldOpen) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setFieldActive((i) => Math.min(i + 1, Math.max(fieldResults.length - 1, 0)));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setFieldActive((i) => Math.max(i - 1, 0));
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          closeFieldTypeahead();
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          if (fieldResults[fieldActive]) {
            e.preventDefault();
            pickField(fieldResults[fieldActive]);
            return;
          }
          // No result to pick — fall through to full-line resolution below.
        }
      }

      // Enter on a `!`-prefixed line resolves/creates instead of saving a fact.
      if (e.key === "Enter" && !e.shiftKey && isFieldCommandLine()) {
        e.preventDefault();
        void resolveFieldCommand();
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onEnter();
      return;
    }
    if (e.key === "Escape") {
      onEscape?.();
      return;
    }
  }

  return (
    <div className="relative">
      {fieldCommand && pendingCreate && (
        <div className="mb-1.5 flex items-center gap-2 rounded-md border border-neutral-300 bg-neutral-50 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900">
          <span>
            Create <span className="font-semibold">&quot;{pendingCreate.name}&quot;</span> ·{" "}
            {pendingCreate.guessedType}
          </span>
          <span className="ml-auto flex items-center gap-2 text-xs text-neutral-400">
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => void confirmCreate()} className="hover:text-neutral-900 dark:hover:text-neutral-100">
              ↵ confirm
            </button>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={cancelCreate} className="hover:text-neutral-900 dark:hover:text-neutral-100">
              esc cancel
            </button>
          </span>
        </div>
      )}

      <div className="relative">
        <div
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          aria-label={placeholder}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onInput={() => {
            emit();
            detect();
            detectField();
            updateFieldMode();
            if (fieldCommand) {
              setPendingCreate(null);
              setFieldError("");
            }
          }}
          onKeyDown={onKeyDown}
          onPaste={(e) => {
            // Coerce to text/plain — no formatting ever enters the editor.
            e.preventDefault();
            const text = e.clipboardData.getData("text/plain");
            document.execCommand("insertText", false, text);
          }}
          onBlur={() => {
            closeTypeahead();
            closeFieldTypeahead();
          }}
          className={`min-h-[3.5rem] w-full whitespace-pre-wrap rounded-md border px-3 py-2 text-sm outline-none transition empty:before:text-neutral-400 empty:before:content-[attr(data-placeholder)] ${
            fieldMode
              ? "border-neutral-400 bg-neutral-50 pr-16 font-mono dark:border-neutral-500 dark:bg-neutral-950"
              : "border-neutral-300 bg-white focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-100"
          }`}
        />
        {fieldMode && !pendingCreate && (
          <span className="pointer-events-none absolute right-2 top-2 rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
            Field
          </span>
        )}
      </div>

      {fieldCommand && fieldError && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldError}</p>
      )}

      {fieldOpen && fieldCaret && (
        <ul
          role="listbox"
          aria-label="Field suggestions"
          style={{ left: fieldCaret.left, top: fieldCaret.top + 4 }}
          className="fixed z-40 max-h-56 w-64 overflow-y-auto rounded-md border border-neutral-200 bg-white py-1 text-sm shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
        >
          {fieldResults.length === 0 ? (
            <li className="px-3 py-1.5 text-neutral-400">No matches</li>
          ) : (
            fieldResults.map((f, i) => (
              <li key={f.id} role="option" aria-selected={i === fieldActive}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickField(f);
                  }}
                  onMouseEnter={() => setFieldActive(i)}
                  className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left transition ${
                    i === fieldActive ? "bg-neutral-100 dark:bg-neutral-800" : ""
                  }`}
                >
                  <span className="truncate text-neutral-800 dark:text-neutral-100">{f.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-neutral-400">
                    {FIELD_TYPE_LABELS[f.type]}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}

      {open && caret && (
        <ul
          role="listbox"
          aria-label="Mention suggestions"
          style={{ left: caret.left, top: caret.top + 4 }}
          className="fixed z-40 max-h-56 w-64 overflow-y-auto rounded-md border border-neutral-200 bg-white py-1 text-sm shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
        >
          {results.length === 0 ? (
            <li className="px-3 py-1.5 text-neutral-400">No matches</li>
          ) : (
            results.map((r, i) => (
              <li key={r.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  // Use mousedown so the pick fires before the editor's blur.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(r);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left transition ${
                    i === active ? "bg-neutral-100 dark:bg-neutral-800" : ""
                  }`}
                >
                  <span className="truncate text-neutral-800 dark:text-neutral-100">{r.name}</span>
                  {r.categoryName && (
                    <span className="ml-auto shrink-0 text-xs text-neutral-400">{r.categoryName}</span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

/** Build an atomic, non-editable mention chip carrying the subject id. */
function makeChip(id: string, name: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.dataset.mentionId = id;
  span.contentEditable = "false";
  span.className = chipClass;
  span.textContent = name;
  return span;
}

/** Walk the editor DOM into ADR 0001 storage form (text + `@{id}`). */
function serialize(root: HTMLElement): string {
  let out = "";
  root.childNodes.forEach((node) => {
    const isBlock =
      node.nodeType === Node.ELEMENT_NODE &&
      /^(DIV|P)$/.test((node as HTMLElement).tagName) &&
      !(node as HTMLElement).dataset.mentionId;
    if (isBlock && out !== "" && !out.endsWith("\n")) out += "\n";
    out += serializeNode(node);
  });
  return out.replace(/\n+$/, "");
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  if (el.dataset.mentionId) return `@{${el.dataset.mentionId}}`;
  if (el.tagName === "BR") return "\n";
  let inner = "";
  el.childNodes.forEach((c) => {
    inner += serializeNode(c);
  });
  return inner;
}

function placeCaretAtEnd(root: HTMLElement) {
  root.focus();
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}
