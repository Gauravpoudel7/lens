import { Logo } from "@/components/landing/logo";
import { DISCLAIMER } from "@/content/landing/copy";
import { getLandingCopy } from "@/lib/landing-facts";
import { CHECK_HREF, PRO_HREF, RECORD_HREF, VERIFY_HREF } from "@/lib/landing-links";

export async function Footer() {
  const { copy, facts, xUrl } = await getLandingCopy();
  const columns = [
    {
      title: "Product",
      links: [
        { label: "Record", href: RECORD_HREF },
        { label: "Check a token", href: CHECK_HREF },
        { label: "Verify", href: VERIFY_HREF },
        { label: "Pro", href: PRO_HREF },
      ],
    },
    {
      title: "Resources",
      links: [
        { label: "How it works", href: "#how-it-works" },
        { label: "Pricing", href: "#pricing" },
      ],
    },
    {
      title: "Social",
      links: [
        { label: `X ${copy.HANDLE}`, href: xUrl },
        ...(facts.githubUrl ? [{ label: "GitHub", href: facts.githubUrl }] : []),
      ],
    },
  ];
  return (
    <footer className="border-t border-white/10 bg-canvas">
      <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6">
        <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Logo />
          </div>
          {columns.map((col) => (
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
