/**
 * Monochrome outline die (step-16 polish) — replaces the 🎲 emoji on the
 * random-name button. Drawn in `currentColor` (outline stroke + filled pips) so
 * it adapts to text color, theme, and hover. Shows a 5-pip face. The app's first
 * custom icon; keep it self-contained.
 */
export function DiceIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      aria-hidden="true"
    >
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      {/* 5-pip face: four corners + center, filled */}
      {[
        [8, 8],
        [16, 8],
        [12, 12],
        [8, 16],
        [16, 16],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.35" fill="currentColor" stroke="none" />
      ))}
    </svg>
  );
}
