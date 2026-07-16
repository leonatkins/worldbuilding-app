/**
 * Panel-surface audit (step 16a). Run: `npm run audit:panels`
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 * The app draws a faint graph-paper grid behind EVERYTHING (see `body` in
 * app/globals.css). That makes one rule non-negotiable:
 *
 *      ANY BOX-BORDERED CONTAINER MUST HAVE AN OPAQUE BACKGROUND.
 *
 * Panels are sheets laid ON the paper — not windows onto it. A panel with a
 * border but no background lets the grid show straight through, which reads as
 * a missing background.
 *
 * This bug is invisible until the texture exists. The app shipped ~26 of them,
 * because while the page background was flat white a transparent panel on white
 * simply looks white. The style guide asked for this all along — "sections are
 * separated with thin hairline borders AND a subtle surface-color change" — the
 * surface change was just never implemented.
 *
 * ── THE DISTINCTION ──────────────────────────────────────────────────────────
 *   box border   (`border`)                -> a panel  -> needs bg-surface-raised
 *   edge border  (`border-b`, `border-t`…) -> a divider -> correctly transparent
 *
 * Exempt: `border-dashed` empty states (bare paper is the point), and elements
 * that paint their own fill (the Color swatch's inline style, native
 * <input type="color">) — a surface token would be wrong on those.
 */
import { readFileSync, globSync } from "node:fs";

const SKIP_SNIPPETS = [
  "inline-block h-4 w-4 rounded-full border border-neutral-300", // Color swatch: inline backgroundColor
  "h-9 w-12 rounded border border-neutral-300", // native <input type="color">
];

const offenders = [];

for (const file of globSync("app/**/*.tsx")) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      const chunks = [...line.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)]
        .map((m) => m[1] ?? m[2])
        .filter(Boolean);

      for (const cls of chunks) {
        if (SKIP_SNIPPETS.some((s) => cls.includes(s))) continue;
        const tokens = cls.split(/\s+/);
        const hasBoxBorder = tokens.some((t) => /^(hover:|focus:|dark:)?border$/.test(t));
        const hasBg = tokens.some((t) => /^(hover:|focus:|dark:)?bg-/.test(t));
        if (hasBoxBorder && !hasBg && !tokens.includes("border-dashed")) {
          offenders.push(`${file}:${i + 1}\n    ${cls.slice(0, 100)}`);
        }
      }
    });
}

if (offenders.length > 0) {
  console.error(
    `\n✗ ${offenders.length} bordered panel(s) with no background — the grid texture will show through:\n`
  );
  for (const o of offenders) console.error(`  ${o}\n`);
  console.error("  Fix: add `bg-surface-raised`. See the header of this file for why.\n");
  process.exit(1);
}

console.log("✓ every bordered panel has an opaque surface");
