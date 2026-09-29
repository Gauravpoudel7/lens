import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const HERO =
  "Tag @askLens on X under any Solana coin and get an instant, provable risk check";

export const metadata: Metadata = {
  title: {
    default: "Lens",
    template: "%s · Lens",
  },
  description: HERO,
  openGraph: {
    title: "Lens",
    description: HERO,
    siteName: "Lens",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lens",
    description: HERO,
  },
};

const NAV = [
  { href: "/", label: "Record" },
  { href: "/check", label: "Run a check" },
  { href: "/verify", label: "Verify" },
  { href: "/pro", label: "Pro" },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} antialiased`}>
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07080d]/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-2.5">
              {/* Public mark, same geometry as the favicon. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mark.svg" alt="" width={32} height={32} className="size-8" />
              <span className="text-lg font-semibold tracking-tight">Lens</span>
            </Link>
            <nav className="flex flex-wrap items-center gap-1 text-sm text-zinc-300">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full px-3 py-1.5 hover:bg-white/5 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <div className="mx-auto min-h-[calc(100vh-8rem)] max-w-6xl px-4 pb-16 sm:px-6">{children}</div>
        <footer className="border-t border-white/10">
          <div className="mx-auto max-w-6xl px-4 py-6 text-xs leading-5 text-zinc-500 sm:px-6">
            Lens is an automated account. It shows facts with sources, never a buy or sell instruction, and every
            reply ends with “Not financial advice.” Wrong calls stay on this page.
          </div>
        </footer>
      </body>
    </html>
  );
}
