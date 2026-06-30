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
 */
import { useEffect, useRef, useState } from "react";
import { type FactToken } from "@/lib/facts";
import { searchSubjectsInWorld } from "@/app/actions/subjects";
import type { ResolvedMention } from "@/lib/mentions";

type Suggestion = { id: string; name: string; categoryName: string | null };

const chipClass =
  "mx-px rounded bg-neutral-100 px-1 font-semibold text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100";

export function MentionInput({
  worldId,
  initialTokens,
  resolved,
  placeholder,
  autoFocus,
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
  onChange: (serialized: string) => void;
  /** Enter with the typeahead closed — the composer/editor saves. */
  onEnter: () => void;
  onEscape?: () => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);

  // Typeahead state.
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(0);
  const [caret, setCaret] = useState<{ left: number; top: number } | null>(null);
  // Where the `@` trigger sits, captured at detection so a pick can replace it.
  const trigger = useRef<{ node: Text; at: number; end: number } | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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

    const query = m[2];
    trigger.current = { node: textNode, at: offset - query.length - 1, end: offset };

    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setCaret({ left: rect.left, top: rect.bottom });
    setOpen(true);
    setActive(0);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      void searchSubjectsInWorld(worldId, query).then(setResults);
    }, 150);
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
    } else {
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
  }

  return (
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
        }}
        onKeyDown={onKeyDown}
        onPaste={(e) => {
          // Coerce to text/plain — no formatting ever enters the editor.
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
        }}
        onBlur={closeTypeahead}
        className="min-h-[3.5rem] w-full whitespace-pre-wrap rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition empty:before:text-neutral-400 empty:before:content-[attr(data-placeholder)] focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-100"
      />

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
