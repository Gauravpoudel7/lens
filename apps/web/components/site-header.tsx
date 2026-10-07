"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ApertureMark } from "@/components/logo";

const NAV = [
  { href: "/", label: "Record" },
  { href: "/check", label: "Check" },
  { href: "/verify", label: "Verify" },
  { href: "/pro", label: "Pro" },
  { href: "/account", label: "Account" },
];

function isCurrent(path: string, href: string): boolean {
  if (href === "/") return path === "/" || path.startsWith("/r/");
  return path === href || path.startsWith(`${href}/`);
}

export function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [path]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 text-ink">
          <ApertureMark />
          <span className="font-serif text-xl tracking-tight">Lens</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV.map((item) => {
            const current = isCurrent(path, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  current ? "text-ink underline decoration-accent decoration-2 underline-offset-8" : "text-muted hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2 md:hidden">
          <Link href="/check" className="rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink">
            Check
          </Link>
          <button
            type="button"
            className="rounded-md border border-line px-3 py-1.5 text-sm"
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </div>
      {open ? (
        <nav id="site-menu" className="border-t border-line px-4 py-3 md:hidden" aria-label="Primary">
          <ul className="space-y-1">
            {NAV.map((item) => {
              const current = isCurrent(path, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={`block rounded-md px-2 py-2 text-base ${current ? "text-ink" : "text-muted"}`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
