import type { Metadata } from "next";
import { Newsreader, Courier_Prime } from "next/font/google";
import "./globals.css";

/**
 * Newsreader — one variable serif with an optical-size axis, so display sizes
 * and 12px UI rows come from the same file. Italic is loaded because the style
 * guide uses italic+muted as the visual grammar for system text.
 *
 * Courier Prime — reserved for the field command. It is a *serifed* typewriter
 * face, so it satisfies "no sans-serif anywhere" (a sans mono like IBM Plex
 * Mono would not). Serif-vs-mono is what marks a command as a command.
 *
 * Both are self-hosted at build time by next/font: no CDN request, no layout
 * shift (automatic size-adjust fallback metrics).
 */
const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

const courierPrime = Courier_Prime({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-courier-prime",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Worldbuilding App",
  description: "A fast, minimal, fact-first worldbuilding tool.",
};

/**
 * Resolves the theme before first paint. Without this, the first paint uses the
 * default theme and then snaps once React reads localStorage — and "no flashes"
 * is a standing rule. It must stay inline and synchronous in <head>; deferring
 * it to a component defeats the entire point.
 *
 * The stored *preference* is `system | light | dark`, but the attribute is
 * always a resolved `light | dark`, so CSS never needs a media-query branch.
 */
const themeInit = `(function(){try{var p=localStorage.getItem("theme")||"system";var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){document.documentElement.setAttribute("data-theme","light")}})()`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: the script above intentionally mutates <html>
    // before React hydrates.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${newsreader.variable} ${courierPrime.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
