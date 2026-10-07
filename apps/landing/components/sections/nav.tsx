"use client";

import { useRef, useState } from "react";
import { m, useMotionValueEvent, useScroll } from "framer-motion";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/logo";
import { HANDLE, NAV_LINKS } from "@/content/copy";
import { X_URL, appUrl } from "@/lib/site";
import { cn } from "@/lib/utils";

export function Nav() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // The sheet locks page scroll while open, so anchor jumps wait until it has closed.
  const pendingHash = useRef<string | null>(null);

  function onMenuLink(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    e.preventDefault();
    pendingHash.current = href;
    setMenuOpen(false);
  }
  function onMenuClosed(e: Event) {
    const href = pendingHash.current;
    if (!href) return;
    e.preventDefault();
    pendingHash.current = null;
    document.querySelector(href)?.scrollIntoView();
    history.replaceState(null, "", href);
  }

  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setScrolled(y > 12);
    setHidden(y > 400 && y > prev);
  });

  return (
    <m.header
      animate={{ y: hidden ? "-110%" : "0%" }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color] duration-300",
        scrolled ? "border-white/10 bg-canvas/70 backdrop-blur-xl" : "border-transparent bg-transparent",
      )}
    >
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-6 px-4 sm:px-6">
        <a href="#top" className="rounded-md" aria-label="Lens, back to top">
          <Logo />
        </a>
        <ul className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="rounded-full px-3.5 py-2 text-sm text-body transition-colors hover:bg-white/[0.05] hover:text-ink"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" size="sm">
            <a href={appUrl()}>View the record</a>
          </Button>
          <Button asChild size="sm">
            <a href={X_URL} target="_blank" rel="noreferrer">
              Follow {HANDLE}
            </a>
          </Button>
        </div>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
              <Menu className="size-5" aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent onCloseAutoFocus={onMenuClosed}>
            <SheetTitle className="pt-2">
              <Logo />
            </SheetTitle>
            <ul className="flex flex-col">
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    onClick={(e) => onMenuLink(e, l.href)}
                    className="flex min-h-12 items-center border-b border-white/5 text-lg text-ink"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-auto flex flex-col gap-3">
              <Button asChild variant="outline">
                <a href={appUrl()}>View the record</a>
              </Button>
              <Button asChild>
                <a href={X_URL} target="_blank" rel="noreferrer">
                  Follow {HANDLE}
                </a>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </m.header>
  );
}
