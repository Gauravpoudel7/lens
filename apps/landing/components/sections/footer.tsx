import { Logo } from "@/components/logo";
import { DISCLAIMER, HANDLE } from "@/content/copy";
import { X_URL, appUrl } from "@/lib/site";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Record", href: appUrl() },
      { label: "Check a token", href: appUrl("/check") },
      { label: "Verify", href: appUrl("/verify") },
      { label: "Pro", href: appUrl("/pro") },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Docs", href: "#" }, // TODO: docs URL
    ],
  },
  {
    title: "Social",
    links: [
      { label: `X ${HANDLE}`, href: X_URL },
      { label: "GitHub", href: "#" }, // TODO: public repo URL
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-canvas">
      <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6">
        <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Logo />
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="text-sm font-medium text-ink">{col.title}</h2>
              <ul className="mt-4 space-y-1">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="inline-flex min-h-10 items-center text-sm text-body transition-colors hover:text-ink">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className="mt-14 max-w-[80ch] text-sm leading-relaxed text-faint">{DISCLAIMER}</p>
        <div className="mt-8 flex flex-wrap justify-between gap-4 border-t border-white/10 pt-8 text-sm text-faint">
          <span>© 2026 Lens</span>
          <span>Built on Solana for the Colosseum hackathon.</span>
        </div>
      </div>
    </footer>
  );
}
