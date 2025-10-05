import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ShiftSense",
  description: "Scheduling with CP-SAT",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <nav className="w-full px-4 py-3 border-b flex gap-4 text-sm">
          <a href="/" className="underline">Home</a>
          <a href="/roster" className="underline">Roster</a>
          <a href="/runs" className="underline">Runs</a>
          <a href="/preset" className="underline">Preset</a>
        </nav>
        {children}
      </body>
    </html>
  );
}
