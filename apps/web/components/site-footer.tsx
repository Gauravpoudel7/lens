import Link from "next/link";
import { NAV } from "@/lib/nav";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-base leading-7 text-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>Facts with sources. Not financial advice. Lens never holds your funds.</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Footer">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-ink">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
