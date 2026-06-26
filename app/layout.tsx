import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Worldbuilding App",
  description: "A fast, minimal, fact-first worldbuilding tool.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
