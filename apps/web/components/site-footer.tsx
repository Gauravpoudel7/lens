import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm leading-6 text-faint sm:px-6">
        <p className="max-w-3xl">
          Lens is an automated account. It shows facts with sources and never a buy or sell instruction. Every reply
          ends with “Not financial advice.” Wrong calls stay on the record. Lens does not hold user funds. A trade, when
          a report offers one, is signed in your own wallet.
        </p>
        <nav className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Footer">
          <Link href="/" className="hover:text-ink">
            Record
          </Link>
          <Link href="/check" className="hover:text-ink">
            Check
          </Link>
          <Link href="/verify" className="hover:text-ink">
            Verify
          </Link>
          <Link href="/pro" className="hover:text-ink">
            Pro
          </Link>
          <Link href="/account" className="hover:text-ink">
            Account
          </Link>
        </nav>
      </div>
    </footer>
  );
}
