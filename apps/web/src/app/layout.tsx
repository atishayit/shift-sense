import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShiftSense",
  description: "Scheduling with solver",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white">
        <header className="sticky top-0 z-10 border-b border-neutral-800 bg-black/70 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 text-sm">
            <Link href="/" className="font-semibold mr-4">ShiftSense</Link>
            <Link href="/roster">Roster</Link>
            <Link href="/runs">Runs</Link>
            <Link href="/preset">Preset</Link>
            <Link href="/audit">Audit</Link>
            <Link href="/forecast">Forecast</Link>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
