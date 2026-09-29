import type { Metadata } from "next";
import { Newsreader, Public_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const sans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const serif = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: {
    default: "Lens public record",
    template: "%s · Lens",
  },
  description:
    "Lens is the Solana risk bot @askLens. Every reply is hashed before it is posted, and the full record stays public.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${serif.variable} antialiased`}>
        <div className="mx-auto min-h-screen max-w-5xl px-4 pb-16 sm:px-6">
          <header className="flex flex-wrap items-end justify-between gap-4 border-b border-ink py-5">
            <div>
              <Link href="/" className="font-serif text-4xl leading-none tracking-tight">
                Lens
              </Link>
              <p className="mt-1 text-sm text-muted">The analyst that can&apos;t edit its record.</p>
            </div>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/" className="hover:underline">
                Record
              </Link>
              <Link href="/check" className="hover:underline">
                Run a check
              </Link>
              <Link href="/verify" className="hover:underline">
                Verify
              </Link>
            </nav>
          </header>
          {children}
          <footer className="mt-16 border-t border-line pt-4 text-xs leading-5 text-muted">
            Lens is an automated account. It shows facts with sources, never a buy or sell instruction,
            and every reply ends with “Not financial advice.” Wrong calls stay on this page.
          </footer>
        </div>
      </body>
    </html>
  );
}
